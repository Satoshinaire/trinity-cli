// @flow
const NETWORK = {
  MAIN: 'MainNet',
  TEST: 'TestNet'
}

const EXPLORER = {
  NEO_TRACKER: 'Neotracker',
  NEO_SCAN: 'Neoscan',
  ANT_CHAIN: 'Antchain'
}

const ASSETS = {
  NEO: 'NEO',
  GAS: 'GAS'
}

const ASSETS_LABELS = {
  [ASSETS.NEO]: 'Neo',
  [ASSETS.GAS]: 'Gas'
}

const BIP44_PATH =
  '8000002C' +
  '80000378' +
  '80000000' +
  '00000000' +
  '00000000'

module.exports.NETWORK = NETWORK
module.exports.EXPLORER = EXPLORER
module.exports.ASSETS = ASSETS
module.exports.ASSETS_LABEL = ASSETS_LABELS
module.exports.BIP44_PATH = BIP44_PATH
