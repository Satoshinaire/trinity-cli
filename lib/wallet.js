'use strict'

const pkg = require('../package.json')
const Configstore = require('configstore')
const defaultConfig = require('../defaultConfig')
const neonjs = require('neon-js')
const chalk = require('chalk')
const Promise = require('bluebird')
const asTable = require('as-table').configure({
  title: x => chalk.bold.green(x),
  delimiter: chalk.dim.green(' | '),
  dash: chalk.dim.green('-'),
  print: obj => (typeof obj === 'boolean') ? (obj ? 'Yes' : 'No') : String(obj)
})
const winston = require('winston')
const network = require('./network')
const ledgerComms = require('../vendor/ledger/ledger-comm-node')
const ledgerWallet = require('../vendor/ledger/ledgerNanoS')
const BIP44_PATH = require('../vendor/constants').BIP44_PATH

const g = require('./global')

const conf = new Configstore(pkg.name, defaultConfig)
const rpc_node = (network.get() == 'MainNet' ? neonjs.CONST.DEFAULT_RPC.MAIN : neonjs.CONST.DEFAULT_RPC.TEST)

function walletCreate(self, args, cb) {
  self.prompt([
    {
      type: 'input',
      name: 'label',
      message: chalk.green('? Give this address a label [optional] : ')
    },
    {
      type: 'password',
      name: 'passphrase',
      message: chalk.green('? Provide a passphrase : ')
    },
    {
      type: 'password',
      name: 'passphrase2',
      message: chalk.green('? Confirm your passphrase : ')
    }
  ], function (inputs) {
    if (inputs.passphrase.length <= 4) {
      self.log(chalk.green(' Passphrase must be longer than 4 characters.'))
      winston.log('debug', 'Address creation failed. Passphrase less than 5 characters.')
      cb()
    } else if (inputs.passphrase !== inputs.passphrase2) {
      self.log(chalk.green(' Passphrase and confirmation don\'t match.'))
      winston.log('debug', 'Address creation failed. Passphrases didn\'t match.')
      cb()
    } else {
      let newPrivateKey = neonjs.wallet.generatePrivateKey()
      let newWif = neonjs.wallet.getWIFFromPrivateKey(newPrivateKey)
      encryptKey(self, newWif, inputs)
        .then((outputs) => {
          winston.log('info', 'Address creation succeeded.', {
            metadata: outputs
          })
          cb()
        })
        .catch((err) => {
          winston.log('error', 'Address creation error.', {
            metadata: err
          })
          cb()
        })
    }
  })
}

function walletImport(self, args, cb) {
  self.prompt([
    {
      type: 'password',
      name: 'existingWif',
      message: chalk.green(' Enter your existing private key in WIF format : ')
    },
    {
      type: 'input',
      name: 'label',
      message: chalk.green('? Give this address a label [optional] : ')
    },
    {
      type: 'password',
      name: 'passphrase',
      message: chalk.green('? Provide a passphrase : ')
    },
    {
      type: 'password',
      name: 'passphrase2',
      message: chalk.green('? Confirm your passphrase : ')
    }
  ], function (inputs) {
    if (inputs.existingWif.toString().length != 52) {
      self.log(chalk.green(' Please provide a valid private key in WIF format.'))
      winston.log('debug', 'Address import failed. Private key provided was not a valid WIF format.')
      cb()
    } else if (inputs.passphrase.length <= 4) {
      self.log(chalk.green(' Passphrase must be longer than 4 characters.'))
      winston.log('debug', 'Address import failed. Passphrase less than 5 characters.')
      cb()
    } else if (inputs.passphrase !== inputs.passphrase2) {
      self.log(chalk.green(' Passphrase and confirmation don\'t match.'))
      winston.log('debug', 'Address import failed. Passphrases didn\'t match.')
      cb()
    } else {
      encryptKey(self, inputs.existingWif.toString(), inputs)
        .then((outputs) => {
          winston.log('info', 'Address import succeeded.', {
            metadata: outputs
          })
          cb()
        })
        .catch((err) => {
          winston.log('error', 'Address creation error.', {
            metadata: err
          })
          cb()
        })
    }
  })
}

