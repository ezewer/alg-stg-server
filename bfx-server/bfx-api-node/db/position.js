'use strict'

const eMth = require('exact-math')

let openPosition = null
let lastPosWasMarket = false
const closedPositions = []
const { makerFee, takerFee } = require('../../../config/general.json')
const { configPair } = require('../../../config/strategie.json')
const mongoQ = require('../../../helpers/mongo')
const pair = configPair.substring(1).toLowerCase()

function resetOpenPositions () { openPosition = null }
function resetClosedPositions () {
  while (closedPositions.length) closedPositions.pop()
}
function getClosedPositions () { return closedPositions }
function getOpenPositions () { return openPosition }

function isPositionOpen () { return !!openPosition }

function addToPosition (price, usd, crypto, usdFee, mts, isMarketSell) {
  lastPosWasMarket = isMarketSell
  if (!openPosition) return openAPosition(price, usd, crypto, usdFee, parseInt(mts), isMarketSell)
  const isCloseOp = eMth.add(openPosition.amount, crypto) === 0
  updatePosition(price, usd, crypto, usdFee, parseInt(mts), isMarketSell)

  if (isCloseOp) closeOpenPosition(crypto, isMarketSell)
}

function forceClosePositions () {
  if (!openPosition) return true
  const lastAmnt = openPosition.trades[openPosition.trades.length - 1].amount
  closeOpenPosition(lastAmnt, lastPosWasMarket)
}

function closeOpenPosition (crypto, isMarketSell) {
  const {
    pl,
    minPrice,
    maxPrice,
    maxAmount,
    isLong,
    basePriceOfMaxAmount,
    mtsCreate,
    mtsUpdate,
    usdFees,
    trades,
    orders,
    tradedVol,
    minPriceMts,
    maxPriceMts
  } = openPosition

  const isMarketClose = !!isMarketSell && eMth.div(crypto, maxAmount) // False or perc
  const bsTrdOfMxAmnt = eMth.mul(basePriceOfMaxAmount, maxAmount)
  const getPerc = (pl) => eMth.mul(eMth.div(pl, bsTrdOfMxAmnt), 100)
  const plPerc = getPerc(pl)
  const tkFee = eMth.sub(1, eMth.div(takerFee, 100))
  const mkrFee = eMth.sub(1, eMth.div(makerFee, 100))
  const worked = (pl < 0) ? -1 : (isMarketClose) ? 0 : 1

  const plMin = (isLong)
    ? eMth.sub(eMth.mul(minPrice, maxAmount, tkFee), bsTrdOfMxAmnt)
    : eMth.sub(bsTrdOfMxAmnt, eMth.mul(maxPrice, maxAmount, tkFee))

  const plMax = (isLong)
    ? eMth.sub(eMth.mul(maxPrice, maxAmount, mkrFee), bsTrdOfMxAmnt)
    : eMth.sub(bsTrdOfMxAmnt, eMth.mul(minPrice, maxAmount, mkrFee))

  const plPercMin = getPerc(plMin)
  const plPercMax = getPerc(plMax)
  const date = new Date(mtsUpdate)
  const month = date.getUTCMonth() + 1
  const year = date.getUTCFullYear()

  const mtsDuration = eMth.sub(mtsUpdate, mtsCreate)
  const mtsDurationMin = (isLong)
    ? eMth.sub(minPriceMts, mtsCreate)
    : eMth.sub(maxPriceMts, mtsCreate)
  const mtsDurationMax = (isLong)
    ? eMth.sub(maxPriceMts, mtsCreate)
    : eMth.sub(minPriceMts, mtsCreate)

  const clPos = {
    pair,
    worked, // 1 worked as expected + gain money, 0 didnt worked as expected lost money, -1 lost money
    isMarketClose, // false: was not close with a market order; (0-1) amount that was close with market order
    isLong, // true: long position, short: a short position
    maxAmount, // Max amount of the position
    startPrice: basePriceOfMaxAmount, // Price position was open
    minPrice, // Minimun price reached while trade was open
    maxPrice, // Maximun price reached while trade was open
    usdFees, // Fees in USD equivalent
    tradedVol, // Aproximate amount traded in USD equivalent (dont consider buy fee)
    pl, // Profits and Loss
    plPerc, // Profits and Loss express as a % of amount bought
    plMin, // The worst point of the position, considering exit with a taker fees
    plMax, // The Best point of the position, considering exit with a maker fees
    plPercMin, // The worst point of the position  express as a %, considering exit with a taker fees
    plPercMax, // The Best point of the position  express as a %, considering exit with a maker fees
    trades, // Trades, shown as an array
    orders,
    mtsCreate,
    mtsUpdate,
    month, // UTC month as to be sort later
    year, // UTC year as to be sort later
    mtsDuration, // Mts duration of the position
    mtsDurationMin, // Mts duration to min value
    mtsDurationMax // Mts duration to max value
  }
  mongoQ._insertOne(null, clPos, 'backtest') // No need to await
  closedPositions.push(clPos)
  openPosition = null
}

