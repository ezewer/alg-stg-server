'use strict'

const eMth = require('exact-math')

const { type, currency } = require('../../../config/strategie.json')
const { makerFee, takerFee } = require('../../../config/general.json')
const { addToPosition } = require('./position')
const { getMts } = require('./show')

const isMargin = type === 'margin'

function executeOrder (wallet, order, prevAmnt, isMarketSell) {
  const execAmnt = eMth.sub(prevAmnt, order.amount)
  if (execAmnt > 0) return _execBuyOrder(wallet, order, execAmnt, isMarketSell)
  else return _execSellOrder(wallet, order, execAmnt, isMarketSell)
  // is margin trade?
}

function _execBuyOrder (wallet, order, execAmnt, isMarketSell) {
  const usdSpent = eMth.mul(execAmnt, order.price)
  const percFee = isMarketSell || (order.mtsCreate === order.mtsUpdate) // If created os eq to updated means a market sell
    ? takerFee && eMth.div(takerFee, 100)
    : makerFee && eMth.div(makerFee, 100)
  const usdFee = eMth.mul(usdSpent, percFee)
  const cryptoAdded = eMth.mul(execAmnt, eMth.sub(1, percFee))
  const usdRemove = eMth.mul(usdSpent, -1)
  addToPosition(order.price, usdRemove, cryptoAdded, usdFee, getMts(), isMarketSell)
  const walletsSnapshot = (isMargin)
    ? _calcWalletsMargin()
    : _calcWalletsExchange(wallet, eMth.mul(usdSpent, -1), cryptoAdded)
  return { order, walletsSnapshot }
}

// order, walletsSnapshot
function _calcWalletsExchange (wallet, usd, crypto) {
  wallet.USD.balance = eMth.add(wallet.USD.balance, usd)
  if (usd > 0) wallet.USD.balanceAvailable = eMth.add(wallet.USD.balanceAvailable, usd)
  wallet[currency].balance = eMth.add(wallet[currency].balance, crypto)
  if (crypto > 0) wallet[currency].balanceAvailable = eMth.add(wallet[currency].balanceAvailable, crypto)
  return Object.keys(wallet).map(w => {
    return { currency: w, ...wallet[w] }
  })
}

function _calcWalletsMargin () {
  throw new Error('NOT implemented yet')
}

function _execSellOrder (wallet, order, execAmnt, isMarketSell) {
  const usdTotal = eMth.mul(execAmnt, order.price, -1)
  const percFee = isMarketSell || (order.mtsCreate === order.mtsUpdate) // If created os eq to updated means a market sell
    ? takerFee && eMth.div(takerFee, 100)
    : makerFee && eMth.div(makerFee, 100)
  const usdFee = eMth.mul(usdTotal, percFee)
  const usdAdded = eMth.sub(usdTotal, usdFee)
  const cryptoRemoved = execAmnt

  addToPosition(order.price, usdAdded, cryptoRemoved, usdFee, getMts(), isMarketSell)
  const walletsSnapshot = (isMargin)
    ? _calcWalletsMargin()
    : _calcWalletsExchange(wallet, usdAdded, cryptoRemoved)
  return { order, walletsSnapshot }
}

module.exports = {
  executeOrder
}
