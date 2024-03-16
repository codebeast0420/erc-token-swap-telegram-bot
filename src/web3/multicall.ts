import { Multicall, ContractCallResults, ContractCallContext } from 'ethereum-multicall';
import { AddressDead, AddressZero, getBN } from './web3.operation';
import { getChainTokens, getDedicatedSyncRPC, getAllFactories } from './chain.parameters';
const Web3 = require('web3');
import { getTokenInfo, updateDexAndPairs, updateToken, updateTokenInfo, updateTokenTaxInfo } from '../service/token.service';
import { ChainModel } from '../models/chain.model';
import Logging from '../utils/logging';
import { PairInfoModel } from '../models/pair.info.model';
import { pairIntrinsicCallCtx, pairIntrinsicCallRes, tokenBalanceCallCtx, tokenBalanceCallRes, pairReserveCallCtxFromIntrinsic, pairReserveCallResFromIntrinsic, tokenIntrinsicCallCtx, tokenPairReqCallCtx, tokenIntrinsicCallRes, tokenPairReqCallRes, pairLockedCallCtx, pairLockedCallRes, routerIntrinsicCallCtx, routerIntrinsicCallRes, factoryIntrinsicCallCtx, factoryIntrinsicCallRes, pairFactoryReqCallCtx, pairFactoryReqCallRes } from './requests/multicall_param';
import { getTaxCollection } from './requests/tax_collect';
import { DexInfoModel } from '../models/dex.info.model';

function getTokenDeadAddresses() {
	return [AddressZero, AddressDead]
}

const MAX_SYNC_COUNT = 5 // 20 items
const MAX_SYNC_PERIOD = 20000 // 20 seconds
const multicall = {};
const web3 = {};

export function getMulticall(chain: string, rpc: string) {
	if (multicall[chain] === undefined) {
		multicall[chain] = new Multicall({ web3Instance: getWeb3(chain, rpc), tryAggregate: true });
	}
	return multicall[chain];
}

export function getWeb3(chain: string, rpc: string) {
	if (web3[chain] === undefined) {
		web3[chain] = new Web3(rpc);
	}
	return web3[chain];
}

export function splitMulticallRequests(cc: ContractCallContext[]) {
	const MAX_CALLS = 800
	if (cc.length === 0) return []

	let ret = []
	let bulk = []

	cc.forEach(c => {
		const bulkCallCount = bulk.map(b => b.calls.length).reduce((prev, cur) => prev + cur, 0)

		if (bulkCallCount + c.calls.length / 2 <= MAX_CALLS) {
			bulk = [...bulk, c]
		} else {
			if (bulk.length === 0) {
				ret = [...ret, [c]]
			} else {
				ret = [...ret, bulk]
				bulk = [c]
			}
		}
	})

	if (bulk.length > 0) ret = [...ret, bulk]

	return ret
}

export async function executeMulticall(chain: string, multicall: any, cc1: ContractCallContext[], errorText?: string, throwText?: string) {
	let ret1
	try {
		const ccSplit = splitMulticallRequests(cc1)

		const rr = await Promise.all(ccSplit.map(ccBulk => multicall.call(ccBulk)))
		if (rr.length > 0) {
			ret1 = {
				blockNumber: rr[0].blockNumber,
				results: rr.reduce((prev, cur) => {
					return {
						...prev,
						...cur.results
					}
				}, {})
			}
		}
	} catch (err) {
		if (errorText) {
			Logging.error(errorText)
			console.log(chain, cc1.length, cc1.map(c => c.calls.length).reduce((prev, cur) => prev + cur, 0), cc1.map(c => c.reference))
			console.error(err)
		}
		if (throwText) {
			throw new Error(throwText)
		}
	}

	return ret1
}

