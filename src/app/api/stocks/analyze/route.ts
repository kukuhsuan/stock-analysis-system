import { NextRequest } from 'next/server'

export const maxDuration = 60 // seconds - Vercel Pro/Hobby max
import { getStockInfo, getLatestPrice, getFinancialStatements, getBalanceSheet, getMonthlyRevenue, getInstitutionalInvestors, getPER, getStockPrice } from '@/lib/finmind'
import { analyzeTechnical } from '@/lib/technical'
import { calculateScore } from '@/lib/scorer'
import { analyzeStockWithAI } from '@/lib/gemini'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true'

  if (!symbol) return Response.json({ error: '請輸入股票代號' }, { status: 400 })

  try {
    // Check cache (valid for 1 day)
    if (!forceRefresh) {
      const cached = await prisma.stockAnalysisCache.findUnique({ where: { symbol } })
      if (cached && new Date() < cached.expiresAt) {
        return Response.json({ ...JSON.parse(cached.analysisJson), cached: true })
      }
    }

    // Fetch all data in parallel
    const [info, price, priceHistory, financials, balanceSheet, monthlyRevenue, institutional, per] = await Promise.all([
      getStockInfo(symbol),
      getLatestPrice(symbol),
      getStockPrice(symbol, 90),
      getFinancialStatements(symbol),
      getBalanceSheet(symbol),
      getMonthlyRevenue(symbol),
      getInstitutionalInvestors(symbol),
      getPER(symbol),
    ])

    if (!info && !price) return Response.json({ error: `找不到股票代號 ${symbol}` }, { status: 404 })

    const technical = analyzeTechnical(priceHistory)
    const score = calculateScore({ financials, balanceSheet, monthlyRevenue, technical, per })

    const aiAnalysis = await analyzeStockWithAI({
      symbol,
      name: info?.name ?? symbol,
      price,
      per,
      financials,
      balanceSheet,
      monthlyRevenue,
      technical,
      institutional,
      score,
    })

    // Calculate additional metrics
    const latestFinancial = financials[0]
    const latestBS = balanceSheet[0]
    const metrics = {
      grossMargin: latestFinancial?.grossProfit && latestFinancial?.revenue
        ? ((latestFinancial.grossProfit / latestFinancial.revenue) * 100).toFixed(1)
        : null,
      operatingMargin: latestFinancial?.operatingIncome && latestFinancial?.revenue
        ? ((latestFinancial.operatingIncome / latestFinancial.revenue) * 100).toFixed(1)
        : null,
      netMargin: latestFinancial?.netIncome && latestFinancial?.revenue
        ? ((latestFinancial.netIncome / latestFinancial.revenue) * 100).toFixed(1)
        : null,
      debtRatio: latestBS?.totalLiabilities && latestBS?.totalAssets
        ? ((latestBS.totalLiabilities / latestBS.totalAssets) * 100).toFixed(1)
        : null,
      roe: latestFinancial?.netIncome && latestBS?.totalEquity
        ? (() => {
            const v = (latestFinancial.netIncome / latestBS.totalEquity) * 100
            return v > 0 && v < 10000 ? v.toFixed(1) : null // 合理範圍內才顯示
          })()
        : null,
    }

    const result = {
      symbol,
      name: info?.name ?? symbol,
      market: info?.market ?? 'TWSE',
      industry: info?.industry ?? '',
      price,
      per,
      metrics,
      financials: financials.slice(0, 4),
      balanceSheet: balanceSheet.slice(0, 2),
      monthlyRevenue: monthlyRevenue.slice(0, 6),
      institutional,
      technical,
      score,
      aiAnalysis,
      updatedAt: new Date().toISOString(),
    }

    // Save to cache
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)
    await prisma.stockAnalysisCache.upsert({
      where: { symbol },
      create: { symbol, analysisJson: JSON.stringify(result), score: score.total, status: score.status, expiresAt },
      update: { analysisJson: JSON.stringify(result), score: score.total, status: score.status, expiresAt, updatedAt: new Date() },
    })

    return Response.json(result)
  } catch (error) {
    console.error('Analyze error:', error)
    return Response.json({ error: '分析失敗，請稍後再試' }, { status: 500 })
  }
}
