import axios from 'axios'

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const HEADERS = { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }

// Crumb cache
let _crumb: string | null = null
let _crumbTs = 0
let _yfClient: any = null

async function getYFClient() {
  if (_yfClient) return _yfClient
  try {
    const { wrapper } = await import('axios-cookiejar-support')
    const { CookieJar } = await import('tough-cookie')
    const jar = new CookieJar()
    _yfClient = wrapper(axios.create({ jar, withCredentials: true }))
  } catch {
    _yfClient = axios
  }
  return _yfClient
}

async function getYahooCrumb(): Promise<string | null> {
  try {
    if (_crumb && Date.now() - _crumbTs < 3600000) return _crumb
    const client = await getYFClient()
    await client.get('https://fc.yahoo.com', { headers: { 'User-Agent': USER_AGENT }, timeout: 8000 }).catch(() => {})
    const res = await client.get('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': USER_AGENT }, timeout: 8000,
    })
    _crumb = res.data as string
    _crumbTs = Date.now()
    return _crumb
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

// 從 v8 chart meta 抓估值（不需要 crumb，穩定）
async function getFundamentalsFromV8(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`
    const res = await axios.get(url, {
      params: { interval: '1d', range: '1d', modules: 'defaultKeyStatistics,summaryDetail,financialData' },
      headers: HEADERS,
      timeout: 10000,
    })
    const meta = res.data?.chart?.result?.[0]?.meta ?? {}
    return {
      per: meta.trailingPE ?? null,
      pbr: null as number | null,
      dividendYield: meta.trailingAnnualDividendYield ? meta.trailingAnnualDividendYield * 100 : null,
    }
  } catch { return null }
}

// 財報 + 估值指標（先試 query2 不帶 crumb，失敗就 fallback v8）
export async function getUSStockFundamentals(symbol: string) {
  // 先嘗試 query2（有時不需要 crumb）
  const v10Result = await tryV10Fundamentals(symbol)
  if (v10Result) return v10Result

  // fallback：只回傳 v8 能取到的估值，財報欄位留空
  const perFromV8 = await getFundamentalsFromV8(symbol)
  if (!perFromV8) return null
  return {
    per: perFromV8,
    metrics: { grossMargin: null, operatingMargin: null, netMargin: null, roe: null, debtRatio: null },
    financials: [],
    balanceSheet: [],
  }
}

async function tryV10Fundamentals(symbol: string) {
  const modules = [
    'incomeStatementHistory',
    'balanceSheetHistory',
    'defaultKeyStatistics',
    'summaryDetail',
    'financialData',
  ].join(',')

  // 嘗試不同的 host + crumb 組合
  const attempts = [
    { host: 'query2.finance.yahoo.com', withCrumb: false },
    { host: 'query1.finance.yahoo.com', withCrumb: true },
  ]

  for (const { host, withCrumb } of attempts) {
    try {
      const crumb = withCrumb ? await getYahooCrumb() : null
      const client = withCrumb ? await getYFClient() : axios
      const res = await client.get(`https://${host}/v10/finance/quoteSummary/${symbol}`, {
        params: { modules, ...(crumb ? { crumb } : {}) },
        headers: { ...HEADERS, 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: 12000,
      })
      const data = res.data?.quoteSummary?.result?.[0]
      if (!data) continue

      const fd = data.financialData ?? {}
      const sd = data.summaryDetail ?? {}
      const ks = data.defaultKeyStatistics ?? {}

      const per = {
        per: sd.trailingPE?.raw ?? ks.forwardPE?.raw ?? null,
        pbr: ks.priceToBook?.raw ?? null,
        dividendYield: sd.dividendYield?.raw ? sd.dividendYield.raw * 100 : null,
      }

      const metrics = {
        grossMargin: fd.grossMargins?.raw ? (fd.grossMargins.raw * 100).toFixed(1) : null,
        operatingMargin: fd.operatingMargins?.raw ? (fd.operatingMargins.raw * 100).toFixed(1) : null,
        netMargin: fd.profitMargins?.raw ? (fd.profitMargins.raw * 100).toFixed(1) : null,
        roe: fd.returnOnEquity?.raw ? (fd.returnOnEquity.raw * 100).toFixed(1) : null,
        debtRatio: null as string | null,
      }

      const incomeHistory = data.incomeStatementHistory?.incomeStatementHistory ?? []
      const bsHistory = data.balanceSheetHistory?.balanceSheetStatements ?? []

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
    } catch { continue }
  }
  return null
}
