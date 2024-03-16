import { ChainModel } from "../models/chain.model";
import { MonitorInfoModel } from "../models/monitor.info.model";
import { PairInfoModel } from "../models/pair.info.model";
import { TokenInfoModel } from "../models/token.info.model";
import Logging from "../utils/logging";
import { getNativeCurrencyPrice } from "../web3/chain.parameters";
import { findBestPair, findBestWETHPair } from "../web3/dex/common/bestpair";
import { getReserves } from "../web3/dex/common/reserve";
import { getV3PairPrice } from "../web3/dex/v3/v3.calculate";
import { prefetchPairsOnChain, prefetchTokensOnChain } from "../web3/multicall";
import { getBN } from "../web3/web3.operation";

export async function updateSellMonitorInfo(chain: string, token: string, user: string, tokenSold: string, ethAmount: string) {
    let tokenDB = await TokenInfoModel.findOne({ chain: chain, address: token })
    if (tokenDB.lp.length === 0) {
        await prefetchTokensOnChain(chain, JSON.stringify([token]))
        tokenDB = await TokenInfoModel.findOne({ chain: chain, address: token })
    }

    if (tokenDB.lp.length === 0) {
        Logging.error(`updateSellMonitorInfo: pair not found for ${token} on [${chain}]`)
        return
    }

    const lpArray = await Promise.all(tokenDB.lp.map(p => PairInfoModel.findOne({ chain: chain, address: p })))

    const bestLP = findBestPair(tokenDB.address, lpArray)
    if (bestLP === undefined) {
        Logging.error(`updateSellMonitorInfo: unable to find best lp of ${tokenDB.address} on [${chain}]`)
        return
    }

    const pair = bestLP?.address

    let pairFound
    {
        await prefetchPairsOnChain(chain, JSON.stringify([pair]))
        const ps = await PairInfoModel.find({ chain: chain, address: pair })
        pairFound = ps.find(p => p.reserve0 !== undefined && p.reserve1 !== undefined)
    }

    if (pairFound === undefined || pairFound === null) {
        Logging.error(`updateSellMonitorInfo: pair ${pair} not found on [${chain}]`)
        return
    }

    if (pairFound.token0 !== token && pairFound.token1 !== token) {
        Logging.error(`updateSellMonitorInfo: pair ${pair} mismatched to token ${token} on [${chain}]`)
        return
    }

    const BN = getBN()
    const tokens = await Promise.all([
        TokenInfoModel.findOne({ chain: chain, address: pairFound.token0 }),
        TokenInfoModel.findOne({ chain: chain, address: pairFound.token1 })
    ])

    if (tokens[0] === null) {
        await prefetchTokensOnChain(chain, JSON.stringify([pairFound.token0]))
        tokens[0] = await TokenInfoModel.findOne({ chain: chain, address: pairFound.token0 })
    }

    if (tokens[0] === null) {
        Logging.error(`updateSellMonitorInfo-0: token ${pairFound.token0} not found on [${chain}]`)
        return
    }

    if (tokens[1] === null) {
        await prefetchTokensOnChain(chain, JSON.stringify([pairFound.token1]))
        tokens[1] = await TokenInfoModel.findOne({ chain: chain, address: pairFound.token1 })
    }

    if (tokens[1] === null) {
        Logging.error(`updateSellMonitorInfo-1: token ${pairFound.token1} not found on [${chain}]`)
        return
    }

    const nativePrice = await getNativeCurrencyPrice(chain)

    let reserves = getReserves(pairFound)

    let priceImpact
    let tokenSoldDecimal = BN(tokenSold).div(BN(`1e${tokenDB.decimals}`))
    let expectedPayout = BN(ethAmount).div(BN(`1e18`))

    if (token === pairFound.token0) {
        priceImpact = reserves[0].div(reserves[0].plus(BN(tokenSoldDecimal))).minus(1).toString()
    } else {
        priceImpact = reserves[1].div(reserves[1].plus(BN(tokenSoldDecimal))).minus(1).toString()
    }

    if (0 === await MonitorInfoModel.countDocuments({ user: user, chain: chain, token: token, pair: pair })) {
        const newItem = new MonitorInfoModel({
            user: user,
            chain: chain,
            token: token,
            pair: pair
        })
        await newItem.save()
    }

    const mItem = await MonitorInfoModel.findOne({
        user: user,
        chain: chain,
        token: token,
        pair: pair
    })

    mItem.priceImpactSum = BN(mItem.priceImpactSum || '0').plus(priceImpact).toString()
    mItem.priceImpactCount = (mItem.priceImpactCount || 0) + 1
    mItem.priceImpactLast = priceImpact

    mItem.expectedSellTokenSum = BN(mItem.expectedSellTokenSum || '0').plus(tokenSoldDecimal).toString()
    mItem.expectedSellPayoutSum = BN(mItem.expectedSellPayoutSum || '0').plus(expectedPayout).toString()
    mItem.expectedSellPayoutCount = (mItem.expectedSellPayoutCount || 0) + 1
    mItem.expectedSellPayoutLast = expectedPayout.toString()

    mItem.expectedSellPayoutUSDSum = BN(mItem.expectedSellPayoutUSDSum || '0').plus(expectedPayout.times(nativePrice)).toString()
    mItem.expectedSellPayoutUSDLast = expectedPayout.times(nativePrice).toString()

    await mItem.save()
}

