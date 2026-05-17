import axios from 'axios'

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
}

// Yahoo Finance crumb cache（crumb + cookie 用於 v10 API）
let _crumbCache: { crumb: string; cookie: string; ts: number } | null = null

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  try {
    // Use cached crumb if less than 1 hour old
    if (_crumbCache && Date.now() - _crumbCache.ts < 3600000) {
      return { crumb: _crumbCache.crumb, cookie: _crumbCache.cookie }
    }
    // Get cookie from Yahoo Finance main page
    const cookieRes = await axios.get('https://fc.yahoo.com', {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000,
      maxRedirects: 5,
    })
    const setCookie = (cookieRes.headers['set-cookie'] ?? []).map((c: string) => c.split(';')[0]).join('; ')
    // Get crumb
    const crumbRes = await axios.get('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...HEADERS, Cookie: setCookie },
      timeout: 8000,
    })
    const crumb = crumbRes.data as string
    _crumbCache = { crumb, cookie: setCookie, ts: Date.now() }
    return { crumb, cookie: setCookie }
  } catch { return null }
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
    ].join(',')
    const auth = await getYahooCrumb()
    const res = await axios.get(url, {
      params: { modules, ...(auth ? { crumb: auth.crumb } : {}) },
      headers: { ...HEADERS, ...(auth ? { Cookie: auth.cookie } : {}) },
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