export async function queryTokenInfoOnChain(telegramId: string, chain: string, token: string, user: string) {
	try {
		let storedToken: any = await getTokenInfo(chain, token);
		if (storedToken === null || storedToken.marketCap === undefined) {
			await prefetchTokensOnChain(chain, JSON.stringify([token]))
			storedToken = await getTokenInfo(chain, token);
		}

		const loadTaxInfo = async () => {
			try {
				const taxInfo: any = await getTaxCollection(getWeb3(chain, await getDedicatedSyncRPC(chain)), chain, token)
				if (taxInfo?.address) {
					await updateTokenTaxInfo(chain, taxInfo.address, taxInfo)
				}
			} catch (err) {
				console.error(err)
			}
		}

		loadTaxInfo()

		if (storedToken === null) { // polling chain, invalid token set
			return
		}

		let lpDb = await Promise.all(storedToken.lp.map(lp => {
			return PairInfoModel.findOne({ chain: chain, address: lp })
		}))
		lpDb = lpDb.filter(p => p !== null)

		const pairSyncCtx = pairReserveCallCtxFromIntrinsic(lpDb)

		const cc2 = tokenBalanceCallCtx([storedToken.address], [[user]])

		const BN = getBN();
		const multicall = getMulticall(chain, await getDedicatedSyncRPC(chain));
		const ret2 = await executeMulticall(chain, multicall, [...cc2, ...pairSyncCtx]) // ,'[queryTokenInfoOnChain - 1]', '-'

		const balInfo = tokenBalanceCallRes(ret2, [storedToken.address], 0, user)
		const balance = balInfo.balance.div(BN(`1e${balInfo.decimals}`)).toString()

		await Promise.all(lpDb.map(lp => {
			const infoRet = pairReserveCallResFromIntrinsic(ret2, lp)
			return PairInfoModel.findByIdAndUpdate(lp._id, infoRet)
		}))

		let lpRet = await Promise.all(storedToken.lp.map(lp => {
			return PairInfoModel.findOne({ chain: chain, address: lp })
		}))
		lpRet = lpRet.filter(p => p !== null)

		return {
			...storedToken._doc,
			lp: lpRet,
			balance
		};
	} catch (err) {
		Logging.error('[queryTokenInfoOnChain]')
		console.error(err)
	}
}

export async function queryAndSyncToken(telegramId: string, chain: string, token: string, user: string) {
	try {
		let storedToken: any = await getTokenInfo(chain, token);

		if (storedToken === null || storedToken.marketCap === undefined) {
			await prefetchTokensOnChain(chain, JSON.stringify([token]))
			storedToken = await getTokenInfo(chain, token);
		}

		if (storedToken === null) { // polling chain, invalid token set
			return
		}

		const loadTaxInfo = async () => {
			try {
				const taxInfo: any = await getTaxCollection(getWeb3(chain, await getDedicatedSyncRPC(chain)), chain, token)
				if (taxInfo?.address) {
					await updateTokenTaxInfo(chain, taxInfo.address, taxInfo)
				}
			} catch (err) {
				console.error(err)
			}
		}

		loadTaxInfo()

		const chainInfo = await ChainModel.findOne({ name: chain })

		const balanceCtx = tokenBalanceCallCtx([storedToken.address], [[user, ...getTokenDeadAddresses()]])
		const pairCtx = pairIntrinsicCallCtx(storedToken.lp)
		const lpDb = await Promise.all(storedToken.lp.map(lp => {
			return PairInfoModel.findOne({ chain: chain, address: lp })
		}))

		const pairSyncCtx = pairReserveCallCtxFromIntrinsic(lpDb.filter(lp => lp !== null))
		const tokenSyncCtx = tokenIntrinsicCallCtx([token])
		const pairLockedCtx = pairLockedCallCtx(storedToken.lp, chainInfo.lpLocksAddresses)
		const factories = await getAllFactories(chain)
		const getPairCtx = tokenPairReqCallCtx([storedToken.address], factories, chainInfo.tokens)

		const BN = getBN();
		const cc1 = [...balanceCtx, ...pairCtx, ...pairSyncCtx, ...tokenSyncCtx, ...pairLockedCtx, ...getPairCtx]
		const multicall = getMulticall(chain, await getDedicatedSyncRPC(chain));
		const ret2 = await executeMulticall(chain, multicall, cc1) // , '[queryAndSyncToken - 1]', '-'

		const balInfo = tokenBalanceCallRes(ret2, [storedToken.address], 0, user)
		const balance = balInfo.balance.div(BN(`1e${balInfo.decimals}`)).toString()

		let lpNew: any = tokenPairReqCallRes(ret2, storedToken.address, factories, chainInfo.tokens)
		if (lpNew?.length === 0) {
			const pairsFound = await PairInfoModel.find({
				$or: [
					{ token0: storedToken.address },
					{ token1: storedToken.address }
				]
			})
			lpNew = pairsFound
		} else {
			await Promise.all(lpNew.map((pairUpdate: any) => PairInfoModel.findOneAndUpdate({ chain: chain, address: pairUpdate.address }, { factory: pairUpdate.factory })))
		}

		for (const lpItem of lpDb) {
			if (lpItem === null) continue

			const pret = pairIntrinsicCallRes(ret2, lpItem.address)

			const infoRet = pairReserveCallResFromIntrinsic(ret2, pret)
			const lockedBalArray = chainInfo.lpLocksAddresses.map(locker => pairLockedCallRes(ret2, lpItem.address, locker))
			const lockedAmount = lockedBalArray.reduce((prev, cur) => prev.plus(cur), BN(0))
			const lockedV = lpItem.decimals ? lockedAmount.div(BN(`1e${lpItem.decimals}`)).toString() : undefined

			const newInfo = {
				chain: chain,
				...pret,
				...infoRet,
				factory: lpNew.find(tp => tp.address === pret.address).factory,
				reserve0: BN(infoRet.balance0).div(BN(`1e${infoRet.decimal0}`)).toString(),
				reserve1: BN(infoRet.balance1).div(BN(`1e${infoRet.decimal1}`)).toString(),
				locked: lockedV
			}

			for (const ch in newInfo) {
				lpItem[ch] = newInfo[ch]
			}

			await lpItem.save()
		}

		const t1 = tokenIntrinsicCallRes(ret2, token)

		const updateTokenItem = {
			chain: chain,
			...t1,
			lp: lpNew.map(p => p.address),
			hitCount: storedToken.hitCount + 1,
			marketCap: BN(t1.totalSupply).minus(t1.burnt).toString()
		}

		await updateToken(updateTokenItem)
		await updateTokenInfo(updateTokenItem.chain, updateTokenItem.address, updateTokenItem)

		return {
			...updateTokenItem,
			hitCount: storedToken.hitCount,
			age: storedToken.age,
			lp: lpDb.filter(t => t !== null),
			balance
		};
	} catch (err) {
		Logging.error('[queryAndSyncToken]')
		console.error(err)
	}
}

