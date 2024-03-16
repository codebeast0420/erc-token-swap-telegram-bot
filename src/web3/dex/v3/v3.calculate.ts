import { PairInfoModel } from "../../../models/pair.info.model"
import { TokenInfoModel } from "../../../models/token.info.model"
import { getBN } from "../../web3.operation"

export function getV3PairReserves(sqrtPriceX96: string) {
	const BN = getBN()
	const t1 = BN(2).pow(BN(64))
	const t2 = BN(2).pow(BN(96))
	const t3 = BN(2).pow(BN(192))

	if (BN(sqrtPriceX96).gte(t2)) {
		const t = BN(sqrtPriceX96).div(t1).integerValue()
		return [t1.toString(), t.times(t).toString()]
	} else {
		const t = BN(sqrtPriceX96)
		return [t3.toString(), t.times(t).toString()]
	}
}

export function getV3PairPrice(pairDB: any) {
	const res = getV3PairReserves(pairDB.sqrtPriceX96)
	const BN = getBN()
	return BN(res[1]).div(BN(`1e${pairDB.decimal1}`)).div(BN(res[0]).div(BN(`1e${pairDB.decimal0}`))).toString()
}

export function getPathBytesFromV3Path(pathInfo: any) {
	let ret = ''
	for (let i = 0; i < pathInfo.path.length; i++) {
		ret += pathInfo.path[i].slice(2).padStart(40, '0') + (i < pathInfo.path.length - 1 ? pathInfo.fee[i].toString(16).padStart(6, '0') : '')
	}

	return "0x" + ret
}


export async function getAmountsOutExtV3(chain: string, amount: string, pathInfo: any) {
	const BN = getBN()

	if (pathInfo.version !== 3) {
		throw new Error(`[getAmountsOutExtV3] ${chain}:${pathInfo.factory} - dex version is not 3`)
	}

	const path = pathInfo.path
	const fee = pathInfo.fee
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
				fee: fee[i],
				version: 3
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
			console.log('>>>', i, pairFound, token0, token1, pathInfo, pairs)
			throw new Error('[getAmountsOutExtV3] Invalid path')
		}

		const pairPrice = getV3PairPrice(pairFound)
		const lq = BN(pairFound.liquidity || '0')
		if (lq.eq(0)) {
			throw new Error(`[getAmountsOutExtV3] ${chain}:${pairFound.address} v3 null liquidity`)
		}

		const L2 = lq.times(lq).div(BN(`1e${pairFound.decimal0}`).times(BN(`1e${pairFound.decimal1}`))) // converting to decimal number
		const x = L2.div(BN(pairPrice)).sqrt()
		const y = L2.times(BN(pairPrice)).sqrt()

		const dexFee = BN(fee[i]).div(BN(`1000000`))
		const amountWithoutFee = BN(amount).times(BN(1).minus(dexFee))

		if (pairFound.token0 === path[i]) {
			const reserve1 = BN(pairFound.reserve1)
			const reserve0 = BN(pairFound.reserve0)

			amount = y.times(amountWithoutFee).div(x.plus(amountWithoutFee)).toString()

			if (reserve1.lt(amount)) {
				throw new Error(`[getAmountsOutExtV3] ${chain}:${pairFound.address} exceed swap amount {${amount.toString()}, ${reserve1.toString()}}`)
			}
		} else {
			const reserve1 = BN(pairFound.reserve1)
			const reserve0 = BN(pairFound.reserve0)

			amount = x.times(amountWithoutFee).div(y.plus(amountWithoutFee)).toString()

			if (reserve0.lt(amount)) {
				throw new Error(`[getAmountsOutExtV3] ${chain}:${pairFound.address} exceed swap amount {${amount.toString()}, ${reserve0.toString()}}`)
			}
		}
	}

	return amount
}

export async function getAmountsInExtV3(chain: string, amount: string, pathInfo: any) {
	const BN = getBN()

	if (pathInfo.version !== 3) {
		throw new Error(`[getAmountsInExtV3] ${chain}:${pathInfo.factory} - dex version is not 3`)
	}

	const path = pathInfo.path
	const fee = pathInfo.fee

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
				fee: fee[i - 1],
				version: 3
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
			throw new Error('[getAmountsInExtV3] Invalid path')
		}

		const pairPrice = getV3PairPrice(pairFound)
		const lq = BN(pairFound.liquidity || '0')
		if (lq.eq(0)) {
			throw new Error(`[getAmountsInExtV3] ${chain}:${pairFound.address} v3 null liquidity`)
		}

		const L2 = lq.times(lq).div(BN(`1e${pairFound.decimal0}`).times(BN(`1e${pairFound.decimal1}`))) // converting to decimal number
		const x = L2.div(BN(pairPrice)).sqrt()
		const y = L2.times(BN(pairPrice)).sqrt()

		const dexFee = BN(fee[i - 1]).div(BN(`1000000`))
		const amountWithoutFee = BN(amount).times(BN(1).minus(dexFee))

		if (pairFound.token0 === path[i]) {
			const reserve1 = BN(pairFound.reserve1)
			const reserve0 = BN(pairFound.reserve0)

			if (reserve0.lt(amountWithoutFee)) {
				throw new Error(`[getAmountsInExtV3] ${chain}:${pairFound.address} exceed swap amount {${amount.toString()}, ${reserve0.toString()}}`)
			}

			amount = y.times(amountWithoutFee).div(x.minus(amountWithoutFee)).toString()
		} else {
			const reserve1 = BN(pairFound.reserve1)
			const reserve0 = BN(pairFound.reserve0)

			if (reserve1.lt(amountWithoutFee)) {
				throw new Error(`[getAmountsInExtV3] ${chain}:${pairFound.address} exceed swap amount {${amount.toString()}, ${reserve1.toString()}}`)
			}

			amount = x.times(amountWithoutFee).div(y.minus(amountWithoutFee)).toString()
		}
	}

	return amount
}
