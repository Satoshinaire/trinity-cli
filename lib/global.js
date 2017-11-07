'use strict'

const pkg = require('../package.json')
const Configstore = require('configstore')
const defaultConfig = require('../defaultConfig')
const winston = require('winston')

const conf = new Configstore(pkg.name, defaultConfig)

function globalSet(key, val) {
  let tState = JSON.parse(process.env.TRINITY_STATE)
  tState[key] = val
  process.env.TRINITY_STATE = JSON.stringify(tState)
  return tState
}

function globalGet(key) {
  let tState = JSON.parse(process.env.TRINITY_STATE)
  if (tState[key] == undefined) {
    return false
  } else {
    return tState[key]
  }
}

module.exports.set = globalSet
module.exports.get = globalGet
