import axios from 'axios'

const BASE_URL = 'https://api.finmindtrade.com/api/v4/data'
const TOKEN = process.env.FINMIND_TOKEN

function getStartDate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

async function fetchFinMind(dataset: string, stockId: string, startDate: string) {
  const res = await axios.get(BASE_URL, {
    params: { dataset, data_id: stockId, start_date: startDate, token: TOKEN },
    timeout: 15000,
  })
  return res.data?.data ?? []
}

// 股票基本資訊
export async function getStockInfo(symbol: string) {
  try {
    const data = await fetchFinMind('TaiwanStockInfo', symbol, '2020-01-01')
    const info = data.find((d: any) => d.stock_id === symbol) ?? data[0]
    return info ? { symbol, name: info.stock_name ?? info.company_name ?? symbol, market: info.type ?? 'TWSE', industry: info.industry_category ?? '' } : null
  } catch { return null }
}

// 近 N 天股價（OHLCV）
export async function getStockPrice(symbol: string, days = 90) {
  try {
    const data = await fetchFinMind('TaiwanStockPrice', symbol, getStartDate(days))
    return data.sort((a: any, b: any) => a.date.localeCompare(b.date))
  } catch { return [] }
}

// 最新股價資訊（今日或最近一個交易日）
export async function getLatestPrice(symbol: string) {
  const prices = await getStockPrice(symbol, 5)
  if (!prices.length) return null
  const latest = prices[prices.length - 1]
  const prev = prices.length > 1 ? prices[prices.length - 2] : null
  const change = prev ? latest.close - prev.close : 0
  const changePercent = prev ? (change / prev.close) * 100 : 0
  return {
    date: latest.date,
    close: latest.close,
    open: latest.open,
    high: latest.max,
    low: latest.min,
    volume: latest.Trading_Volume,
    change,
    changePercent,
  }
}

// 季度財報（損益表）
export async function getFinancialStatements(symbol: string) {
  try {
    const data = await fetchFinMind('TaiwanStockFinancialStatements', symbol, getStartDate(730))
    // group by date+type
    const byQuarter: Record<string, any> = {}
    for (const row of data) {
      const key = `${row.date}_${row.type}`
      if (!byQuarter[key]) byQuarter[key] = { date: row.date, type: row.type }
      const name: string = row.origin_name ?? ''
      if (name.includes('每股盈餘') || name === 'EPS') byQuarter[key].eps = row.value
      if (name.includes('營業收入') || name === 'Revenue') byQuarter[key].revenue = row.value
      if (name.includes('毛利') && !name.includes('率')) byQuarter[key].grossProfit = row.value
      if (name.includes('營業利益') && !name.includes('率')) byQuarter[key].operatingIncome = row.value
      if (name.includes('稅後') || name.includes('淨利') || name.includes('NetIncome')) byQuarter[key].netIncome = row.value
    }
    return Object.values(byQuarter)
      .sort((a: any, b: any) => b.date.localeCompare(a.date))
      .slice(0, 8)
  } catch { return [] }
}

// 資產負債表
export async function getBalanceSheet(symbol: string) {
  try {
    const data = await fetchFinMind('TaiwanStockBalanceSheet', symbol, getStartDate(400))
    const byQuarter: Record<string, any> = {}
    for (const row of data) {
      const key = `${row.date}_${row.type}`
      if (!byQuarter[key]) byQuarter[key] = { date: row.date, type: row.type }
      const name: string = row.origin_name ?? ''
      if (name.includes('資產總') || name === 'TotalAssets') byQuarter[key].totalAssets = row.value
      if (name.includes('負債總') || name === 'TotalLiabilities') byQuarter[key].totalLiabilities = row.value
      if (name.includes('權益總') || name === 'TotalEquity') byQuarter[key].totalEquity = row.value
    }
    return Object.values(byQuarter).sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 4)
  } catch { return [] }
}

// 月營收
export async function getMonthlyRevenue(symbol: string) {
  try {
    const data = await fetchFinMind('TaiwanStockMonthRevenue', symbol, getStartDate(400))
    return data
      .sort((a: any, b: any) => {
        if (a.revenue_year !== b.revenue_year) return b.revenue_year - a.revenue_year
        return b.revenue_month - a.revenue_month
      })
      .slice(0, 12)
  } catch { return [] }
}

// 法人買賣超（最近 5 天加總）
export async function getInstitutionalInvestors(symbol: string) {
  try {
    const data = await fetchFinMind('TaiwanStockInstitutionalInvestors', symbol, getStartDate(10))
    const byDate: Record<string, any> = {}
    for (const row of data) {
      if (!byDate[row.date]) byDate[row.date] = { date: row.date, foreignNet: 0, investmentTrustNet: 0, dealerNet: 0 }
      const name: string = row.name ?? ''
      if (name.includes('外資')) byDate[row.date].foreignNet = (row.buy ?? 0) - (row.sell ?? 0)
      if (name.includes('投信')) byDate[row.date].investmentTrustNet = (row.buy ?? 0) - (row.sell ?? 0)
      if (name.includes('自營')) byDate[row.date].dealerNet = (row.buy ?? 0) - (row.sell ?? 0)
    }
    const days = Object.values(byDate).sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 5)
    const totals = days.reduce((acc: any, d: any) => ({
      foreignNet: acc.foreignNet + d.foreignNet,
      investmentTrustNet: acc.investmentTrustNet + d.investmentTrustNet,
      dealerNet: acc.dealerNet + d.dealerNet,
    }), { foreignNet: 0, investmentTrustNet: 0, dealerNet: 0 })
    return { days, totals }
  } catch { return { days: [], totals: { foreignNet: 0, investmentTrustNet: 0, dealerNet: 0 } } }
}

// PER / PBR
export async function getPER(symbol: string) {
  try {
    const data = await fetchFinMind('TaiwanStockPER', symbol, getStartDate(5))
    if (!data.length) return null
    const latest = data[data.length - 1]
    return { per: latest.PER ?? null, pbr: latest.PBR ?? null, dividendYield: latest.DividendYield ?? null }
  } catch { return null }
}
