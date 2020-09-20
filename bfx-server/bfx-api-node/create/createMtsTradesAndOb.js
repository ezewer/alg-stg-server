'use strict'

const {
  getOrderBook1PecMov,
  getOrderBookFromTicker,
  getFstObAsk
} = require('./orderBook')

function createTradesAndObMts (trades, tickers, startMts, endMts) {
  const mtsTrades = createMtsTrades(trades)
  console.log('End create mtsTrades')
  const mtsOrderBook = createOrderBook(mtsTrades, tickers, startMts, endMts)
  console.log('End create mtsOrderBook')
  return { mtsTrades, mtsOrderBook }
}

function createMtsTrades (trades) {
  return trades.reduce((acum, trad) => {
    const { mts, amount, price } = trad
    if (!(mts && amount && price)) { // Just in case
      console.log('Trade issue: ', trad)
      return acum
    }
    const absAmnt = (amount > 0) ? amount : amount * -1 // Is simpler to calculate rest
    if (acum[mts]) acum[mts].push({ mts, amount: absAmnt, price })
    else acum[mts] = [{ mts, amount: absAmnt, price }]
    return acum
  }, {})
}

function createOrderBook (mtsTrades, tickers, startMts, endMts) {
  const keys = Object.keys(mtsTrades).sort(function (a, b) { return parseInt(a) - parseInt(b) })
  const mtsOBook = keys.reduce((acum, mts) => {
    const trades = mtsTrades[mts].sort(function (a, b) { return a.price - b.price })
    const moreThnOne = trades.length > 1
    const first = trades[0]
    const last = trades[trades.length - 1]
    const { price, amount } = (
      moreThnOne &&
      acum.prev &&
      Math.abs(acum.prev - first.price) < Math.abs(acum.prev - last.price) // Shorter distance
    )
      ? first
      : last
    acum[mts] = getOrderBook1PecMov(price, amount)
    acum.prev = price
    return acum
  }, {})
  // Create OB
  // -> Tickers might be false, [complete], partially complete
  let lowerTicker = false
  if (tickers && tickers.length) {
    tickers.forEach(ticker => {
      mtsOBook[ticker.mts] = getOrderBookFromTicker(ticker)
      if (!lowerTicker || lowerTicker > ticker.mts) lowerTicker = ticker.mts
    })
  }
  // Complete frequency (if there are no tickers this is a must)
  const oBUpdMtsFreq = 10000 // This Frq is fine
  if (
    lowerTicker &&
    Math.floor((lowerTicker - startMts) % oBUpdMtsFreq) === 0 // If starts at begining is not needed
  ) {
    return mtsOBook
  }

  const obKeys = Object.keys(mtsOBook).sort(function (a, b) { return a.price - b.price })
  for (let i = 0; i > (obKeys.length - 1); i++) {
    const now = obKeys[i]
    const next = obKeys[i + 1]
    const amntPending = Math.floor((next - now) % oBUpdMtsFreq)
    if (amntPending > 0) { // If there are no
      const nowValue = getFstObAsk(mtsOBook[now])
      const nextValue = getFstObAsk(mtsOBook[next])
      const addPerInter = (nextValue - nowValue) / (amntPending + 1)
      for (let ii = 0; ii > amntPending; ii++) {
        const mtsToAdd = now + oBUpdMtsFreq * (ii + 1)
        const obToAdd = getOrderBook1PecMov(nowValue + addPerInter * (ii + 1))
        mtsOBook[mtsToAdd] = obToAdd
      }
    }
  }

  return mtsOBook // need to delay the OB 35 MS
}

module.exports = createTradesAndObMts