export async function queryTokenInfoFromPairOnChain(telegramId: string, chain: string, pair: string) {
	try {
		const BN = getBN()
		let rpc = await getDedicatedSyncRPC(chain)
		let tokensOnChain = await getChainTokens(chain)

		const pairDb = await PairInfoModel.findOne({ chain: chain, address: pair.toLowerCase() })
		let t0
		let t1

		const multicall = getMulticall(chain, rpc);

		if (pairDb === null) {
			const cc1 = pairIntrinsicCallCtx([pair])
			const ret1 = await executeMulticall(chain, multicall, cc1) // , '[queryTokenInfoFromPairOnChain - 1]', '-'

			const pret = pairIntrinsicCallRes(ret1, pair)

			if (pret.token0?.length === 0 || pret.token1?.length === 0) return ''

			const factories = await getAllFactories(chain)

			const cc2 = pairReserveCallCtxFromIntrinsic([pret])
			const cc3 = pairFactoryReqCallCtx([pret.token0], [pret.token1], factories)
			const ret2 = await executeMulticall(chain, multicall, [...cc2, ...cc3]) // , '[queryTokenInfoFromPairOnChain - 2]', '-'

			const infoRet = pairReserveCallResFromIntrinsic(ret2, pret)

			if (0 === await PairInfoModel.countDocuments({ chain: chain, address: infoRet.address })) {
				const newItem = new PairInfoModel({
					chain: chain,
					...infoRet,
					factory: pairFactoryReqCallRes(ret2, infoRet.address, infoRet.token0, infoRet.token1, factories),
					reserve0: BN(infoRet.balance0).div(BN(`1e${infoRet.decimal0}`)).toString(),
					reserve1: BN(infoRet.balance1).div(BN(`1e${infoRet.decimal1}`)).toString(),
				})
				await newItem.save()
			} else {
				await PairInfoModel.updateMany({ chain: chain, address: infoRet.address }, {
					factory: pairFactoryReqCallRes(ret2, infoRet.address, infoRet.token0, infoRet.token1, factories),
					reserve0: BN(infoRet.balance0).div(BN(`1e${infoRet.decimal0}`)).toString(),
					reserve1: BN(infoRet.balance1).div(BN(`1e${infoRet.decimal1}`)).toString(),
				})
			}

			Logging.info(`[${chain}] - new pair loaded manually ${pair}`)

			t0 = infoRet.token0
			t1 = infoRet.token1
		} else {
			t0 = pairDb.token0
			t1 = pairDb.token1
		}

		const tFound0 = tokensOnChain.find(t => t.toLowerCase() === t0.toLowerCase())
		const tFound1 = tokensOnChain.find(t => t.toLowerCase() === t1.toLowerCase())

		if (tFound0 && !tFound1) {
			return t1
		} else if (!tFound0 && tFound1) {
			return t0
		} else {
			return ''
		}
	} catch (err) {
		Logging.error('[queryTokenInfoFromPairOnChain]')
		console.error(err)
	}
}

