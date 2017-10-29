const axios = require('axios')
const commNode = require('../ledger/ledger-comm-node')
const BIP44_PATH = require('../constants').BIP44_PATH
const neonjs = require('neon-js')

const CURRENT_VERSION = 0

const ledgerNanoSCreateSignatureAsync = async(txData) => {
  return new Promise((resolve, reject) => {
    let signatureInfo = 'Ledger Signing Text of Length [' + txData.length + "], Please Confirm Using the Device's Buttons. " + txData
    const signData = txData + BIP44_PATH
    // process.stdout.write(signatureInfo + '\n')
    const validStatus = [0x9000]
    const messages = []

    const bufferSize = 255 * 2
    let offset = 0
    while (offset < signData.length) {
      let chunk
      let p1
      if ((signData.length - offset) > bufferSize) {
        chunk = signData.substring(offset, offset + bufferSize)
      } else {
        chunk = signData.substring(offset)
      }
      if ((offset + chunk.length) === signData.length) {
        p1 = '80'
      } else {
        p1 = '00'
      }

      const chunkLength = chunk.length / 2
      // process.stdout.write('Ledger Signature chunkLength ' + chunkLength + '\n')

      let chunkLengthHex = chunkLength.toString(16)
      while (chunkLengthHex.length < 2) {
        chunkLengthHex = '0' + chunkLengthHex
      }
      // process.stdout.write('Ledger Signature chunkLength hex ' + chunkLengthHex + '\n')
      // console.log('chunk.length', chunk.length)
      // console.log('signData.length', signData.length)

      messages.push('8002' + p1 + '00' + chunkLengthHex + chunk)
      offset += chunk.length
    }

    // console.log('what is messages', messages)
    commNode.create_async(0, false).then((comm) => {
      // console.log('what is comm', comm)
      for (let ix = 0; ix < messages.length; ix++) {
        let message = messages[ix]
        // process.stdout.write('Ledger Message (' + ix + '/' + messages.length + ') ' + message + '\n')

        comm.exchange(message, validStatus).then((response) => {
          // process.stdout.write('Ledger Signature Response ' + response + '\n')
          if (response !== '9000') {
            comm.device.close()

            /**
             * https://stackoverflow.com/questions/25829939/specification-defining-ecdsa-signature-data <br>
             * the signature is TLV encoded. the first byte is 30, the "signature" type<br>
             * the second byte is the length (always 44)<br>
             * the third byte is 02, the "number: type<br>
             * the fourth byte is the length of R (always 20)<br>
             * the byte after the encoded number is 02, the "number: type<br>
             * the byte after is the length of S (always 20)<br>
             * <p>
             * eg:
             * 304402200262675396fbcc768bf505c9dc05728fd98fd977810c547d1a10c7dd58d18802022069c9c4a38ee95b4f394e31a3dd6a63054f8265ff9fd2baf68a9c4c3aa8c5d47e9000
             * is 30LL0220RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR0220SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS
             */

            let rLenHex = response.substring(6, 8)
            // process.stdout.write('Ledger Signature rLenHex ' + rLenHex + '\n')
            let rLen = parseInt(rLenHex, 16) * 2
            // process.stdout.write('Ledger Signature rLen ' + rLen + '\n')
            let rStart = 8
            // process.stdout.write('Ledger Signature rStart ' + rStart + '\n')
            let rEnd = rStart + rLen
            // process.stdout.write('Ledger Signature rEnd ' + rEnd + '\n')

            while ((response.substring(rStart, rStart + 2) === '00') && ((rEnd - rStart) > 64)) {
              rStart += 2
            }

            let r = response.substring(rStart, rEnd)
            // process.stdout.write('Ledger Signature R [' + rStart + ',' + rEnd + ']:' + (rEnd - rStart) + ' ' + r + '\n')
            let sLenHex = response.substring(rEnd + 2, rEnd + 4)
            // process.stdout.write('Ledger Signature sLenHex ' + sLenHex + '\n')
            let sLen = parseInt(sLenHex, 16) * 2
            // process.stdout.write('Ledger Signature sLen ' + sLen + '\n')
            let sStart = rEnd + 4
            // process.stdout.write('Ledger Signature sStart ' + sStart + '\n')
            let sEnd = sStart + sLen
            // process.stdout.write('Ledger Signature sEnd ' + sEnd + '\n')

            while ((response.substring(sStart, sStart + 2) === '00') && ((sEnd - sStart) > 64)) {
              sStart += 2
            }

            let s = response.substring(sStart, sEnd)
            // process.stdout.write('Ledger Signature S [' + sStart + ',' + sEnd + ']:' + (sEnd - sStart) + ' ' + s + '\n')

            // let msgHashStart = sEnd + 4
            // let msgHashEnd = msgHashStart + 64
            // let msgHash = response.substring(msgHashStart, msgHashEnd)
            // process.stdout.write('Ledger Signature msgHash [' + msgHashStart + ',' + msgHashEnd + '] ' + msgHash + '\n')

            while (r.length < 64) {
              r = '00' + r
            }

            while (s.length < 64) {
              s = '00' + s
            }

            let signature = r + s
            // let signatureInfo = 'Signature of Length [' + signature.length + '] : ' + signature
            // process.stdout.write('r[' + r.length + ']:"' + r + '"+s[' + s.length + ']"' + s + '" =' + signatureInfo + '\n')

            resolve(signature)
          }
        }).catch((reason) => {
          comm.device.close()
          signatureInfo = 'An error occured[1]: ' + reason
          // process.stdout.write('Signature Reponse ' + signatureInfo + '\n')
          reject(signatureInfo)
        })
      }
    }).catch((reason) => {
      signatureInfo = 'An error occured[2]: ' + reason
      // process.stdout.write('Signature Reponse ' + signatureInfo + '\n')
      reject(signatureInfo)
    })
  })
}

