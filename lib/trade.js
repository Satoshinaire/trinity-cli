'use strict'

const pkg = require('../package.json')
const Configstore = require('configstore')
const defaultConfig = require('../defaultConfig')
const chalk = require('chalk')
const q = require('q')
const asTable = require('as-table').configure({
  title: x => chalk.bold.green(x),
  delimiter: chalk.dim.green(' | '),
  dash: chalk.dim.green('-'),
  print: obj => (typeof obj === 'boolean') ? (obj ? 'Yes' : 'No') : String(obj)
})
const winston = require('winston')
const CryptoJS = require('crypto-js')
const moment = require('moment')
const Kucoin = require('kucoin-api')

const conf = new Configstore(pkg.name, defaultConfig)

const g = require('./global')

function tradeState(self, args, cb) {
  let kcCreds = g.get('kucoin')
  if (!kcCreds) {
    self.log(chalk.green(' KuCoin API credentials are currently ') + chalk.bold.green('locked') + chalk.green(' for this session.'))
  } else {
    self.log(chalk.green(' KuCoin API credentials are currently ') + chalk.bold.green('unlocked') + chalk.green(' for this session.'))
  }
  cb()
}

function tradeConfig(self, args, cb) {
  let kucoinConfig = conf.get('kucoin')
  self.prompt([
    {
      type: 'input',
      name: 'apiKey',
      message: chalk.green('? KuCoin API Key : ')
    },
    {
      type: 'input',
      name: 'apiSecret',
      message: chalk.green('? KuCoin API Secret : ')
    },
    {
      type: 'password',
      name: 'passphrase',
      message: chalk.green('? Passphrase for KuCoin credential encryption : ')
    },
    {
      type: 'password',
      name: 'passphraseConfirm',
      message: chalk.green('? Please provide your passphrase again to confirm : ')
    }
  ], (answers) => {
    if (answers.passphrase != answers.passphraseConfirm) {
      self.log(chalk.red('Passphrases don\'t match, sorry try again.'))
      cb()
    } else {
      let kucoin = {
        apiKey: answers.apiKey,
        apiSecret: answers.apiSecret
      }
      let creds = encryptCredentials(kucoin, answers.passphrase)
      conf.set('kucoin', creds.toString())
      self.log(chalk.green(' Your KuCoin API credentials have been encrypted and saved. You will need the passphrase you provided for all operations that use them.'))
      self.log(chalk.green(' Adding your KuCoin Deposit Address for GAS to your contact list...'))
      let kc = new Kucoin(kucoin.apiKey, kucoin.apiSecret)
      kc.getDepositAddress({
          symbol: 'GAS'
        })
        .then((result) => {
          let contact = {
            label: 'KuCoin-GAS',
            address: result.data.address
          }
          let contacts = conf.get('contacts')
          contacts.push(contact)
          conf.set('contacts', contacts)
          self.log(chalk.green(' Contact added.'))
          winston.log('debug', 'Contact added, address %s', contact.address, {
            metadata: result
          })
          cb()
        })
    }
  })
}

function tradeUnlock(self, args, cb) {
  let kcCreds = g.get('kucoin')
  if (!kcCreds) {
    self.prompt({
      type: 'password',
      name: 'passphrase',
      message: chalk.green('? Please enter your KuCoin API credentials passphrase : ')
    }, (answers) => {
      let encryptedKucoin = conf.get('kucoin')
      let kucoin = decryptCredentials(encryptedKucoin, answers.passphrase)
      kcCreds = kucoin
      g.set('kucoin', kcCreds)
      self.log(chalk.green(' KuCoin API credentials unlocked for this Trinity session.'))
      cb()
    })
  } else {
    self.log(chalk.green(' KuCoin API credentials already unlocked.'))
    cb()
  }
}

function tradeLock(self, args, cb) {
  let kcCreds = g.get('kucoin')
  if (!kcCreds) {
    self.log(chalk.green(' KuCoin API credentials already locked.'))
    cb()
  } else {
    kcCreds = false
    g.set('kucoin', kcCreds)
    self.log(chalk.green(' KuCoin API credentials locked for this Trinity session.'))
    cb()
  }
}