function checkForLedger(self) {
  return new Promise((resolve, reject) => {
    ledgerComms.list_async()
      .then((devices) => {
        if (devices.length > 0) {
          resolve(devices)
        } else {
          reject(devices)
        }
      })
      .catch((err) => {
        self.log(err)
        reject(err)
      })
  })
}

/* TEMP */
function getPublicKeyEncoded(publicKey) {
  let publicKeyArray = neonjs.u.hexstring2ab(publicKey)
  if (publicKeyArray[64] % 2 === 1) {
    return '03' + neonjs.u.ab2hexstring(publicKeyArray.slice(1, 33))
  } else {
    return '02' + neonjs.u.ab2hexstring(publicKeyArray.slice(1, 33))
  }
}

function walletImportLedger(self, args, cb) {
  let device
  self.log(chalk.green(' Checking for device...'))

  checkForLedger(self)
    .then((devices) => {
      ledgerComms.create_async(5000)
        .then((comm) => {
          let device = comm.device.getDeviceInfo()
          self.log(chalk.green(' ' + device.manufacturer + ' ' + device.product + ' found.'))

          let message = Buffer.from(`8004000000${BIP44_PATH}`, 'hex')
          let validStatus = [0x9000]

          self.log(chalk.green(' Retrieving public key from device...'))

          comm.exchange(message.toString('hex'), validStatus)
            .then((response) => {
              comm.device.close()
              let publicKey = response.substring(0, 130)
              let scriptHash = neonjs.wallet.getScriptHashFromPublicKey(publicKey)
              let address = neonjs.wallet.getAddressFromScriptHash(scriptHash)
              self.log(chalk.green(' Importing address: ') + chalk.bold.green(address))
              winston.log('info', 'Importing address from Ledger Nano S: %s', address, {
                metadata: response
              })

              self.prompt([
                {
                  type: 'input',
                  name: 'label',
                  message: chalk.green('? Give this address a label [optional] : ')
                }
              ], function (inputs) {

                let wallet = {
                  label: (inputs.label != undefined ? inputs.label : ''),
                  address: address,
                  encryptedWif: '',
                  isHardwareWallet: true
                }
                let gConf = g.get('conf')
                let addresses = gConf.addresses
                addresses.push(wallet)
                g.set('conf', gConf)

                winston.log('info', 'Address import succeeded.', {
                  metadata: wallet
                })
                cb()
              })
            })
            .catch((err) => {
              comm.device.close()
              if (err === 'Invalid status 28160') {
                self.log(chalk.log(' NEO App does not appear to be open, request for private key returned error 28160.'))
              } else if (err === 'Invalid status 6e00') {
                self.log(chalk.log(' NEO App does not appear to be open, request for private key returned error 6e00.'))
              } else if (err === 'Invalid status 6d00') {
                self.log(chalk.log(' NEO App does not appear to be open, request for private key returned error 6d00.'))
              } else {
                self.log(chalk.green(` Public Key Comm Messaging Error: ${err}`))
              }
              winston.log('error', 'Error importing address from Ledger Nano S.', {
                metadata: err
              })
              cb()
            })
        })
        .catch((err) => {
          self.log(err)
          winston.log('error', 'Error importing address from Ledger Nano S.', {
            metadata: err
          })
          cb()
        })
    })
    .catch((err) => {
      self.log(err)
      self.log(chalk.green(' Device not found.'))
      self.log(chalk.green(' Plug your Ledger Nano S in, enter your PIN, then try again.'))
      winston.log('error', 'Error importing address from Ledger Nano S.', {
        metadata: err
      })
      cb()
    })
}