const chainTokenBulks = {}
const tickTokenBulks = {}

export function prefetchTokensBulk(chain: string, token: string) {
	if (chainTokenBulks[chain] === undefined) chainTokenBulks[chain] = []
	if (tickTokenBulks[chain] === undefined) tickTokenBulks[chain] = (new Date()).getTime()

	if (chainTokenBulks[chain].find(c => c === token)) return

	chainTokenBulks[chain] = [...chainTokenBulks[chain], token]

	const count = chainTokenBulks[chain].length
	const tickNow = (new Date()).getTime()
	if (count >= MAX_SYNC_COUNT || tickNow > tickTokenBulks[chain] + MAX_SYNC_PERIOD) {
		tickTokenBulks[chain] = tickNow

		const data = JSON.stringify(chainTokenBulks[chain])
		chainTokenBulks[chain] = []

		if (count > 0) {
			prefetchTokensOnChain(chain, data)
		}
	}
}

export async function prefetchTokensOnChain(chain: string, tokens: string) {
	try {
		const tokenArray = JSON.parse(tokens)
		if (tokenArray === undefined) return

		let uniqueArray = []

		for (const t of tokenArray) {
			if (tokenArray[tokenArray.indexOf(t)] === t) {
				// if (0 === await TokenInfoModel.countDocuments({ chain: chain, address: t.toLowerCase() })) {
				uniqueArray = [...uniqueArray, t.toLowerCase()]
			}
		}

		if (uniqueArray.length === 0) return

		const BN = getBN()
		let rpc = await getDedicatedSyncRPC(chain)
		let factories = await getAllFactories(chain)
		let chainTokens = await getChainTokens(chain)

		const cc1: ContractCallContext[] = [
			...tokenIntrinsicCallCtx(uniqueArray),
			...tokenPairReqCallCtx(uniqueArray, factories, chainTokens)
		];

		const multicall = getMulticall(chain, rpc)
		const ret1 = await executeMulticall(chain, multicall, cc1) // , '[prefetchTokensOnChain - 1]', '-'
		if (ret1 === undefined) return

		const t1 = uniqueArray.map(token => {
			const t1 = tokenIntrinsicCallRes(ret1, token)

			return {
				chain: chain,
				...t1
			};
		})

		const tokenInfoArray = t1.filter(r => r.valid === true)

		if (tokenInfoArray.length === 0) return

		// let tick = (new Date()).getTime()
		// const printTick = () => {
		//     const curTick = (new Date()).getTime()
		//     console.log('>>> ' + ((curTick - tick) / 1000))
		//     tick = curTick
		// }
		// const busd = tokenInfoArray.find(r => r.address === '0xe9e7cea3dedca5984780bafc599bd69add087d56')
		// if (busd) {
		//     console.log('++++++++++++++++++++++++++++++++++++++++++++ 1')
		// }

		const chainInfo = await ChainModel.findOne({ name: chain });

		const allLps = tokenInfoArray.map(t => {
			return {
				address: t.address,
				lp: tokenPairReqCallRes(ret1, t.address, factories, chainTokens),
			}
		})

		const allLpAddresses = allLps.map(t => t.lp.map(c => c.address)).reduce((prev, cur) => [...prev, ...cur], [])

		const cc2: ContractCallContext[] = [
			...pairIntrinsicCallCtx(allLpAddresses),
			...pairLockedCallCtx(allLpAddresses, chainInfo.lpLocksAddresses)
		]
		const ret2 = await executeMulticall(chain, multicall, cc2) // , '[prefetchTokensOnChain - 2]', '-'

		// if (busd) {
		//     console.log('++++++++++++++++++++++++++++++++++++++++++++ 1.5', tokenInfoArray.length)
		//     printTick()
		// }

		for (let idx = 0; idx < tokenInfoArray.length; idx++) {
			const tifa = tokenInfoArray[idx]
			const lpInfo = allLps.find(t => t.address === tifa.address)
			const lpArray = lpInfo.lp

			const lpRes: any[] = lpArray.map(lp => {
				const pairInfo = pairIntrinsicCallRes(ret2, lp.address)
				const lockedAmount = chainInfo.lpLocksAddresses.map(locker => pairLockedCallRes(ret2, lp.address, locker)).reduce((prev, cur) => prev.plus(cur), BN(0))
				const locked = pairInfo.decimals ? lockedAmount.div(BN(`1e${pairInfo.decimals}`)).toString() : undefined
				return {
					chain: chain,
					...pairInfo,
					factory: lp.factory,
					locked
				}
			})

			// if (busd) {
			//     console.log('++++++++++++++++++++++++++++++++++++++++++++ 1.7.1', idx)
			//     printTick()
			// }

			for (const pr of lpRes) {
				const newPr = pr

				if (0 === await PairInfoModel.countDocuments({ chain: chain, address: pr.address })) {
					const newPair = new PairInfoModel(newPr)
					await newPair.save()
				} else {
					await PairInfoModel.updateMany({ chain: chain, address: pr.address }, newPr)
				}
			}
			// if (busd) {
			//     console.log('++++++++++++++++++++++++++++++++++++++++++++ 1.7.2', idx)
			//     printTick()
			// }

			const updateItem = {
				chain: chain,
				...tifa,
				lp: lpRes.map(p => p.address),
				marketCap: BN(tifa.totalSupply).minus(tifa.burnt).toString()
			}

			// if (updateItem.address === '0xe9e7cea3dedca5984780bafc599bd69add087d56') {
			//     console.log('>>> BUSD marketcap', updateItem.address, updateItem.marketCap)
			// }

			await updateToken(updateItem)

			// if (busd) {
			//     console.log('++++++++++++++++++++++++++++++++++++++++++++ 1.7.3', idx)
			//     printTick()
			// }

			await updateTokenInfo(updateItem.chain, updateItem.address, updateItem)

			// if (busd) {
			//     console.log('++++++++++++++++++++++++++++++++++++++++++++ 1.7.4', idx)
			//     printTick()
			// }

			const taxInfo: any = await getTaxCollection(getWeb3(chain, rpc), chain, tifa.address)
			if (taxInfo?.address !== undefined) {
				await updateTokenTaxInfo(chain, taxInfo.address, taxInfo)
			}

			// if (busd) {
			//     console.log('++++++++++++++++++++++++++++++++++++++++++++ 1.7.5', idx)
			//     printTick()
			// }
		}

		// if (busd) {
		//     console.log('===================================================== 2')
		//     printTick()
		// }

		// Logging.info(`[${chain}] - ${tokenInfoArray.length} tokens added`)
	} catch (err) {
		Logging.error('[prefetchTokensOnChain]')
		console.error(err)
	}
}

