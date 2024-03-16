import { AddressDead, AddressZero, fastQuery, getBN, getGasEstimation, newWeb3, sendTxn } from './web3.operation';
import ERC20 from './abi/ERC20.json';
import { getDedicatedSyncRPC } from './chain.parameters';
import { getMulticall } from '../web3/multicall';
import { IAddress } from '../models/address.model';
import Logging from '../utils/logging';
import { getTxCallback } from '../service/transaction.backup.service';
import { tokenBalanceCallCtx, tokenBalanceCallRes, tokenIntrinsicCallCtx, tokenIntrinsicCallRes } from './requests/multicall_param';
import { getTokenInfo } from '../service/token.service';
import { getAppUser } from '../service/app.user.service';
import { ChainModel } from '../models/chain.model';
import { SettingsModel } from '../models/settings.model';
import { chainGasPrice } from '../service/chain.service';
import { getWallet } from '../service/wallet.service';
import { convertValue } from '../utils/common';
import { DexInfoModel } from '../models/dex.info.model';
import { getSettings } from '../service/settings.service';
import { chainConfig } from './chain.config';

// const ERC20 = JSON.parse(fs.readFileSync('./src/web3/abi/ERC20.json').toString().trim())

export async function getTokenSimpleInfo(telegramId: string, chain: string, token: string, user: string) {
	try {
		const cc1 = [
			...tokenIntrinsicCallCtx([token]),
			...tokenBalanceCallCtx([token], [[user, AddressZero, AddressDead]])
		];

		const rpc = await getDedicatedSyncRPC(chain)
		const multicall = getMulticall(chain, rpc)

		let ret1
		try {
			ret1 = await multicall.call(cc1)
		} catch (err) {
			console.error(`==> ${new Date().toLocaleString()}`)
			console.error(err)
			Logging.error('[getTokenSimpleInfo]')
			throw new Error('-')
		}

		const tokenRes = tokenIntrinsicCallRes(ret1, token)
		const userBal = tokenBalanceCallRes(ret1, [token], 0, user)
		const zeroBal = tokenBalanceCallRes(ret1, [token], 0, AddressZero)
		const deadBal = tokenBalanceCallRes(ret1, [token], 0, AddressDead)

		const BN = getBN();
		return {
			...tokenRes,
			marketCap: BN(tokenRes.totalSupply)
				.minus(BN(zeroBal.balance).div(BN(`1e${zeroBal.decimals}`)))
				.minus(BN(deadBal.balance).div(BN(`1e${deadBal.decimals}`)))
				.toString(),
			balance: BN(userBal.balance).div(BN(`1e${userBal.decimals}`)).toString()
		}
	} catch (err) {

	}
}

export async function transferToken(telegramId: string, chain: string, tokenAddress: string, addressTo: string, amount: string, address?: IAddress) {
	const tokenInfo = await getTokenSimpleInfo(telegramId, chain, tokenAddress, addressTo);

	const BN = getBN();
	const label = `🔗<b>${chain}</b>\nTransferring <b>${BN(amount).div(BN(`1e${tokenInfo.decimals}`).toString())} ${tokenInfo.symbol}</b> to <b>${addressTo}</b>`;

	const callback = getTxCallback(label)
	return await sendTxn(telegramId, chain,
		{
			abi: ERC20.abi,
			functionName: 'transfer',
			args: [addressTo, amount]
		},
		{
			to: tokenAddress,
			address: address
		},
		{
			callback: callback
		});
}


export async function approveTokenExt(telegramId: string, chain: string, tokenAddress: string, routerAddress: string, wallet?: any) {
	const tokenInfo = await getTokenInfo(chain, tokenAddress);
	const label = `🔗<b>${chain}</b>\nApproving <b>${tokenInfo.symbol}</b> for <code>${routerAddress}</code>`;

	const callback = getTxCallback(label)

	const user = await getAppUser(telegramId)
	const chainInfo = await ChainModel.findOne({ name: chain })
	const setting = await SettingsModel.findOne({ user: user._id, chain: chainInfo._id })

	const BN = getBN()
	const gasPriceInGwei = await chainGasPrice(chain)
	let approveGasPrice = BN(0)

	if (chain === 'ethereum') {
		approveGasPrice = BN(setting?.approveGasPrice || '0').plus(BN(gasPriceInGwei))
	} else {
		approveGasPrice = BN(setting?.approveGasPrice || '0').eq(BN(0)) === true ? BN(gasPriceInGwei) : BN(setting?.approveGasPrice || '0')
	}

	const approveGasPriceWei = approveGasPrice.times(BN(`1e9`)).integerValue().toString()

	return await sendTxn(telegramId, chain,
		{
			abi: ERC20.abi,
			functionName: 'approve',
			args: [routerAddress, '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff']
		},
		{
			to: tokenAddress,
			address: wallet,
			gasPrice: approveGasPriceWei
		},
		{
			callback: callback
		})
}

export async function isTokenApprovedExt(telegramId: string, chain: string, tokenAddress: string, amount: string, routerAddress: string, wallet?: any) {
	const BN = getBN();
	const w = wallet ? wallet : await getWallet(telegramId)
	const allowance = await fastQuery(telegramId, chain, {
		abi: ERC20.abi,
		functionName: 'allowance',
		args: [w.address, routerAddress]
	},
		{
			to: tokenAddress
		});

	return BN(allowance.toString()).gte(BN(amount));
}


export async function userTransferToken(telegramId: string, chain: string, tokenAddress: string, addressTo: string, amount: string) {
	const w = await getWallet(telegramId);
	const tokenInfo: any = await getTokenSimpleInfo(telegramId, chain, tokenAddress, w.address);
	const bal = tokenInfo.balance;
	const decimals = tokenInfo.decimals;
	const BN = getBN();
	const amn = BN(convertValue(bal, amount, BN)).times(BN(`1e${decimals.toString()}`)).integerValue().toString()

	return await transferToken(telegramId, chain, tokenAddress, addressTo, amn);
}

export async function userTransferAdditional(telegramId: string, chain: string, tokenAddress: string, addressTo: string, amount: string, address: IAddress, tokenInfo: any) {
	const BN = getBN();
	const amn = BN(convertValue(tokenInfo.balance, amount, BN)).times(BN(`1e${tokenInfo.decimals.toString()}`)).integerValue().toString();

	return await transferToken(telegramId, chain, tokenAddress, addressTo, amn, address);
}

export async function getApprovalAddress(telegramId: string, chain: string, token: string, factory: string) {
	const dexInfo = await DexInfoModel.findOne({ chain: chain, factory: factory })
	const setting = await getSettings(telegramId, chain)
	const approvalAddress = setting.antiMEV === true ? chainConfig[chain].antimevSwapper : dexInfo.router

	return dexInfo.router
}