export async function updateBuyMonitorInfo(chain: string, token: string, user: string, tokenBought: string, ethAmount: string) {
    let tokenDB = await TokenInfoModel.findOne({ chain: chain, address: token })
    if (tokenDB.lp.length === 0) {
        await prefetchTokensOnChain(chain, JSON.stringify([token]))
        tokenDB = await TokenInfoModel.findOne({ chain: chain, address: token })
    }

    if (tokenDB.lp.length === 0) {
        Logging.error(`updateBuyMonitorInfo: pair not found for ${token} on [${chain}]`)
        return
    }

    const lpArray = await Promise.all(tokenDB.lp.map(p => PairInfoModel.findOne({ chain: chain, address: p })))

    const bestLP = findBestPair(tokenDB.address, lpArray)
    if (bestLP === undefined) {
        Logging.error(`updateBuyMonitorInfo: unable to find best lp of ${tokenDB.address} on [${chain}]`)
        return
    }
    const pair = bestLP?.address

    let pairFound
    {
        await prefetchPairsOnChain(chain, JSON.stringify([pair]))
        const ps = await PairInfoModel.find({ chain: chain, address: pair })
        pairFound = ps.find(p => p.reserve0 !== undefined && p.reserve1 !== undefined)
    }

    if (pairFound === undefined || pairFound === null) {
        Logging.error(`updateBuyMonitorInfo: pair ${pair} not found on [${chain}]`)
        return
    }

    if (pairFound.token0 !== token && pairFound.token1 !== token) {
        Logging.error(`updateBuyMonitorInfo: pair ${pair} mismatched to token ${token} on [${chain}]`)
        return
    }

    const BN = getBN()
    const tokens = await Promise.all([
        TokenInfoModel.findOne({ chain: chain, address: pairFound.token0 }),
        TokenInfoModel.findOne({ chain: chain, address: pairFound.token1 })
    ])

    if (tokens[0] === null) {
        await prefetchTokensOnChain(chain, JSON.stringify([pairFound.token0]))
        tokens[0] = await TokenInfoModel.findOne({ chain: chain, address: pairFound.token0 })
    }

    if (tokens[0] === null) {
        Logging.error(`updateBuyMonitorInfo-0: token ${pairFound.token0} not found on [${chain}]`)
        return
    }

    if (tokens[1] === null) {
        await prefetchTokensOnChain(chain, JSON.stringify([pairFound.token1]))
        tokens[1] = await TokenInfoModel.findOne({ chain: chain, address: pairFound.token1 })
    }

    if (tokens[1] === null) {
        Logging.error(`updateBuyMonitorInfo-1: token ${pairFound.token1} not found on [${chain}]`)
        return
    }

    const nativePrice = await getNativeCurrencyPrice(chain)

    let reserves = getReserves(pairFound)

    let priceImpact
    let tokenBoughtDecimal = BN(tokenBought).div(BN(`1e${tokenDB.decimals}`))
    let expectedPayout = BN(ethAmount).div(BN(`1e18`))

    if (token === pairFound.token0) {
        priceImpact = reserves[0].minus(BN(tokenBoughtDecimal)).div(reserves[0]).minus(1).toString()
    } else {
        priceImpact = reserves[1].minus(BN(tokenBoughtDecimal)).div(reserves[1]).minus(1).toString()
    }

    if (0 === await MonitorInfoModel.countDocuments({ user: user, chain: chain, token: token, pair: pair })) {
        const newItem = new MonitorInfoModel({
            user: user,
            chain: chain,
            token: token,
            pair: pair
        })
        await newItem.save()
    }

    const mItem = await MonitorInfoModel.findOne({
        user: user,
        chain: chain,
        token: token,
        pair: pair
    })

    mItem.priceImpactSum = BN(mItem.priceImpactSum || '0').plus(priceImpact).toString()
    mItem.priceImpactCount = (mItem.priceImpactCount || 0) + 1
    mItem.priceImpactLast = priceImpact

    if (BN(mItem.expectedBuyTokenSum || '0').eq(BN(0))) {
        mItem.expectedSellTokenSum = '0'
        mItem.expectedSellPayoutSum = '0'
        mItem.expectedSellPayoutCount = 0
        mItem.expectedSellPayoutLast = '0'

        mItem.expectedSellPayoutUSDSum = '0'
        mItem.expectedSellPayoutUSDLast = '0'
    }

    mItem.expectedBuyTokenSum = BN(mItem.expectedBuyTokenSum || '0').plus(tokenBoughtDecimal).toString()
    mItem.expectedBuyPayoutSum = BN(mItem.expectedBuyPayoutSum || '0').plus(expectedPayout).toString()
    mItem.expectedBuyPayoutCount = (mItem.expectedBuyPayoutCount || 0) + 1
    mItem.expectedBuyPayoutLast = expectedPayout.toString()

    mItem.expectedBuyPayoutUSDSum = BN(mItem.expectedBuyPayoutUSDSum || '0').plus(expectedPayout.times(nativePrice)).toString()
    mItem.expectedBuyPayoutUSDLast = expectedPayout.times(nativePrice).toString()

    await mItem.save()
}