const hardwareDoClaimAllGas = (net, publicKey, signingFunction) => {
  return new Promise(function (resolve, reject) {
    ledgerNanoSGetdoClaimAllGas(net, publicKey, ledgerNanoSCreateSignatureAsync).then((response) => {
      resolve(response)
    }).catch(function (reason) {
      // process.stdout.write('failure hardwareDoClaimAllGas ' + reason + '\n')
      // process.stdout.write('failure hardwareDoClaimAllGas ' + reason.stack + '\n')
      reject(reason)
    })
  })
}

const hardwareDoSendAsset = (net, sendAddress, publicKey, sendAsset, signingFunction) => {
  return new Promise(function (resolve, reject) {
    ledgerNanoSGetdoSendAsset(net, sendAddress, sendAsset, ledgerNanoSCreateSignatureAsync, publicKey).then((response) => {
      resolve(response)
    }).catch(function (reason) {
      // process.stdout.write('failure hardwareDoSendAsset ' + reason + '\n')
      // process.stdout.write('failure hardwareDoSendAsset ' + reason.stack + '\n')
      reject(reason)
    })
  })
}

const ledgerNanoSGetdoSendAsset = (net, toAddress, assetAmounts, signingFunction, publicKey) => {
  return new Promise(function (resolve, reject) {
    // process.stdout.write('started ledgerNanoSGetdoSendAsset net "' + JSON.stringify(net) + '"\n')
    // process.stdout.write('started ledgerNanoSGetdoSendAsset toAddress "' + JSON.stringify(toAddress) + '"\n')
    // process.stdout.write('started ledgerNanoSGetdoSendAsset assetAmounts "' + JSON.stringify(assetAmounts) + '"\n')
    // process.stdout.write('started ledgerNanoSGetdoSendAsset signingFunctionFn "' + (signingFunction instanceof Function) + '"\n')
    // process.stdout.write('interim ledgerNanoSGetdoSendAsset publicKey "' + JSON.stringify(publicKey) + '" \n')
    const publicKeyEncoded = neonjs.getPublicKeyEncoded(publicKey)
    // process.stdout.write('interim ledgerNanoSGetdoSendAsset publicKeyEncoded "' + JSON.stringify(publicKeyEncoded) + '" \n')
    const fromAccount = neonjs.getAccountFromPublicKey(publicKeyEncoded)
    // process.stdout.write('interim ledgerNanoSGetdoSendAsset fromAccount "' + JSON.stringify(fromAccount) + '" \n')
    // process.stdout.write('interim ledgerNanoSGetdoSendAsset toAddress "' + toAddress + '" \n')
    const toScriptHash = neonjs.getScriptHashFromAddress(toAddress)
    // process.stdout.write('interim ledgerNanoSGetdoSendAsset toScriptHash "' + toScriptHash + '" \n')

    return neonjs.getBalance(net, fromAccount.address).then((balances) => {
      // process.stdout.write('interim ledgerNanoSGetdoSendAsset getBalance assetAmounts "' + JSON.stringify(assetAmounts) + '" balances "' + JSON.stringify(balances) + '" \n')
      /* eslint-disable */
      const intents = _.map(assetAmounts, (v, k) => {
        return {
          assetId: neonjs.ASSETS[k],
          value: v,
          scriptHash: toScriptHash
        }
      })
      /* eslint-enable */
      // process.stdout.write('interim ledgerNanoSGetdoSendAsset transferTransaction \n')
      // process.stdout.write('interim ledgerNanoSGetdoSendAsset create.contract publicKeyEncoded "' + JSON.stringify(fromAccount.publicKeyEncoded) + '"\n')
      // process.stdout.write('interim ledgerNanoSGetdoSendAsset create.contract balances "' + JSON.stringify(balances) + '"\n')
      // process.stdout.write('interim ledgerNanoSGetdoSendAsset create.contract intents "' + JSON.stringify(intents) + '"\n')
      // process.stdout.write('interim ledgerNanoSGetdoSendAsset create.contract src "' + create.contract + '" \n')
      // process.stdout.write('interim ledgerNanoSGetdoSendAsset create.contract src "' + JSON.stringify(create.contract) + '" \n')
      // process.stdout.write('interim ledgerNanoSGetdoSendAsset calculateInputs src "' + calculateInputs + '" \n')
      // process.stdout.write('interim ledgerNanoSGetdoSendAsset calculateInputs src "' + JSON.stringify(calculateInputs) + '" \n')

      const unsignedTx = ContractTx(fromAccount.publicKeyEncoded, balances, intents)
      // process.stdout.write('interim ledgerNanoSGetdoSendAsset serializeTransaction unsignedTx "' + JSON.stringify(unsignedTx) + '" \n')
      const txData = neonjs.serializeTransaction(unsignedTx)
      // process.stdout.write('interim ledgerNanoSGetdoSendAsset txData "' + txData + '" \n')
      signingFunction(txData).then((sign) => {
        // process.stdout.write('interim ledgerNanoSGetdoSendAsset sign1 "' + JSON.stringify(sign) + '" \n')
        // process.stdout.write('interim ledgerNanoSGetdoSendAsset sign2 "' + JSON.stringify(sign) + '" \n')
        // process.stdout.write('interim ledgerNanoSGetdoSendAsset sign account "' + JSON.stringify(fromAccount) + '" \n')
        // process.stdout.write('interim ledgerNanoSGetdoSendAsset sign account.publicKeyEncoded "' + fromAccount.publicKeyEncoded + '" \n')
        // process.stdout.write('interim ledgerNanoSGetdoSendAsset sign Ledger "' + sign + '" \n')
        const txRawData = neonjs.addContract(txData, sign, fromAccount.publicKeyEncoded)
        neonjs.queryRPC(net, 'sendrawtransaction', [txRawData], 4).then((response) => {
          // process.stdout.write('interim ledgerNanoSGetdoSendAsset sendrawtransaction "' + JSON.stringify(response) + '" \n')
          resolve(response)
        }).catch(function (reason) {
          // process.stdout.write('failure ledgerNanoSGetdoSendAsset1 ' + reason + '\n')
          // process.stdout.write('failure ledgerNanoSGetdoSendAsset1 ' + reason.stack + '\n')
          reject(reason)
        })
      }).catch(function (reason) {
        // process.stdout.write('failure ledgerNanoSGetdoSendAsset2 ' + reason + '\n')
        // process.stdout.write('failure ledgerNanoSGetdoSendAsset2 ' + reason.stack + '\n')
        reject(reason)
      })
    }).catch(function (reason) {
      // process.stdout.write('failure ledgerNanoSGetdoSendAsset4 ' + reason + '\n')
      // process.stdout.write('failure ledgerNanoSGetdoSendAsset4 ' + reason.stack + '\n')
      reject(reason)
    })
  })
}

