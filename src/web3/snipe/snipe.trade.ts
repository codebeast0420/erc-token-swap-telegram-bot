import { SnipeTokenModel } from "../../models/snipe.godmode.token";
import { TransactionHistoryModel } from "../../models/transaction.history.model";
import { sendBotMessage } from "../../service/app.service";
import { getAppUser } from "../../service/app.user.service";
import { getSettings } from "../../service/settings.service";
import { getTxCallback } from "../../service/transaction.backup.service";
import { getMultiWallets } from "../../service/wallet.service";
import { getWallet } from "../../service/wallet.service";
import { NO_BRIBING, convertValue, sleep } from "../../utils/common";
import Logging from "../../utils/logging";
import { getBlockExplorer, getBotInstance, getDefaultRouterAndWETH, getNativeCurrencySymbol } from "../chain.parameters";
import { AddressZero, fastQuery, getBN, sendTxn, sendTxnAdvanced } from "../web3.operation";
import Router from '../abi/IPancakeRouter02.json'
import CamelotRouter from '../abi/ICamelotRouter.json'
import { updateUserState } from "../../service/stat.service";
import { processError } from "../../service/error";
import { externalInvokeMonitor } from "../../commands/monitor";
import { encodeFunctionCall } from "../abi/encode";
import AntiMEV from '../abi/AntiMEVSwap.json'
import { chainConfig } from "../chain.config";
import { antiMEVSwapCallbackParams } from "../antimev/swap";
import { getGasPrice } from "../../service/chain.service";
import { decodeTxInput } from "../abi/decode";
import { getRouterAndWETH, getTokenInfo } from "../../service/token.service";
import { PairInfoModel } from "../../models/pair.info.model";
import { findBestPair, findBestWETHPair } from "../dex/common/bestpair";
import { DexInfoModel } from "../../models/dex.info.model";
import { prefetchDexOnChain, prefetchTokensOnChain } from "../multicall";
import { TokenInfoModel } from "../../models/token.info.model";
import { getPathToTokenV2 } from "../dex/v2/v2.path";
import { getAmountsInExtV2 } from "../dex/v2/v2.calculate";

async function runForDeadBlocks(web3: any, maxBlocks: number, snipe: any, func: any) {
	let startNumber = await web3.eth.getBlockNumber()
	let oldNumber = startNumber

	let ret
	while (startNumber + maxBlocks >= oldNumber) {
		try {
			ret = await func()
			break
		} catch (err) {
			console.error(`==> block: ${oldNumber}, ${new Date().toLocaleString()}, snipe token ${snipe.token.address} on [${snipe.token.chain}]`)
			console.error(err)
		}

		while (oldNumber === await web3.eth.getBlockNumber()) await sleep(500)
		oldNumber = oldNumber + 1
	}

	return ret
}

async function skipBlocks(web3: any, snipe: any, transaction: any, func: string) {
	const BN = getBN()
	const netGasPrice = await getGasPrice(snipe.token.chain)

	let maxFeePerGasForced = snipe.token.chain === 'ethereum' ? BN(netGasPrice).plus(BN(snipe.gasDeltaPrice).times(BN('1e9'))).integerValue().toString() : BN(snipe.gasDeltaPrice).times(BN('1e9')).integerValue().toString()
	//transaction.maxFeePerGas ?? transaction.gasPrice
	// let maxPriorityFeePerGasForced = transaction.maxPriorityFeePerGas? BN(transaction.maxPriorityFeePerGas).div(2).integerValue().toString(): BN(transaction.gasPrice).minus(BN(netGasPrice)).div(2).integerValue().toString()
	let maxPriorityFeePerGasForced = BN(maxFeePerGasForced).minus(BN(netGasPrice)).integerValue().toString()

	if (BN(maxPriorityFeePerGasForced).lt(BN('0.01e9'))) maxPriorityFeePerGasForced = BN('0.01e9').toString()

	let gasPriceWeiVal

	if (snipe.blockDelay > 0) {
		const initBlockNumber = await web3.eth.getBlockNumber()

		let oldNumber
		while (true) {
			const n = await web3.eth.getBlockNumber();
			if (oldNumber === undefined) oldNumber = n
			else if (oldNumber === n) {
				continue
			}

			if (n >= initBlockNumber + snipe.blockDelay) break;
			oldNumber = n
			console.log(`[${func}] ${snipe._id} skipping`, n);
		}

		gasPriceWeiVal = snipe.gasDeltaPrice ? BN(snipe.gasDeltaPrice.toString()).times(BN(`1e9`)).integerValue().toString() : undefined
		maxFeePerGasForced = undefined
		maxPriorityFeePerGasForced = undefined
	}

	return {
		gasPriceWeiVal,
		maxFeePerGasForced,
		maxPriorityFeePerGasForced
	}
}

