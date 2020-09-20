'use strict'

const eMth = require('exact-math')
const _ = require('lodash')

/*
  if (status.startsWith('EXECUTED')) return true
  if (status.includes('PARTIALLY FILLED')) return true
  ACTIVE, EXECUTED @ PRICE(AMOUNT) e.g. "EXECUTED @ 107.6(-0.2)", PARTIALLY FILLED @ PRICE(AMOUNT), I
  NSUFFICIENT MARGIN was: PARTIALLY FILLED @ PRICE(AMOUNT), CANCELED, CANCELED was: PARTIALLY FILLED @ PRICE(AMOUNT),
  RSN_DUST (amount is less than 0.00000001), RSN_PAUSE (trading is paused / paused due to AMPL rebase event)
*/
function resParseOrder (order) {
  const {
    id, gid, cid, symbol, mtsCreate, mtsUpdate, amount, amountOrig, type, typePrev,
    mtsTIF, flags, status, price, priceAvg, priceTrailing, priceAuxLimit, notify, placedId
  } = order
  return [
    id, gid, cid, symbol, mtsCreate, mtsUpdate, amount, amountOrig, type, typePrev,
    mtsTIF, null, flags, status, null, null, price, priceAvg, priceTrailing,
    priceAuxLimit, null, null, null, notify, null, placedId
  ]
}

function parseNewOrder (order, id, mts) {
  const { symbol, amount, price, type, flags = null } = order
  const status = 'ACTIVE'
  const mtsCreate = mts
  const mtsUpdate = mts
  const amountOrig = parseFloat(amount)
  const priceAvg = 0
  return {
    id,
    symbol,
    amount: parseFloat(amount),
    price: parseFloat(price),
    flags,
    type,
    status,
    mtsCreate,
    mtsUpdate,
    amountOrig,
    priceAvg
  }
}

function parseUpdateOrder (upd, order, mts) {
  const mtsUpdate = mts
  const price = parseFloat(upd.price || order.price)
  const amount = parseFloat(upd.amount || order.amount)
  const diffAmount = (upd.amount) ? eMth.sub(upd.amount, order.amount) : 0
  const amountOrig = eMth.add(order.amountOrig, diffAmount)
  const type = upd.type || order.type
  const updObj = { mtsUpdate, price, amount, amountOrig, type }
  if (upd.type && !order.typePrev) updObj.typePrev = order.type // This is not working when changeing to update type
  return _.assign(
    {},
    order,
    updObj
  )
}

function parseCancelOrder (order, mts) {
  const mtsUpdate = mts
  const status = (order.status === 'ACTIVE')
    ? 'CANCELED'
    : `CANCELED was: ${order.status}`
  return _.assign({}, order, { mtsUpdate, status })
}

function nwOrdToObj (o) {
  if (!o) return { err: 'empty' }
  return {
    id: o[0],
    gid: o[1],
    cid: o[2],
    symbol: o[3],
    mtsCreate: o[4],
    mtsUpdate: o[5],
    amount: o[6],
    amountOrig: o[7],
    type: o[8],
    typePrev: o[9],
    mtsTIF: o[10],
    flags: o[12],
    status: o[13],
    price: o[16],
    priceAvg: o[17],
    priceTrailing: o[18],
    priceAuxLimit: o[19],
    notify: o[23],
    placedId: o[25]
  }
}

module.exports = {
  resParseOrder,
  parseNewOrder,
  parseUpdateOrder,
  parseCancelOrder,
  nwOrdToObj
}