function openAPosition (price, usd, crypto, usdFee, mts) {
  const isLong = crypto > 0
  openPosition = {
    pl: usd,
    minPrice: price,
    maxPrice: price,
    amount: crypto,
    maxAmount: Math.abs(crypto),
    isLong,
    basePriceOfMaxAmount: price,
    mtsCreate: mts,
    mtsUpdate: mts,
    maxPriceMts: mts,
    minPriceMts: mts,
    usdFees: usdFee,
    trades: [parseTrade(price, crypto, usdFee, mts)],
    orders: [],
    tradedVol: Math.abs(usd)
  }
}

function parseTrade (price, crypto, usdFee, mts) {
  return { amount: crypto, price, usdFee, mts }
}

function updatePosition (price, usd, crypto, usdFee, mts, isMarketSell) {
  const oP = openPosition // Deep clone is not needed
  if (
    (oP.isLong && crypto > 0) || (!oP.isLong && crypto < 0)
  ) openPosition.maxAmount = eMth.add(oP.maxAmount, Math.abs(crypto))
  openPosition.amount = eMth.add(oP.amount, crypto)
  openPosition.tradedVol = eMth.add(oP.tradedVol, Math.abs(usd))
  openPosition.pl = eMth.add(oP.pl, usd)
  openPosition.usdFees = eMth.add(oP.usdFees, usdFee)
  openPosition.mtsUpdate = mts
  openPosition.trades.push(parseTrade(price, crypto, usdFee, mts))
  if (price < openPosition.minPrice) openPosition.minPrice = price
  if (price > openPosition.maxPrice) openPosition.maxPrice = price
}

function updatePositionsPl (minPrice, maxPrice, mts) { // Need to add this to trades
  if (!openPosition) return true
  if (minPrice < openPosition.minPrice) {
    openPosition.minPrice = minPrice
    openPosition.minPriceMts = mts
  }
  if (maxPrice > openPosition.maxPrice) {
    openPosition.maxPrice = maxPrice
    openPosition.maxPriceMts = mts
  }
}

function updatePositionsOrder (order, mts) {
  if (!openPosition) return true
  openPosition.orders.push({ ...order, mts })
}

/*
  Positions of BFX
  symbol: 0, --> Not for the moment as just one symbol
  status: 1, --> Not for the moment, active would be open and close closed
  amount: 2, //
  basePrice: 3,
  marginFunding: 4, --> Not for the moment
  marginFundingType: 5, --> Not for the moment
  pl: 6,
  plPerc: 7,
  liquidationPrice: 8, --> Not for the moment
  leverage: 9, --> Not for the moment
  id: 11, --> Not for the moment as just one symbol
  mtsCreate: 12,
  mtsUpdate: 13,
  type: 15, --> Not for the moment
  collateral: 17, --> Not for the moment
  collateralMin: 18, --> Not for the moment
  meta: 19 --> Not for the moment
*/

module.exports = {
  addToPosition,
  isPositionOpen,
  updatePositionsPl,
  resetOpenPositions,
  resetClosedPositions,
  getClosedPositions,
  getOpenPositions,
  forceClosePositions,
  updatePositionsOrder
}
