'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const HOT_STOCKS = [
  { symbol: '2330', name: '台積電' },
  { symbol: '2317', name: '鴻海' },
  { symbol: '2454', name: '聯發科' },
  { symbol: '2308', name: '台達電' },
  { symbol: '2412', name: '中華電' },
  { symbol: '2882', name: '國泰金' },
]

const HOT_US_STOCKS = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Google' },
  { symbol: 'META', name: 'Meta' },
]

export default function Home() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('recentStocks')
    if (saved) setRecent(JSON.parse(saved))
  }, [])

  const handleSearch = async (symbol: string) => {
    const s = symbol.trim().toUpperCase()
    if (!s) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/stocks/search?symbol=${s}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '查詢失敗'); return }
      // Save to recent
      const newRecent = [s, ...recent.filter(r => r !== s)].slice(0, 5)
      setRecent(newRecent)
      localStorage.setItem('recentStocks', JSON.stringify(newRecent))
      router.push(`/stocks/${s}`)
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="text-5xl mb-4">📊</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI 股票健檢分析</h1>
        <p className="text-gray-500">輸入股票代號，獲得 AI 驅動的完整分析報告</p>
      </div>

      {/* Search Box */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch(input)}
            placeholder="輸入股票代號，例如：2330 或 AAPL"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            autoFocus
          />
          <button
            onClick={() => handleSearch(input)}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '查詢中...' : '分析'}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>

      {/* Hot Stocks */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">熱門台股</h2>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {HOT_STOCKS.map(s => (
            <button
              key={s.symbol}
              onClick={() => handleSearch(s.symbol)}
              className="flex flex-col items-center p-3 rounded-xl hover:bg-blue-50 hover:border-blue-200 border border-gray-100 transition-colors text-left"
            >
              <span className="font-semibold text-gray-900 text-sm">{s.symbol}</span>
              <span className="text-xs text-gray-500 mt-0.5">{s.name}</span>
            </button>
          ))}
        </div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">熱門美股</h2>
        <div className="grid grid-cols-3 gap-2">
          {HOT_US_STOCKS.map(s => (
            <button
              key={s.symbol}
              onClick={() => handleSearch(s.symbol)}
              className="flex flex-col items-center p-3 rounded-xl hover:bg-green-50 hover:border-green-200 border border-gray-100 transition-colors text-left"
            >
              <span className="font-semibold text-gray-900 text-sm">{s.symbol}</span>
              <span className="text-xs text-gray-500 mt-0.5">{s.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent */}
      {recent.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">最近查詢</h2>
          <div className="flex flex-wrap gap-2">
            {recent.map(s => (
              <button
                key={s}
                onClick={() => handleSearch(s)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-8">⚠️ 僅供參考，非投資建議</p>
    </div>
  )
}
