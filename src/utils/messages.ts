import * as dotenv from 'dotenv';
import path from 'path';
import { getMultiWallets, getWallet } from '../service/wallet.service';
import { chainTxFee, chainGasPrice, chainPrice, getAllChains, getGasPrice } from '../service/chain.service';
import { getSelectedChain } from '../service/connected.chain.service';
import { AddressDead, AddressZero, getBN } from '../web3/web3.operation';
import { queryAndSyncToken, queryTokenInfoOnChain } from '../web3/multicall';

import { getNativeCurrencyPrice, getNativeCurrencySymbol } from '../web3/chain.parameters';
import {
	NOT_STARTED,
	NOT_ENOUGH_BALANCE,
	TOO_MUCH_REQUESTED,
	NOT_CONFIGURED_CHAIN,
	NOT_CONNECTED_CHAIN,
	NOT_CONNECTED_WALLET,
	NOT_APPROVED,
	MAX_TX_NOT_FOUND,
	APE_MAX_NOT_FOUND,
	INSUFFICIENT_ETH,
	ALREADY_EXIST,
	timeGapString,
	GASPRICE_OVERLOADED,
	GAS_EXCEEDED,
	TX_ERROR,
	ESTIMATE_GAS_ERROR,
	INVALID_VALUE_SET,
	NOT_ALLOWED_ANTIMEV,
	ROUTER_NOT_FOUND,
	INVALID_WALLET_ADDRESS,
	BRIBING_FAILED,
	INSUFFICIENT_ETH_BRIBE,
	INVALID_OPERATION
} from './common';
import { IAddress } from '../models/address.model';
import { ChainModel } from '../models/chain.model';
import { IAffiliateBalance } from '../service/affiliate.service';
import { IAffiliateInfluencer } from '../models/affiliate.influencer.model';
import { getQuickAutoBuyContext } from '../service/autobuy.service';
import { formatTokenprice, getTokenPrice, getTokenTaxInfo } from '../service/token.service';
import { currencyFormat, numberFormat } from './global.functions';
import { getBlockExplorer } from '../web3/chain.parameters';
import { IAppUser } from '../models/app.user.model';
import { UserStatModel } from '../models/user.stat.model';
import { getAppUser } from '../service/app.user.service';
import { getSettings } from '../service/settings.service';
import { PairInfoModel } from '../models/pair.info.model';
import { batchAddressBalances, getETHBalance, userETHBalance } from '../web3/nativecurrency/nativecurrency.query';
import { getPathFromTokenV2, getPathToTokenV2 } from '../web3/dex/v2/v2.path';
import { getPathFromTokenV3, getPathToTokenV3 } from '../web3/dex/v3/v3.path';
import { findBestPair } from '../web3/dex/common/bestpair';

dotenv.config();
if (process.env.NODE_ENV == ('development' || 'development ')) {
	dotenv.config({ path: path.join(__dirname, '..', '.env.development') });
} else if (process.env.NODE_ENV == ('production' || 'production ')) {
	dotenv.config({ path: path.join(__dirname, '..', '.env') });
} else if (process.env.NODE_ENV == ('staging' || 'staging ')) {
	dotenv.config({ path: path.join(__dirname, '..', '.env.staging') });
}

export const walletAction = `
    Select target chain
`;

export async function getTransferMessage(telegramId: string, chain: string, walletId?: string) {
	let ret = `🔗 <b>Current chain:</b> ${chain}\n`;

	let wallet;
	try {
		wallet = await getWallet(telegramId)

		if (walletId !== undefined && wallet._id.toString() !== walletId) {
			let wallets = await getMultiWallets(telegramId)
			wallet = wallets.find((el) => el._id.toString() === walletId)
		}
	} catch { }
	const connected = wallet !== undefined;

	if (connected === true) {
		ret += `✅ Wallet: Connected\n`;
		ret += `Address: <code>${wallet.address}</code>\n\n`;

		const ethBal = await getETHBalance(telegramId, chain, wallet.address);
		ret += `💰 Available balance: <b>${ethBal} ${await getNativeCurrencySymbol(chain)}</b>`;
	} else {
		ret += 'Wallet: <b>disconnected</b>\n';
	}

	return ret;
}

export async function getChainStatus(telegramId: string, chain: string) {
	let ret = `✅ Chain: <b>${chain}</b>\n\n`;

	let wallet;
	try {
		wallet = await getWallet(telegramId);
	} catch { }
	const connected = wallet !== undefined;

	if (connected === true) {
		ret += `Wallet: <b>connected</b>\n`;
		ret += `Address: <code>${wallet.address}</code>\n\n`;

		const ethBal = await userETHBalance(telegramId, chain);
		ret += `You have <b>${ethBal} ${await getNativeCurrencySymbol(chain)}</b>`;
	} else {
		ret += 'Wallet: <b>disconnected</b>\n';
	}

	return ret;
}