const ledgerNanoSGetdoClaimAllGas = (net, publicKey, signingFunction) => {
  return new Promise(function (resolve, reject) {
    // process.stdout.write('started ledgerNanoSGetdoClaimAllGas signingFunction "' + JSON.stringify(signingFunction) + '"\n')
    const apiEndpoint = neonjs.getAPIEndpoint(net)
    const publicKeyEncoded = neonjs.getPublicKeyEncoded(publicKey)
    // process.stdout.write('interim ledgerNanoSGetdoClaimAllGas publicKeyEncoded "' + JSON.stringify(publicKeyEncoded) + '" \n')
    const fromAccount = neonjs.getAccountFromPublicKey(publicKeyEncoded)
    // process.stdout.write('interim ledgerNanoSGetdoClaimAllGas fromAccount "' + JSON.stringify(fromAccount) + '" \n')
    // process.stdout.write('interim ledgerNanoSGetdoClaimAllGas sign fromAccount "' + JSON.stringify(fromAccount) + '" \n')
    // TODO: when fully working replace this with mainnet/testnet switch
    return axios.get(apiEndpoint + '/v2/address/claims/' + fromAccount.address).then((response) => {
      // process.stdout.write('interim ledgerNanoSGetdoClaimAllGas sign signingFunction "' + (signingFunction instanceof Function) + '" \n')
      const txData = neonjs.serializeTransaction(neonjs.create.claim(fromAccount.publicKeyEncoded, response.data))
      // process.stdout.write('interim ledgerNanoSGetdoClaimAllGas txData "' + txData + '" \n')
      signingFunction(txData).then((sign) => {
        // process.stdout.write('interim ledgerNanoSGetdoClaimAllGas sign fromAccount "' + JSON.stringify(fromAccount) + '" \n')
        // process.stdout.write('interim ledgerNanoSGetdoClaimAllGas sign fromAccount.publicKeyEncoded "' + fromAccount.publicKeyEncoded + '" \n')
        // process.stdout.write('interim ledgerNanoSGetdoClaimAllGas sign Ledger "' + sign + '" \n')
        const txRawData = neonjs.addContract(txData, sign, fromAccount.publicKeyEncoded)
        neonjs.queryRPC(net, 'sendrawtransaction', [txRawData], 4).then((response) => {
          resolve(response)
        }).catch(function (reason) {
          // process.stdout.write('failure ledgerNanoSGetdoClaimAllGas ' + reason + '\n')
          reject(reason)
        })
      }).catch(function (reason) {
        // process.stdout.write('failure ledgerNanoSGetdoClaimAllGas ' + reason + '\n')
        reject(reason)
      })
    }).catch(function (reason) {
      // process.stdout.write('failure ledgerNanoSGetdoClaimAllGas ' + reason + '\n')
      reject(reason)
    })
  })
}

