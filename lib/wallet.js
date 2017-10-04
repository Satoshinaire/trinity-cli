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
  print: obj => (typeof obj === 'boolean') ? (obj ? 'yes' : 'no') : String(obj)
})

const conf = new Configstore(pkg.name, defaultConfig)

function walletCreate(self, args, cb) {
  self.log(chalk.white('Creating wallet...'))

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
  ], function (result) {
    if (result.passphrase.length <= 4) {
      self.log(' Passphrase must be longer than 4 characters.')
      cb()
    } else if (result.passphrase !== result.passphrase2) {
      self.log(' Passphrase and confirmation don\'t match.')
      cb()
    } else {
      let newPrivateKey = neonjs.generatePrivateKey()
      let newWif = neonjs.getWIFFromPrivateKey(newPrivateKey)
      neonjs.encryptWifAccount(newWif, result.passphrase.toString())
        .then((newAccount) => {
          let wallet = {
            label: (result.label != undefined ? result.label : ''),
            address: newAccount.address,
            encryptedWif: newAccount.encryptedWif
          }
          let addresses = conf.get('addresses')
          addresses.push(wallet)
          conf.set('addresses', addresses);
          self.log(chalk.bold.green(' This information will only be displayed once!'))
          self.log(chalk.green(' Your address and encrypted private key will be stored locally on your machine.'))
          self.log(chalk.green(' Your private key and passphrase will not be stored anywhere.'))
          self.log(chalk.green(' Label: ') + chalk.bold.green(result.label))
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
            cb()
          })
        })
    }
  })
}

function walletList(self, args, cb) {
  let tableData = [];
  let addresses = conf.get('addresses')
  if (addresses.length <= 0) {
    self.log(' No addresses found.')
  }
  let addressList = []
  for (let i = 0; i < addresses.length; i++) {
    let row = {
      id: chalk.green(i + 1),
      label: chalk.green(addresses[i].label),
      address: chalk.green(addresses[i].address)
    }
    tableData.push(row)
  }
  self.log(asTable(tableData).toString());
  cb()
}

function walletRemove(self, args, cb) {
  let addresses = conf.get('addresses')
  let addressList = []
  let removed = false
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
    self.log(' Removing ' + address)
    for (let i = 0; i < addresses.length; i++) {
      if (addresses[i].address == address) {
        addresses.splice(i, 1)
        self.log(' Removed ' + address)
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

function walletClear(self, args, cb) {
  conf.set('addresses', [])
  self.log(chalk.white(' Wallet cleared.'))
  cb()
}

function encrypt(newWif, passPhrase) {
  let deferred = q.defer();

  neonjs.encrypt_wif(newWif, passPhrase)
    .then((result) => {
      deferred.resolve(result)
    })

  return deferred.promise;
}

module.exports.create = walletCreate
module.exports.list = walletList
module.exports.remove = walletRemove
module.exports.clear = walletClear