export async function getErrorMessageResponse(telegramId: string, error: string) {
	if (error === NOT_STARTED) {
		return `⚠️ You never started here\nPlease run by /start`;
	} else if (error.startsWith(NOT_ENOUGH_BALANCE) || error.startsWith(TOO_MUCH_REQUESTED)) {
		return error;
	} else if (error === NOT_CONFIGURED_CHAIN) {
		return `⚠️ Not configured chain\nPlease run by /start`;
	} else if (error === NOT_CONNECTED_CHAIN) {
		return `⚠️ Not connected chain\nPlease run by /start`;
	} else if (error === NOT_CONNECTED_WALLET) {
		return `⚠️ Not connected wallet\nPlease run by /wallets`;
	} else if (error === NOT_APPROVED) {
		return `⚠️ Token not approved\nPlease approve it by clicking <b>Approve</b> button`;
	} else if (error === MAX_TX_NOT_FOUND) {
		return `⚠️ Can't specify max tx amount`;
	} else if (error === APE_MAX_NOT_FOUND) {
		return `⚠️ Can't specify ape max amount`;
	} else if (error.startsWith(INSUFFICIENT_ETH) || error.startsWith(GASPRICE_OVERLOADED) || error.startsWith(GAS_EXCEEDED) || error.startsWith(TX_ERROR) || error.startsWith(ESTIMATE_GAS_ERROR) || error.startsWith(INVALID_VALUE_SET) || error.startsWith(NOT_ALLOWED_ANTIMEV) || error.startsWith(ROUTER_NOT_FOUND) || error.startsWith(INVALID_WALLET_ADDRESS) || error.startsWith(BRIBING_FAILED) || error.startsWith(INSUFFICIENT_ETH_BRIBE) || error.startsWith(INVALID_OPERATION)) {
		return error;
	} else if (error.startsWith(ALREADY_EXIST)) {
		return error;
	}
	return null;
}

