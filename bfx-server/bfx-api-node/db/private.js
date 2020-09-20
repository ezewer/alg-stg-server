'use strict'

const eMth = require('exact-math')
const _ = require('lodash')
const { startUsd } = require('../../../config/general.json')
const { currency, configPair, type, invTable } = require('../../../config/strategie.json')
const { resParseOrder, parseNewOrder, parseUpdateOrder, parseCancelOrder } = require('./parse')
const { getMts } = require('./show')
const {
  addEditPrivateTradeToShow,
  showPrivateTrade,
  addWalletsNotifFnc,
  notifyWallets,
  getOb
} = require('./show')

const {
  executeOrder
} = require('./execute')

const {
  isPositionOpen,
  updatePositionsPl,
  updatePositionsOrder
} = require('./position')

const {
  promiseAll,
  isPostOnlyCancelNeeded,
  canOrderPriceExecute,
  canOrderAmountFullyExecute,
  calcPriceAvg
} = require('./helpers')

const wallet = {
  USD: { type, balance: startUsd, balanceAvailable: startUsd }
}
wallet[currency] = { type, balance: 0, balanceAvailable: 0 }

function setWallets (wallets) {
  Object.keys(wallets).forEach(k => {
    wallet[k] = wallets[k]
  })
}

let activeOrders = {}

function forceClearActiveOrders () {
  if (Object.keys(activeOrders).length) {
    console.log('DEBUG: Orders that where kept active: ', activeOrders)
  }
  activeOrders = {}
}

const invTableLength = Object.keys(invTable).length
function checkActiveOrdersLenght () {
  if (Object.keys(activeOrders).length > invTableLength) {
    console.log('activeOrders: ', activeOrders)
    throw new Error('Wrong set of orders, needs to be ended')
  }
}

function getActiveOrders () {
  return activeOrders
}

function privateTradesFncs (mts, trades) {
  showPrivateTrade(mts)
  if (trades) executePrivateTrades(mts, trades)
}

function executePrivateTrades (mts, publicTrades) {
  const actvOrders = Object.keys(activeOrders)
  if (!actvOrders.length && !isPositionOpen()) return true // Nothing to do

  const { maxPrice, minPrice } = publicTrades.reduce((acum, trade) => {
    const { price } = trade
    if (!acum.maxPrice || acum.maxPrice < price) acum.maxPrice = price
    if (!acum.minPrice || acum.minPrice > price) acum.minPrice = price
    return acum
  }, { maxPrice: false, minPrice: false })
  updatePositionsPl(minPrice, maxPrice, mts)

  if (!actvOrders.length) return true // Nothing to do
  const { maxBuy, minSell } = actvOrders.reduce((acum, k) => {
    const { amount, price } = activeOrders[k]
    if (amount > 0) {
      if (!acum.maxBuy || acum.maxBuy < price) acum.maxBuy = price
    }
    if (amount < 0) {
      if (!acum.minSell || acum.minSell > price) acum.minSell = price
    }
    return acum
  }, { maxBuy: false, minSell: false })

  if (maxBuy && maxBuy >= minPrice) _executeOrders(mts, publicTrades, 'buy')
  if (minSell && minSell <= maxPrice) _executeOrders(mts, publicTrades, 'sell')
}

function _executeOrders (mts, publicTrades, type) {
  const sortTrades = publicTrades.sort(
    (a, b) => parseFloat(a.price) - parseFloat(b.price)
  )

  const trades = (type === 'buy') ? sortTrades : sortTrades.reverse() // Sort according to buy or sell

  let order = _getOrderBuyMaxSellMinPrice(type)
  let prevAmnt = parseFloat(order.amount)

  const rereshValuesAndCheckIfStop = () => {
    order = _getOrderBuyMaxSellMinPrice(type)
    if (!order.id) return true // No more active orders
    prevAmnt = parseFloat(order.amount)

    return false
  }

  for (
    let i = 0;
    i < trades.length && canOrderPriceExecute(order, trades[i].price); // Price is sorted as to avoid checking more
    i++
  ) {
    const { amount } = trades[i]
    if (isPostOnlyCancelNeeded(order, mts)) {
      cancelOrder(order.id, mts)
      i-- // As to check again same trade
      if (rereshValuesAndCheckIfStop()) return true
    } else {
      if (!canOrderAmountFullyExecute(order, amount)) {
        order.amount = eMth.mul(
          eMth.sub(Math.abs(order.amount), amount),
          Math.sign(order.amount)
        )
      } else {
        order.amount = 0
        _executeOrder(mts, order, prevAmnt)
        trades[i].amount = eMth.sub(amount, Math.abs(order.amount)) // order.amount is negative, amount is positive
        i-- // As to check again same trade with the residual amount
        if (rereshValuesAndCheckIfStop()) return true
      }
    }
  }
  // Has not been stopped and returned before so order needs to execute
  _executeOrder(mts, order, prevAmnt)
}

