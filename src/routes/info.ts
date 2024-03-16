import { Router, Request, Response, NextFunction } from 'express';
import { getAllChains, getGasPrice } from '../service/chain.service';
import { ChainModel } from '../models/chain.model';
import { AppUserModel } from '../models/app.user.model';
import { VisitRecordModel } from '../models/visit.record';
import { UserStatModel } from '../models/user.stat.model';
import { getBN } from '../web3/web3.operation';
import { getNativeCurrencyPrice } from '../web3/chain.parameters';
import { getTokenInfoScan } from '../utils/messages';

const router = Router();

async function getChainReport(chainName?: string) {
	let res = []
	const chains = getAllChains()
	const chInfo = await Promise.all(chains.map(ch => ChainModel.findOne({ name: ch })))

	if (chainName === undefined) {
		for (const ch of chains) {
			const foundInfo = chInfo.find(c => c.name === ch)
			if (foundInfo === undefined) {
				res = [`Unrecognized chain "${ch}"`]
			} else {
				res = [...res, {
					name: ch,
					latestBlock: foundInfo.blockScanned,
					blocks: foundInfo.blockScanCount,
					blockScanDuration: foundInfo.blockScanDuration,
					pendingTransactions: foundInfo.pendingTxnCount,
					pendingTransactionScanDuration: foundInfo.pendingTxnDuration
				}]
			}
		}
	} else {
		const ch = chainName
		const foundInfo = chInfo.find(c => c.name === ch)
		if (foundInfo === undefined) {
			res = [`Unrecognized chain "${ch}"`]
		} else {
			res = [...res, {
				name: ch,
				latestBlock: foundInfo.blockScanned,
				blocks: foundInfo.blockScanCount,
				blockScanDuration: foundInfo.blockScanDuration,
				pendingTransactions: foundInfo.pendingTxnCount,
				pendingTransactionScanDuration: foundInfo.pendingTxnDuration
			}]
		}
	}

	return res
}

async function getUserVisits(days: number) {
	const now = new Date()
	const ONEDAY = 86400 * 1000

	const launchTimestamp = (new Date("2023-07-16T17:41:13.199Z")).getTime()

	let ret = []
	let i
	for (i = 0; i < days; i++) {
		const startTimestamp = now.getTime() - (i + 1) * ONEDAY
		const endTimestamp = now.getTime() - i * ONEDAY

		if (endTimestamp < launchTimestamp) break

		const users = await AppUserModel.find({
			createdAt: {
				$gte: new Date(now.getTime() - (i + 1) * ONEDAY),
				$lt: new Date(now.getTime() - i * ONEDAY)
			}
		})

		const visits = await VisitRecordModel.find({
			localTimeStamp: {
				$gte: now.getTime() - (i + 1) * ONEDAY,
				$lt: now.getTime() - i * ONEDAY
			}
		})

		const userArr = visits.map(v => v.user.toString())
		const uniqueVisits = visits.filter((val, idx) => userArr.indexOf(val.user.toString()) === idx)

		ret = [...ret, {
			date: new Date(now.getTime() - (i + 1) * ONEDAY),
			newUsers: users.length,
			dailyUsers: uniqueVisits.length,
			visits: visits.length,
		}]
	}
	return ret
}

async function getTotalTradeVolume() {
	const BN = getBN()
	const chains = getAllChains()
	const ret = {}
	for (const ch of chains) {
		const stats = await UserStatModel.find({ chain: ch })
		const tvl = stats.reduce((prev, cur) => prev.plus(BN(cur.txFee).plus(BN(cur.sellVolume)).plus(BN(cur.buyVolume))), BN(0))
		const price = await getNativeCurrencyPrice(ch)

		ret[ch] = {
			tvl: tvl.toString(),
			price
		}
	}
	return ret
}

router.get('/', async (request: Request, response: Response) => {
	const query = request.query;

	let res

	try {
		if (query.chain) {
			if (query.chain === 'all') {
				res = {
					chains: await getChainReport()
				}
			} else {
				res = await getChainReport(query.chain as string)
			}
		} else if (query.users) {
			res = {
				users: await getUserVisits(parseInt(query.days as string)),
				tvl: await getTotalTradeVolume()
			}
		} else if (query.gas) {
			res = await getGasPrice(query.gas as string, true)
		}
	} catch (err) {
		res = err.message
	}

	response.send(res);
});

router.get('/token', async (request: Request, response: Response) => {
	const query = request.query;

	let res

	try {
		const token = query.address.toString().toLowerCase()
		const chain = query.chain.toString()
		res = await getTokenInfoScan(chain, token)
	} catch (err) {
		res = err.message
	}

	response.send(res);
});

module.exports = router;