export async function getTokenStatusMessage(telegramId: string, chain: string, token: string) {
	const BN = getBN();
	const w = await getWallet(telegramId);

	const ret = await queryAndSyncToken(telegramId, chain, token, w.address);

	const lpTotalSupply = ret.lp.reduce((prev, cur) => prev.plus(cur.totalSupply), BN(0))
	const lpLockedSupply = ret.lp.reduce((prev, cur) => prev.plus(cur.locked), BN(0))
	const lockedLpPercent = lpTotalSupply.eq(0) ? 0 : parseFloat(lpLockedSupply.times(100).div(lpTotalSupply).toFixed(3))

	let tokenPrice = '0'
	try {
		tokenPrice = await getTokenPrice(telegramId, chain, ret.address);
	} catch (err) { }

	// const lockedLp = await new HoldersLockedLpScrapingService().getTopLocker(chain, ret);
	let holders //= await new HoldersLockedLpScrapingService().getTopHolders(chain, token);
	let taxes = await getTokenTaxInfo(chain, token)
	const txFee = await chainTxFee(telegramId, chain)
	const name = ret.name;
	const symbol = ret.symbol;

	let ownerRenounced = (ret.owner === undefined || ret.owner.toLowerCase() === AddressZero || ret.owner.toLowerCase() === AddressDead.toLowerCase() || ret.owner.toLowerCase() === '') ? 'RENOUNCED' : 'NOT RENOUNCED';

	let totalBurnt = BN(ret.burnt)
	const totalSupplyExcludingBurnt = BN(ret.totalSupply).minus(totalBurnt);
	const marketCapExcludingBurnt = BN(totalSupplyExcludingBurnt).times(BN(tokenPrice)).toFixed(2);
	const burnt = BN(totalBurnt).times(BN(tokenPrice)).toFixed(2);
	const priceToShow = formatTokenprice(tokenPrice)


	// await getLockedLiquidity(chain, token)

	const gasGWei = await chainGasPrice(chain);
	const nPrice = await chainPrice(chain);

	let text = `🪙 <b>${name} (\$${symbol}) 🔗 ${chain.toUpperCase()}</b>\n`;
	text += '\n'
	text += `CA: <code>${token}</code>\n`;
	text += '\n'
	text += `<b>🧢 Market Cap | ${currencyFormat().format(marketCapExcludingBurnt)} </b>\n`;
	text += `<b>📈 Price | ${priceToShow} </b>\n`;
	text += '\n'
	if (taxes != undefined && taxes != null) {
		text += `⚖ Taxes: 🅑 ${parseFloat(BN(taxes.buyTax || '0').toFixed(3))} | 🅢 ${parseFloat(BN(taxes.sellTax || '0').toFixed(3))} \n`
	}
	text += `👨‍💻 Owner: <b>${ownerRenounced}</b>\n`;
	if (!isNaN(lockedLpPercent) && lockedLpPercent > 0) {
		text += `🔒 LP Locked: ${lockedLpPercent}%\n`
	} else {
		text += `🔒 LP:<b> NO LP LOCKED!</b>\n`
	}

	const explorer = await getBlockExplorer(chain);

	if (holders !== null && holders !== undefined && typeof holders !== undefined) {
		text += `👥 Holders: ${holders.totalHolders} - `;
		if (holders?.topHolders?.length > 0) {
			holders.topHolders.map((holder, index) => {
				const isLast = index === holders?.topHolders?.length - 1
				const percentage = parseFloat(holder.percentage.replace('%', ''))
				if (percentage > 0.01)
					text += `${percentage.toFixed(2)}%${!isLast ? ' |' : ''}`
			})
		}
		text += '\n'
	} else {
		// text += `👥 Holders: - \n`
	}

	text += '\n'
	text += `💰 Balance | ${numberFormat().format(ret.balance)} ${ret.symbol}\n`;
	text += '\n'
	text += `⛽️ Gas: <b>${parseFloat(BN(gasGWei).toFixed(3))} GWEI</b> Ξ $${BN(parseFloat(BN(nPrice).times(BN(gasGWei)).div(BN('1e9')).toFixed(7))).toString()}\n`
	text += `🔥 Burnt | ${currencyFormat().format(burnt)}\n`;
	text += '\n'

	text += `🎯 Alpha | ${ret.hitCount}\n`;
	text += `🕰 Age: ${ret.age === null ? 'NaN' : timeGapString(ret.age, new Date())}\n`;

	text += `⚠️ <i>Market cap includes locked tokens, excluding burned</i>\n\n`;
	// if (ret.lp?.length > 0) {
	//     text += ret.lp.map((lp) => { return `💰 LP(${lp.symbol}): <code>${lp.lp}</code>\n` }).reduce((prev, cur) => prev + cur, '')
	// }

	// const lpPercentage = BN(ret.lp.reduce((prev, cur) => prev.plus(cur.token0 === token ? cur.reserve0 : cur.reserve1), BN(0))).times(100).div(BN(`1e${ret.decimals}`)).div(BN(ret.totalSupply)).toFixed(2)

	// text += `⛽ Gas | <b>${gasGWei.toString()} WEI</b> Ξ $${BN(nPrice).times(BN(gasGWei.toString())).div(BN('1e9')).toString()}\n`
	// text += `💵 Tx Fees | 🅑 $${BN(txFee.min).toFixed(6)} 🅢 $${BN(txFee.max).toFixed(6)}\n`
	// text += `💧 Liquidity | ${lpPercentage}%\n`

	// text += `Liquidity: <b>${BN(lp1.toString()).toFixed(2)} ${symbol}</b> | <b>${BN(lp2.toString()).toFixed(2)} ${sym1}</b>\n`

	text += `📨 <code>t.me/Zehereelabot?start=${token}</code>`
	return {
		text,
		symbol
	};

}

