#!/usr/bin/env node

'use strict'

const pkg = require('./package.json')
const Configstore = require('configstore')
const defaultConfig = require('./defaultConfig')
const Vorpal = require('vorpal')
const chalk = Vorpal().chalk
const wallet = require('./lib/wallet')
const network = require('./lib/network')
const contacts = require('./lib/contacts')

const conf = new Configstore(pkg.name, defaultConfig)

const trinity = Vorpal()
  .delimiter(chalk.dim.green('[' + network.get() + '] ') + chalk.green('trinity') + chalk.green(' >'))
  .history('trinity-command-history')
  .show()

trinity.log(chalk.bold.green("\n" + ' Wake up, Neo… ' + "\n"))

trinity
  .command('send neo', chalk.bold.red('[EXPERIMENTAL]') + ' Send NEO from one of your addresses to one of your contacts.')
  .action(function (args, cb) {
    let self = this
    wallet.sendNeo(self, args, cb)
  })

trinity
  .command('send gas', chalk.bold.red('[EXPERIMENTAL]') + ' Send GAS from one of your addresses to one of your contacts.')
  .action(function (args, cb) {
    let self = this
    wallet.sendGas(self, args, cb)
  })

trinity
  .command('wallet list', 'List available wallets.')
  .action(function (args, cb) {
    let self = this
    wallet.list(self, args, cb)
  })

trinity
  .command('wallet show', 'Select an address to show its balances, transactions, claimables, etc.')
  .action(function (args, cb) {
    let self = this
    wallet.show(self, args, cb)
  })

trinity
  .command('wallet create', 'Creates a new wallet address.')
  .action(function (args, cb) {
    let self = this
    wallet.create(self, args, cb)
  })

trinity
  .command('wallet import', 'Import an existing private key in WIF format.')
  .action(function (args, cb) {
    let self = this
    wallet.import(self, args, cb)
  })

trinity
  .command('wallet remove', 'Select an address to remove from local storage.')
  .action(function (args, cb) {
    let self = this
    wallet.remove(self, args, cb)
  })

trinity
  .command('wallet clear', 'Purge all wallet information from local storage.')
  .action(function (args, cb) {
    let self = this
    wallet.clear(self, args, cb)
  })

trinity
  .command('contact list', 'List your contacts.')
  .action(function (args, cb) {
    let self = this
    contacts.list(self, args, cb)
  })

trinity
  .command('contact add', 'Add a new contact.')
  .action(function (args, cb) {
    let self = this
    contacts.add(self, args, cb)
  })

trinity
  .command('contact remove', 'Remove an existing contact.')
  .action(function (args, cb) {
    let self = this
    contacts.remove(self, args, cb)
  })

trinity
  .command('claim gas', chalk.bold.red('[EXPERIMENTAL]') + ' Claim all available and unavailable gas.')
  .action(function (args, cb) {
    let self = this
    wallet.claimAllGas(self, args, cb)
  })

trinity
  .command('network', 'Switch to a different network.')
  .action(function (args, cb) {
    let self = this
    network.set(self, args, cb)
  })

wallet.updateBalances(trinity)
var trinityLoop = setInterval(() => {
  wallet.updateBalances(trinity)
  wallet.updateClaimables(trinity)
}, 5000)
