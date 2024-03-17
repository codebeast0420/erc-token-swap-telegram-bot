import { ADDRESS_ADDRESS_THIS, ADDRESS_CONTRACT_BALANCE, AddressDead, AddressZero, estimateGasByProvider, fastQuery, getBN, getGasPriceByPreset, getUpperGas, newWeb3, sendTxn, sendTxnAdvanced } from './web3.operation';
import Router from './abi/IPancakeRouter02.json';
import UniRouter from './abi/UniswapV2.json';
import CamelotRouter from './abi/ICamelotRouter.json'
import RouterV3 from './abi/SmartRouter.json';
import ERC20 from './abi/ERC20.json'
import AntiMEV from './abi/AntiMEVSwap.json'
import { getNativeCurrencyDecimal, getNativeCurrencySymbol } from './chain.parameters';
import { getWallet } from '../service/wallet.service';
import { getTxCallback } from '../service/transaction.backup.service';
import { approveTokenExt, getApprovalAddress, getTokenSimpleInfo, isTokenApprovedExt } from './token.interaction';
import { getTokenInfo, getTokenPrice, getTokenTaxInfo } from '../service/token.service';
import { externalInvokeMonitor } from '../commands/monitor';
import { getAppUser, userVerboseLog } from '../service/app.user.service';
import { SettingsModel } from '../models/settings.model';
import { ChainModel } from '../models/chain.model';
import { getSettings, isApproveAuto } from '../service/settings.service';
import { getGasPrice } from '../service/chain.service';
import { updateBuyMonitorInfo, updateSellMonitorInfo } from '../service/monitor.service';
import { getAmountsInExtV2, getAmountsOutExtV2 } from './dex/v2/v2.calculate';
import { getAmountsInExtV3, getAmountsOutExtV3, getPathBytesFromV3Path } from './dex/v3/v3.calculate';
import { DexInfoModel } from '../models/dex.info.model';
import { updateUserState } from '../service/stat.service';
import { getETHBalance } from './nativecurrency/nativecurrency.query';
import { APE_MAX_NOT_FOUND, BRIBING_FAILED, INSUFFICIENT_ETH, INSUFFICIENT_ETH_BRIBE, INVALID_OPERATION, MAX_TX_NOT_FOUND, NOT_ALLOWED_ANTIMEV, NOT_APPROVED, NOT_ENOUGH_BALANCE, ROUTER_NOT_FOUND, TOO_MUCH_REQUESTED, convertValue } from '../utils/common';
import { queryTokenInfoOnChain } from './multicall';
import { encodeFunctionCall } from './abi/encode';
import { antiMEVSwapCallbackParams, generateFakeAmount, generateSwapCall } from './antimev/swap'
import { chainConfig } from './chain.config';
import { getBestPathFromToken, getBestPathToToken } from './dex/common/bestpath';

const { ethers } = require('ethers');

