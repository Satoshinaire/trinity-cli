'use strict'

const pkg = require('../package.json')
const Configstore = require('configstore')
const defaultConfig = require('../defaultConfig')
const neonjs = require('neon-js')
const chalk = require('chalk')
const q = require('q')
const asTable = require('as-table').configure({
  title: x => chalk.bold.green(x),
  delimiter: chalk.dim.green(' | '),
  dash: chalk.dim.green('-'),
  print: obj => (typeof obj === 'boolean') ? (obj ? 'Yes' : 'No') : String(obj)
})
const winston = require('winston')
const network = require('./network')

const conf = new Configstore(pkg.name, defaultConfig)

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
      let newPrivateKey = neonjs.generatePrivateKey()
      let newWif = neonjs.getWIFFromPrivateKey(newPrivateKey)
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

function walletList(self, args, cb) {
  let tableData = [];
  let addresses = conf.get('addresses')
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
    self.log(asTable(tableData).toString());
  }
  cb()
}

function walletRemove(self, args, cb) {
  let addresses = conf.get('addresses')
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
      let address = result.addressSelection;
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
      conf.set('addresses', addresses)
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
      conf.set('addresses', defaultConfig.addresses)
      self.log(chalk.green(' Wallet cleared.'))
    }
    cb()
  })
}

function encryptKey(self, newWif, inputs) {
  let deferred = q.defer();

  neonjs.encryptWifAccount(newWif, inputs.passphrase.toString())
    .then((newAccount) => {
      let wallet = {
        label: (inputs.label != undefined ? inputs.label : ''),
        address: newAccount.address,
        encryptedWif: newAccount.encryptedWif
      }
      let addresses = conf.get('addresses')
      addresses.push(wallet)
      conf.set('addresses', addresses);
      self.log(chalk.bold.green(' This information will only be displayed once!'))
      self.log(chalk.green(' Your address and encrypted private key will be stored locally on your machine.'))
      self.log(chalk.green(' Your private key and passphrase will not be stored anywhere.'))
      self.log(chalk.green(' Label : ') + chalk.bold.green(inputs.label))
      self.log(chalk.green(' Public Address : ') + chalk.bold.green(newAccount.address))
      self.log(chalk.green(' Private Key : ') + chalk.bold.green(newAccount.wif))
      self.log(chalk.green(' Encrypted Key : ') + chalk.bold.green(newAccount.encryptedWif))
      self.log(chalk.green(' Passphrase : ') + chalk.bold.green(newAccount.passphrase))
      self.log(chalk.bold.red(' Now is your only chance to make a secure copy of your private key!'))
      self.prompt({
        type: 'confirm',
        name: 'keysaved',
        message: chalk.green('Have you saved your private key securely? '),
        default: true
      }, function (answer) {
        self.log(chalk.green(' I must believe you have.'))
        winston.log('info', 'Address WIF encrypted for address: %s', wallet.address)
        if (answer.keysaved) {
          winston.log('info', 'Private key saved acknowledgement received.')
        } else {
          winston.log('info', 'Private key saved acknowledgement NOT received.')
        }
        deferred.resolve(answer)
      })
    })

  return deferred.promise;
}

function walletShow(self, args, cb) {
  let addresses = conf.get('addresses')
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
      let address = result.addressSelection;
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
          let row = [
            chalk.green(asset),
            chalk.green(addresses[addressIndex].balances[asset].balance)
          ]
          tableData.push(row)
        }
      }
      self.log(chalk.bold.green('Balances'))
      self.log(asTable(tableData).toString())

      let transactionHistory = neonjs.getTransactionHistory(network.get(), address)
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
            let gasToClaim = (claimables.available + claimables.unavailable) / 100000000
            self.log(chalk.bold.green('Claimable gas: ') + chalk.green((claimables.available / 100000000) + ' / ' + gasToClaim))
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
  let addresses = conf.get('addresses')
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

      let contacts = conf.get('contacts')
      let contactList = []

      for (let i = 0; i < addresses.length; i++) {
        contactList.push('*' + (addresses[i].label ? addresses[i].label + ' (' : '') + addresses[i].address + (addresses[i].label ? ')' : ''))
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
          message: chalk.green('Which contact would you like to send to?'),
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
                neonjs.decryptWIF(txnDetails.encryptedWif, result.passphrase)
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

                    neonjs.doSendAsset(network.get(), txnDetails.toAddress, decrypted, sendAsset)
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
  let addresses = conf.get('addresses')
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
      let addressIndex;
      if (address.indexOf('(') >= 0) {
        txnDetails.fromDisplay = address
        let foundAddress = address.match(/\((.*)\)/)
        txnDetails.fromAddress = foundAddress[1]
        for (let i = 0; i < addresses.length; i++) {
          if (addresses[i].address == txnDetails.fromAddress) {
            txnDetails.encryptedWif = addresses[i].encryptedWif
            txnDetails.canClaim = (addresses[i].claimables.available ? true : false)
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
            neonjs.decryptWIF(txnDetails.encryptedWif, result.passphrase)
              .then((decrypted) => {
                self.log(chalk.green(' Passphrase accepted.'))

                self.log(chalk.bold.green(' Claiming...'))
                neonjs.doClaimAllGas(network.get(), decrypted)
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
        let gasToClaim = (claimables.available + claimables.unavailable) / 100000000
        self.log(chalk.green(' You must first make a transaction so gas becomes claimable.'))
        self.log(chalk.green(' Currently you have: ' + (claimables.available / 100000000) + ' / ' + gasToClaim + ' available.'))
        winston.log('info', 'Claiming transaction failed. Claimable gas must be greater than 0.')
        cb()
      }
    })
  }
}

function walletUpdateBalances(self) {
  let addresses = conf.get('addresses')
  for (let i = 0; i < addresses.length; i++) {
    neonjs.getBalance(network.get(), addresses[i].address)
      .then((result) => {
        addresses[i].balances = result
        conf.set('addresses', addresses)
        winston.log('silly', 'Updated balance for %s', addresses[i].address, {
          metadata: result
        })
      })
  }
}

function walletUpdateClaimables(self) {
  let addresses = conf.get('addresses')
  for (let i = 0; i < addresses.length; i++) {
    neonjs.getClaimAmounts(network.get(), addresses[i].address)
      .then((result) => {
        addresses[i].claimables = result
        conf.set('addresses', addresses)
        winston.log('silly', 'Updated balance for %s', addresses[i].address, {
          metadata: result
        })
      })
  }
}

module.exports.sendNeo = sendNeo
module.exports.sendGas = sendGas
module.exports.create = walletCreate
module.exports.import = walletImport
module.exports.list = walletList
module.exports.remove = walletRemove
module.exports.clear = walletClear
module.exports.show = walletShow
module.exports.claimAllGas = claimAllGas
module.exports.updateBalances = walletUpdateBalances
module.exports.updateClaimables = walletUpdateClaimables
