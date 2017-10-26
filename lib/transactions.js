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
const moment = require('moment')
const network = require('./network')
const Neoscan = require('../vendor/neoscan').Neoscan
const neoscan = new Neoscan(network.get())

const conf = new Configstore(pkg.name, defaultConfig)

function transactionShow(self, args, cb) {
  let txid = args.options.transaction || false
  if (!txid) {
    self.log(chalk.green('No transaction ID provided.'))
    cb()
  } else {
    neoscan.getTransaction(txid)
      .then((result) => {
        if (result.txid == 'not found') {
          self.log(chalk.green(' Transaction not found.'))
        } else {
          let overview = "\n"
          overview += chalk.bold.green(result.type.replace('Transaction', ''))
          overview += ' ' + txid + "\n"
          self.log(chalk.green(overview))

          let timestamp = chalk.bold.green('Time: ')
          timestamp += moment.unix(result.time).format('llll') + ' (Local)'
          timestamp += ' '
          timestamp += chalk.dim.green(moment.unix(result.time).utc().format('llll') + ' (UTC)')
          timestamp += "\n"
          self.log(chalk.green(timestamp))

          let blockheight = chalk.bold.green('Block: ')
          blockheight += result.block_height + chalk.dim.green(' (' + result.block_hash + ')')
          blockheight += "\n"
          self.log(chalk.green(blockheight))

          let tableData = []
          let vins = result.vin
          let vouts = result.vouts

          let rowCount = (vins.length > vouts.length ? vins.length : vouts.length)
          for (let i = 0; i < rowCount; i++) {
            let row = {
              From: chalk.green(vins[i] ? lookupAddress(vins[i].address_hash) : ''),
              In: chalk.green(vins[i] ? vins[i].value : ''),
              '->': chalk.green(vouts[i] ? vouts[i].asset : ''),
              Out: chalk.green(vouts[i] ? vouts[i].value : ''),
              To: chalk.green(vouts[i] ? lookupAddress(vouts[i].address) : '')
            }
            tableData.push(row)
          }

          self.log(asTable(tableData).toString())
          self.log('')
          winston.log('debug', 'Looking up transaction %s', txid, {
            metadata: result
          })
        }
        cb()
      })
      .catch((err) => {
        self.log(err)
        winston.log('error', 'Failed to look up transaction %s', txid, {
          metadata: err
        })
        cb()
      })
  }
}

function lookupAddress(address) {
  let output = address
  let addresses = conf.get('addresses')
  let contacts = conf.get('contacts')

  for (let i = 0; i < addresses.length; i++) {
    if (addresses[i].address == address) {
      output = addresses[i].label + ' (' + addresses[i].address + ')*'
    }
  }

  for (let i = 0; i < contacts.length; i++) {
    if (contacts[i].address == address) {
      output = contacts[i].label + ' (' + contacts[i].address + ')'
    }
  }

  return output
}

module.exports.show = transactionShow