function walletList(self, args, cb) {
  let tableData = []
  let gConf = g.get('conf')
  let addresses = gConf.addresses
  let totalBalances = []
  if (addresses.length <= 0) {
    self.log(chalk.green(' No addresses found.'))
  } else {
    let addressList = []
    for (let i = 0; i < addresses.length; i++) {
      let row = {
        Label: chalk.green(addresses[i].label),
        Address: chalk.green(addresses[i].address)
      }
      for (let asset in addresses[i].balances) {
        if (asset != 'address' && asset != 'net') {
          if (totalBalances[asset] == undefined) {
            totalBalances[asset] = 0
          }
          if (addresses[i].balances[asset].balance == null) {
            addresses[i].balances[asset].balance = 0
          }
          row[asset] = chalk.green(addresses[i].balances[asset].balance)
          totalBalances[asset] = totalBalances[asset] + addresses[i].balances[asset].balance
        }
      }
      tableData.push(row)
    }
    let summaryRow = {
      Label: '',
      Address: chalk.dim.green('Totals')
    }
    for (let asset in totalBalances) {
      summaryRow[asset] = chalk.dim.green(totalBalances[asset])
    }
    tableData.push(summaryRow)
    self.log(asTable(tableData).toString())
  }
  cb()
}

function walletRemove(self, args, cb) {
  let gConf = g.get('conf')
  let addresses = gConf.addresses
  let addressList = []
  let removed = false
  if (addresses.length <= 0) {
    self.log(chalk.green(' No addresses found.'))
    winston.log('debug', 'Address removal failed. No addresses to remove.')
    cb()
  } else {
    for (let i = 0; i < addresses.length; i++) {
      addressList.push((addresses[i].label ? addresses[i].label + ' (' : '') + addresses[i].address + (addresses[i].label ? ')' : ''))
    }
    self.prompt({
      type: 'list',
      name: 'addressSelection',
      message: chalk.green('Which address would you like to remove?'),
      choices: addressList
    }, (result) => {
      let address = result.addressSelection
      if (address.indexOf('(') >= 0) {
        let foundAddress = address.match(/\((.*)\)/)
        address = foundAddress[1]
      }
      for (let i = 0; i < addresses.length; i++) {
        if (addresses[i].address == address) {
          addresses.splice(i, 1)
          self.log(chalk.green(' Removed ' + address))
          winston.log('info', 'Address removal succeeded for address: %s', address)
          removed = true
        }
      }
      gConf.addresses = addresses
      g.set('conf', gConf)
      if (!removed) {
        self.log(chalk.green(' ' + address + ' not found in local storage.'))
        winston.log('info', 'Address removal failed, address %s not found in local storage.', address)
      }
      cb()
    })
  }
}

function walletClear(self, args, cb) {
  self.prompt({
    type: 'confirm',
    name: 'doClear',
    message: chalk.bold.red('Are you certain you\'d like to purge locally saved addresses and encrypted private keys?'),
    default: false
  }, (result) => {
    if (result.doClear) {
      winston.log('info', 'All addresses cleared from local storage.', {
        metadata: defaultConfig.addresses
      })
      let gConf = g.get('conf')
      gConf.addresses = defaultConfig.addresses
      g.set('conf', gConf)
      self.log(chalk.green(' Wallet cleared.'))
    }
    cb()
  })
}

function encryptKey(self, newWif, inputs) {
  return new Promise((resolve, reject) => {
    neonjs.wallet.encryptWifAccount(newWif, inputs.passphrase.toString())
      .then((newAccount) => {
        let wallet = {
          label: (inputs.label != undefined ? inputs.label : ''),
          address: newAccount.address,
          encryptedWif: newAccount.encryptedWif
        }
        let gConf = g.get('conf')
        let addresses = gConf.addresses
        addresses.push(wallet)
        gConf.addresses = addresses
        g.set('conf', gConf)
        self.log(chalk.bold.green(' This information will only be displayed once!'))
        self.log(chalk.green(' Your address and encrypted private key will be stored locally on your machine.'))
        self.log(chalk.green(' Your private key and passphrase will not be stored anywhere.'))
        self.log(chalk.green(' Label : ') + chalk.bold.green(inputs.label))
        self.log(chalk.green(' Public Address : ') + chalk.bold.green(newAccount.address))
        self.log(chalk.green(' Private Key : ') + chalk.bold.green(newAccount._WIF))
        self.log(chalk.green(' Encrypted Key : ') + chalk.bold.green(newAccount.encryptedWif))
        self.log(chalk.bold.red(' Now is your only chance to make a secure copy of your private key!'))
        self.prompt({
          type: 'confirm',
          name: 'keysaved',
          message: chalk.green('Be sure you have saved your private key securely! '),
          default: true
        }, function (answer) {
          self.log(chalk.green(' Address added.'))
          winston.log('info', 'Address WIF encrypted for address: %s', wallet.address)
          if (answer.keysaved) {
            winston.log('info', 'Private key saved acknowledgement received.')
          } else {
            winston.log('info', 'Private key saved acknowledgement NOT received.')
          }
          resolve(answer)
        })
      })
      .catch((err) => {
        self.log(err)
        reject(err)
      })
  })
}

