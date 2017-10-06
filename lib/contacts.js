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

const conf = new Configstore(pkg.name, defaultConfig)

function listContacts(self, args, cb) {
  let tableData = [];
  let contacts = conf.get('contacts')
  if (contacts.length <= 0) {
    self.log(' No contacts found.')
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
    } else {
      self.log(chalk.green(' Must be a valid NEO / GAS address.'))
    }
    cb()
  })
}

module.exports.list = listContacts
module.exports.add = addContact