function _executeOrder (mts, order, prevAmnt, isMarketSell) {
  if (order.amount === prevAmnt) return true // early exit
  order.priceAvg = calcPriceAvg(order, prevAmnt)
  order.mtsUpdate = parseInt(mts)
  const excTxt = (order.amount === 0) ? 'EXECUTED' : 'PARTIALLY FILLED'
  order.status = `${excTxt} @ ${order.priceAvg}(${eMth.sub(order.amountOrig, order.amount)})`
  const res = executeOrder(wallet, order, prevAmnt, isMarketSell)

  res.walletsSnapshot.forEach(w => {
    const { currency } = w
    wallet[currency] = w
  })

  addEditPrivateTradeToShow(mts, res) // Notify changes in order wallet
  if (order.amount === 0) delete activeOrders[res.order.id]
  else activeOrders[res.order.id] = res.order
}

function _getOrderBuyMaxSellMinPrice (type = 'buy') {
  const keepOrder = (prev, order) => {
    const { price, amount } = order
    return (type === 'buy')
      ? amount > 0 && (!prev.price || prev.price < price)
      : amount < 0 && (!prev.price || prev.price > price)
  }
  return Object.keys(activeOrders).reduce((o, k) => {
    if (keepOrder(o, activeOrders[k])) return activeOrders[k]
    return o
  }, { })
}

async function submitOrder (order) { // flags: 4096
  if (order.type && order.type.endsWith('MARKET')) {
    order.price = _getMarketExecPrice(order.amount)
  }
  const { symbol, amount, price, type } = order
  if (
    !(symbol && amount && type && price)
  ) throw new Error('submitOrder: information pending')
  _checkValidOrder(order)
  updatePositionsOrder(order, getMts())
  if (type.endsWith('MARKET')) return _execMarketOrder(order)
  const res = _setOrder(order)
  checkActiveOrdersLenght()// Prevent error of adding wrong orders
  await addEditPrivateTradeToShow(getMts(), res) // Adds Lag to response
  // Not having in consideration the post only option
  return resParseOrder(res.order) // Return is Array
}

function _checkValidOrder (order) {
  const { symbol, amount, price } = order
  if (configPair !== symbol) throw new Error('_validOrder: Wrong symbol')
  // Add a check for the minimun required
  if (parseFloat(amount) > 0) { // BUY
    const usdAmount = eMth.mul(amount, price)
    if (usdAmount > wallet.USD.balanceAvailable) {
      throw new Error('Invalid order: not enough')
    }
  } else { // Sell
    const cryptoAmount = eMth.mul(amount, -1)
    if (cryptoAmount > wallet[currency].balanceAvailable) {
      throw new Error('Invalid order: not enough')
    }
  }
}

function updateAvailableWallet (order) {
  const { amount, price } = order
  const parsAmount = parseFloat(amount)
  if (parsAmount > 0) { // BUY
    const usdAmount = eMth.mul(amount, price)
    const available = wallet.USD.balanceAvailable
    wallet.USD.balanceAvailable = eMth.sub(available, usdAmount)
  } else { // Sell
    const cryptoAmount = eMth.mul(amount, -1)
    const available = wallet[currency].balanceAvailable
    wallet[currency].balanceAvailable = eMth.sub(available, cryptoAmount)
  }
  return getWalletsSnapshot()
}

function _setOrder (sentOrder) {
  const id = createId()
  const walletsSnapshot = updateAvailableWallet(sentOrder)
  const order = parseNewOrder(sentOrder, id, getMts())
  activeOrders[id] = order
  return { order, walletsSnapshot }
}

let lastId = 100000000
function createId () {
  lastId++
  return lastId
}

async function _execMarketOrder (order) {
  const res = _setOrder(order)
  await promiseAll([
    addEditPrivateTradeToShow(getMts(), res), // First set
    _processMarketOrder(_.cloneDeep(res.order)) // Exec trade
  ])
  return resParseOrder(res.order)
}

function _processMarketOrder (order) {
  const prevAmnt = order.amount
  order.amount = 0
  return _executeOrder(getMts(), order, prevAmnt, true)
}

function _getMarketExecPrice (amount) { // On future have consideration of moving price
  const ob = getOb()
  return (amount > 0) ? ob.bids[0][0] : ob.asks[0][0]
}

async function updateOrder (order) {
  if (order.type && order.type.endsWith('MARKET')) {
    order.price = _getMarketExecPrice(order.amount)
  }
  // Aca
  _checkValidUpdOrder(order)
  const { id, type } = order
  if (type && type.endsWith('MARKET')) {
    const editedOrder = _.assign({}, activeOrders[id], order)
    updatePositionsOrder(editedOrder, getMts())
    return _updToMarketOrder(editedOrder)
  }
  const res = _updOrder(order)
  updatePositionsOrder(order, getMts())
  await addEditPrivateTradeToShow(getMts(), res)
  return resParseOrder(res.order)
}

