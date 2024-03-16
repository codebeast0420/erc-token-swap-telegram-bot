import Logging from '../utils/logging';
import { getGasPrice } from '../service/chain.service';
import { getBlockExplorer, getBotInstance, getNativeCurrencyDecimal, getNativeCurrencySymbol, getRPC } from './chain.parameters';
import { getAppUser, userVerboseLog } from '../service/app.user.service';
import { getWallet } from '../service/wallet.service';
import { ESTIMATE_GAS_ERROR, GASPRICE_OVERLOADED, GAS_EXCEEDED, INSUFFICIENT_ETH, TX_ERROR } from '../utils/common';
import { botEnum } from '../constants/botEnum';
import { addAffiliateEarnings, addTxRecord, updateUserState } from '../service/stat.service';
import { getSettings } from '../service/settings.service';
import { encodeFunctionCall } from './abi/encode';
import { chainConfig } from './chain.config';
import FeeDistABI from './abi/FeeDist.json'

import { flashBotPrivateTxn, flashBotSend } from './flashbot';
import { sendProtectedTxn } from './protect/mev';

const Web3 = require('web3');
const BN = require('bignumber.js');
const ethers = require('ethers')

BN.config({
	EXPONENTIAL_AT: [-40, 96],
	ROUNDING_MODE: 3 // BigNumber.ROUND_FLOOR
});

export const AddressZero = '0x0000000000000000000000000000000000000000';
export const AddressOne = '0x0000000000000000000000000000000000000001';
export const AddressTwo = '0x0000000000000000000000000000000000000002';
export const ADDRESS_CONTRACT_BALANCE = AddressZero;
export const ADDRESS_MSG_SENDER = AddressOne;
export const ADDRESS_ADDRESS_THIS = AddressTwo;
export const AddressDead = '0x000000000000000000000000000000000000dEaD';

export function getBN() {
	return BN;
}

export function getAccountFromPvKey(web3: any, pvkey: string) {
	return web3.eth.accounts.privateKeyToAccount(pvkey)
}

export async function newWeb3WithPrivateKey(telegramId: string, chain: string, pvkey: string) {
	const web3: any = newWeb3(telegramId, chain)
	const account = getAccountFromPvKey(web3, pvkey);
	await web3.eth.accounts.wallet.add(pvkey);

	return {
		web3: web3,
		...account
	};
}

export async function newWeb3(telegramId: string, chain: string) {
	const rpc = await getRPC(telegramId, chain)
	return new Web3(rpc)
}

export async function newContract(web3: any, abi: any[], address: string) {
	return await new web3.eth.Contract(abi, address);
}

export async function queryContract(tx: any) {
	if (!tx) {
		throw new Error("undefined query transaction")
	}

	return await tx.call();
}

export async function getGasEstimation(web3: any, tx: any, from: string, to: string, value?: string) {
	return tx ? await tx.estimateGas({ from: from, value: value !== undefined ? value : '0' }) : await web3.eth.estimateGas({ from: from, to: to, value: value === undefined ? '0' : value });
}

export async function getChainId(web3: any) {
	return await web3.eth.net.getId()
}

export async function getNonce(web3: any, address: string) {
	return await web3.eth.getTransactionCount(address)
}

