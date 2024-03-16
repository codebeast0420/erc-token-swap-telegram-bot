import { AutoBuyTokenModel } from '../models/auto.buy.token';
import { PairInfoModel } from '../models/pair.info.model';
import { QuickAutoBuyModel } from '../models/quick.auto.buy.model';
import { TransactionHistoryModel } from '../models/transaction.history.model';
import { convertValue } from '../utils/common';
import Logging from '../utils/logging';
import { getErrorMessageResponse } from '../utils/messages';
import { getNativeCurrencyDecimal, getNativeCurrencySymbol } from '../web3/chain.parameters';
import { swapETHForToken } from '../web3/dex.interaction';
import { findBestWETHPair } from '../web3/dex/common/bestpair';
import { queryTokenInfoOnChain } from '../web3/multicall';
import { userETHBalance } from '../web3/nativecurrency/nativecurrency.query';
import { AddressZero, getBN } from '../web3/web3.operation';
import { sendBotMessage } from './app.service';
import { getAppUser, userVerboseLog } from './app.user.service';
import { processError } from './error';
import { getTokenInfo, getTokenPrice } from './token.service';
import { getWallet } from './wallet.service';

export async function isTokenAutoBuySet(telegramId: string, chain: string, token: string) {
	const user = await getAppUser(telegramId);
	const sell = await AutoBuyTokenModel.findOne({ user: user._id, chain: chain, token: token, state: 'pending' });
	return sell !== null;
}

export async function removeTokenAutoBuy(telegramId: string, chain: string, token: string) {
	const user = await getAppUser(telegramId);
	await AutoBuyTokenModel.deleteOne({ user: user._id, chain: chain, token: token, state: 'pending' });
}

export async function addTokenAutoBuy(telegramId: string, chain: string, token: string, price: string, wethLP: string) {
	const user = await getAppUser(telegramId);
	if (0 === (await AutoBuyTokenModel.countDocuments({ user: user._id, chain: chain, token: token, state: 'pending' }))) {
		const newAutoBuyToken = new AutoBuyTokenModel({
			user: user._id,
			chain: chain,
			token: token,
			state: 'pending',
			priceStamp: price,
			priceLimit: '-50%',
			amountAtLimit: '100%',
			wethLP: wethLP
		});

		await newAutoBuyToken.save();
	}
}

export async function updateTokenAutoBuyContext(telegramId: string, chain: string, token: string, updateContext: any) {
	const user = await getAppUser(telegramId);

	const itemToUpdate = await AutoBuyTokenModel.findOne({ user: user._id, chain: chain, token: token, state: 'pending' });

	if (itemToUpdate === null) {
		throw new Error(`Not enabled auto buy\n<code>${token}</code>`);
	}

	for (const ch in updateContext) {
		itemToUpdate[ch] = updateContext[ch];
	}

	await itemToUpdate.save();
}

export async function getTokenAutoBuyContext(telegramId: string, chain: string, token: string) {
	const user = await getAppUser(telegramId);

	return await AutoBuyTokenModel.findOne({ user: user._id, chain: chain, token: token, state: 'pending' });
}