export async function getPNL(chain: string, token: string, user: string) {
    const BN = getBN()
    const mArray = await MonitorInfoModel.find({ chain: chain, token: token, user: user })
    if (mArray.length === 0) return { pnl: '0.00', initial: '0.00', worth: '0.00' }

    const totalBuyPayout = mArray.reduce((prev, cur) => prev.plus(cur.expectedBuyPayoutSum || '0'), BN(0))
    const totalBuyPayoutUSD = mArray.reduce((prev, cur) => prev.plus(cur.expectedBuyPayoutUSDSum || '0'), BN(0))
    const totalBuyToken = mArray.reduce((prev, cur) => prev.plus(cur.expectedBuyTokenSum || '0'), BN(0))

    const totalSellPayout = mArray.reduce((prev, cur) => prev.plus(cur.expectedSellPayoutSum || '0'), BN(0))
    const totalSellPayoutUSD = mArray.reduce((prev, cur) => prev.plus(cur.expectedSellPayoutUSDSum || '0'), BN(0))
    const totalSellToken = mArray.reduce((prev, cur) => prev.plus(cur.expectedSellTokenSum || '0'), BN(0))

    if (totalBuyPayoutUSD.eq(0)) return { pnl: '0.00', initial: '0.00', worth: '0.00' }

    const ethPrice = await getNativeCurrencyPrice(chain)
    const totalNow = totalBuyPayout.times(BN(ethPrice))

    const tokenInfo = await TokenInfoModel.findOne({ chain: chain, address: token })
    let tokenRatio
    if (tokenInfo !== null && tokenInfo.lp.length > 0) {
        const lpArray = await Promise.all(tokenInfo.lp.map(p => PairInfoModel.findOne({ chain: chain, address: p })))
        const bestWETHPair = await findBestWETHPair(tokenInfo.address, lpArray)
        const reserves = getReserves(bestWETHPair)

        if (bestWETHPair.token0 === token) {
            tokenRatio = BN(reserves[1]).div(reserves[0])
        } else if (bestWETHPair.token1 === token) {
            tokenRatio = BN(reserves[0]).div(reserves[1])
        }
    }

    const totalBoughtAmount = totalBuyPayout.gt(totalSellPayout) ? totalBuyPayout.minus(totalSellPayout) : BN(0)
    const totalBoughtToken = totalBuyToken.gt(totalSellToken) ? totalBuyToken.minus(totalSellToken) : BN(0)

    const worthBN = BN(tokenRatio ? totalBoughtToken.times(tokenRatio).toString() : '0.00')

    return {
        pnl: totalBoughtAmount.eq(0) ? '0' : worthBN.times(100).div(totalBoughtAmount).minus(100).toString(), //totalNow.div(totalBuyPayoutUSD).times(100).minus(100).toString(),
        initial: totalBoughtAmount.toString(),
        worth: worthBN.toString()
    }
}

export async function getPriceImpact(chain: string, token: string, user: string) {
    const BN = getBN()
    const mArray = await MonitorInfoModel.find({ chain: chain, token: token, user: user })
    if (mArray.length === 0) return '0.00'

    const totalPriceImpactCount = mArray.reduce((prev, cur) => prev.plus(cur.priceImpactCount || 0), BN(0))
    const totalPriceImpactSum = mArray.reduce((prev, cur) => prev.plus(cur.priceImpactSum || 0), BN(0))

    if (totalPriceImpactCount.eq(0)) return '0.00'

    return totalPriceImpactSum.times(100).div(totalPriceImpactCount).toString()
}