function calculateInputAmount(ra: any[], outAmount: string) {
	const BN = getBN()
	let i
	for (i = ra.length - 1; i >= 0; i--) {
		const pa = ra[i]
		if (BN(pa[1]).lte(BN(outAmount))) {
			throw new Error('failed to estimate')
		}

		const deltaY = BN(pa[1]).minus(BN(outAmount))
		outAmount = BN(pa[0]).times(BN(outAmount)).div(deltaY).toString()
	}

	return BN(outAmount).integerValue().toString()
}

export async function processSnipeLiquidity(telegramId: string, web3: any, chain: string, snipe: any, transaction: any, ex?: any) {
	const BN = getBN()

	const { maxFeePerGasForced, maxPriorityFeePerGasForced, gasPriceWeiVal } = await skipBlocks(web3, snipe, transaction, 'processSnipeLiquidity')

	const tres = await Promise.all([
		getAppUser(telegramId),
		getMultiWallets(telegramId),
		getWallet(telegramId),
		getSettings(telegramId, chain),
		getNativeCurrencySymbol(chain),
		getBlockExplorer(chain),
		getGasPrice(chain)
	])

	const user = tres[0]
	const multiWallets = tres[1]
	const mainWallet = tres[2]
	const setting = tres[3]
	const nativeSymbol = tres[4]
	const blockExploer = tres[5]
	const netGasPrice = tres[6].toString()

	// regulating parameters...
	const wallets = (snipe.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]
	const gasForced = snipe.maxGas
	// const gasPrice = transaction.gasPrice // BN(snipe.gasDeltaPrice).times(BN(`1e9`)).integerValue().toString() //
	const tokenAddress = snipe.token.address
	const tokenInfo = await getTokenInfo(chain, tokenAddress)
	const ret = decodeTxInput(web3, Router.abi, transaction.input)

	let weth
	const routerAddress = transaction.to?.toLowerCase()

	{
		if (0 === await DexInfoModel.countDocuments({ chain: chain, router: routerAddress })) {
			await prefetchDexOnChain(chain, JSON.stringify([{ router: routerAddress }]))
		}

		const dexInfo = await DexInfoModel.findOne({ chain: chain, router: routerAddress })
		if (dexInfo) {
			weth = dexInfo.weth
		} else {
			if (ex?.signTx !== true) {
				await sendBotMessage(telegramId, `Error sniping\n\n${blockExploer}/tx/${transaction.hash}\n\nFailed to find dex info of <code>${routerAddress}</code> on <b>${chain}</b>`)
			}
			return
		}
	}

	let reserveArray
	let path

	if (ret) {
		if (ret.abi.name === 'addLiquidityETH') {
			const lpArray = (await Promise.all(tokenInfo.lp.map(addr => PairInfoModel.findOne({ chain: chain, address: addr, version: 2 })))).filter(lp => lp !== null)
			const bestPair = await findBestWETHPair(tokenAddress, lpArray)

			const tokenReserve = bestPair ? (bestPair.token0 === tokenAddress ? BN(bestPair.reserve0 || '0').times(BN(`1e${bestPair.decimal0}`)).toString() : BN(bestPair.reserve1 || '0').times(BN(`1e${bestPair.decimal1}`)).toString()) : undefined
			const wethReserve = bestPair ? (bestPair.token0 === tokenAddress ? BN(bestPair.reserve1 || '0').times(BN(`1e${bestPair.decimal1}`)).toString() : BN(bestPair.reserve0 || '0').times(BN(`1e${bestPair.decimal0}`)).toString()) : undefined

			reserveArray = [[BN(wethReserve || '0').plus(ret.decoded.amountTokenDesired).integerValue().toString(), BN(tokenReserve || '0').plus(transaction.value).integerValue().toString()]]
			path = [weth, tokenAddress]
		} else if (ret.abi.name === 'addLiquidity') {
			const proxyTokenAddress = ret.decoded.tokenA.toLowerCase() === tokenAddress ? ret.decoded.tokenB.toLowerCase() : ret.decoded.tokenA.toLowerCase()
			const proxyTokenInfo = await getTokenInfo(chain, proxyTokenAddress)
			const lpProxyArray = (await Promise.all(proxyTokenInfo.lp.map(addr => PairInfoModel.findOne({ chain: chain, address: addr, version: 2 })))).filter(lp => lp !== null)
			const bestProxyPair = await findBestWETHPair(proxyTokenAddress, lpProxyArray)
			if (bestProxyPair === undefined) {
				if (ex?.signTx !== true) {
					await sendBotMessage(telegramId, `Error sniping\n\n${blockExploer}/tx/${transaction.hash}\n\nFailed to find WETH pair of <code>${proxyTokenAddress}</code>:<b>${proxyTokenInfo.symbol}</b> on <b>${chain}</b>`)
				}
				return
			}

			if (bestProxyPair.token0 === proxyTokenAddress) {
				reserveArray = [
					[BN(bestProxyPair.reserve1).times(BN(`1e${tokenInfo.decimals}`)).integerValue().toString(), BN(bestProxyPair.reserve0).times(BN(`1e${proxyTokenInfo.decimals}`)).integerValue().toString()]
				]
			} else {
				reserveArray = [
					[BN(bestProxyPair.reserve0).times(BN(`1e${tokenInfo.decimals}`)).integerValue().toString(), BN(bestProxyPair.reserve1).times(BN(`1e${proxyTokenInfo.decimals}`)).integerValue().toString()]
				]
			}

			const lpArray = (await Promise.all(tokenInfo.lp.map(addr => PairInfoModel.findOne({ chain: chain, address: addr, version: 2 })))).filter(lp => lp !== null)
			const bestPair = findBestPair(tokenAddress, lpArray.filter(lp => (lp.token0 === tokenAddress && lp.token1 === proxyTokenAddress) || lp.token1 === tokenAddress && lp.token0 === proxyTokenAddress))

			const tokenReserve = bestPair ? (bestPair.token0 === tokenAddress ? BN(bestPair.reserve0 || '0').times(BN(`1e${bestPair.decimal0}`)).toString() : BN(bestPair.reserve1 || '0').times(BN(`1e${bestPair.decimal1}`)).toString()) : undefined
			const proxyReserve = bestPair ? (bestPair.token0 === tokenAddress ? BN(bestPair.reserve1 || '0').times(BN(`1e${bestPair.decimal1}`)).toString() : BN(bestPair.reserve0 || '0').times(BN(`1e${bestPair.decimal0}`)).toString()) : undefined

			const proxyTokenAddAmount = ret.decoded.tokenA.toLowerCase() === tokenAddress ? ret.decoded.amountBDesired : ret.decoded.amountADesired
			const tokenAddAmount = ret.decoded.tokenA.toLowerCase() === tokenAddress ? ret.decoded.amountADesired : ret.decoded.amountBDesired

			reserveArray = [
				...reserveArray,
				[BN(proxyReserve || '0').plus(proxyTokenAddAmount).integerValue().toString(), BN(tokenReserve || '0').plus(tokenAddAmount).integerValue().toString()]
			]
			path = [weth, proxyTokenAddress, tokenAddress]
		}
	}

	for (const w of wallets) {
		try {
			const ethBal = await web3.eth.getBalance(w.address)
			const pv = convertValue(web3.utils.fromWei(ethBal.toString()).toString(), snipe.nativeCurrencyAmount || '50%', BN)
			let ethAmount = BN(pv.toString()).times(BN('1e18')).integerValue().toString()

			let ethAmountByTokenAmount
			if (snipe.tokenAmount && reserveArray) {
				const tokenAmountWithoutDecimal = BN(snipe.tokenAmount).times(BN(`1e${tokenInfo.decimals}`)).integerValue().toString()
				try {
					ethAmountByTokenAmount = calculateInputAmount(reserveArray, tokenAmountWithoutDecimal)
				} catch (err) {
				}
			}

			if (ethAmountByTokenAmount && BN(ethAmount).gt(BN(ethAmountByTokenAmount))) ethAmount = ethAmountByTokenAmount

			const label = `⛓<b>${chain}</b>\n<code>${w.address}</code>\nSniping <b>${tokenAddress}</b>\n${blockExploer}/tx/${transaction.hash}`

			if (ex?.signTx !== true) {
				Logging.info(label)
			}

			const callback = getTxCallback(label)

			let abi = Router.abi
			let args = ['0', path, w.address, '0xffffffff']
			if (chain === 'arbitrum' && routerAddress === '0xc873fecbd354f5a56e00e710b90ef4201db2448d') { // arbitrum camelot router
				abi = CamelotRouter.abi
				args = ['0', path, w.address, AddressZero, '0xffffffff']
			}

			let tx
			try {
				if (BN(snipe.bribeAmount || '0').lte(0) || chain !== 'ethereum') {
					throw new Error(NO_BRIBING)
				}

				const swapCall = encodeFunctionCall(undefined, abi, 'swapExactETHForTokensSupportingFeeOnTransferTokens', args)
				const fees = await Promise.all([
					fastQuery(telegramId, chain, {
						abi: AntiMEV.abi,
						functionName: 'feeAmount',
						args: []
					}, {
						from: w.address,
						to: chainConfig[chain].antimevSwapper
					}),
					fastQuery(telegramId, chain, {
						abi: AntiMEV.abi,
						functionName: 'bribeFeeAmount',
						args: []
					}, {
						from: w.address,
						to: chainConfig[chain].antimevSwapper
					})
				])
				const fee = fees[0]
				const bribeFee = fees[1].toString()
				const bribe = BN(snipe.bribeAmount).times(BN('1e18')).integerValue().toString()

				const callParams = antiMEVSwapCallbackParams(routerAddress, tokenAddress, ethAmount, { data: swapCall }, 'buy', BN(fee.toString()).toString(), bribeFee, bribe)
				try {
					tx = await sendTxnAdvanced(telegramId, chain,
						{
							...callParams,
							gasForced,
							gasPrice: gasPriceWeiVal ? BN(gasPriceWeiVal).plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined,
							gasPriceForced: maxFeePerGasForced,
							// maxPriorityFeePerGasForced: maxPriorityFeePerGasForced,
							address: w,
							signTx: ex?.signTx,
							block0Tx: transaction.raw
						},
						{
							callback: callback,
							exInfo: {
								telegramId: telegramId,
								chain: chain,
								token: tokenAddress,
								user: w.address,
								type: 'buy',
								tokenAmount: '0',
								ethAmount: ethAmount
							}
						})

					if (ex?.signTx === true) return tx
				} catch (err) {
					if (snipe.backupTx === true) {
						throw new Error('Backup transaction')
					}
				}
			} catch (err) {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)

				const swapCall = encodeFunctionCall(undefined, abi, 'swapExactETHForTokensSupportingFeeOnTransferTokens', args)

				const runTx = async () => {
					return await sendTxnAdvanced(telegramId, chain,
						{
							data: swapCall,
							to: routerAddress,
							gasPrice: BN(snipe.gasDeltaPrice || '0').times(BN(`1e9`)).plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString(),
							// gasPriceForced: maxFeePerGasForced,
							// maxPriorityFeePerGasForced: maxPriorityFeePerGasForced,
							address: w,
							gasForced,
							value: ethAmount,
							signTx: ex?.signTx
						},
						{
							callback: callback,
							exInfo: {
								telegramId: telegramId,
								chain: chain,
								token: path[path.length - 1],
								user: w.address,
								type: 'buy',
								tokenAmount: '0',
								ethAmount: ethAmount
							}
						}
					)
				}

				if (ex?.signTx === true) {
					return await runTx()
				} else {
					if (err.message === NO_BRIBING) {
						tx = await runTx()
					} else {
						tx = await runForDeadBlocks(web3, 100, snipe, runTx)
					}
				}
			}

			if (tx?.transactionHash) {
				const newTx = await TransactionHistoryModel.findOne({ user: snipe.user._id, chain: chain, transactionHash: tx.transactionHash })
				await SnipeTokenModel.findByIdAndUpdate(snipe._id, { transaction: newTx._id })

				await externalInvokeMonitor(telegramId, user.chatId, chain, snipe.token.address)
			} else {
				Logging.error(`[processSnipeLiquidity] ${user.userName} token ${snipe.token.address}(${snipe.token.symbol})`)
			}

			await updateUserState(telegramId, chain, 0, 0, undefined, ethAmount)
		} catch (err) {
			console.error(`==> ${new Date().toLocaleString()}`)
			console.error(err)
			const bot = getBotInstance()
			await processError(bot, telegramId, err)
		}
	}
}

