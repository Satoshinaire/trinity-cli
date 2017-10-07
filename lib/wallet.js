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
      self.log(' Passphrase must be longer than 4 characters.')
      cb()
    } else if (inputs.passphrase !== inputs.passphrase2) {
      self.log(' Passphrase and confirmation don\'t match.')
      cb()
    } else {
      let newPrivateKey = neonjs.generatePrivateKey()
      let newWif = neonjs.getWIFFromPrivateKey(newPrivateKey)
      encryptKey(self, newWif, inputs)
        .then((outputs) => {
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
      self.log(' Please provide a valid private key in WIF format.')
      cb()
    } else if (inputs.passphrase.length <= 4) {
      self.log(' Passphrase must be longer than 4 characters.')
      cb()
    } else if (inputs.passphrase !== inputs.passphrase2) {
      self.log(' Passphrase and confirmation don\'t match.')
      cb()
    } else {
      encryptKey(self, inputs.existingWif.toString(), inputs)
        .then((outputs) => {
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
    self.log(' No addresses found.')
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
    self.log(' No addresses found.')
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
          removed = true
        }
      }
      conf.set('addresses', addresses)
      if (!removed) {
        self.log(' ' + address + ' not found in local storage.')
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
      conf.set('addresses', [])
      self.log(chalk.white(' Wallet cleared.'))
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
      self.log(chalk.green(' Label: ') + chalk.bold.green(inputs.label))
      self.log(chalk.green(' Public Address: ') + chalk.bold.green(newAccount.address))
      self.log(chalk.green(' Private Key: ') + chalk.bold.green(newAccount.wif))
      self.log(chalk.green(' Encrypted Key: ') + chalk.bold.green(newAccount.encryptedWif))
      self.log(chalk.green(' Passphrase: ') + chalk.bold.green(newAccount.passphrase))
      self.log(chalk.bold.red(' Now is your only chance to make a secure copy of your private key!'))
      self.prompt({
        type: 'confirm',
        name: 'keysaved',
        message: chalk.green('Have you saved your private key securely? '),
        default: true
      }, function (answer) {
        self.log(chalk.green(' I must believe you have.'))
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
    self.log(' No addresses found.')
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
        })
        .then(() => {
          let claimAmounts = neonjs.getClaimAmounts(network.get(), address)
            .then((claimables) => {
              self.log('')
              let gasToClaim = (claimables.available + claimables.unavailable) / 100000000
              self.log(chalk.bold.green('Claimable gas: ') + chalk.green(gasToClaim))
              cb()
            })
        })
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
      })
  }
}

module.exports.create = walletCreate
module.exports.import = walletImport
module.exports.list = walletList
module.exports.remove = walletRemove
module.exports.clear = walletClear
module.exports.show = walletShow
module.exports.updateBalances = walletUpdateBalances
