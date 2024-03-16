import { botEnum } from '../constants/botEnum';
import { AddressModel } from '../models/address.model';
import { ChainModel } from '../models/chain.model';
import { CopyTradeModel } from '../models/copytrade.model';
// import { LotusSettingsModel } from '../models/lotus.settings.model';
import { SettingsModel } from '../models/settings.model';
import { WalletModel } from '../models/wallet.model';
import { ALREADY_EXIST } from '../utils/common';
import { getAppUser, userVerboseLog } from './app.user.service';

export async function getSettings(telegramId: string, chain: string) {
	const user = await getAppUser(telegramId);

	const ch: any = await ChainModel.findOne({ name: chain })
	if (ch === null) {
		throw new Error(`chain [${chain}] not configured`)
	}

	const f = await SettingsModel.findOne({ user: user._id, chain: ch._id })
	if (f === null) {
		const newSave = new SettingsModel({
			user: user._id,
			chain: ch._id,
			multiWallet: false,
			antiMEV: chain === 'ethereum' ? true : false,
			slippage: 100,
			approveAuto: true,
			sellHighPrice: '100%',
			sellLowPrice: '-50%',
			sellHighAmount: '100%',
			sellLowAmount: '100%'
		})

		await newSave.save()
	}
	return await SettingsModel.findOne({ user: user._id, chain: ch._id })
}

export async function updateSettingsInfo(telegramId: string, chain: string, info: any) {
	const user = await getAppUser(telegramId);

	const ch: any = await ChainModel.findOne({ name: chain })
	if (ch === null) {
		throw new Error(`chain [${chain}] not configured`)
	}

	const fItem = await SettingsModel.findOne({ user: user._id, chain: ch._id });
	if (fItem === null) {
		throw new Error(`Not found setting for [${user.telegramId}]`);
	}

	for (const ch in info) {
		fItem[ch] = info[ch];

		if (ch === 'multiWallet') {
			const wallet: any = await WalletModel.findOne({ owner: user._id })
			if (info[ch] === true) {
				const addrArray = await AddressModel.find({ walletPk: wallet._id })
				for (const aa of addrArray) {
					aa.connected = true
					await aa.save()
				}
				wallet.addresses = addrArray.map(a => a._id)
				await wallet.save()
			} else {
				const addrArray = await AddressModel.find({ walletPk: wallet._id })
				let mainAddressId
				for (const aa of addrArray) {
					if (aa.additional === true) {
						aa.connected = false
						await aa.save()
					} else {
						mainAddressId = aa._id
					}
				}
				if (mainAddressId) {
					wallet.addresses = [mainAddressId]
					await wallet.save()
				}
			}
		}
	}

	await fItem.save();
}

export async function isApproveAuto(telegramId: string, chain: string) {
	const t = await getSettings(telegramId, chain)
	if (t === null) {
		throw new Error('Please configure chain first')
	}

	return t.approveAuto || true
}

// export async function getLotusSettings(telegramId: string, chain: string) {
// 	const user = await getAppUser(telegramId);

// 	const f = await LotusSettingsModel.findOne({ user: user._id, chain: chain })
// 	if (f === null) {
// 		const newSave = new LotusSettingsModel({
// 			user: user._id,
// 			chain: chain,
// 			multiWallet: false,
// 			defaultBuyETHAmount: '100%'
// 		})

// 		await newSave.save()
// 	}
// 	return await LotusSettingsModel.findOne({ user: user._id, chain: chain })
// }

// export async function updateLotusSettingsInfo(telegramId: string, chain: string, info: any) {
// 	const user = await getAppUser(telegramId);

// 	const fItem = await LotusSettingsModel.findOne({ user: user._id, chain: chain });
// 	if (fItem === null) {
// 		throw new Error(`Not found lotus setting for [${user.telegramId}]`);
// 	}

// 	for (const ch in info) {
// 		fItem[ch] = info[ch];
// 	}

// 	await fItem.save();
// }
