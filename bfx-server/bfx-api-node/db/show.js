'use strict'

/*
Create an array with whats being shown and go returning fromt the array
*/
const _ = require('lodash')

const {
  getMtsObWthLag,
  getPubTradWthLag,
  getPrvTradWthLag
} = require('./lag')

const pubTradesMts = {}
const pubTrades = []
const orderBookMts = {}
const orderBook = []
const privTradesMts = {}
const privTrades = []
let pubTradeFnc = null
let ordBookFnc = null
let onOrderUpdateFnc = null
let onOrderCloseFnc = null
let walletsNotifFnc = null
let lastOb = null
let mtsArr = null

const lastShownWallet = {}
const addPubTradeFnc = function (fnc) { pubTradeFnc = fnc }
const addOrdBookFnc = function (fnc) { ordBookFnc = fnc }
const addOnOrderUpdateFnc = function (fnc) { onOrderUpdateFnc = fnc }
const addOnOrderCloseFnc = function (fnc) { onOrderCloseFnc = fnc }
const addWalletsNotifFnc = function (fnc) { walletsNotifFnc = fnc }
const getOb = () => {
  if (lastOb) return lastOb
  // Just in case should not use this
  const keys = Object.keys(orderBookMts).sort()
  return orderBookMts[keys[0]][0]
}

function resetShowFncs () {
  addPubTradeFnc(null)
  addOrdBookFnc(null)
  addOnOrderUpdateFnc(null)
  addOnOrderCloseFnc(null)
  addWalletsNotifFnc(null)
  Object.keys(lastShownWallet).forEach(k => {
    delete lastShownWallet[k]
  })
}

function notifyWallets (snapshot) {
  if (!walletsNotifFnc) return false
  snapshot.forEach((s) => {
    const last = lastShownWallet[s.currency]
    if (!(last && _.isEqual(last, s))) {
      walletsNotifFnc(s)
      lastShownWallet[s.currency] = s
    }
  })
}

function addEditPrivateTradeToShow (mts, walletTrade) {
  return new Promise((resolve, reject) => {
    const lagMts = getPrvTradWthLag(mts)
    addMts(lagMts)
    if (privTradesMts[lagMts]) privTradesMts[lagMts].push(1)
    else privTradesMts[lagMts] = [1]
    const walletTradeClone = _.cloneDeep(walletTrade)
    privTrades.push({ ...walletTradeClone, resolve })
  })
}

/* function addExecPrivateTradeToShow () { // When trade is executed

} */

function notifyPrivateOrder (walletTrade) {
  const { order, walletsSnapshot, resolve } = walletTrade
  if (resolve) resolve(order) // First return
  const isClose = order.status.startsWith('EXECUTED') ||
    order.status.startsWith('CANCELED')
  notifyWallets(walletsSnapshot)
  if (isClose && onOrderCloseFnc) onOrderCloseFnc(order)
  if (!isClose && onOrderUpdateFnc) onOrderUpdateFnc(order)
}

function showPrivateTrade (mts) {
  if (!privTradesMts[mts]) return false
  const arr = privTradesMts[mts]
  arr.forEach(() => notifyPrivateOrder(privTrades.shift()))
  delete privTradesMts[mts]
}

function showPublicTrade (mts) {
  if (!pubTradeFnc) return false
  if (!pubTradesMts[mts]) return false
  const arr = pubTradesMts[mts]
  arr.forEach(() => pubTradeFnc(pubTrades.shift()))
  delete pubTradesMts[mts]
}

function addPubTradeToShow (mts, trade) {
  const lagMts = getPubTradWthLag(mts)
  addMts(lagMts)
  if (pubTradesMts[lagMts]) pubTradesMts[lagMts].push(1)
  else pubTradesMts[lagMts] = [1]
  const tradeClone = _.cloneDeep(trade)
  pubTrades.push(tradeClone)
}

function showOrderBook (mts) {
  if (!orderBookMts[mts]) return false
  const arr = orderBookMts[mts]
  delete orderBookMts[mts]
  arr.forEach(() => {
    lastOb = orderBook.shift()
    if (ordBookFnc) ordBookFnc(lastOb)
  })
}

function addOrderBookToShow (mts, ob) {
  const lagMts = getMtsObWthLag(mts)
  addMts(lagMts)
  if (orderBookMts[lagMts]) orderBookMts[lagMts].push(1)
  else orderBookMts[lagMts] = [1]
  const obClone = _.cloneDeep(ob)
  orderBook.push(obClone)
}

function setMtsArr (arr) {
  if (!(mtsArr && mtsArr.length)) {
    mtsArr = arr
  } else { // Adds to array if already exists
    const newArr = mtsArr.concat(arr)
    mtsArr = _.sortedUniq(newArr.sort())
  }
}

function getNextMts () {
  if (!(mtsArr && mtsArr.length)) return false // Ended
  return parseInt(mtsArr.shift()) // As to be a number
}

function getMts () {
  return parseInt(mtsArr[0]) || 'END'
}

function addMts (nro) {
  for (let i = 0; i < mtsArr.length; i++) {
    if (mtsArr[i] === nro.toString()) return true // Mts already there
    if (mtsArr[i] > nro) return mtsArr.splice(i, 0, nro.toString())
  }
  return mtsArr.push(nro)
}

module.exports = {
  // Public
  showPublicTrade,
  addPubTradeToShow,
  showOrderBook,
  addOrderBookToShow,
  addPubTradeFnc,
  addOrdBookFnc,
  // private
  addEditPrivateTradeToShow,
  showPrivateTrade,
  addOnOrderUpdateFnc,
  addOnOrderCloseFnc,
  addWalletsNotifFnc,
  notifyWallets,
  // General
  getOb,
  setMtsArr,
  getNextMts,
  getMts,
  // Specail
  resetShowFncs
}
