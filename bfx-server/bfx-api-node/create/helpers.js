'use strict'

const mongoQ = require('../../../helpers/mongo')

async function findTrades (db, pair, start, end) {
  const query = { pair, mts: { $gte: start, $lt: end } }
  const fields = { price: 1, amount: 1, mts: 1 }
  const sort = { mts: -1 }
  return mongoQ._findFields(db, query, fields, 'pubTrades', 0, 0, sort)
}

async function findTickers (db, pair, start, end) {
  const query = { pair, mts: { $gte: start, $lt: end } }
  const fields = { bid: 1, ask: 1, mts: 1 }
  const sort = { mts: -1 }
  return mongoQ._findFields(db, query, fields, 'tickers', 0, 0, sort)
}

function addMonthToDate (date) {
  const cloneDate = new Date(date)
  const addMonthMts = cloneDate.setMonth(cloneDate.getMonth() + 1)
  return new Date(addMonthMts).getTime()
}

function addDayToDate (date) {
  const cloneDate = new Date(date)
  const addMonthMts = cloneDate.setDate(cloneDate.getDate() + 1)
  return new Date(addMonthMts).getTime()
}

module.exports = {
  findTrades,
  findTickers,
  addMonthToDate,
  addDayToDate
}
