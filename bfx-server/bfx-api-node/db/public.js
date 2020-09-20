'use strict'

const _ = require('lodash')

const {
  showPublicTrade,
  addPubTradeToShow,
  showOrderBook,
  addOrderBookToShow,
  setMtsArr,
  getMts
} = require('./show')

let mtsOrderBook = null
let mtsTrades = null

// Por aca, hay algo mal en como vuelve a agregar datos
// Como que no los considera / vuelve a agregar bien
function setObAndPublicTrades (ob, pt) { // Creates the array thats going to run
  clearOldMts()
  mtsOrderBook = _.assign({}, mtsOrderBook, ob)
  mtsTrades = _.assign({}, mtsTrades, pt)
  const mtsArr = Object.keys(ob).sort()
  setMtsArr(mtsArr)
  return mtsArr[0] - 100
}

function clearOldMts () {
  if (!mtsOrderBook || getMts() === 'END') return true
  const mts = getMts()
  const threatHold = 10000
  Object.keys(mtsOrderBook).forEach(k => {
    if ((parseInt(k) + threatHold) < mts) delete mtsOrderBook[k]
  })
  Object.keys(mtsTrades).forEach(k => {
    if ((parseInt(k) + threatHold) < mts) delete mtsTrades[k]
  })
}

function unsetObAndPublicTrades () { // Stops running
  mtsOrderBook = {}
  mtsTrades = {}
  const mtsArr = []
  setMtsArr(mtsArr)
  return 0
}

function publicTradesFncs (mts) {
  showPublicTrade(mts)
  const trade = mtsTrades[mts] && mtsTrades[mts][0]
  if (!trade) return false // No trades to add
  addPubTradeToShow(mts, [trade])
  return mtsTrades[mts]
}

function orderBooksFncs (mts) {
  showOrderBook(mts)
  const ob = mtsOrderBook[mts]
  if (!ob) return false // No order book to add
  addOrderBookToShow(mts, ob)
}

module.exports = {
  setObAndPublicTrades,
  unsetObAndPublicTrades,
  publicTradesFncs,
  orderBooksFncs
}
