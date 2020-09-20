'use strict'

const eMth = require('exact-math')

function getOrderBook1PecMov (price, amount = 100) {
  return {
    bids: [[toFiveNumb(eMth.mul(price, 0.99998)), 1, amount]],
    asks: [[toFiveNumb(eMth.mul(price, 1.00002)), 1, amount]]
  }
}

function getOrderBookFromTicker (ticker) {
  const { bid, ask } = ticker
  const amount = 100 // Not worried about this at the moment
  return {
    bids: [[bid, 1, amount]],
    asks: [[ask, 1, amount]]
  }
}

function getFstObAsk (ob) {
  return ob.asks[0][0]
}

function getFstObBid (ob) {
  return ob.bids[0][0]
}

function toFiveNumb (num) {
  const ns = num.toString()
  const amnt = 5 + amntOfCerosOrDots(ns)
  const finalNs = ns.substring(0, amnt)
  return parseFloat(finalNs)
}

function amntOfCerosOrDots (sNum) {
  let i = 0
  for (let c = 0; ['0', '.'].includes(sNum[c]); c++) i++
  if (i === 0 && sNum.includes('.')) return 1
  return i
}

module.exports = {
  getOrderBook1PecMov,
  getOrderBookFromTicker,
  getFstObAsk,
  getFstObBid
}