export async function swapETHForToken(telegramId: string, chain: string, swapParams: any, sendParams: any, customLabel?: string) {
	console.log("swapETHForToken");
	const user = await getAppUser(telegramId)

	const tokenInfo = await getTokenInfo(chain, swapParams.token)
	console.log("new tokenInfo", tokenInfo.marketCap)
	const tokenPrice = await getTokenPrice(telegramId, chain, tokenInfo.address)

	const BN = getBN();
	const nativeDecimals = await getNativeCurrencyDecimal(chain);
	const nativeSymbol = await getNativeCurrencySymbol(chain);
	const label = customLabel ? customLabel : `🔗<b>${chain}</b>\nBuying <b>${tokenInfo.symbol}</b> at <b>${BN(tokenInfo.marketCap).times(BN(tokenPrice)).toFixed(2)}$ MC</b> with <b>${BN(sendParams.value).div(BN(`1e${nativeDecimals}`)).toFixed(4)} ${nativeSymbol}</b>`;

	const callback = getTxCallback(label);

	const chainInfo = await ChainModel.findOne({ name: chain })
	const setting = await SettingsModel.findOne({ user: user._id, chain: chainInfo._id })

	const gasPriceInWei = await getGasPrice(chain)

	const pgInWei = sendParams.gasPrice ? sendParams.gasPrice : BN(setting?.buyGasPrice || '0').times(BN('1e9')).toString()
	let buyGasPrice
	if (chain === 'ethereum') {
		buyGasPrice = BN(pgInWei).plus(BN(gasPriceInWei))
	} else {
		buyGasPrice = BN(pgInWei).eq(BN(0)) === true ? BN(gasPriceInWei) : BN(pgInWei)
	}

	let amountOutMin = '0'
	let tokenAmount = '0'
	let slippage = swapParams.slippage ? swapParams.slippage : setting.slippage

	// let bestPath = {
	// 	path: ["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", tokenInfo.address]
	// }

	let bestPath = {
		path: ["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", tokenInfo.address]
	}
	
	const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/7535811d19b1410e98c261fbb638651a");
	const routerAddress = '0x7a250d5630b4cf539739df2c5dacb4c659f2488d'
	const abi = UniRouter.abi
	const contract = new ethers.Contract(routerAddress, abi, provider);
	console.log("eth params", sendParams, nativeDecimals);
	// const ethAmountDecimal = BN(sendParams.value).div(BN(`1e${nativeDecimals}`)).toString()
	// console.log("ethAmountDecimal", ethAmountDecimal);
	const amountOut = await contract.getAmountsOut(sendParams.value, bestPath.path);
	const integers = amountOut.map(bn => bn.toNumber().toString());
	console.log("amountOut", integers.join(''))
	


	// if (bestPath?.version === 2) {
	// 	amountOut = await getAmountsOutExtV2(chain, ethAmountDecimal, bestPath)
	// } else if (bestPath?.version === 3) {
	// 	amountOut = await getAmountsOutExtV3(chain, ethAmountDecimal, bestPath)
	// } else {
	// 	throw new Error(INVALID_OPERATION + `\nFailed to calculate <b>${tokenInfo.symbol}</b> amount to buy by <b>${ethAmountDecimal} ${nativeSymbol}</b>`)
	// }

	// const factory = bestPath.factory
	const factory = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"

	tokenAmount = integers.join('')
	// amountOutMin = BN(tokenAmount).times(BN(100).minus(BN(slippage))).div(BN(100)).integerValue().toString()

	// const dexFound: any = await DexInfoModel.findOne({ chain: chain, factory: factory })
	// const routerAddress = dexFound.router

	const w = sendParams.address ? sendParams.address : await getWallet(telegramId)

	let tx
	{
		let abi = Router.abi
		let args = [amountOutMin, bestPath.path, swapParams.recipient, '0xffffffff']
		tx = await sendTxn(telegramId, chain,
			{
				abi,
				functionName: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
				args
			},
			{
				...sendParams,
				to: routerAddress,
				gasPrice: buyGasPrice.integerValue().toString(),
				address: w,
				antiMEV: setting.antiMEV
			},
			{
				callback: callback,
				exInfo: {
					telegramId: telegramId,
					chain: chain,
					token: swapParams.token,
					user: w.address,
					type: 'buy',
					tokenAmount: tokenAmount,
					ethAmount: sendParams.value
				}
			}
		)
	}
	// if (bestPath.version === 2) {
	// 	let abi = Router.abi
	// 	let args = [amountOutMin, bestPath.path, swapParams.recipient, '0xffffffff']
	// 	if (chain === 'arbitrum' && routerAddress === '0xc873fecbd354f5a56e00e710b90ef4201db2448d') { // arbitrum camelot router
	// 		abi = CamelotRouter.abi
	// 		args = [amountOutMin, bestPath.path, swapParams.recipient, AddressZero, '0xffffffff']
	// 	}
	// 	{
	// 		tx = await sendTxn(telegramId, chain,
	// 			{
	// 				abi,
	// 				functionName: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
	// 				args
	// 			},
	// 			{
	// 				...sendParams,
	// 				to: routerAddress,
	// 				gasPrice: buyGasPrice.integerValue().toString(),
	// 				address: w,
	// 				antiMEV: setting.antiMEV
	// 			},
	// 			{
	// 				callback: callback,
	// 				exInfo: {
	// 					telegramId: telegramId,
	// 					chain: chain,
	// 					token: swapParams.token,
	// 					user: w.address,
	// 					type: 'buy',
	// 					tokenAmount: tokenAmount,
	// 					ethAmount: sendParams.value
	// 				}
	// 			}
	// 		)
	// 	}
	// } else if (bestPath.version === 3) {
	// 	const ethAmount = BN(sendParams.value).integerValue().toString()

	// 	const pathAssembled = getPathBytesFromV3Path(bestPath)
	// 	const wrapETHData = encodeFunctionCall(undefined, RouterV3.abi, "wrapETH", [ethAmount])
	// 	const exactInputData = encodeFunctionCall(undefined, RouterV3.abi, "exactInput", [[pathAssembled, ADDRESS_ADDRESS_THIS, ADDRESS_CONTRACT_BALANCE, amountOutMin]])
	// 	const sweepTokenData = encodeFunctionCall(undefined, RouterV3.abi, "sweepToken", [swapParams.token, amountOutMin, swapParams.recipient])
	// 	const swapCall = encodeFunctionCall(undefined, RouterV3.abi, 'multicall', [[wrapETHData, exactInputData, sweepTokenData]])

	// 	// if (setting.antiMEV === true || BN(sendParams.bribe || '0').gt(0)) {
	// 	// 	const fee = await fastQuery(telegramId, chain, {
	// 	// 		abi: AntiMEV.abi,
	// 	// 		functionName: 'feeAmount',
	// 	// 		args: []
	// 	// 	}, {
	// 	// 		from: w.address,
	// 	// 		to: chainConfig[chain].antimevSwapper
	// 	// 	})

	// 	// 	let bribeFee
	// 	// 	let bribe
	// 	// 	if (BN(sendParams.bribe || '0').gt(0)) {
	// 	// 		const bfee = await fastQuery(telegramId, chain, {
	// 	// 			abi: AntiMEV.abi,
	// 	// 			functionName: 'bribeFeeAmount',
	// 	// 			args: []
	// 	// 		}, {
	// 	// 			from: w.address,
	// 	// 			to: chainConfig[chain].antimevSwapper
	// 	// 		})
	// 	// 		bribeFee = bfee.toString()
	// 	// 		bribe = BN(sendParams.bribe).integerValue().toString()
	// 	// 	}

	// 	// 	const callParams = antiMEVSwapCallbackParams(routerAddress, swapParams.token, sendParams.value, { data: swapCall }, 'buy', BN(fee.toString()).toString(), bribeFee, bribe)

	// 	// 	tx = await sendTxnAdvanced(telegramId, chain,
	// 	// 		{
	// 	// 			...callParams,
	// 	// 			gasPrice: buyGasPrice.integerValue().toString(),
	// 	// 			address: w
	// 	// 		},
	// 	// 		{
	// 	// 			callback: callback,
	// 	// 			exInfo: {
	// 	// 				telegramId: telegramId,
	// 	// 				chain: chain,
	// 	// 				token: swapParams.token,
	// 	// 				user: w.address,
	// 	// 				type: 'buy',
	// 	// 				tokenAmount: tokenAmount,
	// 	// 				ethAmount: ethAmount
	// 	// 			}
	// 	// 		})
	// 	// } else
	// 	{
	// 		tx = await sendTxnAdvanced(telegramId, chain,
	// 			{
	// 				...sendParams,
	// 				data: swapCall,
	// 				to: routerAddress,
	// 				gasPrice: buyGasPrice.integerValue().toString(),
	// 				address: w,
	// 				antiMEV: setting.antiMEV
	// 			},
	// 			{
	// 				callback: callback,
	// 				exInfo: {
	// 					telegramId: telegramId,
	// 					chain: chain,
	// 					token: swapParams.token,
	// 					user: w.address,
	// 					type: 'buy',
	// 					tokenAmount: tokenAmount,
	// 					ethAmount: ethAmount
	// 				}
	// 			})
	// 	}
	// }

	await updateUserState(telegramId, chain, 0, 0, undefined, sendParams.value)

	const taxInfo = await getTokenTaxInfo(chain, swapParams.token)
	await updateBuyMonitorInfo(chain, swapParams.token, w.address, BN(tokenAmount).times(BN(100).minus(BN(taxInfo?.buyTax || '0')).div(100)).toString(), sendParams.value)

	if (tx?.transactionHash) {
		const user = await getAppUser(telegramId)
		await externalInvokeMonitor(telegramId, user.chatId, chain, swapParams.token)
	}

	return tx
}

