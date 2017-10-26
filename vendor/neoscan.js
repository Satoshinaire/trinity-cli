const clients = require('restify-clients')
const q = require('q')

class Neoscan {
  constructor(network = 'MainNet') {
    if (network == 'MainNet') {
      this.client = clients.createJsonClient({
        url: 'https://neoscan.io',
        version: '~1.0'
      })
      this.path_prefix = '/api/main_net/v1'
    } else {
      this.client = clients.createJsonClient({
        url: 'https://neoscan-testnet.io',
        version: '~1.0'
      })
      this.path_prefix = '/api/test_net/v1'
    }
  }

  getInfo(type, hash) {
    let deferred = q.defer()
    let path = this.path_prefix + '/get_' + type + '/' + hash
    this.client.get(path, function (err, req, res, obj) {
      if (err) {
        deferred.reject(err)
      } else {
        if (typeof obj == 'string') {
          obj = JSON.parse(obj)
        }
        deferred.resolve(obj)
      }
    })
    return deferred.promise
  }

  getAddress(hash) {
    return this.getInfo('address', hash)
  }

  getAllNodes() {
    return this.getInfo('all_nodes')
  }

  getAsset(hash) {
    return this.getInfo('asset', hash)
  }

  getAssets() {
    return this.getInfo('assets')
  }

  getBalance(hash) {
    return this.getInfo('balance', hash)
  }

  getBlock(hash_or_integer) {
    return this.getInfo('block', hash_or_integer)
  }

  getClaimed(hash) {
    return this.getInfo('claimed', hash)
  }

  getHeight() {
    return this.getInfo('height')
  }

  getHighestBlock() {
    return this.getInfo('highest_block')
  }

  getLastBlocks() {
    return this.getInfo('last_blocks')
  }

  getLastTransactions(type) {
    return this.getInfo('last_transactions', type)
  }

  getNodes() {
    return this.getInfo('nodes')
  }

  getTransaction(hash) {
    return this.getInfo('transaction', hash)
  }
}

module.exports.Neoscan = Neoscan