function walletShow(self, args, cb) {
  let gConf = g.get('conf')
  let addresses = gConf.addresses
  let addressList = []
  let addressIndex
  if (addresses.length <= 0) {
    self.log(chalk.green(' No addresses found.'))
    cb()
  } else {
    for (let i = 0; i < addresses.length; i++) {
      addressList.push((addresses[i].label ? addresses[i].label + ' (' : '') + addresses[i].address + (addresses[i].label ? ')' : ''))
    }
    self.prompt({
      type: 'list',
      name: 'addressSelection',
      message: chalk.green('Which address would you like to see?'),
      choices: addressList
    }, (result) => {
      let address = result.addressSelection
      if (address.indexOf('(') >= 0) {
        let foundAddress = address.match(/\((.*)\)/)
        address = foundAddress[1]
      }
      for (let i = 0; i < addresses.length; i++) {
        if (addresses[i].address == address) {
          addressIndex = i
        }
      }
      let tableData = []
      for (let asset in addresses[addressIndex].balances) {
        if (asset != 'address' && asset != 'net') {
          if (addresses[addressIndex].balances[asset].balance == null) {
            addresses[addressIndex].balances[asset].balance = 0
          }
          let row = [
            chalk.green(asset),
            chalk.green(addresses[addressIndex].balances[asset].balance)
          ]
          tableData.push(row)
        }
      }
      self.log(chalk.bold.green('Balances'))
      self.log(asTable(tableData).toString())

      let transactionHistory = neonjs.api.getTransactionHistory(network.get(), address)
        .then((txns) => {
          self.log('')
          if (txns.length == 0) {
            self.log(chalk.green(' No transactions found.'))
          } else {
            let txnData = []
            let txnQty = (txns.length <= 20 ? txns.length : 20)
            for (let i = 0; i < txnQty; i++) {
              let row = {
                Asset: chalk.green(txns[i].neo_sent ? 'Neo' : 'Gas'),
                Amount: chalk.green(txns[i][(txns[i].neo_sent ? 'NEO' : 'GAS')]),
                TransacionID: chalk.dim.green(txns[i].txid)
              }
              txnData.push(row)
            }
            self.log(asTable(txnData).toString())
            self.log(chalk.dim.green(txnQty + ' Most recent transactions'))
          }
          winston.log('debug', 'Transaction list for address %s received.', address)
        })
        .then(() => {
          let claimables = addresses[addressIndex].claimables
          self.log('')
          if (claimables) {
            let gasToClaim = claimables.total_unspent_claim / 100000000
            let gasAvailable = claimables.total_claim / 100000000
            self.log(chalk.bold.green('Claimable gas: ') + chalk.green(gasAvailable + ' / ' + gasToClaim))
          } else {
            self.log(chalk.green(' Awaiting claimable information... try again.'))
          }
          cb()
        })
        .catch((err) => {
          winston.log('error', 'Transaction list for address %s failed to be retrieved.', addresses[addressIndex].address, {
            metadata: err
          })
          cb()
        })
    })
  }
}