export const getBotGeneralConfiguration = async (telegramId: string, chain: string, part: string = 'general') => {
	let w;
	let botSettings = await getSettings(telegramId, chain)
	let symbol;
	try {
		w = await getWallet(telegramId);
		symbol = await getNativeCurrencySymbol(chain);
	} catch { }

	let displayBalance = '';
	if (w !== undefined) {
		const balance = await userETHBalance(telegramId, chain);
		displayBalance = `<b>${balance} ${symbol}</b>`;
	}

	let gasPrice;
	try {
		gasPrice = await chainGasPrice(chain);
	} catch (err) {
		gasPrice = 'Not Defined';
	}

	const BN = getBN()
	let text = ''
	text += `🔗 <b>${chain}</b>\n`
	text += `Wallet: <b><code>${w?.address || 'Disconnected'}</code></b>\n`
	text += `${displayBalance}\n`
	text += `Multi-Wallets: <b>${disabledEnabledEmoji(botSettings?.multiWallet || false)}</b>\n`
	text += `\n`
	if (part === 'general') {
		text += `📍 <b>General</b>\n`
		text += `Anti-Rug: <b>${disabledEnabledEmoji(botSettings?.antiRug || false)}</b>\n`
		text += `Smart Slippage: <b>${disabledEnabledEmoji(botSettings?.smartSlippage || false)}</b>\n`
		if (chain === 'ethereum') {
			text += `Max Gas Price: <b>Default(${parseFloat(BN(gasPrice).toFixed(2))} gwei) + Delta(${botSettings?.maxGasPrice || '0'} gwei)</b>\n`
		} else {
			text += `Max Gas Price: <b>${(botSettings?.maxGasPrice ? `${botSettings?.maxGasPrice} gwei` : `Disabled`)}</b>\n`
		}
		text += `Slippage: <b>${(botSettings?.slippage < 100 ? `${botSettings?.slippage}%` : undefined) || 'Default(100%)'}</b>\n`
		text += `Gas Limit: <b>${(botSettings?.maxGasLimit > 0 ? botSettings?.maxGasLimit : undefined) || 'Auto'}</b>\n`
		text += `\n`
	}

	if (part === 'buy') {
		text += `📌 <b>Buy</b>\n`
		text += `Auto Buy: <b>${disabledEnabledEmoji(botSettings?.buyAutoBuy || false)}</b>\n`
		text += `Duplicate Buy: <b>${disabledEnabledEmoji(botSettings?.buyDupeBuy || false)}</b>\n`

		if (chain === 'ethereum') {
			text += `Buy Gas Price: <b>Default(${parseFloat(BN(gasPrice).toFixed(2))} gwei) + Delta(${botSettings?.buyGasPrice || '0'} gwei)</b>\n`
		} else {
			text += `Buy Gas Price: <b>${(botSettings?.buyGasPrice ? `${botSettings?.buyGasPrice} gwei` : `Default(${parseFloat(BN(gasPrice).toFixed(2))} gwei)`)}</b>\n`
		}
		text += `Max MCap: <b>${botSettings?.buyMaxMC || 'Disabled'}</b>\n`
		text += `Min Liquidity: <b>${botSettings?.buyMinLiquidity || 'Disabled'}</b>\n`
		text += `Max Liquidity: <b>${botSettings?.buyMaxLiquidity || 'Disabled'}</b>\n`
		text += `Min MCap/Liq: <b>${botSettings?.buyMinMCLiq || 'Disabled'}</b>\n`
		text += `Max Buy Tax: <b>${(botSettings?.buyMaxBuyTax ? `${botSettings?.buyMaxBuyTax}%` : undefined) || 'Disabled'}</b>\n`
		text += `Max Sell Tax: <b>${(botSettings?.buyMaxSellTax ? `${botSettings?.buyMaxSellTax}%` : undefined) || 'Disabled'}</b>\n`
		text += `\n`
	}

	if (part === 'sell') {
		text += `📌 <b>Sell</b>\n`
		text += `Auto Sell: <b>${disabledEnabledEmoji(botSettings?.sellAutoSell || false)}</b>\n`
		text += `Trailing Sell: <b>${disabledEnabledEmoji(botSettings?.sellTrailingSell || false)}</b>\n`
		text += `Trailing Sell Confirmation: <b>${disabledEnabledEmoji(botSettings?.sellConfirmTradeSell || false)}</b>\n`
		if (chain === 'ethereum') {
			text += `Sell Gas Price: <b>Default(${parseFloat(BN(gasPrice).toFixed(2))} gwei) + Delta(${botSettings?.sellGasPrice || '0'} gwei)</b>\n`
		} else {
			text += `Sell Gas Price: <b>${(botSettings?.sellGasPrice ? `${botSettings?.sellGasPrice} gwei` : `Default(${parseFloat(BN(gasPrice).toFixed(2))} gwei)`)}</b>\n`
		}
		text += `Auto Sell (high): <b>${(botSettings?.sellHighPrice ? `${botSettings?.sellHighPrice}` : undefined) || 'Default(+100%)'}</b>\n`
		text += `Sell Amount (high): <b>${(botSettings?.sellHighAmount ? `${botSettings?.sellHighAmount}` : undefined) || 'Default(100%)'}</b>\n`
		text += `Auto Sell (low): <b>${(botSettings?.sellLowPrice ? `${botSettings?.sellLowPrice}` : undefined) || 'Default(-50%)'}</b>\n`
		text += `Sell Amount (low): <b>${(botSettings?.sellLowAmount ? `${botSettings?.sellLowAmount}` : undefined) || 'Default(100%)'}</b>\n`
		text += `\n`
	}

	if (part === 'approve') {
		text += `${disabledEnabledEmoji(botSettings?.approveAuto || false)} <b>Approve</b>\n`
		text += `Auto Approve: <b>${disabledEnabledEmoji(botSettings?.approveAuto || false)}</b>\n`

		if (chain === 'ethereum') {
			text += `Approve Gas Price: <b>Default(${parseFloat(BN(gasPrice).toFixed(2))} gwei) + Delta(${botSettings?.approveGasPrice || '0'} gwei)</b>\n`
		} else {
			text += `Approve Gas Price: <b>${(botSettings?.approveGasPrice ? `${botSettings?.approveGasPrice} gwei` : `Default(${parseFloat(BN(gasPrice).toFixed(2))} gwei)`)}</b>\n`
		}
	}
	// text += `\n`
	// text += `ℹ️ <i>Smart Slippage is unsuitable for stealth launches and God Mode snipes.</i>\n`

	return text
};