function _updOrder (updOrder) {
  const { id } = updOrder
  const aO = activeOrders[id]
  const walletsSnapshot = updateAvailableWalletOnSetUpdate(updOrder, aO)
  const order = parseUpdateOrder(updOrder, aO, getMts())
  activeOrders[id] = order
  return { order, walletsSnapshot }
}

async function _updToMarketOrder (order) {
  const res = _updOrder(order)
  await promiseAll([
    addEditPrivateTradeToShow(getMts(), res), // First set
    _processMarketOrder(_.cloneDeep(res.order)) // Exec trade
  ])
  return resParseOrder(res.order)
}

function _checkValidUpdOrder (order) {
  if (!(order && order.id)) throw new Error('MALFORMED TRADE')
  const { id, symbol, amount, price } = order
  const aO = activeOrders[id]
  if (!aO) throw new Error('order: invalid')
  // General checks
  if (amount && (_.isNaN(amount) || amount === 0)) throw new Error('order: invalid')
  if (price && (_.isNaN(price) || price <= 0)) throw new Error('order: invalid')
  if (symbol && aO.symbol !== symbol) throw new Error('_validOrder: Wrong symbol')
  // Amount check
  if (!amount && price) return true // no need for further checks
  if (parseFloat(amount || aO.amount) > 0) { // BUY
    const prevUsdAmount = eMth.mul(aO.amount, aO.price)
    const actUsdAmount = eMth.mul(amount || aO.amount, price || aO.price)
    const usdDiff = eMth.sub(actUsdAmount, prevUsdAmount)
    if (usdDiff > wallet.USD.balanceAvailable) {
      throw new Error('Invalid order: not enough')
    }
  } else { // Sell
    if (!amount) return true // Price dont matter
    const prevCryptoAmount = eMth.mul(aO.amount, -1)
    const actCryptoAmount = eMth.mul(amount, -1)
    const cypDiff = eMth.sub(actCryptoAmount, prevCryptoAmount)
    if (cypDiff > wallet[currency].balanceAvailable) {
      throw new Error('Invalid order: not enough')
    }
  }
}

function updateAvailableWalletOnSetUpdate (order, aO) {
  const { amount, price } = order
  if (parseFloat(amount || aO.amount) > 0) { // BUY
    const prevUsdAmount = eMth.mul(aO.amount, aO.price)
    const actUsdAmount = eMth.mul(amount || aO.amount, price || aO.price)
    const usdDiff = eMth.sub(actUsdAmount, prevUsdAmount)
    const available = wallet.USD.balanceAvailable
    wallet.USD.balanceAvailable = eMth.sub(available, usdDiff)
  } else { // Sell, wont do an early exit for this
    const prevCryptoAmount = eMth.mul(aO.amount, -1)
    const actCryptoAmount = eMth.mul(amount, -1)
    const cypDiff = eMth.sub(actCryptoAmount, prevCryptoAmount)
    const available = wallet[currency].balanceAvailable
    wallet[currency].balanceAvailable = eMth.sub(available, cypDiff)
  }
  return getWalletsSnapshot()
}

function updateAvailableWalletOnCancel (aO) {
  const { amount, price } = aO
  if (parseFloat(amount) > 0) { // BUY
    const usdDiff = eMth.mul(amount, price)
    const available = wallet.USD.balanceAvailable
    wallet.USD.balanceAvailable = eMth.add(available, usdDiff)
  } else { // Sell, wont do an early exit for this
    const cypDiff = eMth.mul(amount, -1)
    const available = wallet[currency].balanceAvailable
    wallet[currency].balanceAvailable = eMth.add(available, cypDiff)
  }
  return getWalletsSnapshot()
}

function setWalletsNotifFnc (fnc) {
  addWalletsNotifFnc(fnc)
  const snapshot = getWalletsSnapshot()
  notifyWallets(snapshot) //
}

function getWalletsSnapshot () {
  return Object.keys(wallet).map(w => {
    return { currency: w, ...wallet[w] }
  })
}

async function cancelOrder (id, mts = getMts()) {
  if (!id) throw new Error('MALFORMED TRADE')
  const aO = activeOrders[id]
  if (!aO) throw new Error('order: invalid')
  const res = _canLimitOrder(id, mts)
  updatePositionsOrder(res.order, getMts())
  await addEditPrivateTradeToShow(mts, res)
  return resParseOrder(res.order)
}

function _canLimitOrder (id, mts) {
  const aO = activeOrders[id]
  const walletsSnapshot = updateAvailableWalletOnCancel(aO)
  const order = parseCancelOrder(aO, mts)
  delete activeOrders[id]
  return { order, walletsSnapshot }
}

module.exports = {
  setWallets, // Special Init
  privateTradesFncs,
  setWalletsNotifFnc,
  submitOrder,
  updateOrder,
  cancelOrder,
  forceClearActiveOrders,
  getActiveOrders
}
