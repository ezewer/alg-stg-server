'use strict'

const DB = require('../db')
const {
  addMoreTradesAndOb
} = require('../create')

class WSv2 {
  constructor (opts) {
    // Set details start end, pairs, etc
    this._open = false
    this._notifInClose = false
  }

  // functions
  getOB (symbol) {
    return DB.getOb()
  }

  getMts () {
    return DB.getMts()
  }

  setWallets (wallets) {
    return DB.setWallets(wallets)
  }

  // Manage orders
  //  gid, cid, placedId NOT BEING USED AT THE MOMENT
  submitOrder (order) {
    // Submits an order
    return DB.submitOrder(order)
  }

  updateOrder (order) {
    // Updates an order
    return DB.updateOrder(order)
  }

  cancelOrder (id) {
    // cancels an order
    return DB.cancelOrder(id)
  }

  onOrderUpdate (symbObj, fnc) {
    DB.addOnOrderUpdateFnc(fnc)
  }

  onOrderClose (symbObj, fnc) {
    DB.addOnOrderCloseFnc(fnc)
  }

  // Wallets

  onWalletUpdate (symbol, fnc) { // Not implementing the symbol option
    // (w) => { wallet.update(w) }
    DB.setWalletsNotifFnc(fnc)
  }

  // UPDATES

  onTrades (symbObj, fnc) {
    // (t) => updatePublicTrade(t)
    DB.addPubTradeFnc(fnc)
  }

  onOrderBook (symbObj, fnc) {
    // (o) => updateOrderBook(o)
    DB.addOrdBookFnc(fnc)
  }

  // start
  addNotifInClose (fnc) {
    this._notifInClose = fnc
  }

  async on (type, fnc) {
    if (type !== 'open') throw new Error('unknown type: ', type)
    await fnc()
  }

  open () {
    if (this._open) throw new Error('Already opened')
    console.log('Opening the ws')
    this._open = true
    // start running
    this.startRunning()
  }

  async startRunning () {
    console.log('startRunning period')
    DB.resetClosedPositions()
    const sleep = (ms) => {
      return new Promise(resolve => setTimeout(resolve, ms))
    }
    let run = true
    let retry = false // As to be sure its not end by wrong
    while (run) {
      try {
        const mts = DB.nextMts()
        await sleep(0) // Give time to async functions to execute
        retry = await addMoreTradesAndOb(mts) // Would return false if there is more
      } catch (e) {
        if (retry) {
          if (e.message !== 'End period') console.log('Finish by error: ', e)
          run = false
        } else {
          console.log('Force the check!')
          retry = await addMoreTradesAndOb(null, true)// Force the sync process
        }
      }
    }
    this.close()
  }

  async close () {
    this._open = false
    // Notify on close as to keep to next fnc
    if (this._notifInClose) this._notifInClose()
    this._notifInClose = false
    DB.stopRunning()
  }

  // Special
  getClosedPositions () {
    return DB.getClosedPositions()
  }

  forceClosePositions () {
    return DB.forceClosePositions()
  }

  forceClearActiveOrders () {
    return DB.forceClearActiveOrders()
  }

  getActiveOrders () {
    return DB.getActiveOrders()
  }

  // CONSTANTS RETURNS
  isReconnecting () { return false }
  isAuthenticated () { return true }
  auth (...args) { return true }
  onServerRestart (fnc) { } // not going to restart server

  // no need to return features
  subscribeOrderBook (SYMBOL, PRECISION, LENGTH) { return true }
  unsubscribeOrderBook (SYMBOL, PRECISION, LENGTH) { return true }
  subscribeTrades (sSymb) { return true }
}

module.exports = { WSv2 }