export async function processSnipeMethodId(telegramId: string, web3: any, chain: string, snipe: any, transaction: any, ex?: any) {
	const BN = getBN()

	const { maxFeePerGasForced, maxPriorityFeePerGasForced, gasPriceWeiVal } = await skipBlocks(web3, snipe, transaction, 'processSnipeMethodId')

	const tres = await Promise.all([
		getAppUser(telegramId),
		getMultiWallets(telegramId),
		getWallet(telegramId),
		getSettings(telegramId, chain),
		getNativeCurrencySymbol(chain),
		getBlockExplorer(chain),
		getGasPrice(chain)
	])

	const user = tres[0]
	const multiWallets = tres[1]
	const mainWallet = tres[2]
	const setting = tres[3]
	const nativeSymbol = tres[4]
	const blockExploer = tres[5]
	const netGasPrice = tres[6].toString()

	// regulating parameters...
	const wallets = (snipe.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]
	const gasForced = snipe.maxGas
	// const gasPrice = transaction.gasPrice // BN(snipe.gasDeltaPrice).times(BN(`1e9`)).integerValue().toString() //
	const tokenAddress = snipe.token.address

	if (0 === await TokenInfoModel.countDocuments({ chain: chain, address: tokenAddress })) {
		await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
	}

	const tokenInfo = await getTokenInfo(chain, tokenAddress)
	let routerAddress
	let weth
	let path
	let v2Path

	try {
		v2Path = await getPathToTokenV2(chain, tokenAddress)
		const wi = await getRouterAndWETH(chain, v2Path.factory)
		if (wi.router) {
			routerAddress = wi.router
			weth = wi.weth

			path = v2Path.path
		} else {
			throw new Error('Not found Router')
		}
	} catch (err) {
		const wi = getDefaultRouterAndWETH(chain)
		routerAddress = wi?.router
		weth = wi?.weth
		path = [weth, tokenAddress]
	}

	if (routerAddress === undefined || weth === undefined) {
		if (ex?.signTx !== true) {
			await sendBotMessage(telegramId, `Error sniping\n\n${blockExploer}/tx/${transaction.hash}\n\nFailed to find dex info.`)
		}
		return
	}

	for (const w of wallets) {
		try {
			const ethBal = await web3.eth.getBalance(w.address)
			const pv = convertValue(web3.utils.fromWei(ethBal.toString()).toString(), snipe.nativeCurrencyAmount || '50%', BN)
			let ethAmount = BN(pv.toString()).times(BN('1e18')).integerValue().toString()

			let ethAmountByTokenAmount
			if (snipe.tokenAmount && v2Path) {
				try {
					const ethAmountWithDecimal = await getAmountsInExtV2(chain, snipe.tokenAmount, v2Path)
					ethAmountByTokenAmount = BN(ethAmountWithDecimal).times(BN('1e18')).integerValue().toString()
				} catch (err) {
					console.error(err)
				}
			}

			if (ethAmountByTokenAmount && BN(ethAmount).gt(BN(ethAmountByTokenAmount))) ethAmount = ethAmountByTokenAmount

			const label = `⛓<b>${chain}</b>\n<code>${w.address}</code>\nSniping <b>${tokenAddress}</b>\n${blockExploer}/tx/${transaction.hash}`
			if (ex?.signTx !== true) {
				Logging.info(label)
			}

			const callback = getTxCallback(label)

			let abi = Router.abi
			let args = ['0', path, w.address, '0xffffffff']
			if (chain === 'arbitrum' && routerAddress === '0xc873fecbd354f5a56e00e710b90ef4201db2448d') { // arbitrum camelot router
				abi = CamelotRouter.abi
				args = ['0', path, w.address, AddressZero, '0xffffffff']
			}

			let tx
			try {
				if (BN(snipe.bribeAmount || '0').lte(0) || chain !== 'ethereum') {
					throw new Error(NO_BRIBING)
				}

				const swapCall = encodeFunctionCall(undefined, abi, 'swapExactETHForTokensSupportingFeeOnTransferTokens', args)
				const fees = await Promise.all([
					fastQuery(telegramId, chain, {
						abi: AntiMEV.abi,
						functionName: 'feeAmount',
						args: []
					}, {
						from: w.address,
						to: chainConfig[chain].antimevSwapper
					}),
					fastQuery(telegramId, chain, {
						abi: AntiMEV.abi,
						functionName: 'bribeFeeAmount',
						args: []
					}, {
						from: w.address,
						to: chainConfig[chain].antimevSwapper
					})
				])
				const fee = fees[0]
				const bribeFee = fees[1].toString()
				const bribe = BN(snipe.bribeAmount).times(BN('1e18')).integerValue().toString()

				const callParams = antiMEVSwapCallbackParams(routerAddress, tokenAddress, ethAmount, { data: swapCall }, 'buy', BN(fee.toString()).toString(), bribeFee, bribe)

				try {
					tx = await sendTxnAdvanced(telegramId, chain,
						{
							...callParams,
							gasForced,
							gasPrice: gasPriceWeiVal ? BN(gasPriceWeiVal).plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined,
							gasPriceForced: maxFeePerGasForced,
							// maxPriorityFeePerGasForced: maxPriorityFeePerGasForced,
							address: w,
							signTx: ex?.signTx,
							block0Tx: transaction.raw
						},
						{
							callback: callback,
							exInfo: {
								telegramId: telegramId,
								chain: chain,
								token: tokenAddress,
								user: w.address,
								type: 'buy',
								tokenAmount: '0',
								ethAmount: ethAmount
							}
						})

					if (ex?.signTx === true) {
						return tx
					}
				} catch (err) {
					if (snipe.backupTx === true) {
						throw new Error('Backup transaction')
					}
				}
			} catch (err) {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)

				const swapCall = encodeFunctionCall(undefined, abi, 'swapExactETHForTokensSupportingFeeOnTransferTokens', args)

				const runTx = async () => {
					return await sendTxnAdvanced(telegramId, chain,
						{
							data: swapCall,
							to: routerAddress,
							gasPrice: BN(snipe.gasDeltaPrice || '0').times(BN(`1e9`)).plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString(),
							// gasPriceForced: maxFeePerGasForced,
							// maxPriorityFeePerGasForced: maxPriorityFeePerGasForced,
							address: w,
							gasForced,
							value: ethAmount,
							signTx: ex?.signTx
						},
						{
							callback: callback,
							exInfo: {
								telegramId: telegramId,
								chain: chain,
								token: path[path.length - 1],
								user: w.address,
								type: 'buy',
								tokenAmount: '0',
								ethAmount: ethAmount
							}
						}
					)
				}

				if (ex?.signTx === true) {
					return await runTx()
				} else {
					if (err.message === NO_BRIBING) {
						tx = await runTx()
					} else {
						tx = await runForDeadBlocks(web3, 100, snipe, runTx)
					}
				}
			}

			if (tx?.transactionHash) {
				const newTx = await TransactionHistoryModel.findOne({ user: snipe.user._id, chain: chain, transactionHash: tx.transactionHash })
				await SnipeTokenModel.findByIdAndUpdate(snipe._id, { transaction: newTx._id })

				await externalInvokeMonitor(telegramId, user.chatId, chain, snipe.token.address)
			} else {
				Logging.error(`[processSnipeMethodId] ${user.userName} token ${snipe.token.address}(${snipe.token.symbol})`)
			}

			await updateUserState(telegramId, chain, 0, 0, undefined, ethAmount)
		} catch (err) {
			console.error(`==> ${new Date().toLocaleString()}`)
			console.error(err)
			const bot = getBotInstance()
			await processError(bot, telegramId, err)
		}
	}
}
