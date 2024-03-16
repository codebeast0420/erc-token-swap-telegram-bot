import { PairInfoModel } from "../../../models/pair.info.model"
import { TokenInfoModel } from "../../../models/token.info.model"
import { getBN } from "../../web3.operation"

export function getV2PairPrice(pairDB: any) {
	const BN = getBN()
	if (BN(pairDB.reserve0).eq(0)) {
		throw new Error('v2 drained to null')
	}

	return BN(pairDB.reserve1).div(BN(pairDB.reserve0)).toString()
}


export async function getAmountsOutExtV2(chain: string, amount: string, pathInfo: any) {
	const BN = getBN()

	if (pathInfo.version !== 2) {
		throw new Error(`[getAmountsOutExtV2] ${chain}:${pathInfo.factory} - dex version is not 2`)
	}

	const dexFee = BN(0.0030)

	const path = pathInfo.path
	for (let i = 0; i < path.length - 1; i++) {
		const tres = await Promise.all([
			PairInfoModel.find({
				chain: chain,
				$or: [
					{
						token0: path[i],
						token1: path[i + 1]
					},
					{
						token1: path[i],
						token0: path[i + 1]
					}
				],
				version: 2
			}),
			TokenInfoModel.findOne({ chain: chain, address: path[i] }),
			TokenInfoModel.findOne({ chain: chain, address: path[i + 1] })
		])
		const pairs: any[] = tres[0]
		const token0 = tres[1]
		const token1 = tres[2]

		const reserve0Max = pairs.reduce((prev, cur) => prev.lt(cur.reserve0 || '0') ? BN(cur.reserve0) : prev, BN(0))
		const reserve1Max = pairs.reduce((prev, cur) => prev.lt(cur.reserve1 || '0') ? BN(cur.reserve1) : prev, BN(0))

		const pairFound = pairs.find(t => BN(t.reserve0 ?? '0').eq(reserve0Max) || BN(t.reserve1 ?? '0').eq(reserve1Max))
		if (pairFound === undefined || token0 === null || token1 === null) {
			console.log('>>>', i, pairFound, token0, token1, path)
			throw new Error('[getAmountsOutExtV2] Invalid path')
		}

		if (pairFound.token0 === path[i]) {
			const reserve1 = BN(pairFound.reserve1)
			const reserve0 = BN(pairFound.reserve0)
			amount = reserve1.times(BN(amount).times(BN(1).minus(dexFee))).div(reserve0.plus(BN(amount)).times(BN(1).minus(dexFee))).toString()
		} else {
			const reserve0 = BN(pairFound.reserve0)
			const reserve1 = BN(pairFound.reserve1)
			amount = reserve0.times(BN(amount)).div(reserve1.plus(BN(amount))).toString()
		}
	}

	return amount
}


export async function getAmountsInExtV2(chain: string, amount: string, pathInfo: any) {
	const BN = getBN()

	if (pathInfo.version !== 2) {
		throw new Error(`[getAmountsInExtV2] ${chain}:${pathInfo.factory} - dex version is not 2`)
	}

	const path = pathInfo.path
	for (let i = path.length - 1; i > 0; i--) {
		const tres = await Promise.all([
			PairInfoModel.find({
				chain: chain,
				$or: [
					{
						token0: path[i],
						token1: path[i - 1]
					},
					{
						token1: path[i],
						token0: path[i - 1]
					}
				],
				version: 2
			}),
			TokenInfoModel.findOne({ chain: chain, address: path[i] }),
			TokenInfoModel.findOne({ chain: chain, address: path[i - 1] })
		])
		const pairs: any[] = tres[0]
		const token0 = tres[1]
		const token1 = tres[2]

		const reserve0Max = pairs.reduce((prev, cur) => prev.lt(cur.reserve0 || '0') ? BN(cur.reserve0) : prev, BN(0))
		const reserve1Max = pairs.reduce((prev, cur) => prev.lt(cur.reserve1 || '0') ? BN(cur.reserve1) : prev, BN(0))

		const pairFound = pairs.find(t => BN(t.reserve0 ?? '0').eq(reserve0Max) || BN(t.reserve1 ?? '0').eq(reserve1Max))
		if (pairFound === undefined || token0 === null || token1 === null) {
			console.log('>>>', i, pairFound, token0, token1, path)
			throw new Error('[getAmountsInExtV2] Invalid path')
		}

		if (pairFound.token0 === path[i]) {
			const reserve1 = BN(pairFound.reserve1)
			const reserve0 = BN(pairFound.reserve0)

			if (reserve0.lte(BN(amount))) {
				throw new Error('[getAmountsInExtV2] Amount Exceeded')
			}
			amount = reserve1.times(BN(amount)).div(reserve0.minus(BN(amount))).toString()
		} else {
			const reserve0 = BN(pairFound.reserve0)
			const reserve1 = BN(pairFound.reserve1)
			if (reserve1.lte(BN(amount))) {
				throw new Error('[getAmountsInExtV2] Amount Exceeded')
			}
			amount = reserve0.times(BN(amount)).div(reserve1.minus(BN(amount))).toString()
		}
	}

	return BN(amount).times(10000).div(9970).toString()
}
