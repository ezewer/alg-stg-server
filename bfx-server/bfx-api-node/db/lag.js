'use strict'

let mtsToAdd = 0
let mtsTill = 0

function setExtraLag (amnt, mts) {
  if (mtsTill && mts > mtsTill) {
    mtsToAdd = 0
    mtsTill = 0
  }
  if (amnt < 10) return
  const n = (amnt / 10)
  mtsToAdd += n
  const newTill = mts + n
  if (mtsTill < newTill) mtsTill = newTill
}

function getExtraLag (mts) {
  if (!mtsTill) return 0
  if (mts > mtsTill) {
    mtsToAdd = 0
    mtsTill = 0
    return 0
  }
  return mtsToAdd
}

function getMtsObWthLag (mts) {
  return 35// bstante fijo _addLag(mts, 30, 10)
}

function getPubTradWthLag (mts) {
  return _addLag(mts, 500, 35)
}

function getPrvTradWthLag (mts) {
  return _addLag(mts, 200, 15)
}

function _addLag (mts, max, min) {
  if (min > max) throw Error('Min cant be > than max')
  const lag = min + getExtraLag(mts) // parseInt(Math.random() * (max - min)) + min
  return parseInt(mts) + parseInt(lag) // If no parse it does not get mts as int
}

module.exports = {
  getMtsObWthLag,
  getPubTradWthLag,
  getPrvTradWthLag,
  setExtraLag
}
