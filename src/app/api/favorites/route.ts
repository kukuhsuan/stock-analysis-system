import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const favorites = await prisma.favoriteStock.findMany({ orderBy: { createdAt: 'desc' } })
    return Response.json(favorites)
  } catch {
    return Response.json({ error: '無法取得收藏清單' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { symbol, name } = await request.json()
    if (!symbol) return Response.json({ error: '請提供股票代號' }, { status: 400 })
    const favorite = await prisma.favoriteStock.upsert({
      where: { symbol },
      create: { symbol, name },
      update: { name },
    })
    return Response.json(favorite)
  } catch {
    return Response.json({ error: '收藏失敗' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const symbol = request.nextUrl.searchParams.get('symbol')
    if (!symbol) return Response.json({ error: '請提供股票代號' }, { status: 400 })
    await prisma.favoriteStock.delete({ where: { symbol } })
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: '刪除收藏失敗' }, { status: 500 })
  }
}