export async function swapTokenForETH(telegramId: string, chain: string, swapParams: any, sendParams: any, customLabel?: string) {
	const user = await getAppUser(telegramId)

	const tokenInfo = await getTokenInfo(chain, swapParams.token);
	const tokenPrice = await getTokenPrice(telegramId, chain, tokenInfo.address)

	const BN = getBN();
	const nativeDecimals = await getNativeCurrencyDecimal(chain);
	const nativeSymbol = await getNativeCurrencySymbol(chain)
	const label = customLabel ? customLabel : `🔗<b>${chain}</b>\nSelling <b>${BN(swapParams.amount).div(BN(`1e${tokenInfo.decimals}`)).toFixed(4)} ${tokenInfo.symbol}</b> at <b>${BN(tokenInfo.marketCap).times(BN(tokenPrice)).toFixed(2)}$ MC</b> to <b>${nativeSymbol}</b>`;
	const successLabel = `\nSuccessfully sold ${parseFloat(BN(swapParams.amount).div(BN(`1e${tokenInfo.decimals}`)).toFixed(4))} ${tokenInfo.symbol} for ${nativeSymbol}\n☑️Check your wallet!\n`

	const callback = getTxCallback(label, successLabel)

	const chainInfo = await ChainModel.findOne({ name: chain })
	const setting = await SettingsModel.findOne({ user: user._id, chain: chainInfo._id })

	const gasPriceInWei = await getGasPrice(chain)

	const pgInWei = sendParams.gasPrice ? sendParams.gasPrice : BN(setting?.sellGasPrice || '0').times(BN('1e9')).toString()
	let sellGasPrice
	if (chain === 'ethereum') {
		sellGasPrice = BN(pgInWei).plus(BN(gasPriceInWei))
	} else {
		sellGasPrice = BN(pgInWei).eq(BN(0)) === true ? BN(gasPriceInWei) : BN(pgInWei)
	}

	let amountOutMin = '0'
	let ethAmount = '0'
	let slippage = swapParams.slippage ? swapParams.slippage : setting.slippage

	let bestPath
	let amountOut

	try {
		bestPath = await getBestPathFromToken(chain, swapParams.token)
	} catch (err) {
	}

	const tokenAmountDecimal = BN(swapParams.amount).div(BN(`1e${tokenInfo.decimals}`)).toString()
	if (bestPath?.version === 2) {
		amountOut = await getAmountsOutExtV2(chain, tokenAmountDecimal, bestPath)
	} else if (bestPath?.version === 3) {
		amountOut = await getAmountsOutExtV3(chain, tokenAmountDecimal, bestPath)
	} else {
		throw new Error(INVALID_OPERATION + `\nFailed to calculate <b>${nativeSymbol}</b> amount to buy by <b>${tokenAmountDecimal} ${tokenInfo.symbol}</b>`)
	}

	const factory = bestPath.factory

	ethAmount = BN(amountOut).times(BN(`1e${nativeDecimals}`)).integerValue().toString()
	amountOutMin = BN(ethAmount).times(BN(100).minus(BN(slippage))).div(BN(100)).integerValue().toString()

	const w = sendParams.address ? sendParams.address : await getWallet(telegramId)

	const dexInfo = await DexInfoModel.findOne({ chain: chain, factory: factory })
	const routerAddress = dexInfo.router
	const approvalAddress = await getApprovalAddress(telegramId, chain, swapParams.token, factory)
	if (approvalAddress === undefined) {
		if (setting.antiMEV === true) throw new Error(NOT_ALLOWED_ANTIMEV + ` on ${chain}`)
		else throw new Error(ROUTER_NOT_FOUND + `for token ${swapParams.token} on ${chain}`)
	}

	if (true !== (await isTokenApprovedExt(telegramId, chain, swapParams.token, swapParams.amount, approvalAddress)) && true === await isApproveAuto(telegramId, chain)) {
		await approveTokenExt(telegramId, chain, swapParams.token, approvalAddress);
	}

	const tokenAmount = swapParams.amount

	let tx
	if (bestPath.version === 2) {
		let abi = Router.abi

		let args = [tokenAmount, amountOutMin, bestPath.path, swapParams.recipient, '0xffffffff']
		if (chain === 'arbitrum' && routerAddress === '0xc873fecbd354f5a56e00e710b90ef4201db2448d') { // arbitrum camelot router
			abi = CamelotRouter.abi
			args = [tokenAmount, amountOutMin, bestPath.path, swapParams.recipient, AddressZero, '0xffffffff']
		}

		// if (setting.antiMEV === true || BN(sendParams.bribe || '0').gt(0)) {
		// 	const fakeAmount = generateFakeAmount()
		// 	const swapCall = encodeFunctionCall(undefined, abi, 'swapExactTokensForETHSupportingFeeOnTransferTokens', ["0x" + fakeAmount, ...args.slice(1)])
		// 	const balanceCall = encodeFunctionCall(undefined, ERC20.abi, 'balanceOf', [chainConfig[chain].antimevSwapper])

		// 	const fee = await fastQuery(telegramId, chain, {
		// 		abi: AntiMEV.abi,
		// 		functionName: 'feeAmount',
		// 		args: []
		// 	}, {
		// 		from: w.address,
		// 		to: chainConfig[chain].antimevSwapper
		// 	})

		// 	let bribeFee
		// 	let bribe
		// 	if (BN(sendParams.bribe || '0').gt(0)) {
		// 		const bfee = await fastQuery(telegramId, chain, {
		// 			abi: AntiMEV.abi,
		// 			functionName: 'bribeFeeAmount',
		// 			args: []
		// 		}, {
		// 			from: w.address,
		// 			to: chainConfig[chain].antimevSwapper
		// 		})
		// 		bribeFee = bfee.toString()
		// 		bribe = BN(sendParams.bribe).integerValue().toString()
		// 	}

		// 	const callParams = antiMEVSwapCallbackParams(routerAddress, swapParams.token, tokenAmount,
		// 		generateSwapCall(swapCall, [{
		// 			fakeAmount,
		// 			ca: swapParams.token,
		// 			data: balanceCall
		// 		}]),
		// 		'sell', BN(fee.toString()).toString(), bribeFee, bribe)
		// 	tx = await sendTxnAdvanced(telegramId, chain,
		// 		{
		// 			...callParams,
		// 			gasPrice: sellGasPrice.integerValue().toString(),
		// 			address: w
		// 		},
		// 		{
		// 			callback: callback,
		// 			exInfo: {
		// 				telegramId: telegramId,
		// 				chain: chain,
		// 				token: swapParams.token,
		// 				user: w.address,
		// 				type: 'sell',
		// 				tokenAmount: tokenAmount,
		// 				ethAmount: ethAmount
		// 			}
		// 		})
		// } else
		{
			tx = await sendTxn(telegramId, chain,
				{
					abi,
					functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
					args
				},
				{
					...sendParams,
					to: routerAddress,
					gasPrice: sellGasPrice.integerValue().toString(),
					address: w,
					antiMEV: setting.antiMEV
				},
				{
					callback: callback,
					exInfo: {
						telegramId: telegramId,
						chain: chain,
						token: swapParams.token,
						user: w.address,
						type: 'sell',
						tokenAmount: swapParams.amount,
						ethAmount: ethAmount
					}
				}
			)
		}
	} else if (bestPath.version === 3) {
		// if (setting.antiMEV === true || BN(sendParams.bribe || '0').gt(0)) {
		// 	const fakeAmount = generateFakeAmount()

		// 	const pathAssembled = getPathBytesFromV3Path(bestPath)
		// 	const exactInputData = encodeFunctionCall(undefined, RouterV3.abi, "exactInput", [[pathAssembled, ADDRESS_ADDRESS_THIS, "0x" + fakeAmount, amountOutMin]])
		// 	const unwrapETHData = encodeFunctionCall(undefined, RouterV3.abi, "unwrapWETH9", [amountOutMin, swapParams.recipient])
		// 	const swapCall = encodeFunctionCall(undefined, RouterV3.abi, 'multicall', [[exactInputData, unwrapETHData]])

		// 	const balanceCall = encodeFunctionCall(undefined, ERC20.abi, 'balanceOf', [chainConfig[chain].antimevSwapper])

		// 	const fee = await fastQuery(telegramId, chain, {
		// 		abi: AntiMEV.abi,
		// 		functionName: 'feeAmount',
		// 		args: []
		// 	}, {
		// 		from: w.address,
		// 		to: chainConfig[chain].antimevSwapper
		// 	})

		// 	let bribeFee
		// 	let bribe
		// 	if (BN(sendParams.bribe || '0').gt(0)) {
		// 		const bfee = await fastQuery(telegramId, chain, {
		// 			abi: AntiMEV.abi,
		// 			functionName: 'bribeFeeAmount',
		// 			args: []
		// 		}, {
		// 			from: w.address,
		// 			to: chainConfig[chain].antimevSwapper
		// 		})
		// 		bribeFee = bfee.toString()
		// 		bribe = BN(sendParams.bribe).integerValue().toString()
		// 	}

		// 	const callParams = antiMEVSwapCallbackParams(routerAddress, swapParams.token, tokenAmount,
		// 		generateSwapCall(swapCall, [{
		// 			fakeAmount,
		// 			ca: swapParams.token,
		// 			data: balanceCall
		// 		}]),
		// 		'sell', BN(fee.toString()).toString(), bribeFee, bribe)

		// 	tx = await sendTxnAdvanced(telegramId, chain,
		// 		{
		// 			...callParams,
		// 			gasPrice: sellGasPrice.integerValue().toString(),
		// 			address: w
		// 		},
		// 		{
		// 			callback: callback,
		// 			exInfo: {
		// 				telegramId: telegramId,
		// 				chain: chain,
		// 				token: swapParams.token,
		// 				user: w.address,
		// 				type: 'sell',
		// 				tokenAmount: swapParams.amount,
		// 				ethAmount: ethAmount
		// 			}
		// 		}
		// 	)
		// } else
		{
			const pathAssembled = getPathBytesFromV3Path(bestPath)
			const exactInputData = encodeFunctionCall(undefined, RouterV3.abi, "exactInput", [[pathAssembled, ADDRESS_ADDRESS_THIS, swapParams.amount, amountOutMin]])
			const unwrapETHData = encodeFunctionCall(undefined, RouterV3.abi, "unwrapWETH9", [amountOutMin, swapParams.recipient])
			const swapCall = encodeFunctionCall(undefined, RouterV3.abi, 'multicall', [[exactInputData, unwrapETHData]])

			tx = await sendTxnAdvanced(telegramId, chain,
				{
					...sendParams,
					data: swapCall,
					to: routerAddress,
					gasPrice: sellGasPrice.integerValue().toString(),
					address: w,
					antiMEV: setting.antiMEV
				},
				{
					callback: callback,
					exInfo: {
						telegramId: telegramId,
						chain: chain,
						token: swapParams.token,
						user: w.address,
						type: 'sell',
						tokenAmount: swapParams.amount,
						ethAmount: ethAmount
					}
				}
			)
		}
	}

	const taxInfo = await getTokenTaxInfo(chain, swapParams.token)

	await updateUserState(telegramId, chain, 0, 0, BN(ethAmount).times(BN(100).minus(BN(taxInfo?.sellTax || '0')).div(100)).toString(), undefined)

	await updateSellMonitorInfo(chain, swapParams.token, w.address, swapParams.amount, BN(ethAmount).times(BN(100).minus(BN(taxInfo?.sellTax || '0')).div(100)).toString())

	// if (tx?.transactionHash) {
	//     const user = await getAppUser(telegramId)
	// await externalInvokeMonitor(telegramId, user.chatId, chain, swapParams.token)
	// }

	return tx
}