export async function signTxn(chain: string, web3: any, info: any, pvkey: string) {
	// const info = {
	//     from: address,
	//     to: contractAddress,
	//     data: data,
	//     gas,
	//     gasPrice,
	//     nonce,
	//     value: value !== undefined ? value : '0',
	//     chainId: networkId
	// };
	const BN = getBN()
	let chainParams = await Promise.all([
		getNonce(web3, web3.eth.accounts.privateKeyToAccount(pvkey).address),
		getGasPrice(chain),
		getChainId(web3)
	])

	if (!info.nonce) {
		info.nonce = chainParams[0]
	}

	if (chain === 'ethereum') {
		if (BN(info.type).eq(BN(2))) {
			if (!info.maxFeePerGas) {
				info.maxFeePerGas = BN(chainParams[1]).times('1.1').integerValue().toString()
				info.maxPriorityFeePerGas = BN(info.maxFeePerGas).minus(BN(chainParams[1])).integerValue().toString()
			}
			info.gasPrice = undefined
		} else {
			if (!info.gasPrice) {
				info.gasPrice = BN(chainParams[1]).times('1.1').integerValue().toString()
			}
		}
	} else {
		if (!info.gasPrice) {
			info.gasPrice = BN(chainParams[1]).times('1.1').integerValue().toString()
		}
	}

	const signData = {
		...info,
		chainId: chainParams[2]
	}

	return await web3.eth.accounts.signTransaction(signData, pvkey);
}

export async function sendTxnByProvider(chain: string, web3: any, info: any, pvkey: string) {
	// const info = {
	//     from: address,
	//     to: contractAddress,
	//     data: data,
	//     gas,
	//     gasPrice,
	//     nonce,
	//     value: value !== undefined ? value : '0',
	//     chainId: networkId
	// };
	const signedTx = await signTxn(chain, web3, info, pvkey)

	console.log('pending tx', signedTx)
	return await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
}

export async function estimateGasByProvider(chain: string, web3: any, info: any) {
	// info = {
	//     from: from,
	//     to: to,
	//     data: data,
	//     value: value === undefined ? '0' : value
	// }
	if (web3 === undefined) {
		web3 = await newWeb3('', chain)
	}
	return await web3.eth.estimateGas(info);
}

export async function getUpperGas(chain: string, estimated: any) {
	const BN = getBN()
	if (chain === 'ethereum') {
		return BN(estimated.toString()).times('1.2').plus("35000").integerValue().toString()
	}
	return estimated
}

export async function executeTxnByProvider(chain: string, web3: any, info: any, pvkey: string) {
	const gas = await estimateGasByProvider(chain, web3, info)
	return await sendTxnByProvider(chain, web3, {
		...info,
		gas: await getUpperGas(chain, gas)
	}, pvkey)
}

export function getGasPriceByPreset(netGasWei: string, preset: string) {
	if ((preset || 'avg') === 'avg') {
		netGasWei = BN(netGasWei).times(BN("1.15")).integerValue().toString()
	} else if (preset === 'slow') {
		netGasWei = BN(netGasWei).times(BN("1.0")).integerValue().toString()
	} else if (preset === 'fast') {
		netGasWei = BN(netGasWei).times(BN("1.3")).integerValue().toString()
	} else if (preset === 'max') {
		netGasWei = BN(netGasWei).times(BN("1.5")).integerValue().toString()
	}
	return netGasWei
}

