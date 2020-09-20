'use strict'

const createMtsTradesAndOb = require('./createMtsTradesAndOb')

const { setObAndPbTrades } = require('../db')

const {
  findTrades,
  findTickers,
  addDayToDate
} = require('./helpers')

let globalStart, globalEnd, globalDb, lastSync, globalPair, mtsStart
const mtsThreadHold = 100000

async function addMoreTradesAndOb (mts, force = false) {
  if (
    force || (lastSync < globalEnd && (mts + mtsThreadHold) > lastSync)
  ) {
    if (lastSync >= globalEnd) return true // already end
    const startMts = lastSync
    const endMts = Math.min(addDayToDate(lastSync), globalEnd)
    await addToPeriod(startMts, endMts)
    lastSync = endMts
    pendingTime()
  }
  return false // true for end
}

function pendingTime () {
  console.log('Start:', new Date(globalStart))
  console.log('End:', new Date(globalEnd))
  console.log('Actual:', new Date(lastSync))
  console.log('Now:', new Date())
  const spent = Date.now() - mtsStart
  const pending = parseInt(((spent / (lastSync - globalStart)) * (globalEnd - lastSync)) / 1000) // pending in secs
  const pendingSecs = parseNum(Math.floor(pending % 60))
  const pendingMins = parseNum(Math.floor((pending / 60) % 60))
  const pendingHrs = parseNum(Math.floor((pending / (60 * 60))))
  console.log(`Pending time: ${pendingHrs}:${pendingMins}:${pendingSecs}`)
}

function parseNum (n) {
  return (n >= 10) ? `${n}` : `0${n}`
}

async function addToPeriod (startMts, endMts) {
  const trades = await findTrades(globalDb, globalPair, startMts, endMts)
  const tickers = await findTickers(globalDb, globalPair, startMts, endMts)
  const { mtsOrderBook, mtsTrades } = createMtsTradesAndOb(trades, tickers, startMts, endMts)
  setObAndPbTrades(mtsOrderBook, mtsTrades) // How should we start trading now?
}

async function setParams (db, start, end, pair) {
  mtsStart = Date.now()
  globalDb = db
  globalStart = start
  lastSync = start
  globalEnd = end
  globalPair = pair
  await addMoreTradesAndOb(start)
}

module.exports = {
  setParams,
  addMoreTradesAndOb
}
