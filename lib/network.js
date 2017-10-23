'use strict'

const pkg = require('../package.json')
const Configstore = require('configstore')
const defaultConfig = require('../defaultConfig')
const neonjs = require('neon-js')
const chalk = require('chalk')
const q = require('q')
const winston = require('winston')

const conf = new Configstore(pkg.name, defaultConfig)

function getNetwork() {
  let networks = conf.get('networks')
  for (let i = 0; i < networks.length; i++) {
    if (networks[i].active) {
      return networks[i].name
    }
  }
}

function setNetwork(self, networkName, cb) {
  let networks = conf.get('networks')

  let networkChoices = [];
  let networkDefault = '';
  for (let i = 0; i < networks.length; i++) {
    networkChoices.push(networks[i].name)
    if (networks[i].active == true) {
      networkDefault = networks[i].name
    }
  }

  self.prompt({
    type: 'list',
    name: 'network',
    message: chalk.green('Which network would you like to use?'),
    choices: networkChoices,
    default: networkDefault
  }, function (result) {
    let networkName = result.network;
    for (let i = 0; i < networks.length; i++) {
      if (networks[i].name == networkName) {
        networks[i].active = true
      } else {
        networks[i].active = false
      }
    }
    conf.set('networks', networks)
    winston.log('info', 'Switched networks.', {
      metadata: networks
    })
    self.delimiter(chalk.dim.green('[' + getNetwork() + '] ') + chalk.green('trinity') + chalk.green(' >'))
    cb()
  })
}

module.exports.get = getNetwork
module.exports.set = setNetwork