export async function userSwapETHForTokens(telegramId: string, chain: string, tokenAddress: string, amount: string) {
	const w = await getWallet(telegramId);

	const BN = getBN();

	const bal = await getETHBalance(telegramId, chain, w.address);
	const decimals = await getNativeCurrencyDecimal(chain);
	const ethSymbol = await getNativeCurrencySymbol(chain);

	let amn = convertValue(bal, amount, BN)

	if (BN(bal).lt(BN(amn))) {
		throw new Error(NOT_ENOUGH_BALANCE + `\nYou have <b>${parseFloat(BN(bal).toFixed(6))} ${ethSymbol}</b>`);
	}

	return await swapETHForToken(telegramId, chain,
		{
			token: tokenAddress,
			// slippage: undefined,
			recipient: w.address
		},
		{
			address: w,
			value: BN(amn).times(BN(`1e${decimals}`)).integerValue().toString()
		});
}

export async function userSwapETHForTokensByTokenAmount(telegramId: string, chain: string, tokenAddress: string, amount: string) {

	const w = await getWallet(telegramId);

	const BN = getBN();

	const bal = await getETHBalance(telegramId, chain, w.address);
	const decimals = await getNativeCurrencyDecimal(chain);
	const ethSymbol = await getNativeCurrencySymbol(chain);
	const tokenInfo = await queryTokenInfoOnChain(telegramId, chain, tokenAddress, w.address);
	console.log("tokenInfo", tokenInfo)
	let amn = convertValue(tokenInfo.balance, amount, BN)

	// let bestPath = {
	// 	path: ["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", tokenInfo.address]
	// }

	let bestPath = {
		path: ["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", tokenInfo.address]
	}

	// try {
	// 	bestPath = await getBestPathToToken(chain, tokenAddress)
	// } catch (err) {
	// }

	console.log("amountIn start")
	const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/7535811d19b1410e98c261fbb638651a");
	const routerAddress = '0x7a250d5630b4cf539739df2c5dacb4c659f2488d'
	const abi = UniRouter.abi
	console.log("amn", amn);
	const contract = new ethers.Contract(routerAddress, abi, provider);
	const amountIn = await contract.getAmountsIn(amn, bestPath.path);
	const integers = amountIn.map(bn => bn.toNumber().toString());
	console.log("amountIn", integers.join(''))

	// amountIn = await getAmountsInExtV2(chain, amn, bestPath)
	// if (bestPath.version === 2) {
	// 	amountIn = await getAmountsInExtV2(chain, amn, bestPath)
	// } else if (bestPath.version === 3) {
	// 	amountIn = await getAmountsInExtV3(chain, amn, bestPath)
	// } else {
	// 	throw new Error(`Failed to calculate <b>${ethSymbol}</b> amount to get <b>${amn} ${tokenInfo.symbol}</b>`)
	// }

	if (BN(bal).lt(amountIn)) {
		throw new Error(
			NOT_ENOUGH_BALANCE +
			`\nYou have <b>${parseFloat(BN(bal).toFixed(6))} ${ethSymbol}</b>\nHowever, it requires <b>${parseFloat(BN(amountIn).toFixed(6))} ${ethSymbol}</b> to buy <b>${BN(amn).toString()} 💦${tokenInfo.symbol}</b>`
		);
	}

	return await swapETHForToken(telegramId, chain,
		{
			token: tokenAddress,
			slippage: undefined,
			recipient: w.address,
		},
		{
			// value: BN(amountIn).times(BN(`1e${decimals}`)).integerValue().toString(),
			value: integers.join(''),
			address: w
		}
	);
}