const ContractTx = (publicKey, balances, intents, override = {}) => {
  // process.stdout.write('ContractTx publicKey ' + JSON.stringify(publicKey) + '\n')
  const tx = Object.assign({
    type: 128,
    version: CURRENT_VERSION,
    scripts: []
  }, override)
  // process.stdout.write('ContractTx tx ' + JSON.stringify(tx) + '\n')
  const attributes = []
  // process.stdout.write('ContractTx attributes ' + JSON.stringify(attributes) + '\n')
  let {
    inputs,
    change
  } = calculateInputs(publicKey, balances, intents)
  return Object.assign(tx, {
    inputs,
    attributes,
    outputs: intents.concat(change)
  }, override)
}

const calculateInputs = (publicKey, balances, intents, gasCost = 0) => {
  // process.stdout.write('calculateInputs publicKey ' + JSON.stringify(publicKey) + '\n')
  // We will work in integers here to be more accurate.
  // As assets are stored as Fixed8, we just multiple everything by 10e8 and round off to get integers.
  const requiredAssets = intents.reduce((assets, intent) => {
    const fixed8Value = Math.round(intent.value * 100000000)
    assets[intent.assetId] ? assets[intent.assetId] += fixed8Value : assets[intent.assetId] = fixed8Value
    return assets
  }, {})

  // process.stdout.write('calculateInputs requiredAssets ' + JSON.stringify(requiredAssets) + '\n')

  // Add GAS cost in
  if (gasCost > 0) {
    const fixed8GasCost = gasCost * 100000000
    requiredAssets[neonjs.ASSETS.GAS] ? requiredAssets[neonjs.ASSETS.GAS] += fixed8GasCost : requiredAssets[neonjs.ASSETS.GAS] = fixed8GasCost
  }
  let change = []
  const inputs = Object.keys(requiredAssets).map((assetId) => {
    const requiredAmt = requiredAssets[assetId]
    const assetBalance = balances[neonjs.ASSETS[assetId]]
    // process.stdout.write('calculateInputs assetId ' + JSON.stringify(assetId) + '\n')
    // process.stdout.write('calculateInputs ASSETS[assetId] ' + JSON.stringify(ASSETS[assetId]) + '\n')
    // process.stdout.write('calculateInputs balances[ASSETS[assetId]] ' + JSON.stringify(balances[ASSETS[assetId]]) + '\n')

    if (assetBalance.balance * 100000000 < requiredAmt) throw new Error(`Insufficient ${neonjs.ASSETS[assetId]}! Need ${requiredAmt / 100000000} but only found ${assetBalance.balance}`)
    // Ascending order sort
    assetBalance.unspent.sort((a, b) => a.value - b.value)
    let selectedInputs = 0
    let selectedAmt = 0
    // Selected min inputs to satisfy outputs
    while (selectedAmt < requiredAmt) {
      selectedInputs += 1
      selectedAmt += Math.round(assetBalance.unspent[selectedInputs - 1].value * 100000000)
    }
    // Construct change output
    if (selectedAmt > requiredAmt) {
      change.push({
        assetId,
        value: (selectedAmt - requiredAmt) / 100000000,
        scriptHash: neonjs.getScriptHashFromPublicKey(publicKey)
      })
    }
    // Format inputs
    return assetBalance.unspent.slice(0, selectedInputs).map((input) => {
      return {
        prevHash: input.txid,
        prevIndex: input.index
      }
    })
  }).reduce((prev, curr) => prev.concat(curr), [])
  return {
    inputs,
    change
  }
}

module.exports.CURRENT_VERSION = CURRENT_VERSION
module.exports.ledgerNanoSCreateSignatureAsync = ledgerNanoSCreateSignatureAsync
module.exports.hardwareDoClaimAllGas = hardwareDoClaimAllGas
module.exports.hardwareDoSendAsset = hardwareDoSendAsset
module.exports.ledgerNanoSGetdoSendAsset = ledgerNanoSGetdoSendAsset
module.exports.ledgerNanoSGetdoClaimAllGas = ledgerNanoSGetdoClaimAllGas
module.exports.ContractTx = ContractTx