export async function sendTxnAdvanced(
	telegramId: string,
	chain: string,
	sendParams: any,
	// to: string,
	// abi: any[] | undefined,
	// fn: string,
	// args: any[],
	// value?: any,
	// address?: IAddress,
	// gasPrice?: string,
	feedback: any,
	// callback?: any,
	// exInfo?: any
) {
	let w;

	const awaitRet = await Promise.all([
		getWallet(telegramId),
		getAppUser(telegramId),
		getNativeCurrencyDecimal(chain),
		getNativeCurrencySymbol(chain),
		getBlockExplorer(chain),
		newWeb3(telegramId, chain),
		getGasPrice(chain),
		getSettings(telegramId, chain),
	])

	if (sendParams.address === null || sendParams.address === undefined || typeof sendParams.address === undefined) {
		w = awaitRet[0];
	} else {
		w = sendParams.address;
	}

	const user = awaitRet[1];
	const decimals = awaitRet[2];
	const symbol = awaitRet[3];
	const exp = awaitRet[4]

	const bot = getBotInstance();
	let msg;

	const userSetting = awaitRet[7]
	try {
		const web3 = awaitRet[5]

		const orgGasPrice = awaitRet[6]
		const curGasPrice = chain === 'ethereum' ? BN(userSetting.maxGasPrice || '0').times(BN('1e9')).plus(BN(orgGasPrice)).toString() : orgGasPrice
		const gasPriceOrg = sendParams.gasPrice === undefined || BN(sendParams.gasPrice).eq(BN(0)) ? curGasPrice : sendParams.gasPrice;
		const gasPrice = sendParams.gasPriceForced ? sendParams.gasPriceForced : getGasPriceByPreset(gasPriceOrg, userSetting.gasPreset)
		if (sendParams.signTx !== true) {
			await userVerboseLog(telegramId, `origin gas price: ${BN(gasPriceOrg.toString()).div(BN(`1e9`)).toFixed(2)}, preset gas price: ${BN(gasPrice.toString()).div(BN(`1e9`)).toFixed(2)}, preset: ${userSetting.gasPreset}, gasPriceForced: ${sendParams.gasPriceForced ? BN(sendParams.gasPriceForced).div(BN('1e9')).toString() : 'not defined'}, maxPriorityFeePerGasForced: ${sendParams.maxPriorityFeePerGasForced ? BN(sendParams.maxPriorityFeePerGasForced).div(BN('1e9')).toString() : 'not defined'}`)
		}

		const myETHBal = await web3.eth.getBalance(w.address)

		let gas = sendParams.gasForced
		if (!gas) {
			try {
				const estimateData = chain === 'ethereum' ? {
					...sendParams,
					from: w.address,
					maxFeePerGas: gasPrice,
					maxPriorityFeePerGas: sendParams.maxPriorityFeePerGasForced ? sendParams.maxPriorityFeePerGasForced : BN(gasPrice).minus(BN(orgGasPrice)).integerValue().toString(),
					type: 2,
					gasPrice: undefined
				} : {
					...sendParams,
					from: w.address,
					gasPrice
				}
				gas = await estimateGasByProvider(chain, web3, estimateData)
				gas = await getUpperGas(chain, gas)
			} catch (err) {
				throw new Error(ESTIMATE_GAS_ERROR + `\n<i>${err.message}</i>`)
			}
		}

		const txData = chain === 'ethereum' ? {
			...sendParams,
			value: BN(sendParams.value || '0').integerValue().toString(),
			address: undefined,
			// from: w.address,
			gas,
			maxFeePerGas: gasPrice,
			maxPriorityFeePerGas: sendParams.maxPriorityFeePerGasForced ? sendParams.maxPriorityFeePerGasForced : BN(gasPrice).minus(BN(orgGasPrice)).integerValue().toString(),
			type: 2,
		} : {
			...sendParams,
			value: BN(sendParams.value || '0').integerValue().toString(),
			address: undefined,
			// from: w.address,
			gas,
			gasPrice
		}

		const signedTx = await signTxn(chain, web3, txData, w.privateKey)

		if (sendParams.signTx === true) {
			return signedTx
		}

		const totalUse = BN(sendParams.value || '0').plus(BN(gas.toString()).times(BN(gasPrice.toString())));
		if (totalUse.gt(BN(myETHBal.toString()))) {
			throw new Error(
				INSUFFICIENT_ETH +
				`\n\nYou have <b>${BN(myETHBal.toString())
					.div(BN(`1e${decimals}`))
					.toString()} ${symbol}</b>\nYou are about to use <b>${totalUse.div(BN(`1e${decimals}`)).toString()} ${symbol}</b>`
			);
		}

		// if (maxGasPrice.gt(BN(0)) && maxGasPrice.times(BN('1e9')).lt(BN(gasPrice))) {
		//     throw new Error(
		//         GASPRICE_OVERLOADED +
		//         `\n\nConfigured max gas price <b>${BN(userSetting.maxGasPrice || '0')} GWEI</b>\nYou are about to use <b>${BN(gasPrice).div(BN(`1e9`)).toString()} GWEI</b>`
		//     )
		// }

		if (BN(userSetting.maxGasLimit || '0').gt(BN(0)) && BN(userSetting.maxGasLimit || '0').lt(BN(gas.toString()))) {
			throw new Error(
				GAS_EXCEEDED +
				`\n\nConfigured max gas <b>${BN(userSetting.maxGasLimit || '0')}</b>\nExpected gas <b>${BN(gas.toString()).toString()}</b>`
			)
		}

		let receipt: any

		{
			const uiInteract = async () => {
				try {
					if (feedback.callback) {
						msg = await feedback.callback(bot, { telegramId, chain, ...txData, tx: signedTx.transactionHash, exInfo: feedback.exInfo }, 'pending');
					} else {
						msg = await bot.telegram.sendMessage(user.chatId, '⌛ Committing transaction...');
					}
				} catch (err) {
					console.error(`==> ${new Date().toLocaleString()}`)
					console.error(err)
					Logging.error('[sendTxnAdvanced - 1]')
				}
			}

			const txCommit = async () => {
				console.log('pending tx', (new Date()).getTime(), txData, signedTx)
				if (BN(sendParams.bribe || '0').gt(0)) {
					return await flashBotSend(telegramId, chain, signedTx.rawTransaction, { targetTx: sendParams.block0Tx })
				} else {
					if (sendParams.antiMEV === true) {
						return await sendProtectedTxn(telegramId, chain, signedTx.rawTransaction)
						// return await flashBotPrivateTxn(telegramId, chain, signedTx.rawTransaction)
					} else {
						return await web3.eth.sendSignedTransaction(signedTx.rawTransaction)
					}
				}
			}

			const ret = await Promise.all([
				uiInteract(),
				txCommit()
			])
			receipt = ret[1]
		}

		console.log(`Transaction:`, (new Date()).getTime(), receipt.transactionHash);
		await updateUserState(telegramId, chain, receipt.gasUsed, receipt.effectiveGasPrice);
		await addTxRecord(telegramId, receipt, chain, w);
		await addAffiliateEarnings(telegramId, chain, receipt.gasUsed, receipt.effectiveGasPrice, receipt.transactionHash);

		if (msg) {
			try {
				if (feedback.callback) {
					await feedback.callback(bot, { telegramId, chain, ...txData, msgId: msg.message_id, tx: receipt.transactionHash }, 'finished');
				} else {
					await bot.telegram.editMessageText(user.chatId, msg.message_id, 0, `🎁 This message will be removed automatically in 60 seconds.\n${exp}/tx/${receipt.transactionHash}`, {
						parse_mode: botEnum.PARSE_MODE_V2
					});

					// setTimeout(() => {
					//     bot.telegram.deleteMessage(user.chatId, msg.message_id)
					//         .then(() => { })
					//         .catch(() => { })
					//         .finally(() => { })
					// }, 60000)
				}
			} catch (err) {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
				Logging.error('[sendTxnAdvanced - 3]')
			}
		}

		return receipt;
	} catch (err) {
		console.error(err)

		if (err.message.startsWith(INSUFFICIENT_ETH)) {
			throw new Error(err.message);
		} else if (err.message.startsWith(GASPRICE_OVERLOADED)) {
			throw new Error(err.message);
		} else if (err.message.startsWith(GAS_EXCEEDED)) {
			throw new Error(err.message);
		} else if (err.message.startsWith(ESTIMATE_GAS_ERROR)) {
			throw new Error(err.message);
		}

		if (msg) {
			try {
				if (feedback.callback) {
					await feedback.callback(bot, { telegramId, chain, ...sendParams, msgId: msg.message_id, error: err }, 'error');
				} else {
					await bot.telegram.editMessageText(user.chatId, msg.message_id, 0, `❌ Failed\nThis message will be removed automatically in 10 seconds.`);

					setTimeout(() => {
						bot.telegram
							.deleteMessage(user.chatId, msg.message_id)
							.then(() => { })
							.catch(() => { })
							.finally(() => { });
					}, 30000);
				}
			} catch (err) {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
				Logging.error('[sendTxnAdvanced - 4]')
			}
		}

		throw new Error(err.message)
	}
}