export async function userSwapTokenForETHByETHAmount(telegramId: string, chain: string, tokenAddress: string, amount: string) {
	const w = await getWallet(telegramId);

	const BN = getBN();

	const bal = await getETHBalance(telegramId, chain, w.address);
	const decimals = await getNativeCurrencyDecimal(chain);
	const ethSymbol = await getNativeCurrencySymbol(chain);
	const tokenInfo = await queryTokenInfoOnChain(telegramId, chain, tokenAddress, w.address);
	let amn = convertValue(bal, amount, BN)

	let bestPath
	let amountIn

	try {
		bestPath = await getBestPathFromToken(chain, tokenAddress)
	} catch (err) {
	}

	if (bestPath.version === 2) {
		amountIn = await getAmountsInExtV2(chain, amn, bestPath)
	} else if (bestPath.version === 3) {
		amountIn = await getAmountsInExtV3(chain, amn, bestPath)
	} else {
		throw new Error(`Failed to calculate <b>${tokenInfo.symbol}</b> amount to get <b>${amn} ${ethSymbol}</b>`)
	}

	if (BN(tokenInfo.balance).lt(amountIn)) {
		throw new Error(
			NOT_ENOUGH_BALANCE +
			`\nYou have <b>${parseFloat(BN(tokenInfo.balance).toFixed(6))} 💦${tokenInfo.symbol}</b>\nHowever, it requires <b>${amountIn} ${tokenInfo.symbol
			}</b> to get <b>${amn} ${ethSymbol}</b>`
		);
	}

	return await swapTokenForETH(telegramId, chain,
		{
			token: tokenAddress,
			amount: BN(amountIn).times(BN(`1e${tokenInfo.decimals}`)).integerValue().toString(),
			//slippage: undefined,
			recipient: w.address,
		},
		{
			address: w,
		});
}