export const getWalletsDefaultMessage = async (telegramId: string, chain: string) => {
	let w;
	let multiWwallets;
	let botSettings = await getSettings(telegramId, chain)
	let symbol;
	try {
		w = await getWallet(telegramId);
		multiWwallets = [w, ...await getMultiWallets(telegramId)]
		symbol = await getNativeCurrencySymbol(chain);
	} catch { }

	let displayBalances = []

	let displayUser = '<b>Disconnected</b>\n'

	let balance = undefined

	if (w !== undefined) {
		balance = await userETHBalance(telegramId, chain);
	}

	let text: string = `🔗 <b>Current Chain:</b> ${chain}\n`
	text += `🧑‍🔧 Main Wallet\n`;
	text += `<code>${w?.address || "No Wallets Connected"}</code>\n`
	text += `<b>${balance || "Invalid Balance"} ${symbol || ""}</b>\n`
	text += `${disabledEnabledEmoji(botSettings.multiWallet || false)} Multi Wallets\n`
	if (botSettings.multiWallet === true) {
		if (w !== undefined && multiWwallets !== undefined) {
			text += `${multiWwallets.length - 1 || 0} Multi Wallets Available\n`
		}
	}

	return text
}

export const getWalletInfoOfChain = async (telegramId: string, chain: string) => {
	let w;
	let multiWwallets;
	let botSettings = await getSettings(telegramId, chain)
	let symbol;
	try {
		w = await getWallet(telegramId);
		multiWwallets = [w, ...await getMultiWallets(telegramId)]
		symbol = await getNativeCurrencySymbol(chain);
	} catch { }

	let displayBalances = []

	let displayUser = '<b>Disconnected</b>\n'

	if (botSettings.multiWallet === true) {
		if (w !== undefined && multiWwallets !== undefined) {
			displayUser = `${disabledEnabledEmoji(botSettings.multiWallet || false)} Multi Wallets\n`
			displayBalances = await Promise.all(multiWwallets.map(m => getETHBalance(telegramId, chain, m.address)))
			displayUser += multiWwallets.map((m, idx) => `${idx + 1} - <b><code>${m.address}</code></b>\n     <b>${displayBalances[idx]} ${symbol}</b>\n`).reduce((prev, cur) => prev + cur, '')
		}
	} else {
		if (w !== undefined) {
			const balance = await userETHBalance(telegramId, chain);
			displayUser = `${disabledEnabledEmoji(botSettings.multiWallet || false)} Multi Wallets\n`
			displayUser += `<b><code>${w.address}</code></b>\n     <b>${balance} ${symbol}</b>\n`
		}
	}

	return `
🔗 <b>${chain}</b>

${displayUser}
📍 <b>General</b>
Anti-Rug: <b>${disabledEnabledEmoji(botSettings?.antiRug || false)}</b>
Smart Slippage: <b>${disabledEnabledEmoji(botSettings?.smartSlippage || false)}</b>
Max Gas Price: <b>${(botSettings?.maxGasPrice > 0 ? `${botSettings?.maxGasPrice} gwei` : undefined) || 'Disabled'}</b>
Slippage: <b>${(botSettings?.slippage < 100 ? `${botSettings?.slippage} %` : undefined) || 'Default(100%)'}</b>
Gas Limit: <b>${(botSettings?.maxGasLimit > 0 ? botSettings?.maxGasLimit : undefined) || 'Auto'}</b>
    `;
};

export async function multiWalletMainMessage(total: number) {
	let response = `💳 <b>Multi-wallets: ${total || 0}</b>\n`;
	response += `${total || 0} additional wallets exist. You can add some by connecting an external wallet or generating a new one (recommended).`;
	return response;
}
export async function multiWalletViewMessage() {
	let response = `🧾 <b>Wallet List</b>\n`
	response += `This is an overview page to see all your current wallets connect to the ChartAI Snipper or Application.`;
	return response;
}