function getCreds(self) {
  let deferred = q.defer()

  let kcCreds = g.get('kucoin')
  if (!kcCreds) {
    self.prompt({
      type: 'password',
      name: 'passphrase',
      message: chalk.green('? Please enter your KuCoin API credentials passphrase : ')
    }, (answers) => {
      let encryptedKucoin = conf.get('kucoin')
      let kucoin = decryptCredentials(encryptedKucoin, answers.passphrase)
      deferred.resolve(kucoin)
    })
  } else {
    let kucoin = kcCreds
    deferred.resolve(kucoin)
  }

  return deferred.promise
}

function tradeBalance(self, args, cb) {
  getCreds(self)
    .then((kucoin) => {
      let kc = new Kucoin(kucoin.apiKey, kucoin.apiSecret)
      kc.getBalance()
        .then((result) => {
          let coins = ['NEO', 'GAS']
          let tableData = []
          for (let i = 0; i < result.data.length; i++) {
            if (coins.indexOf(result.data[i].coinType) >= 0) {
              let row = {
                Coin: chalk.green(result.data[i].coinType),
                Balance: chalk.green(result.data[i].balance),
                Frozen: chalk.green(result.data[i].freezeBalance)
              }
              tableData.push(row)
            }
          }
          self.log(asTable(tableData).toString())
          cb()
        })
        .catch((err) => {
          self.log(err)
          cb()
        })
    })
    .catch((err) => {
      self.leg(err)
      cb()
    })
}

function tradeOrders(self, args, cb) {
  getCreds(self)
    .then((kucoin) => {
      let kc = new Kucoin(kucoin.apiKey, kucoin.apiSecret)
      kc.getActiveOrders({
          pair: 'GAS-NEO'
        })
        .then((result) => {
          if (result.data.SELL.length <= 0 && result.data.BUY.length <= 0) {
            self.log(chalk.green(' You don\'t currently have any active orders on KuCoin.'))
            cb()
          } else {
            let orders = result.data.SELL.concat(result.data.BUY)
            orders.sort(sortByTime)
            let tableData = []
            for (let i = 0; i < orders.length; i++) {
              let row = {
                Time: chalk.green(moment.unix(orders[i][0] / 1000).format('llll')),
                Type: chalk.green(orders[i][1]),
                Price: chalk.green(orders[i][2]),
                Amount: chalk.green(orders[i][3]),
                OrderID: chalk.dim.green(orders[i][5])
              }
              tableData.push(row)
            }
            self.log(asTable(tableData).toString())
            cb()
          }
        })
        .catch((err) => {
          self.log(err)
          cb()
        })
    })
    .catch((err) => {
      self.leg(err)
      cb()
    })
}

function encryptCredentials(obj, passphrase) {
  try {
    let encryptedPassphrase = CryptoJS.SHA256(passphrase).toString()
    let encryptedCredentials = CryptoJS.AES.encrypt(JSON.stringify(obj), encryptedPassphrase)
    return encryptedCredentials
  } catch (e) {
    winston.log('error', 'Encrypting your KuCoin API credentials failed.', {
      metadata: e
    })
    return chalk.bold.red(' Encrypting your KuCoin API credentials failed.')
  }
}

function decryptCredentials(str, passphrase) {
  try {
    let encryptedPassphrase = CryptoJS.SHA256(passphrase).toString()
    let decryptedCredentials = CryptoJS.AES.decrypt(str.toString(), encryptedPassphrase)
    let jsonData = decryptedCredentials.toString(CryptoJS.enc.Utf8)
    return JSON.parse(jsonData)
  } catch (e) {
    winston.log('error', 'Error decrypting KuCoin API credentials.', {
      metadata: e
    })
    return chalk.bold.red(' Error decrypting KuCoin API credentials. Either you mistyped your passphrase, or the credentials were stored incorrectly and you should run trade config again.')
  }
}

function sortByTime(a, b) {
  return (a[0] < b[0] ? 0 : 1)
}

module.exports.state = tradeState
module.exports.config = tradeConfig
module.exports.balance = tradeBalance
module.exports.orders = tradeOrders
module.exports.unlock = tradeUnlock
module.exports.lock = tradeLock
