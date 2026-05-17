'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface StockData {
  symbol: string
  name: string
  market: string
  industry: string
  price: {
    date: string
    close: number
    open: number
    high: number
    low: number
    volume: number
    change: number
    changePercent: number
  } | null
  per: { per: number | null; pbr: number | null; dividendYield: number | null } | null
  metrics: {
    grossMargin: string | null
    operatingMargin: string | null
    netMargin: string | null
    debtRatio: string | null
    roe: string | null
  }
  financials: Array<{
    date: string
    type: string
    eps?: number
    revenue?: number
    grossProfit?: number
    netIncome?: number
  }>
  monthlyRevenue: Array<{
    revenue_year: number
    revenue_month: number
    revenue: number
  }>
  institutional: {
    totals: { foreignNet: number; investmentTrustNet: number; dealerNet: number }
  }
  technical: {
    ma5: number | null
    ma20: number | null
    ma60: number | null
    rsi: number | null
    macd: { macd: number | null; signal: number | null; histogram: number | null }
    kd: { k: number | null; d: number | null }
    volume: { latest: number; average: number; ratio: number }
    signals: {
      isBullish: boolean
      isAboveMa20: boolean
      isAboveMa60: boolean
      isRSIOverbought: boolean
      isRSIOversold: boolean
      isMACDBullish: boolean
      isHighVolume: boolean
    }
  } | null
  score: {
    total: number
    status: string
    statusLabel: string
    fundamental: { total: number; eps: number; roe: number; grossMargin: number; revenueGrowth: number }
    valuation: { total: number; per: number; pbr: number; dividendYield: number; historicalValuation: number }
    technical: { total: number; matrend: number; rsi: number; macd: number; volume: number }
    risk: { total: number; debtRatio: number; revenueDecline: number }
  }
  aiAnalysis: {
    summary: string
    strengths: string[]
    risks: string[]
    strategy: string
    fundamentalAnalysis: string
    valuationAnalysis: string
    technicalAnalysis: string
    riskAnalysis: string
    finalStatus: string
    finalStatusLabel: string
    disclaimer: string
  }
  cached: boolean
  updatedAt: string
}