function sendFunds(self, args, cb, asset) {
  let txnDetails = {
    asset: asset
  }
  let gConf = g.get('conf')
  let addresses = gConf.addresses
  let addressList = []
  if (addresses.length <= 0) {
    self.log(' You need to create or import an address to your wallet before you can send.')
    winston.log('debug', 'Sending failed. No addresses to send from.')
    cb()
  } else {
    for (let i = 0; i < addresses.length; i++) {
      addressList.push((addresses[i].label ? addresses[i].label + ' (' : '') + addresses[i].address + (addresses[i].label ? ')' : ''))
    }
    self.prompt({
      type: 'list',
      name: 'addressSelection',
      message: chalk.green('Which address would you like to send from?'),
      choices: addressList
    }, (result) => {
      let address = result.addressSelection
      if (address.indexOf('(') >= 0) {
        txnDetails.fromDisplay = address
        let foundAddress = address.match(/\((.*)\)/)
        txnDetails.fromAddress = foundAddress[1]
        for (let i = 0; i < addresses.length; i++) {
          if (addresses[i].address == txnDetails.fromAddress) {
            txnDetails.encryptedWif = addresses[i].encryptedWif
          }
        }
      }

      let gConf = g.get('conf')
      let contacts = gConf.contacts
      let contactList = []

      for (let i = 0; i < addresses.length; i++) {
        contactList.push((addresses[i].label ? addresses[i].label + ' (' : '') + addresses[i].address + (addresses[i].label ? ')' : '') + '*')
      }

      if (contactList.length <= 0) {
        self.log(chalk.green(' You need to add a contact to your contact list before you can send.'))
        winston.log('debug', 'Sending from address %s failed. No contacts in contact list to send to.', txnDetails.fromAddress)
        cb()
      } else {
        for (let i = 0; i < contacts.length; i++) {
          contactList.push((contacts[i].label ? contacts[i].label + ' (' : '') + contacts[i].address + (contacts[i].label ? ')' : ''))
        }
        self.prompt({
          type: 'list',
          name: 'contactSelection',
          message: chalk.green('Which contact would you like to send to?') + ' ' + chalk.dim.green('(* denotes one of your own addresses)'),
          choices: contactList
        }, (result) => {
          let contact = result.contactSelection
          if (contact.indexOf('(') >= 0) {
            txnDetails.toDisplay = contact
            let foundContact = contact.match(/\((.*)\)/)
            txnDetails.toAddress = foundContact[1]
          }
          self.prompt({
            type: 'input',
            name: 'amount',
            message: chalk.green('? How much ') + chalk.bold.green(txnDetails.asset.toUpperCase()) + chalk.green(' would you like to send? ')
          }, (result) => {
            txnDetails.amount = result.amount
            self.log(chalk.green(' You will send ') + chalk.bold.green(txnDetails.amount + ' ' + txnDetails.asset.toUpperCase()) + chalk.green(' from ') + chalk.bold.green(txnDetails.fromDisplay) + chalk.green(' to ') + chalk.bold.green(txnDetails.toDisplay))
            self.prompt({
              type: 'password',
              name: 'passphrase',
              message: chalk.green('Please enter your encrypted key passphrase for this address to confirm and authorise the transaction : ')
            }, (result) => {
              winston.log('info', 'Attempting sending transaction.', {
                metadata: txnDetails
              })
              try {
                neonjs.wallet.decryptWIF(txnDetails.encryptedWif, result.passphrase)
                  .then((decrypted) => {
                    self.log(chalk.green(' Passphrase accepted.'))

                    self.log(chalk.bold.green(' Sending...'))

                    /**
                     * Send an asset to an address
                     * @param {string} net - 'MainNet' or 'TestNet'.
                     * @param {string} toAddress - The destination address.
                     * @param {string} fromWif - The WIF key of the originating address.
                     * @param {{NEO: number, GAS: number}} amount - The amount of each asset (NEO and GAS) to send, leave empty for 0.
                     * @return {Promise<Response>} RPC Response
                     */
                    //export const doSendAsset = (net, toAddress, fromWif, assetAmounts) => {

                    let sendAsset = {}
                    if (txnDetails.asset == 'neo') {
                      sendAsset = {
                        NEO: parseInt(txnDetails.amount)
                      }
                    } else if (txnDetails.asset == 'gas') {
                      sendAsset = {
                        GAS: parseFloat(txnDetails.amount)
                      }
                    }

                    neonjs.api.doSendAsset(network.get(), txnDetails.toAddress, decrypted, sendAsset)
                      .then((result) => {
                        if (result.result) {
                          self.log(chalk.bold.green(' Sent!'))
                          winston.log('info', 'Transaction sending succeeded.', {
                            metadata: result
                          })
                        } else {
                          self.log(chalk.bold.red(' The transaction appears to have failed. Please check your transaction history to confirm.'))
                          winston.log('error', 'Transaction sending failed.', {
                            metadata: result
                          })
                        }
                        cb()
                      })
                      .catch((err) => {
                        self.log(chalk.bold.red(err))
                        winston.log('error', 'Transaction sending failed.', {
                          metadata: err
                        })
                        cb()
                      })
                  })
              } catch (err) {
                self.log(chalk.bold.red(' ' + err.message))
                winston.log('error', 'Transaction sending failed.', {
                  metadata: err
                })
                cb()
              }
            })
          })
        })
      }
    })
  }
}