export async function amountSwapTokenMaxTxForETH(telegramId: string, chain: string, tokenAddress: string, wallet: any) {
	const BN = getBN();

	const tokenInfo = await queryTokenInfoOnChain(telegramId, chain, tokenAddress, wallet.address);

	let bestPath

	try {
		bestPath = await getBestPathFromToken(chain, tokenAddress)
	} catch (err) {
		throw new Error(`[amountSwapTokenMaxTxForETH] ${chain}:${tokenAddress} path and factory not provided`)
	}

	const factory = bestPath.factory
	const dexFound: any = await DexInfoModel.findOne({ chain: chain, factory: factory })

	const routerAddress = dexFound.router

	const web3 = await newWeb3(telegramId, chain);

	let count = 0;
	let upperAmount = BN(tokenInfo.balance)
		.times(BN(`1e${tokenInfo.decimals}`))
		.integerValue();
	let lowerAmount = BN(0);

	const allowance = await fastQuery(telegramId, chain,
		{
			abi: ERC20.abi,
			functionName: 'allowance',
			args: [wallet.address, routerAddress]
		},
		{
			to: tokenAddress,
			address: wallet,
			from: wallet.address
		});

	if (BN(allowance.toString()).lt(BN(upperAmount))) {
		await approveTokenExt(telegramId, chain, tokenAddress, routerAddress);
	}

	let curAmount;

	if (bestPath.version === 2) {
		while (count < 21) {
			if (count === 0) {
				curAmount = BN(upperAmount);
			} else {
				curAmount = upperAmount.plus(lowerAmount).div(2);
			}

			try {
				const path = bestPath.path

				let abi = Router.abi
				let args = [curAmount.integerValue().toString(), '0', path, wallet.address, '0xffffffff']
				if (chain === 'arbitrum' && routerAddress === '0xc873fecbd354f5a56e00e710b90ef4201db2448d') { // arbitrum camelot router
					abi = CamelotRouter.abi
					args = [curAmount.integerValue().toString(), '0', path, wallet.address, AddressZero, '0xffffffff']
				}

				const data = encodeFunctionCall(web3, abi, 'swapExactTokensForETHSupportingFeeOnTransferTokens', args)
				const gas = await estimateGasByProvider(chain, web3, {
					from: wallet.address,
					to: routerAddress,
					data: data
				})

				lowerAmount = curAmount;
				if (lowerAmount.eq(upperAmount)) {
					break;
				}
			} catch (err) {
				upperAmount = curAmount;
			}
			count++;
		}
	} else if (bestPath.version === 3) {
		const pathAssembled = getPathBytesFromV3Path(bestPath)

		while (count < 21) {
			if (count === 0) {
				curAmount = BN(upperAmount);
			} else {
				curAmount = upperAmount.plus(lowerAmount).div(2);
			}

			try {
				const exactInputData = encodeFunctionCall(web3, RouterV3.abi, "exactInput", [[pathAssembled, ADDRESS_ADDRESS_THIS, curAmount.integerValue().toString(), '0']])
				const unwrapETHData = encodeFunctionCall(web3, RouterV3.abi, "unwrapWETH9", ['0', wallet.address])

				const data = encodeFunctionCall(web3, RouterV3.abi, 'multicall', [[exactInputData, unwrapETHData]])
				const gas = await estimateGasByProvider(chain, web3, {
					from: wallet.address,
					to: routerAddress,
					data: data
				})

				lowerAmount = curAmount;
				if (lowerAmount.eq(upperAmount)) {
					break;
				}
			} catch (err) {
				upperAmount = curAmount;
			}
			count++;
		}
	}

	return lowerAmount;
}

