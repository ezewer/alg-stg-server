'use strict'

const {
  publicTradesFncs, orderBooksFncs, setObAndPublicTrades, unsetObAndPublicTrades
} = require('./public')

const {
  addPubTradeFnc, addOrdBookFnc, getOb, getNextMts,
  addOnOrderUpdateFnc, addOnOrderCloseFnc, getMts, resetShowFncs
} = require('./show')

const {
  privateTradesFncs, submitOrder, setWalletsNotifFnc, updateOrder, cancelOrder,
  setWallets, forceClearActiveOrders, getActiveOrders
} = require('./private')

const {
  resetOpenPositions,
  resetClosedPositions,
  getClosedPositions,
  forceClosePositions
} = require('./position')

const {
  setExtraLag
} = require('./lag')

let mts = null

function setObAndPbTrades (ob, pt) {
  mts = setObAndPublicTrades(ob, pt)
}

function unsetObAndPbTrades () {
  mts = unsetObAndPublicTrades()
}

function stopRunning () {
  unsetObAndPbTrades()
  resetShowFncs()
  resetOpenPositions()
}

function nextMts () {
  mts = getNextMts()
  if (!mts) throw new Error('End period')
  const trades = publicTradesFncs(mts)
  if (trades) setExtraLag(trades.length, mts)
  privateTradesFncs(mts, trades)
  orderBooksFncs(mts)
  // Execute private trades
  return getMts()
}

module.exports = {
  // Index
  setObAndPbTrades,
  stopRunning,
  nextMts,
  getMts,
  resetClosedPositions,
  // Show
  getOb,
  addPubTradeFnc,
  addOrdBookFnc,
  setWalletsNotifFnc,
  // Private
  setWallets,
  submitOrder,
  updateOrder,
  cancelOrder,
  addOnOrderUpdateFnc,
  addOnOrderCloseFnc,
  getClosedPositions,
  forceClosePositions,
  forceClearActiveOrders,
  getActiveOrders
}
