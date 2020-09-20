'use strict'

const eMth = require('exact-math')

function promiseAll (promises) {
  return new Promise((resolve, reject) => {
    Promise.all(promises)
      .then(value => resolve(value))
      .catch(e => reject(e))
  })
}

function isPostOnlyCancelNeeded (order, mts) {
  return _isPostOnlyFlag(order.flags) && mts === order.mtsCreate
}

function _isPostOnlyFlag (flag) {
  return parseInt(flag) === 4096
}

function canOrderPriceExecute (order, price) { // price <= order.price
  if (!price) return false
  if (order.amount > 0) return price <= order.price // buy
  if (order.amount < 0) return price >= order.price // Sell
  return false
}

function canOrderAmountFullyExecute (order, amount) {
  if (!amount) return false
  return Math.abs(amount) >= Math.abs(order.amount)
}

function calcPriceAvg (order, prevAmnt) {
  const { amount, price, amountOrig, priceAvg } = order
  if (priceAvg === 0) return price // Was not previous sell
  const amntSold = eMth.sub(prevAmnt, amount)
  const soldBefore = eMth.sub(amountOrig, prevAmnt)
  return eMth.div(
    eMth.add(
      eMth.mul(amntSold, price),
      eMth.mul(soldBefore, priceAvg)
    ),
    eMth.add(amntSold, soldBefore)
  )
}

module.exports = {
  promiseAll,
  isPostOnlyCancelNeeded,
  canOrderAmountFullyExecute,
  canOrderPriceExecute,
  calcPriceAvg
}
