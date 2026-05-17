import { NextRequest } from 'next/server'
import { getStockInfo, getLatestPrice } from '@/lib/finmind'
import { getUSStockInfo } from '@/lib/yahoo-finance'

function isUSStock(symbol: string): boolean {
  return /^[A-Za-z]+$/.test(symbol)
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.toUpperCase()
  if (!symbol) return Response.json({ error: '請輸入股票代號' }, { status: 400 })

  try {
    if (isUSStock(symbol)) {
      const info = await getUSStockInfo(symbol)
      if (!info || !info.price) return Response.json({ error: `找不到美股代號 ${symbol}` }, { status: 404 })
      return Response.json({
        symbol,
        name: info.name,
        market: 'US',
        industry: '',
        price: info.price,
        currency: info.currency,
      })
    }

    const [info, price] = await Promise.all([getStockInfo(symbol), getLatestPrice(symbol)])
    if (!info && !price) return Response.json({ error: `找不到股票代號 ${symbol}` }, { status: 404 })
    return Response.json({ symbol, name: info?.name ?? symbol, market: info?.market ?? 'TWSE', industry: info?.industry ?? '', price })
  } catch {
    return Response.json({ error: '查詢失敗，請稍後再試' }, { status: 500 })
  }
}
