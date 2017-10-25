'use strict'

const chalk = require('chalk')

function doMatrix(trinity, matrixState) {
  switch (matrixState) {
    case 0:
      trinity.log('')
      trinity.log(matrixOne())
      trinity.log('')
      matrixState++
      break
    case 1:
      trinity.log('')
      trinity.log(matrixTwo())
      trinity.log('')
      matrixState = 0
      break
  }
  return matrixState
}

function matrixOne() {
  return chalk.bold.green(' Follow the white rabbit.')
}

function matrixTwo() {
  return chalk.bold.green(' Knock, knock, Neo.')
}

module.exports.do = doMatrix