function sendNeo(self, args, cb) {
  sendFunds(self, args, cb, 'neo')
}

function sendGas(self, args, cb) {
  sendFunds(self, args, cb, 'gas')
}

function claimAllGas(self, args, cb) {
  let txnDetails = {}
  let gConf = g.get('conf')
  let addresses = gConf.addresses
  let addressList = []
  if (addresses.length <= 0) {
    self.log(chalk.green(' You need to create or import an address to your wallet before you can claim gas.'))
    winston.log('debug', 'Claiming gas failed. No address to claim for.')
    cb()
  } else {
    for (let i = 0; i < addresses.length; i++) {
      addressList.push((addresses[i].label ? addresses[i].label + ' (' : '') + addresses[i].address + (addresses[i].label ? ')' : ''))
    }
    self.prompt({
      type: 'list',
      name: 'addressSelection',
      message: chalk.green('Which address would you like to send from?'),
      choices: addressList
    }, (result) => {
      let address = result.addressSelection
      let addressIndex
      if (address.indexOf('(') >= 0) {
        txnDetails.fromDisplay = address
        let foundAddress = address.match(/\((.*)\)/)
        txnDetails.fromAddress = foundAddress[1]
        for (let i = 0; i < addresses.length; i++) {
          if (addresses[i].address == txnDetails.fromAddress) {
            txnDetails.encryptedWif = addresses[i].encryptedWif
            txnDetails.canClaim = (addresses[i].claimables.total_claim - addresses[i].claimables.total_unspent_claim > 0 ? true : false)
            addressIndex = i
          }
        }
      }

      if (txnDetails.canClaim) {
        self.prompt({
          type: 'password',
          name: 'passphrase',
          message: chalk.green('Please enter your encrypted key passphrase for this address to confirm and authorise the transaction : ')
        }, (result) => {
          winston.log('info', 'Attempting claiming transaction.', {
            metadata: txnDetails
          })
          try {
            neonjs.wallet.decryptWIF(txnDetails.encryptedWif, result.passphrase)
              .then((decrypted) => {
                self.log(chalk.green(' Passphrase accepted.'))

                self.log(chalk.bold.green(' Claiming...'))
                neonjs.api.doClaimAllGas(network.get(), decrypted)
                  .then((result) => {
                    if (result.result) {
                      self.log(chalk.bold.green(' Claimed!'))
                      winston.log('info', 'Claiming transaction succeeded.', {
                        metadata: result
                      })
                    } else {
                      self.log(chalk.bold.red(' The transaction appears to have failed. Please check your transaction history to confirm.'))
                      winston.log('error', 'Claiming transaction failed.', {
                        metadata: result
                      })
                    }
                    cb()
                  })
              })
          } catch (err) {
            self.log(chalk.bold.red(' ' + err.message))
            winston.log('error', 'Claiming transaction failed.', {
              metadata: err
            })
            cb()
          }
        })
      } else {
        let claimables = addresses[addressIndex].claimables
        let gasToClaim = claimables.total_unspent_claim / 100000000
        let gasAvailable = claimables.total_claim / 100000000
        self.log(chalk.green(' You must first make a transaction so gas becomes claimable.'))
        self.log(chalk.green(' Currently you have: ' + gasAvailable + ' / ' + gasToClaim + ' available.'))
        winston.log('info', 'Claiming transaction failed. Claimable gas must be greater than 0.')
        cb()
      }
    })
  }
}