function PriceTag({ value, suffix = '' }: { value: number | null | undefined; suffix?: string }) {
  if (value == null) return <span className="text-gray-400">N/A</span>
  const isPositive = value >= 0
  return (
    <span className={isPositive ? 'text-red-500' : 'text-green-600'}>
      {isPositive ? '+' : ''}{value.toFixed(2)}{suffix}
    </span>
  )
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ScoreBar({ score, max, label }: { score: number; max: number; label: string }) {
  const pct = Math.min(100, (score / max) * 100)
  const color = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-800 w-12 text-right">{score}/{max}</span>
    </div>
  )
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const colors: Record<string, string> = {
    BUY_WATCH: 'bg-red-100 text-red-700 border-red-200',
    BATCH_BUY: 'bg-orange-100 text-orange-700 border-orange-200',
    HOLD: 'bg-blue-100 text-blue-700 border-blue-200',
    WATCH: 'bg-gray-100 text-gray-700 border-gray-200',
    REDUCE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    EXIT: 'bg-green-100 text-green-700 border-green-200',
  }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${colors[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
      {label}
    </span>
  )
}

function formatNum(n: number | null | undefined, decimals = 1): string {
  if (n == null) return 'N/A'
  if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(decimals) + ' 億'
  if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(decimals) + ' 萬'
  return n.toFixed(decimals)
}

function formatVolume(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + ' 億股'
  if (n >= 1e4) return (n / 1e4).toFixed(0) + ' 張'
  return n.toLocaleString()
}

export default function StockPage() {
  const params = useParams()
  const router = useRouter()
  const symbol = (params.symbol as string).toUpperCase()

  const [data, setData] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/stocks/analyze?symbol=${symbol}${refresh ? '&refresh=true' : ''}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '分析失敗'); return }
      setData(json)
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [symbol])

  useEffect(() => {
    fetchData()
    // Check favorite
    fetch('/api/favorites').then(r => r.json()).then((favs: any[]) => {
      setIsFavorite(favs.some(f => f.symbol === symbol))
    }).catch(() => {})
  }, [symbol, fetchData])

  const toggleFavorite = async () => {
    setFavoriteLoading(true)
    try {
      if (isFavorite) {
        await fetch(`/api/favorites?symbol=${symbol}`, { method: 'DELETE' })
        setIsFavorite(false)
      } else {
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, name: data?.name }),
        })
        setIsFavorite(true)
      }
    } finally {
      setFavoriteLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="inline-block animate-spin text-4xl mb-4">⚙️</div>
        <p className="text-gray-600 font-medium">正在分析 {symbol}...</p>
        <p className="text-sm text-gray-400 mt-2">抓取財報、技術指標、執行 AI 分析，約需 15～30 秒</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-red-500 font-medium">{error}</p>
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={() => fetchData()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">重試</button>
          <Link href="/" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">回首頁</Link>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { price, per, metrics, financials, monthlyRevenue, institutional, technical, score, aiAnalysis } = data

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← 返回</button>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-500 text-sm">{symbol}</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{data.market}</span>
            {data.industry && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{data.industry}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFavorite}
            disabled={favoriteLoading}
            className={`p-2 rounded-lg border transition-colors text-lg ${isFavorite ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
          >
            {isFavorite ? '⭐' : '☆'}
          </button>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {refreshing ? '更新中...' : '🔄 重新分析'}
          </button>
        </div>
      </div>

      {/* Price Card */}
      {price && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">{price.date} 收盤</p>
              <p className="text-4xl font-bold text-gray-900">{price.close.toFixed(2)}</p>
              <p className="text-lg mt-1">
                <PriceTag value={price.change} /> <span className="text-gray-400 text-sm">(<PriceTag value={price.changePercent} suffix="%" />)</span>
              </p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-sm text-gray-500">開 {price.open} / 高 {price.high} / 低 {price.low}</p>
              <p className="text-sm text-gray-500">成交量：{formatVolume(price.volume)}</p>
              {per && (
                <div className="flex gap-3 justify-end mt-2">
                  {per.per != null && <span className="text-xs text-gray-600">本益比 <strong>{per.per.toFixed(1)}</strong></span>}
                  {per.pbr != null && <span className="text-xs text-gray-600">淨值比 <strong>{per.pbr.toFixed(2)}</strong></span>}
                  {per.dividendYield != null && <span className="text-xs text-gray-600">殖利率 <strong>{per.dividendYield.toFixed(1)}%</strong></span>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Status + Score */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* AI 判斷 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">AI 最終判斷</p>
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status={score.status} label={score.statusLabel} />
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{aiAnalysis.strategy}</p>
          <p className="text-xs text-gray-400 mt-3">{aiAnalysis.disclaimer}</p>
        </div>

        {/* 評分 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">股票綜合評分</p>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-4xl font-bold text-gray-900">{score.total}</span>
            <span className="text-gray-400 mb-1">/100</span>
          </div>
          <div className="space-y-2">
            <ScoreBar score={score.fundamental.total} max={40} label="基本面" />
            <ScoreBar score={score.valuation.total} max={25} label="估值" />
            <ScoreBar score={score.technical.total} max={25} label="技術面" />
            <ScoreBar score={score.risk.total} max={10} label="風險" />
          </div>
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5">
        <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold mb-3">AI 分析摘要</p>
        <p className="text-gray-800 leading-relaxed">{aiAnalysis.summary}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {aiAnalysis.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-2">✅ 優點</p>
              <ul className="space-y-1">
                {aiAnalysis.strengths.map((s, i) => <li key={i} className="text-sm text-gray-700">• {s}</li>)}
              </ul>
            </div>
          )}
          {aiAnalysis.risks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-2">⚠️ 風險</p>
              <ul className="space-y-1">
                {aiAnalysis.risks.map((r, i) => <li key={i} className="text-sm text-gray-700">• {r}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">財務指標</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="毛利率" value={metrics.grossMargin ? `${metrics.grossMargin}%` : 'N/A'} />
          <StatCard label="營業利益率" value={metrics.operatingMargin ? `${metrics.operatingMargin}%` : 'N/A'} />
          <StatCard label="淨利率" value={metrics.netMargin ? `${metrics.netMargin}%` : 'N/A'} />
          <StatCard label="ROE" value={metrics.roe ? `${metrics.roe}%` : 'N/A'} />
          <StatCard label="負債比" value={metrics.debtRatio ? `${metrics.debtRatio}%` : 'N/A'} />
        </div>
      </div>

      {/* Analysis Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">📈 基本面分析</h3>
          <p className="text-sm text-gray-700 leading-relaxed">{aiAnalysis.fundamentalAnalysis}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">💰 估值分析</h3>
          <p className="text-sm text-gray-700 leading-relaxed">{aiAnalysis.valuationAnalysis}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">📉 技術面分析</h3>
          <p className="text-sm text-gray-700 leading-relaxed">{aiAnalysis.technicalAnalysis}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">⚠️ 風險分析</h3>
          <p className="text-sm text-gray-700 leading-relaxed">{aiAnalysis.riskAnalysis}</p>
        </div>
      </div>

      {/* Technical Indicators */}
      {technical && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">技術指標</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">均線</p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm"><span className="text-gray-600">MA5</span><span className="font-medium">{technical.ma5 ?? 'N/A'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">MA20</span><span className="font-medium">{technical.ma20 ?? 'N/A'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">MA60</span><span className="font-medium">{technical.ma60 ?? 'N/A'}</span></div>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">動能</p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">RSI</span>
                  <span className={`font-medium ${technical.rsi && technical.rsi > 70 ? 'text-red-500' : technical.rsi && technical.rsi < 30 ? 'text-green-600' : ''}`}>{technical.rsi ?? 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">KD-K</span><span className="font-medium">{technical.kd.k ?? 'N/A'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">KD-D</span><span className="font-medium">{technical.kd.d ?? 'N/A'}</span></div>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">MACD</p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm"><span className="text-gray-600">MACD</span><span className="font-medium">{technical.macd.macd ?? 'N/A'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Signal</span><span className="font-medium">{technical.macd.signal ?? 'N/A'}</span></div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Hist</span>
                  <span className={`font-medium ${(technical.macd.histogram ?? 0) > 0 ? 'text-red-500' : 'text-green-600'}`}>{technical.macd.histogram ?? 'N/A'}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">成交量</p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm"><span className="text-gray-600">量比</span><span className={`font-medium ${technical.volume.ratio > 1.5 ? 'text-red-500' : ''}`}>{technical.volume.ratio}x</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">均量</span><span className="font-medium text-xs">{formatVolume(technical.volume.average)}</span></div>
              </div>
              <p className="text-xs text-gray-500 mt-3 mb-1">訊號</p>
              <div className="flex flex-wrap gap-1">
                {technical.signals.isBullish && <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">多頭</span>}
                {technical.signals.isAboveMa60 && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">站上MA60</span>}
                {technical.signals.isRSIOverbought && <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">RSI過熱</span>}
                {technical.signals.isRSIOversold && <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">RSI超賣</span>}
                {technical.signals.isHighVolume && <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">量增</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quarterly Financials */}
      {financials.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 overflow-x-auto">
          <h3 className="font-semibold text-gray-800 mb-4">近四季財報</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="pb-2">季別</th>
                <th className="pb-2 text-right">EPS</th>
                <th className="pb-2 text-right">營收</th>
                <th className="pb-2 text-right">毛利</th>
                <th className="pb-2 text-right">淨利</th>
              </tr>
            </thead>
            <tbody>
              {financials.slice(0, 4).map((f, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 text-gray-600">{f.date.slice(0, 4)} {f.type}</td>
                  <td className="py-2 text-right font-medium">
                    {f.eps != null ? <span className={f.eps >= 0 ? 'text-red-500' : 'text-green-600'}>{f.eps}</span> : 'N/A'}
                  </td>
                  <td className="py-2 text-right text-gray-700">{f.revenue != null ? formatNum(f.revenue) : 'N/A'}</td>
                  <td className="py-2 text-right text-gray-700">{f.grossProfit != null ? formatNum(f.grossProfit) : 'N/A'}</td>
                  <td className="py-2 text-right">
                    {f.netIncome != null ? <span className={f.netIncome >= 0 ? 'text-red-500' : 'text-green-600'}>{formatNum(f.netIncome)}</span> : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Monthly Revenue */}
      {monthlyRevenue.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">近六月營收</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {monthlyRevenue.slice(0, 6).map((r, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">{r.revenue_year}/{String(r.revenue_month).padStart(2, '0')}</span>
                <span className="text-sm font-semibold text-gray-800">{formatNum(r.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Institutional Investors */}
      {institutional && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">法人買賣超（近5日）</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '外資', value: institutional.totals.foreignNet },
              { label: '投信', value: institutional.totals.investmentTrustNet },
              { label: '自營商', value: institutional.totals.dealerNet },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-lg font-bold ${value >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {value >= 0 ? '+' : ''}{(value / 1000).toFixed(0)} 張
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs text-amber-700 text-center">{aiAnalysis.disclaimer}</p>
        {data.cached && <p className="text-xs text-gray-400 text-center mt-1">資料來自快取 · 更新於 {new Date(data.updatedAt).toLocaleString('zh-TW')}</p>}
      </div>
    </div>
  )
}
