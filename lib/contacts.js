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

const conf = new Configstore(pkg.name, defaultConfig)

function listContacts(self, args, cb) {
  let tableData = [];
  let contacts = conf.get('contacts')
  if (contacts.length <= 0) {
    self.log(chalk.green(' No contacts found.'))
  } else {
    let contactList = []
    for (let i = 0; i < contacts.length; i++) {
      let row = {
        Label: chalk.green(contacts[i].label),
        Address: chalk.green(contacts[i].address)
      }
      tableData.push(row)
    }
    self.log(asTable(tableData).toString());
  }
  cb()
}

function addContact(self, args, cb) {
  let contacts = conf.get('contacts')

  self.prompt([
    {
      type: 'input',
      name: 'label',
      message: chalk.green('? Give this contact a label [optional] : ')
    },
    {
      type: 'input',
      name: 'address',
      message: chalk.green('? Provide the public address for this contact : ')
    }
  ], function (result) {
    let contact = {
      label: result.label,
      address: result.address
    }
    if (neonjs.verifyAddress(result.address)) {
      contacts.push(contact)
      conf.set('contacts', contacts)
      self.log(chalk.green(' Contact added.'))
      winston.log('debug', 'Contact added, address %s', result.address)
    } else {
      self.log(chalk.green(' Must be a valid NEO / GAS address.'))
      winston.log('debug', 'Contact address %s failed verification.', result.address)
    }
    cb()
  })
}

function removeContact(self, args, cb) {
  let contacts = conf.get('contacts')
  let contactList = []
  let removed = false
  if (contacts.length <= 0) {
    self.log(chalk.green(' No contacts found.'))
    winston.log('debug', 'Contact removal failed. No contacts to remove.')
    cb()
  } else {
    for (let i = 0; i < contacts.length; i++) {
      contactList.push((contacts[i].label ? contacts[i].label + ' (' : '') + contacts[i].address + (contacts[i].label ? ')' : ''))
    }
    self.prompt({
      type: 'list',
      name: 'contactSelection',
      message: chalk.green('Which contact would you like to remove?'),
      choices: contactList
    }, (result) => {
      let contact = result.contactSelection;
      if (contact.indexOf('(') >= 0) {
        let foundContact = contact.match(/\((.*)\)/)
        contact = foundContact[1]
      }
      for (let i = 0; i < contacts.length; i++) {
        if (contacts[i].address == contact) {
          contacts.splice(i, 1)
          self.log(chalk.green(' Removed ' + result.contactSelection))
          winston.log('info', 'Contact removal succeeded for address: %s', result.contactSelection)
          removed = true
        }
      }
      conf.set('contacts', contacts)
      if (!removed) {
        self.log(chalk.green(' ' + result.contactSelection + ' not found in local storage.'))
        winston.log('info', 'Contact removal failed, address %s not found in local storage.', result.contactSelection)
      }
      cb()
    })
  }
}

function contactsClear(self, args, cb) {
  self.prompt({
    type: 'confirm',
    name: 'doClear',
    message: chalk.bold.red('Are you certain you\'d like to purge locally saved contacts?'),
    default: false
  }, (result) => {
    if (result.doClear) {
      winston.log('info', 'All contacts cleared from local storage.', {
        metadata: defaultConfig.contacts
      })
      conf.set('contacts', defaultConfig.contacts)
      self.log(chalk.green(' Contacts cleared.'))
    }
    cb()
  })
}

module.exports.list = listContacts
module.exports.add = addContact
module.exports.remove = removeContact
module.exports.clear = contactsClear