function updateWalletBalance(address) {
  let gConf = g.get('conf')
  let tokens = gConf.tokens

  let indexedTokens = []
  for (let hash in tokens) {
    let token = {
      hash: hash,
      data: tokens[hash]
    }
    indexedTokens.push(token)
  }

  return new Promise((resolve, reject) => {
    neonjs.api.getBalance(network.get(), address)
      .then((addressResult) => {
        let tokenBalances = []
        for (let i = 0; i < indexedTokens.length; i++) {
          tokenBalances.push(updateTokenBalance(indexedTokens[i].hash, address))
        }
        return Promise.all(tokenBalances)
          .then((tokenResult) => {
            for (let i = 0; i < tokenResult.length; i++) {
              addressResult[indexedTokens[i].data.symbol] = {}
              if (!isNaN(tokenResult[i])) {
                addressResult[indexedTokens[i].data.symbol].balance = tokenResult[i]
              } else {
                addressResult[indexedTokens[i].data.symbol].balance = 0
              }
            }

            resolve(addressResult)
          })
          .catch((err) => {
            winston.log('debug', 'Wallet balance updated for address: %s', address, {
              metadata: addressResult
            })
            resolve(addressResult)
          })
      })
      .catch((err) => {
        winston.log('error', 'Wallet balance failed to update for address: %s', address, {
          metadata: err
        })
        reject(err)
      })
  })
}

function updateTokenBalance(token, address) {
  return new Promise((resolve, reject) => {
    neonjs.api.getTokenBalance(rpc_node, token, address)
      .then((result) => {
        resolve(result)
      })
      .catch((err) => {
        reject(err)
      })
  })
}

function walletUpdateBalances(self) {
  let gConf = g.get('conf')
  let addresses = gConf.addresses

  let addressBalances = []
  for (let i = 0; i < addresses.length; i++) {
    addressBalances.push(updateWalletBalance(addresses[i].address))
  }

  return Promise.all(addressBalances)
    .then((result) => {
      for (let i = 0; i < result.length; i++) {
        addresses[i].balances = result[i]
      }
      winston.log('debug', 'Wallet balances updated.', {
        metadata: result
      })
      gConf.addresses = addresses
      g.set('conf', gConf)
    })
}

function walletUpdateClaimables(self) {
  let gConf = g.get('conf')
  let addresses = gConf.addresses
  let addressClaimables = []
  for (let i = 0; i < addresses.length; i++) {
    addressClaimables.push(neonjs.api.getClaimAmounts(network.get(), addresses[i].address))
  }
  return Promise.all(addressClaimables)
    .then((result) => {
      for (let i = 0; i < result.length; i++) {
        addresses[i].claimables = result[i]
      }
      winston.log('silly', 'Updated claimables', {
        metadata: result
      })
      gConf.addresses = addresses
      g.set('conf', gConf)
    })
    .catch((err) => {
      winston.log('error', 'Claimables update failed.', {
        metadata: err
      })
    })
}

module.exports.sendNeo = sendNeo
module.exports.sendGas = sendGas
module.exports.create = walletCreate
module.exports.import = walletImport
module.exports.importLedger = walletImportLedger
module.exports.list = walletList
module.exports.remove = walletRemove
module.exports.clear = walletClear
module.exports.show = walletShow
module.exports.claimAllGas = claimAllGas
module.exports.updateBalances = walletUpdateBalances
module.exports.updateClaimables = walletUpdateClaimables