export async function userSwapTokenMaxTxForETH(telegramId: string, chain: string, tokenAddress: string) {
	const w = await getWallet(telegramId);
	const amn = await amountSwapTokenMaxTxForETH(telegramId, chain, tokenAddress, w);

	if (amn === undefined || amn.integerValue().toString() === '0') {
		throw new Error(MAX_TX_NOT_FOUND);
	}

	return await swapTokenForETH(telegramId, chain,
		{
			token: tokenAddress,
			amount: amn.integerValue().toString(),
			recipient: w.address,
			// slippage: undefined
		},
		{
			address: w
		});
}

export async function userSwapTokenForETH(telegramId: string, chain: string, tokenAddress: string, amount: string) {
	const w = await getWallet(telegramId);
	const tokenInfo: any = await getTokenSimpleInfo(telegramId, chain, tokenAddress, w.address);
	const bal = tokenInfo.balance;
	const decimals = tokenInfo.decimals;
	const BN = getBN();
	const amn = convertValue(bal, amount, BN)

	if (BN(bal).lt(BN(amn))) {
		throw new Error(TOO_MUCH_REQUESTED + `\nYou have <b>${parseFloat(BN(bal).toFixed(6))} ${tokenInfo.symbol}</b>`);
	}

	let bestPath

	try {
		bestPath = await getBestPathFromToken(chain, tokenAddress)
	} catch (err) {
		throw new Error(`[userSwapTokenForETH] ${chain}:${tokenAddress} path and factory not provided`)
	}

	const factory = bestPath.factory

	const approvalAddress = await getApprovalAddress(telegramId, chain, tokenAddress, factory)

	const realAmount = BN(amn).times(BN(`1e${decimals.toString()}`)).integerValue().toString()
	if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddress, realAmount, approvalAddress))) {
		if (true === await isApproveAuto(telegramId, chain)) {
			await userVerboseLog(telegramId, `Automatically approving ${tokenAddress} for ${approvalAddress}`)
			await approveTokenExt(telegramId, chain, tokenAddress, approvalAddress)
		}
	}

	return await swapTokenForETH(telegramId, chain,
		{
			token: tokenAddress,
			recipient: w.address,
			amount: realAmount,
			// slippage: undefined
		},
		{
			address: w
		});
}