const chainPairBulks = {}
const tickPairBulks = {}

export function prefetchPairsBulk(chain: string, pair: string) {
	if (chainPairBulks[chain] === undefined) chainPairBulks[chain] = []
	if (tickPairBulks[chain] === undefined) tickPairBulks[chain] = (new Date()).getTime()

	if (chainPairBulks[chain].find(c => c.address === pair)) return

	chainPairBulks[chain] = [...chainPairBulks[chain], pair]

	const count = chainPairBulks[chain].length
	const tickNow = (new Date()).getTime()
	if (count >= MAX_SYNC_COUNT || tickNow > tickPairBulks[chain] + MAX_SYNC_PERIOD) {
		tickPairBulks[chain] = tickNow

		const data = JSON.stringify(chainPairBulks[chain])
		chainPairBulks[chain] = []

		if (count > 0) {
			prefetchPairsOnChain(chain, data)
		}
	}
}

export async function prefetchPairsOnChain(chain: string, pairs: string) {
	try {
		const pairArray = JSON.parse(pairs)
		let uniqueArray = []

		if (pairArray.length === 0) return

		for (const t of pairArray) {
			if (0 === await PairInfoModel.countDocuments({ chain: chain, address: t })) {
				uniqueArray = [...uniqueArray, t.toLowerCase()]
			}
		}

		let rpc = await getDedicatedSyncRPC(chain)

		const multicall = getMulticall(chain, rpc);

		if (uniqueArray.length > 0) {
			const cc1 = pairIntrinsicCallCtx(uniqueArray)
			const ret1 = await executeMulticall(chain, multicall, cc1) // , '[prefetchPairsOnChain - 1]', '-'

			const newPairsArray = ret1 ? uniqueArray.map(pair => {
				return pairIntrinsicCallRes(ret1, pair)
			}) : []

			for (const newPair of newPairsArray) {
				if (0 === await PairInfoModel.countDocuments({ chain: chain, address: newPair.address }) && newPair.token0 && newPair.token1) {
					const newItem = new PairInfoModel({
						chain: chain,
						...newPair
					})

					await newItem.save()
				}
			}
		}
		// const chainInfo = await ChainModel.findOne({ name: chain });

		let pairsInDb = []
		for (const p of pairArray) {
			const pdb = await PairInfoModel.findOne({ chain: chain, address: p })
			if (pdb !== null) {
				if (pdb.token0 && pdb.token1) {
					pairsInDb = [...pairsInDb, pdb]
				} else {
					Logging.info(`Removed invalid pair ${p} on [${chain}] : token0 - ${pdb.token0}, token1 - ${pdb.token1}`)
					await PairInfoModel.deleteMany({ chain: chain, address: p })
				}
			}
		}

		const chainInfo = await ChainModel.findOne({ name: chain })
		const factories = await getAllFactories(chain)

		const cc2 = [
			...pairIntrinsicCallCtx(pairsInDb.map(p => p.address)),
			...pairReserveCallCtxFromIntrinsic(pairsInDb),
			...pairLockedCallCtx(pairsInDb.map(p => p.address), chainInfo.lpLocksAddresses),
			...pairFactoryReqCallCtx(pairsInDb.map(p => p.token0), pairsInDb.map(p => p.token1), factories)
		]

		const BN = getBN();
		const ret2 = await executeMulticall(chain, multicall, cc2) // , '[prefetchPairsOnChain - 2]', '-'

		for (let idx = 0; idx < pairsInDb.length && ret2; idx++) {
			const pret = pairsInDb[idx]
			const pairRes = pairIntrinsicCallRes(ret2, pret.address)
			const pairBal = pairReserveCallResFromIntrinsic(ret2, pret)
			const lockedRes = chainInfo.lpLocksAddresses.map(locker => { return pairLockedCallRes(ret2, pret.address, locker) }).reduce((prev, cur) => prev.plus(cur), BN(0))

			pret.reserve0 = BN(pairBal.balance0).div(BN(`1e${pairBal.decimal0}`)).toString()
			pret.reserve1 = BN(pairBal.balance1).div(BN(`1e${pairBal.decimal1}`)).toString()
			pret.factory = pairFactoryReqCallRes(ret2, pret.address, pret.token0, pret.token1, factories)

			pret.locked = lockedRes.div(BN(`1e${pret.decimals}`)).toString()
			for (const k in pairRes) {
				pret[k] = pairRes[k]
			}

			await pret.save()
		}

		// Logging.info(`[${chain}] - ${newPairsArray.length} pairs added, ${pairsInDb.length} pairs updated`)
	} catch (err) {
		Logging.error('[prefetchPairsOnChain]')
		console.error(err)
	}
}

