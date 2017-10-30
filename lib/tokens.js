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
const rpc_node = (network.get() == 'MainNet' ? neonjs.CONST.DEFAULT_RPC.MAIN : neonjs.CONST.DEFAULT_RPC.TEST)

function tokenAdd(self, args, cb) {
  let tokens = conf.get('tokens')

  self.prompt([
    {
      type: 'input',
      name: 'hash',
      message: chalk.green('? Provide the hash for the token : ')
    }
  ], function (result) {
    if (result.hash.length >= 40 && result.hash.length <= 42) {
      if (result.hash.indexOf('0x') >= 0) {
        result.hash.replace('0x', '')
      }
      tokens[result.hash] = {}
      conf.set('tokens', tokens)
      self.log(chalk.green(' Token added. Your balance for this token will be updated shortly.'))
      winston.log('debug', 'Token added, hash %s', result.hash)
    } else {
      self.log(chalk.green(' Must be a valid token hash.'))
      winston.log('debug', 'Token hash %s incorrect length.', result.hash)
    }
    cb()
  })
}

function tokenRemove(self, args, cb) {
  let tokens = conf.get('tokens')
  let tokenList = []
  let removed = false
  if (tokens.length <= 0) {
    self.log(chalk.green(' No tokens found.'))
    winston.log('debug', 'Token removal failed. No tokens to remove.')
    cb()
  } else {
    for (let hash in tokens) {
      tokenList.push(tokens[hash].name + ' (' + hash + ')')
    }
    self.prompt({
      type: 'list',
      name: 'tokenSelection',
      message: chalk.green('Which token would you like to remove?'),
      choices: tokenList
    }, (result) => {
      let token = result.tokenSelection
      if (token.indexOf('(') >= 0) {
        let foundToken = token.match(/\((.*)\)/)
        token = foundToken[1]
      }
      for (let hash in tokens) {
        if (hash == token) {
          delete(tokens[hash])
          self.log(chalk.green(' Removed ' + result.tokenSelection))
          winston.log('info', 'Token removal succeeded for hash: %s', result.tokenSelection)
          removed = true
        }
      }
      conf.set('tokens', tokens)
      if (!removed) {
        self.log(chalk.green(' ' + result.tokenSelection + ' not found in local storage.'))
        winston.log('info', 'Token removal failed, hash %s not found in local storage.', result.tokenSelection)
      }
      cb()
    })
  }
}

function tokenList(self, args, cb) {
  let tableData = []
  let tokens = conf.get('tokens')
  if (tokens.length <= 0) {
    self.log(chalk.green(' No tokens found.'))
  } else {
    let tokenList = []
    for (let hash in tokens) {
      let row = {
        Symbol: chalk.green(tokens[hash].symbol),
        Name: chalk.green(tokens[hash].name),
        Decimals: chalk.green(tokens[hash].decimals),
        TotalSupply: chalk.green(tokens[hash].totalSupply),
        Hash: chalk.dim.green(hash)
      }
      tableData.push(row)
    }
    self.log(asTable(tableData).toString())
  }
  cb()
}

function updateTokens(self) {
  let deferred = q.defer()
  let tokens = conf.get('tokens')
  for (let hash in tokens) {
    neonjs.api.getTokenInfo(rpc_node, hash)
      .then((result) => {
        tokens[hash] = result
        conf.set('tokens', tokens)
        winston.log('silly', 'Updated info for token %s', hash, {
          metadata: result
        })
        deferred.resolve(true)
      })
      .catch((err) => {
        winston.log('debug', 'Token info update failed for token %s', hash, {
          metadata: err
        })
        deferred.resolve(false)
      })
  }
  return deferred.promise
}

module.exports.add = tokenAdd
module.exports.list = tokenList
module.exports.remove = tokenRemove
module.exports.update = updateTokens
