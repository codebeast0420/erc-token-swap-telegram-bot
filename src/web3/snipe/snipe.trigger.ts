import { DexInfoModel } from "../../models/dex.info.model";
import { SnipeTokenModel } from "../../models/snipe.godmode.token";
import { sendBotMessage } from "../../service/app.service";
import { sendSnipeMessage } from "../../service/multicore/service";
import { getTokenTaxInfo, getWETH } from "../../service/token.service";
import Logging from "../../utils/logging";
import Router from "../../web3/abi/IPancakeRouter02.json"
import { decodeTxInput } from "../abi/decode";
import { flashBotSend } from "../flashbot";
import { getBN } from "../web3.operation";
import { processSnipeLiquidity, processSnipeMethodId } from "./snipe.trade";

const ethers = require('ethers')

export async function handleSnipePendingTxn(web3: any, chain: string, transactions: any[]) {
	const BN = getBN()
	const snipes: any[] = await SnipeTokenModel.find({ state: 'pending' }).populate('token').populate('user');

	for (const transaction of transactions) {
		if (transaction === null) continue

		const ret = decodeTxInput(web3, Router.abi, transaction.input)
		if (ret?.abi.name.indexOf('addLiquidity') > -1) {
			for (const sn of snipes) {
				if (
					sn.token.chain === chain &&
					transaction?.to !== null &&
					sn.method === 'liquidity' &&
					(sn.token.address === ret?.decoded.tokenA?.toLowerCase() || sn.token.address === ret?.decoded.tokenB?.toLowerCase() || sn.token.address === ret?.decoded.token?.toLowerCase())
				) {
					try {
						await SnipeTokenModel.findByIdAndUpdate(sn._id, { state: 'processing' })

						sendSnipeMessage(chain, JSON.stringify({
							discriminator: 'bot-action-data',
							type: 'snipe',
							id: sn._id.toString(),
							chain: chain,
							transaction: transaction
						}))
					} catch (err) {
						console.error(`==> ${new Date().toLocaleString()}`)
						console.error(err)
						Logging.error(`[handleSnipePendingTxn] ${chain} - ${transaction.hash}, router ${transaction.to.toLowerCase()}`)
					}
				}
			}
		}

		for (const sn of snipes) {
			if (
				sn.token.chain === chain &&
				sn.token.address.toLowerCase() === transaction?.to?.toLowerCase() &&
				sn.method === 'method-id' &&
				sn.methodID?.length === 8 &&
				sn.methodID.toLowerCase() === transaction?.input?.slice(2, 10)?.toLowerCase()
			) {
				try {
					await SnipeTokenModel.findByIdAndUpdate(sn._id, { state: 'processing' })
					sendSnipeMessage(chain, JSON.stringify({
						discriminator: 'bot-action-data',
						type: 'snipe',
						id: sn._id.toString(),
						transaction: transaction
					}))
				} catch (err) {
					console.error(`==> ${new Date().toLocaleString()}`)
					console.error(err)
					Logging.error(`[handleSnipePendingTxn] ${sn.user.telegramId} - ${chain} snipe-method-id(${sn.methodID}): ${err.message}`)
				}
			}
		}

		for (const sn of snipes) {
			let addLiquidityFlag = false
			let tokenCall = false
			if (sn.method === 'liquidity') {
				addLiquidityFlag = sn.token.chain === chain
					&& ret?.abi.name.indexOf('addLiquidity') > -1
					&& transaction?.to !== null
					&& (
						sn.token.address === ret?.decoded.tokenA?.toLowerCase()
						|| sn.token.address === ret?.decoded.tokenB?.toLowerCase()
						|| sn.token.address === ret?.decoded.token?.toLowerCase()
					)
			} else if (sn.method === 'method-id') {
				tokenCall = sn.token.chain === chain
					&& sn.token.address.toLowerCase() === transaction?.to?.toLowerCase()
					&& sn.methodID?.length === 8
					&& sn.methodID.toLowerCase() === transaction?.input?.slice(2, 10)?.toLowerCase()
			} else if (sn.method === 'auto') {
				addLiquidityFlag = sn.token.chain === chain
					&& ret?.abi.name.indexOf('addLiquidity') > -1
					&& transaction?.to !== null
					&& (
						sn.token.address === ret?.decoded?.tokenA?.toLowerCase()
						|| sn.token.address === ret?.decoded?.tokenB?.toLowerCase()
						|| sn.token.address === ret?.decoded?.token?.toLowerCase()
					)

				tokenCall = (sn.token.chain === chain && sn.token.address === transaction?.to?.toLowerCase())

				const token = sn.token.address
				const buyTax = BN(sn.maxBuyTax || '100')
				const sellTax = BN(sn.maxSellTax || '100')
				if (buyTax.lt(BN('100')) || sellTax.lt(BN('100'))) {
					let taxes = await getTokenTaxInfo(chain, token)
					const tokenBuyTax = BN(taxes?.buyTax || '0')
					const tokenSellTax = BN(taxes?.sellTax || '0')

					if (tokenBuyTax.gt(buyTax) || tokenSellTax.gt(sellTax)) {
						continue
					}
				}
			}

			try {
				if (addLiquidityFlag === true || tokenCall === true) {
					await sn.populate('user')

					try {
						const signedTx = tokenCall === true ? await processSnipeMethodId(sn.user.telegramId, web3, chain, sn, transaction, { signTx: true }) : await processSnipeLiquidity(sn.user.telegramId, web3, chain, sn, transaction, { signTx: true })

						if (signedTx) {
							const ret = sn.token.chain === 'ethereum'
								? await flashBotSend(sn.user.telegramId, chain, signedTx.rawTransaction, { simulate: true, targetTx: transaction.raw })
								: 'Unsupported Chain'

							console.log('Snipe result', sn._id.toString(), ret)

							await SnipeTokenModel.findByIdAndUpdate(sn._id, { state: 'processing' })
							sendSnipeMessage(chain, JSON.stringify({
								discriminator: 'bot-action-data',
								type: 'snipe',
								id: sn._id.toString(),
								transaction: transaction,
								mode: tokenCall === true ? 'method-id' : 'liquidity'
							}))
						}
					} catch (err) {
						console.error(`==> ${new Date().toLocaleString()}`)
						console.error(err)
						await sendBotMessage(sn.user.telegramId, err.message)
					}
				}
			} catch (err) {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
			}
		}
	}
}