export async function amountSwapETHForTokenApeMax(telegramId: string, chain: string, tokenAddress: string, wallet: any, maxBal: string | undefined, forceGasPrice: number | undefined) {
	const BN = getBN();

	let bestPath

	try {
		bestPath = await getBestPathToToken(chain, tokenAddress)
	} catch (err) {
		throw new Error(`[amountSwapETHForTokenApeMax] ${chain}:${tokenAddress} path and factory not provided`)
	}

	const factory = bestPath.factory

	const settings = await getSettings(telegramId, chain)
	const dexFound: any = await DexInfoModel.findOne({ chain: chain, factory: factory })

	const routerAddress = dexFound.router

	const web3 = await newWeb3(telegramId, chain);
	const totalETHBal = await web3.eth.getBalance(wallet.address);
	const myETHBal = maxBal === undefined ? totalETHBal.toString() : maxBal;

	let count = 0;
	let upperAmount = BN(myETHBal.toString());
	let lowerAmount = BN(0);

	let curAmount;
	let passAmount;
	let gas;

	if (bestPath.version === 2) {
		while (count < 21) {
			if (count === 0) {
				curAmount = BN(upperAmount);
			} else {
				curAmount = upperAmount.plus(lowerAmount).div(2);
			}

			try {
				let abi = Router.abi
				let args = ['0', bestPath.path, wallet.address, '0xffffffff']
				if (chain === 'arbitrum' && routerAddress === '0xc873fecbd354f5a56e00e710b90ef4201db2448d') { // arbitrum camelot router
					abi = CamelotRouter.abi
					args = ['0', bestPath.path, wallet.address, AddressZero, '0xffffffff']
				}

				const data = encodeFunctionCall(web3, abi, 'swapExactETHForTokensSupportingFeeOnTransferTokens', args)
				gas = await estimateGasByProvider(chain, web3, {
					from: wallet.address,
					to: routerAddress,
					data: data,
					value: curAmount.integerValue().toString()
				})

				passAmount = curAmount;
				lowerAmount = curAmount;
				if (lowerAmount.eq(upperAmount)) {
					break;
				}
			} catch (err) {
				upperAmount = curAmount;
			}
			count++;
		}
	} else if (bestPath.version === 3) {
		const pathAssembled = getPathBytesFromV3Path(bestPath)

		while (count < 21) {
			if (count === 0) {
				curAmount = BN(upperAmount);
			} else {
				curAmount = upperAmount.plus(lowerAmount).div(2);
			}

			try {
				const ethAmount = curAmount.integerValue().toString()
				const wrapETHData = encodeFunctionCall(web3, RouterV3.abi, "wrapETH", [ethAmount])
				const exactInputData = encodeFunctionCall(web3, RouterV3.abi, "exactInput", [[pathAssembled, ADDRESS_ADDRESS_THIS, ADDRESS_CONTRACT_BALANCE, '0']])
				const sweepTokenData = encodeFunctionCall(web3, RouterV3.abi, "sweepToken", [tokenAddress, '0', wallet.address])

				const data = encodeFunctionCall(web3, RouterV3.abi, 'multicall', [[wrapETHData, exactInputData, sweepTokenData]])
				gas = await estimateGasByProvider(chain, web3, {
					from: wallet.address,
					to: routerAddress,
					data: data,
					value: ethAmount
				})

				passAmount = curAmount;
				lowerAmount = curAmount;
				if (lowerAmount.eq(upperAmount)) {
					break;
				}
			} catch (err) {
				console.error(err)
				upperAmount = curAmount;
			}
			count++;
		}
	}

	if (passAmount === undefined) {
		throw new Error('❌ Unable to buy')
	}

	const gasPrice = getGasPriceByPreset(forceGasPrice === undefined || forceGasPrice === 0 ? await getGasPrice(chain) : forceGasPrice, settings.gasPreset)
	gas = await getUpperGas(chain, gas)
	const txFee = BN(gas?.toString() || '0').times(BN(gasPrice.toString()).times('1.1'));

	const ret = lowerAmount.plus(txFee).lte(BN(totalETHBal.toString()))
		? lowerAmount
		: lowerAmount.lte(BN(totalETHBal.toString()))
			? BN(totalETHBal.toString()).minus(txFee)
			: lowerAmount.minus(txFee);

	return ret.lt(BN(0)) ? BN(0) : ret;
}

export async function userSwapETHForTokensApeMax(telegramId: string, chain: string, tokenAddress: string, maxBal?: string) {
	const w = await getWallet(telegramId);
	const amn = await amountSwapETHForTokenApeMax(telegramId, chain, tokenAddress, w, maxBal, undefined);

	if (amn === undefined || amn.integerValue().toString() === '0') {
		throw new Error(INSUFFICIENT_ETH);
	}

	return await swapETHForToken(telegramId, chain,
		{
			token: tokenAddress,
			recipient: w.address,
			// slippage: undefined
		},
		{
			address: w,
			value: amn.integerValue().toString()
		}
	);
}

