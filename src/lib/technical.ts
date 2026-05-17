interface PriceData {
  date: string
  close: number
  high: number
  low: number
  volume: number
}

export function calculateMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null
  const slice = prices.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

export function calculateRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null
  let gains = 0, losses = 0
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function ema(prices: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  let prev = prices[0]
  result.push(prev)
  for (let i = 1; i < prices.length; i++) {
    prev = prices[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

export function calculateMACD(prices: number[]): { macd: number | null; signal: number | null; histogram: number | null } {
  if (prices.length < 35) return { macd: null, signal: null, histogram: null }
  const ema12 = ema(prices, 12)
  const ema26 = ema(prices, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i])
  const signalLine = ema(macdLine.slice(-9), 9)
  const macd = macdLine[macdLine.length - 1]
  const signal = signalLine[signalLine.length - 1]
  return { macd, signal, histogram: macd - signal }
}

export function calculateKD(data: PriceData[], period = 9): { k: number | null; d: number | null } {
  if (data.length < period) return { k: null, d: null }
  const recent = data.slice(-period)
  const highs = recent.map(d => d.high)
  const lows = recent.map(d => d.low)
  const currentClose = data[data.length - 1].close
  const highestHigh = Math.max(...highs)
  const lowestLow = Math.min(...lows)
  if (highestHigh === lowestLow) return { k: 50, d: 50 }
  const rsv = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100
  // simplified K/D (no smoothing history)
  const k = rsv
  const d = (k + k + 50) / 3 // approximate
  return { k: Math.round(k * 100) / 100, d: Math.round(d * 100) / 100 }
}

export function analyzeTechnical(priceData: any[]) {
  if (!priceData.length) return null
  const closes = priceData.map((p: any) => Number(p.close))
  const structured: PriceData[] = priceData.map((p: any) => ({
    date: p.date,
    close: Number(p.close),
    high: Number(p.max ?? p.high ?? p.close),
    low: Number(p.min ?? p.low ?? p.close),
    volume: Number(p.Trading_Volume ?? p.volume ?? 0),
  }))

  const ma5 = calculateMA(closes, 5)
  const ma20 = calculateMA(closes, 20)
  const ma60 = calculateMA(closes, 60)
  const rsi = calculateRSI(closes)
  const macd = calculateMACD(closes)
  const kd = calculateKD(structured)
  const currentPrice = closes[closes.length - 1]

  const volumes = structured.map(d => d.volume)
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(volumes.length, 20)
  const latestVolume = volumes[volumes.length - 1]
  const volumeRatio = avgVolume > 0 ? latestVolume / avgVolume : 1

  // 趨勢判斷
  const isBullish = ma5 && ma20 && ma5 > ma20
  const isAboveMa20 = ma20 && currentPrice > ma20
  const isAboveMa60 = ma60 && currentPrice > ma60
  const isRSIOverbought = rsi && rsi > 70
  const isRSIOversold = rsi && rsi < 30
  const isMACDBullish = macd.macd && macd.signal && macd.macd > macd.signal

  return {
    currentPrice,
    ma5: ma5 ? Math.round(ma5 * 100) / 100 : null,
    ma20: ma20 ? Math.round(ma20 * 100) / 100 : null,
    ma60: ma60 ? Math.round(ma60 * 100) / 100 : null,
    rsi: rsi ? Math.round(rsi * 100) / 100 : null,
    macd: {
      macd: macd.macd ? Math.round(macd.macd * 100) / 100 : null,
      signal: macd.signal ? Math.round(macd.signal * 100) / 100 : null,
      histogram: macd.histogram ? Math.round(macd.histogram * 100) / 100 : null,
    },
    kd: { k: kd.k, d: kd.d },
    volume: { latest: latestVolume, average: Math.round(avgVolume), ratio: Math.round(volumeRatio * 100) / 100 },
    signals: {
      isBullish: !!isBullish,
      isAboveMa20: !!isAboveMa20,
      isAboveMa60: !!isAboveMa60,
      isRSIOverbought: !!isRSIOverbought,
      isRSIOversold: !!isRSIOversold,
      isMACDBullish: !!isMACDBullish,
      isHighVolume: volumeRatio > 1.5,
    },
  }
}