export const generatedWalletInfo = (chain: string, address: string, privateKey: string, mnemonic: string) => {
	return `
✅ Generated new wallet:

Chain: <b>${chain}</b>
Address: <code>${address}</code>
Pk: <code>${privateKey}</code>
Mnemonic: <code>${mnemonic}</code>

<i>⚠️ Make sure to save this mnemonic phrase OR private key using pen and paper only. Do NOT copy-paste it anywhere. You could also import it to your Metamask/Trust Wallet. After you finish saving/importing the wallet credentials, delete this message. The bot will not display this information again.</i>
    `;
};

export function disabledEnabledEmoji(value: any) {
	if (value) {
		return '✅';
	} else {
		return '❌';
	}
}

export async function multiWalletMessage(telegramId: string, chain: string, addresses: IAddress[]) {
	addresses = await batchAddressBalances(telegramId, chain, addresses);
	let response = '';
	const symbol = await getNativeCurrencySymbol(chain);
	for (let address of addresses) {
		let displayBalance = '';
		if (address !== undefined) {
			displayBalance = `Balance: <b>${address.balance} ${symbol}</b>`;
		}
		response =
			response +
			`
💳 <b>${address.name || 'untitled'} ${address.connected ? '🟢' : '🔴'}</b>
Address: <b><code>${address.address}</code></b>
${displayBalance}
        `;
	}
	return response;
}

export async function changeMainWalletMessage(currentAddress: any, totalAddresses: number) {
	let response = `💳 <b>Current Wallet:</b> ${currentAddress.name || 'Main'}\n`;
	response += `🔗 Address: <code>${currentAddress.address}</code>\n`;
	response += `✅ Available Wallets: ${totalAddresses}`;

	return response;
}

export async function activeSniperMessage(totalAddresses: number) {
	let response = `🔫 <b>Active sniper: ${totalAddresses || 0}</b>\n`;
	response += `${totalAddresses || 0} active sniper are set. Choose which token to handle.`;
	return response;
}

export function snipeMethodIdmessage(isBeta: boolean) {
	let response = `${isBeta ? "<b>🚨BETA FEAUTURE🚨</b>\nContract is not verified on chain, ChartAI Snipper have tried to decode the contract and display you possible solution\nSuccess is not guarantee\n" : ""}`

	response += "Just ran a scan on this contract and found this methods for you:"
	return response;
}

export async function getQuickMessage(telegramId: string, chain: string) {
	let text = ''

	const ch = await ChainModel.findOne({ name: chain })

	const BN = getBN();

	const bc = await getQuickAutoBuyContext(telegramId, chain)

	// for (const ch of chains)
	{
		text += `🔗 <b>${ch.name.toUpperCase()}</b>\n`;
		text += '\n';
		text += `Auto Buy: ${bc.enabled === true ? '✅' : '❌'}\n`;
		text += `Buy Amount: <b>${bc.amount?.indexOf('%') > -1 ? bc.amount : (bc.amount || '0') + ' ' + ch.currency}</b>\n`;
		text += `Multi Wallet: ${bc.multi === true ? '✅' : '❌'}\n`;
		if (chain === 'ethereum') {
			text += `Gas Price: <b>Default (${parseFloat(BN(ch.gasPrice).div(BN('1e9')).toFixed(3))} GWEI) + Delta ${BN(bc.gasPrice || '0').toString() + ' GWEI'}</b>\n`;
		} else {
			text += `Gas Price: <b>${bc.gasPrice === undefined ? `Default (${parseFloat(BN(ch.gasPrice).div(BN('1e9')).toFixed(3))} GWEI)` : bc.gasPrice.toString() + ' GWEI'}</b>\n`;
		}
		text += `Slippage: <b>${bc.slippage === undefined ? 'Default (100%)' : bc.slippage.toString() + '%'} </b>\n`;
		text += `Smart Slippage: ${bc.smartSlippage === true ? '✅' : '❌'}\n`;
		text += '\n';
	}

	return text;
}

export async function affiliateBalance(request: IAffiliateBalance) {
	let response = `Balance: <code><b>\$${request.totalSalesCommission}</b></code>`;

	for (let chainSales of request.chainEarnings) {
		let chainSalesCommission = `${chainSales.chain} chain: <code>\$${chainSales.earning}</code>`;
		response = response + chainSalesCommission;
	}

	return response;
}

export function affiliateSubscribeMessage(data: IAffiliateInfluencer, link: string) {
	let response = `🟢 successfully subscribed to link ${link}

<i>⚠️ you can always paste a new link to switch</i>
    `;

	return response;
}