export async function sendTxn(telegramId: string, chain: string, tx: any, sendParams: any, feedback: any) {
	const web3 = await newWeb3(telegramId, chain)
	const data = encodeFunctionCall(web3, tx.abi, tx.functionName, tx.args)
	return await sendTxnAdvanced(telegramId, chain, { ...sendParams, data }, feedback);
}

export async function fastQueryAdvanced(telegramId: string, chain: string, callParams: any) {
	try {
		const web3 = await newWeb3(telegramId, chain)
		return await web3.eth.call(callParams)
	} catch (err) {
		console.error(`==> ${new Date().toLocaleString()}`)
		console.error(err)
		Logging.error(`[fastQueryAdvanced-${chain}:${callParams.to}.${callParams.data}] ${err.message}`);
	}
}

export async function fastQuery(telegramId: string, chain: string, tx: any, callParams: any) {
	const web3 = await newWeb3(telegramId, chain)
	const data = encodeFunctionCall(web3, tx.abi, tx.functionName, tx.args)
	return await fastQueryAdvanced(telegramId, chain, { ...callParams, data })
}

export function isValidAddress(addr: string) {
	return ethers.utils.isAddress(addr)
}

export async function payFee(telegramId: string, chain: string, valueToSend: string) {
	const BN = getBN()
	const vD = BN(valueToSend).div(BN(`1e18`)).toString()
	await userVerboseLog(telegramId, `Paying bot usage fee ${vD}`)

	const w = await getWallet(telegramId);

	const web3 = await newWeb3(telegramId, chain);
	// const account = getAccountFromPvKey(web3, w.privateKey)
	const wallets = [] //await getRefereeWallets(telegramId)
	const data = encodeFunctionCall(web3, FeeDistABI, 'deposit', [wallets])

	const receipt = await executeTxnByProvider(
		chain,
		web3,
		{
			// from: account.address, // bsc unexpected revert error if this field is up
			data: data,
			to: chainConfig[chain].feeDistributor,
			value: valueToSend,
			type: chain === 'ethereum' ? 2 : 0
		},
		w.privateKey
	);

	const exp = await getBlockExplorer(chain)
	await userVerboseLog(telegramId, `Paid bot usage fee ${exp}/tx/${receipt.transactionHash}`)
}

export async function getRawTransaction(web3: any, tx: any) {
	try {
		const raw = await new Promise((resolve, reject) => {
			web3.currentProvider.send({
				method: "eth_getRawTransactionByHash",
				params: [tx.hash],
				jsonrpc: "2.0",
				id: 1
			}, function (err, res) {
				if (err !== true) {
					resolve(res.result)
					return
				}
				resolve(undefined)
			})
		})

		// tx.data = tx.input
		// tx.gasLimit = tx.gas

		// function addKey(accum, key) {
		//     if (tx[key]) { accum[key] = tx[key]; }
		//     return accum;
		// }

		// // Extract the relevant parts of the transaction and signature
		// const txFields = "accessList chainId data gasPrice gasLimit maxFeePerGas maxPriorityFeePerGas nonce to type value".split(" ");
		// const sigFields = "v r s".split(" ");

		// // Seriailze the signed transaction
		// const raw = ethers.utils.serializeTransaction(txFields.reduce(addKey, {}), sigFields.reduce(addKey, {}));

		// console.log('>>>', tx, ethers.utils.keccak256(raw), tx.hash)

		// Double check things went well
		if (ethers.utils.keccak256(raw) === tx.hash) return raw;
	} catch (err) {
		console.error(err)
	}
}