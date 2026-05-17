'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Favorite {
  id: number
  symbol: string
  name: string | null
  createdAt: string
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/favorites')
      .then(r => r.json())
      .then(setFavorites)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const remove = async (symbol: string) => {
    await fetch(`/api/favorites?symbol=${symbol}`, { method: 'DELETE' })
    setFavorites(prev => prev.filter(f => f.symbol !== symbol))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">⭐ 收藏清單</h1>
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-700">+ 新增股票</Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">載入中...</div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">☆</p>
          <p className="text-gray-500 mb-4">還沒有收藏的股票</p>
          <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">去搜尋股票</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map(f => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:border-blue-200 transition-colors">
              <button
                onClick={() => router.push(`/stocks/${f.symbol}`)}
                className="flex items-center gap-3 text-left flex-1"
              >
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 font-bold text-sm">
                  {f.symbol.slice(-2)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{f.symbol}</p>
                  {f.name && <p className="text-sm text-gray-500">{f.name}</p>}
                </div>
              </button>
              <div className="flex items-center gap-2">
                <Link
                  href={`/stocks/${f.symbol}`}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                  分析
                </Link>
                <button
                  onClick={() => remove(f.symbol)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