export async function commitAutoBuy(currentPrice: string, context: any) {
	let telegramId
	try {
		const c = await context.populate('user');
		telegramId = c.user.telegramId

		const BN = getBN()
		const w = await getWallet(telegramId)
		const t = await userETHBalance(telegramId, c.chain)
		const nativeDecimal = await getNativeCurrencyDecimal(c.chain)

		if (BN(t).eq(BN(0)) || c.amountAtLimit === undefined) {
			await AutoBuyTokenModel.findByIdAndDelete(context._id)
			return
		}

		let amount = convertValue(t, c.amountAtLimit, BN);

		let tr = null;

		try {
			if (BN(amount).gt(BN(0))) {
				const tokenInfo = await getTokenInfo(c.chain, c.token)
				const nativeSymbol = await getNativeCurrencySymbol(c.chain)
				const label = `⛓<b>${c.chain}</b>\nAuto Buying <b>${tokenInfo.symbol}</b> at <b>${BN(tokenInfo.marketCap).times(BN(currentPrice)).toFixed(2)}$ MC</b> with <b>${BN(amount).toFixed(4)} ${nativeSymbol}</b>`
				const receipt = await swapETHForToken(
					telegramId,
					c.chain,
					{
						token: c.token,
						recipient: w.address,
						// slippage: undefined
					},
					{
						address: w,
						value: BN(amount).times(BN(`1e${nativeDecimal}`)).integerValue().toString(),
						gasPrice: BN(c.gasPrice || '0').times(BN('1e9')).integerValue().toString()
					},
					label
				);
				tr = await TransactionHistoryModel.findOne({ transactionHash: receipt.transactionHash });
			}
		} catch (err) {
			console.error(err);
		}

		c.state = 'completed';
		if (tr !== null) c.transaction = tr._id;

		await c.save()
	} catch (err) {
		console.error(`==> ${new Date().toLocaleString()}`)
		console.error(err)
		Logging.error(`[commitAutoBuy] ${err.message}`);
		const errMsg = await getErrorMessageResponse(telegramId, err.message);
		if (errMsg !== null) {
			await sendBotMessage(telegramId, errMsg)
			await AutoBuyTokenModel.findByIdAndDelete(context._id)
		}
	}
}

export async function updateQuickAutoBuyParam(telegramId: string, chain: string, info: any) {
	const user = await getAppUser(telegramId);

	let itemToUpdate = await QuickAutoBuyModel.findOne({ user: user._id, chain: chain });

	if (itemToUpdate === null) {
		itemToUpdate = new QuickAutoBuyModel({
			user: user._id,
			chain: chain
		});

		await itemToUpdate.save();
	}

	itemToUpdate = await QuickAutoBuyModel.findOne({ user: user._id, chain: chain });
	for (const ch in info) {
		itemToUpdate[ch] = info[ch];
	}

	await itemToUpdate.save();
}

export async function getQuickAutoBuyContext(telegramId: string, chain: string) {
	const user = await getAppUser(telegramId);

	const item = await QuickAutoBuyModel.findOne({ user: user._id, chain: chain });
	if (item !== null) return item;

	const t = new QuickAutoBuyModel({
		user: user._id,
		chain: chain
	});

	await t.save();

	return t;
}

export async function processQuickAutoBuy(ctx: any, telegramId: string, chain: string, tokenAddress: string) {
	try {
		const user = await getAppUser(telegramId);

		const item = await QuickAutoBuyModel.findOne({ user: user._id, chain: chain, enabled: true });
		if (item !== null) {
			await userVerboseLog(telegramId, `processing quick auto buy for token ${tokenAddress} on [${chain}]`);
			const tokenInfo = await queryTokenInfoOnChain(telegramId, chain, tokenAddress, AddressZero);
			const price = await getTokenPrice(telegramId, chain, tokenInfo.address);

			if (price === undefined) {
				await sendBotMessage(telegramId, `❌ Not defiend price of ${tokenInfo.symbol} - ${chain}:${tokenInfo.address}`)
				throw new Error(`Price of ${tokenInfo.address} on ${chain} not defined`)
			}

			const lpArray = await Promise.all(tokenInfo.lp.map(p => PairInfoModel.findOne({ chain: chain, address: p })))

			const bestWETHPair = await findBestWETHPair(tokenInfo.address, lpArray)

			const newAutoBuyToken = new AutoBuyTokenModel({
				user: user._id,
				chain: chain,
				token: tokenAddress,
				state: 'pending',
				priceStamp: price,
				priceLimit: '10%',
				amountAtLimit: item.amount,
				wethLP: bestWETHPair ? bestWETHPair.address : undefined,
				gasPrice: item.gasPrice || '0',
				multi: item.multi,
				slippage: item.slippage,
			});

			await newAutoBuyToken.save();
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}
