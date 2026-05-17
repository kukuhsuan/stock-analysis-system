import axios from 'axios'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
}

function getStartTimestamp(daysAgo: number): number {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return Math.floor(d.getTime() / 1000)
}

// 股票基本資訊 + 即時股價
export async function getUSStockInfo(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`
    const res = await axios.get(url, {
      params: { interval: '1d', range: '5d' },
      headers: HEADERS,
      timeout: 10000,
    })
    const result = res.data?.chart?.result?.[0]
    if (!result) return null
    const meta = result.meta
    const quotes = result.indicators?.quote?.[0]
    const timestamps = result.timestamp ?? []

    const lastIdx = timestamps.length - 1
    const prevIdx = timestamps.length - 2

    const close = quotes?.close?.[lastIdx]
    const prevClose = quotes?.close?.[prevIdx] ?? meta.previousClose ?? meta.regularMarketPreviousClose
    const change = close && prevClose ? close - prevClose : 0
    const changePercent = prevClose ? (change / prevClose) * 100 : 0

    return {
      symbol: meta.symbol ?? symbol,
      name: meta.longName ?? meta.shortName ?? symbol,
      market: 'US',
      industry: '',
      currency: meta.currency ?? 'USD',
      exchange: meta.exchangeName ?? '',
      price: {
        date: new Date((timestamps[lastIdx] ?? 0) * 1000).toISOString().split('T')[0],
        close: close ?? meta.regularMarketPrice,
        open: quotes?.open?.[lastIdx] ?? meta.regularMarketOpen,
        high: quotes?.high?.[lastIdx] ?? meta.regularMarketDayHigh,
        low: quotes?.low?.[lastIdx] ?? meta.regularMarketDayLow,
        volume: quotes?.volume?.[lastIdx] ?? meta.regularMarketVolume,
        change,
        changePercent,
      }
    }
  } catch { return null }
}

// 歷史股價（for 技術指標）
export async function getUSStockPrice(symbol: string, days = 90) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`
    const res = await axios.get(url, {
      params: {
        interval: '1d',
        period1: getStartTimestamp(days),
        period2: Math.floor(Date.now() / 1000),
      },
      headers: HEADERS,
      timeout: 15000,
    })
    const result = res.data?.chart?.result?.[0]
    if (!result) return []
    const timestamps = result.timestamp ?? []
    const quotes = result.indicators?.quote?.[0] ?? {}
    return timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      close: quotes.close?.[i],
      open: quotes.open?.[i],
      max: quotes.high?.[i],
      min: quotes.low?.[i],
      Trading_Volume: quotes.volume?.[i],
    })).filter((d: any) => d.close != null)
  } catch { return [] }
}

// 財報 + 估值指標
export async function getUSStockFundamentals(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}`
    const modules = [
      'incomeStatementHistory',
      'balanceSheetHistory',
      'defaultKeyStatistics',
      'summaryDetail',
      'financialData',
      'calendarEvents',
    ].join(',')
    const res = await axios.get(url, {
      params: { modules },
      headers: HEADERS,
      timeout: 15000,
    })
    const data = res.data?.quoteSummary?.result?.[0]
    if (!data) return null

    const fd = data.financialData ?? {}
    const sd = data.summaryDetail ?? {}
    const ks = data.defaultKeyStatistics ?? {}

    // 估值
    const per = {
      per: sd.trailingPE?.raw ?? ks.forwardPE?.raw ?? null,
      pbr: ks.priceToBook?.raw ?? null,
      dividendYield: sd.dividendYield?.raw ? sd.dividendYield.raw * 100 : null,
    }

    // 財務指標
    const metrics = {
      grossMargin: fd.grossMargins?.raw ? (fd.grossMargins.raw * 100).toFixed(1) : null,
      operatingMargin: fd.operatingMargins?.raw ? (fd.operatingMargins.raw * 100).toFixed(1) : null,
      netMargin: fd.profitMargins?.raw ? (fd.profitMargins.raw * 100).toFixed(1) : null,
      roe: fd.returnOnEquity?.raw ? (fd.returnOnEquity.raw * 100).toFixed(1) : null,
      debtRatio: null as string | null,
    }

    // 近四季 EPS + 收入
    const incomeHistory = data.incomeStatementHistory?.incomeStatementHistory ?? []
    const bsHistory = data.balanceSheetHistory?.balanceSheetStatements ?? []

    // 計算負債比
    if (bsHistory[0]) {
      const bs = bsHistory[0]
      const totalAssets = bs.totalAssets?.raw
      const totalLiab = bs.totalLiab?.raw
      if (totalAssets && totalLiab) {
        metrics.debtRatio = ((totalLiab / totalAssets) * 100).toFixed(1)
      }
    }

    const financials = incomeHistory.map((q: any) => ({
      date: new Date(q.endDate?.raw * 1000).toISOString().split('T')[0],
      eps: q.basicEPS?.raw ?? null,
      revenue: q.totalRevenue?.raw ?? null,
      grossProfit: q.grossProfit?.raw ?? null,
      netIncome: q.netIncome?.raw ?? null,
      operatingIncome: q.operatingIncome?.raw ?? null,
    }))

    const balanceSheet = bsHistory.map((b: any) => ({
      date: new Date(b.endDate?.raw * 1000).toISOString().split('T')[0],
      totalAssets: b.totalAssets?.raw ?? null,
      totalLiabilities: b.totalLiab?.raw ?? null,
      totalEquity: b.totalStockholderEquity?.raw ?? null,
    }))

    return { per, metrics, financials, balanceSheet }
  } catch (e) {
    console.error('Yahoo Finance fundamentals error:', e)
    return null
  }
}