export async function getSnipeTokenInfoText(telegramId: string, snipe: any) {
	if (snipe === null || snipe === undefined) {
		return '⚠️ You configured no tokens to snipe'
	}

	const BN = getBN()
	const primary = await snipe.populate('token')
	const lpInfo = await Promise.all(primary.token.lp.map(addr => PairInfoModel.findOne({ chain: primary.token.chain, address: addr })))
	const gas = await chainGasPrice(primary.token.chain)

	let text = '';

	text += `🪙 <b>${primary.token.name} (${primary.token.symbol})</b> 🔗 ${primary.token.chain}\n`;
	text += `Address: <code>${primary.token.address}</code>\n`;
	const bestLP = findBestPair(primary.token.address, lpInfo)
	// text += lpInfo.map(p => {
	//   return `LP(${p.symbol || 'V3 Pool'}): <code>${p.address}</code>\n`;
	// })
	//   .reduce((cur, prev) => {
	//     return cur + prev;
	//   }, '');

	if (bestLP) {
		text += `<b>LP(${bestLP.symbol || (bestLP.version === 2 ? 'V2 Pair' : 'V3 Pool')}):</b> <code>${bestLP?.address || 'None'}</code>\n`;
		if (lpInfo.length > 0) text += '<b>...</b>\n'
	} else {
		text += `⚠️ <b>No LP defined</b>\n`
	}
	text += '\n'

	const nativeSymbol = await getNativeCurrencySymbol(primary.token.chain)
	text += `💳 Wallet: <code>${primary.multi === true ? 'Multi' : 'Main'}</code>\n`;
	text += `Slippage: <b>${primary.slippage}%</b>\n`
	text += `💰 <b>${nativeSymbol}</b> Amount | <code>${primary.nativeCurrencyAmount}</code>\n`
	text += `💰 <b>${primary.token.symbol}</b> Amount | <code>${primary.tokenAmount}</code>\n`
	if (primary.method === 'method-id') {
		text += `✅ Snipe Method | <code>0x${primary.methodID}</code>\n`
	}

	text += '\n'
	if (primary.token.chain === 'ethereum') {
		text += `🚀 Block0 Tip | ${BN(primary.bribeAmount).gt(0) ? `✅ ${primary.bribeAmount} ${nativeSymbol}` : 'Not configured'}\n`
		text += `⛽ Backup Delta: <code>Default(${parseFloat(BN(gas).toFixed(4))}) GWEI + Delta(${parseFloat(BN(primary.gasDeltaPrice).toFixed(4))}) GWEI</code>\n`;

		text += '\n'

		text += `🎯 Backup TX | ${disabledEnabledEmoji(snipe.backupTx)}\n`
		text += '\n'
		text += 'ℹ️ Block0 Tip buys will send the ETH Tip Amount to block builders. Use higher amounts (0.05+ ETH) to secure entries.\n'
		text += 'ℹ️ Backup (for Block-0) and Block1+ (for deadblock launches) buys will use the Backup Delta.\n'
	} else {
		text += `⛽ Gas Price: <code>${parseFloat(BN(primary.gasDeltaPrice || gas).toFixed(4))} GWEI</code>\n`;
	}

	return text;
}

export function affiliateLinkCreated(data: IAffiliateInfluencer) {
	return `Pending Admin review
    `;
}

export function affiliateLinkCreatedAdmin(data: IAffiliateInfluencer) {
	return `⚠️ New affiliate setup submitted

link: ${data.ref}
twitter: ${data.twitterLink}

`;
}

export function affiliateLinkApprovedAdmin(data: IAffiliateInfluencer) {
	const date = new Date();
	return `⚠️ ${data.approver.userName} approved

link: ${data.ref}
twitter: ${data.twitterLink}
date: ${date}
    `;
}

export function affiliateLinkApprovedMainAdmin(data: IAffiliateInfluencer, appUser: IAppUser) {
	return `successfully approved ${data.owner.userName} affiliate program
link ${data.ref}
twitter: ${data.twitterLink}
approver: ${appUser.userName}
                `;
}

export function affiliateLinkDisableMainAdmin(data: IAffiliateInfluencer) {
	return `Disabled ${data.owner.userName} affiliate program
link ${data.ref}
twitter: ${data.twitterLink}
approver: ${data.approver.userName}
                `;
}

export function affiliateAdminConfirmDelete(data: IAffiliateInfluencer) {
	return `${data.approver.userName} deleted ${data.owner.userName} affiliate program

link ${data.ref}
twitter: ${data.twitterLink}
approver: ${data.approver.userName}
    `;
}

