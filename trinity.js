#!/usr/bin/env node

'use strict'

const pkg = require('./package.json')
const Configstore = require('configstore')
const Vorpal = require('vorpal')
const chalk = Vorpal().chalk
const wallet = require('./lib/wallet')

const conf = new Configstore(pkg.name, {
  addresses: []
})

const trinity = Vorpal()
  .delimiter(chalk.green('trinity >'))
  .history('trinity-command-history')
  .show()

trinity.log(chalk.bold.green("\n" + ' Wake up, Neo… ' + "\n"))

trinity
  .command('wallet create', 'Creates a new wallet address.')
  .action(function (args, cb) {
    let self = this
    wallet.walletCreate(self, args, cb)
  })

trinity
  .command('wallet list', 'List available wallets.')
  .action(function (args, cb) {
    let self = this
    wallet.walletList(self, args, cb)
  })

trinity
  .command('wallet remove <address>', 'Remove the specified wallet from local storage.')
  .action(function (args, cb) {
    let self = this
    wallet.walletRemove(self, args, cb)
  })

trinity
  .command('wallet clear', 'Purge all wallet information from local storage.')
  .action(function (args, cb) {
    let self = this
    wallet.walletClear(self, args, cb)
  })
