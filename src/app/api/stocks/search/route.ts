import { NextRequest } from 'next/server'
import { getStockInfo, getLatestPrice } from '@/lib/finmind'

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')
  if (!symbol) return Response.json({ error: '請輸入股票代號' }, { status: 400 })

  try {
    const [info, price] = await Promise.all([getStockInfo(symbol), getLatestPrice(symbol)])
    if (!info && !price) return Response.json({ error: `找不到股票代號 ${symbol}` }, { status: 404 })
    return Response.json({ symbol, name: info?.name ?? symbol, market: info?.market ?? 'TWSE', industry: info?.industry ?? '', price })
  } catch (error) {
    return Response.json({ error: '查詢失敗，請稍後再試' }, { status: 500 })
  }
}