export async function prefetchDexOnChain(chain: string, dexInfos: string) {
	try {
		const dexArray = JSON.parse(dexInfos)
		if (dexArray === undefined || dexArray.length === 0) return

		const routerArray = dexArray.map(d => d.router)
		const routers = routerArray.filter((r, idx) => routerArray.indexOf(r) === idx).filter(r => r !== null)

		if (routers.length === 0) return

		const cc1 = routerIntrinsicCallCtx(routers)

		const multicall = getMulticall(chain, await getDedicatedSyncRPC(chain));
		const ret1 = await executeMulticall(chain, multicall, cc1) // ', [prefetchDexOnChain - 1]', '-'
		if (ret1 === undefined) return

		const dexArrayWithFactory = routers.map(r => {
			const di = routerIntrinsicCallRes(ret1, r)
			return {
				router: r,
				...di
			}
		}).filter(d => d.factory !== undefined)

		if (dexArrayWithFactory.length > 0) {
			const cc2 = factoryIntrinsicCallCtx(dexArrayWithFactory.map(d => d.factory))
			const ret2 = await executeMulticall(chain, multicall, cc2) // ', [prefetchDexOnChain - 2]', '-'
			if (ret2 === undefined) return

			const dexFullArray = dexArrayWithFactory.map(d => {
				const r1 = factoryIntrinsicCallRes(ret2, d.factory)
				return {
					...d,
					v2: r1.v2,
					v3: r1.v3
				}
			}).filter(d => d.v2 !== false || d.v3 !== false)

			await updateDexAndPairs(chain, dexFullArray)
		}
	} catch (err) {
		Logging.error(`[prefetchDexOnChain] ${err.message}`)
	}
}