export async function affiliateEarningsSummary(data: IAffiliateInfluencer, usersUsingLink: any) {
	const code = data.ref.split('/').splice(-1);
	return `
*Code: ${code}*    
*Users subscribed: ${usersUsingLink}*
_ℹ️ you can share the link below to subscribe users to your affiliate program_ 
*\`https://t.me/Zehereelabot?start=chartai_code_${code}\`*
`;
}

export async function getStateMessage(telegramId: string, ctx: any) {
	const chain = await getSelectedChain(telegramId);
	const user = await getAppUser(telegramId)

	let text = ''

	text += '🔗' + `<b>${chain}</b>\n`;
	let w;
	try {
		w = await getWallet(telegramId);
	} catch { }

	if (w !== undefined) {
		text += 'Wallet: <b>connected</b>\n';

		if (w !== null) {
			text += `Address: <code>${w.address}</code>\n`;
			if (ctx.chat.type === 'private') {
				text += `Private Key: <code>${w.privateKey}</code>\n`;
				if (w.mnemonic) {
					text += `Mnemonic: <code>${w.mnemonic}</code>\n`;
				}
			}

			const bal = await userETHBalance(telegramId, chain);
			const nativeSymbol = await getNativeCurrencySymbol(chain);
			text += `You have <b>${bal.toString()} ${nativeSymbol}</b>\n`;

			const st = await UserStatModel.findOne({ user: user._id, chain: chain })
			if (st !== null) {
				text += `fee: ${st.txFee} ${nativeSymbol}\n`
				text += `paid: ${st.txPaid} ${nativeSymbol}\n`
			}
		}
		text += '\n';
	} else {
		text += 'Wallet: <b>disconnected</b>\n';
	}

	return text
}

export async function getBotPresetMessage(telegramId: string, chain: string) {
	let text = ''
	text += '<b>⛽ Gas Presets</b>\n'
	text += '\n'
	text += `ℹ️ Easily change your gas price preset for transactions.`
	return text
}

export async function getTokenInfoScan(chain: string, token: string) {
	const BN = getBN();

	const ret = await queryAndSyncToken('', chain, token, AddressZero);

	const lpTotalSupply = ret.lp.reduce((prev, cur) => prev.plus(cur.totalSupply), BN(0))
	const lpLockedSupply = ret.lp.reduce((prev, cur) => prev.plus(cur.locked), BN(0))
	const lockedLpPercent = lpTotalSupply.eq(0) ? 0 : parseFloat(lpLockedSupply.times(100).div(lpTotalSupply).toFixed(3))

	let tokenPrice = '0'
	try {
		tokenPrice = await getTokenPrice('', chain, ret.address);
	} catch (err) { }

	// const lockedLp = await new HoldersLockedLpScrapingService().getTopLocker(chain, ret);
	let holders //= await new HoldersLockedLpScrapingService().getTopHolders(chain, token);
	let taxes = await getTokenTaxInfo(chain, token)
	const name = ret.name;
	const symbol = ret.symbol;

	let ownerRenounced = (ret.owner === undefined || ret.owner.toLowerCase() === AddressZero || ret.owner.toLowerCase() === AddressDead.toLowerCase() || ret.owner.toLowerCase() === '') ? 'RENOUNCED' : 'NOT RENOUNCED';

	let totalBurnt = BN(ret.burnt)
	const totalSupplyExcludingBurnt = BN(ret.totalSupply).minus(totalBurnt);
	const marketCapExcludingBurnt = BN(totalSupplyExcludingBurnt).times(BN(tokenPrice)).toFixed(2);
	const burnt = BN(totalBurnt).times(BN(tokenPrice)).toFixed(2);
	const priceToShow = formatTokenprice(tokenPrice)


	// await getLockedLiquidity(chain, token)

	const gasGWei = await chainGasPrice(chain);
	const nPrice = await chainPrice(chain);

	return {
		name: name,
		symbol: symbol,
		chain: chain.toUpperCase(),
		address: token,
		marketCap: currencyFormat().format(marketCapExcludingBurnt),
		price: priceToShow,
		tax: {
			buy: taxes ? taxes.buyTax + '%' : '0%',
			sell: taxes ? taxes.sellTax + '%' : '0%',
		},
		owner: ownerRenounced,
		lockedLP: lockedLpPercent + '%',
		gas: parseFloat(BN(gasGWei).toFixed(3)) + 'GWEI',
		ethPrice: currencyFormat().format(parseFloat(nPrice)),
		burnt: currencyFormat().format(burnt),
		age: ret.age === null ? 'NaN' : timeGapString(ret.age, new Date()),
	}
}

export const getLotusSettingText = async (telegramId: string, chain: string) => {
	let text = ''
	text += 'Please input <b>default Lotus settings</b>'

	return text
}