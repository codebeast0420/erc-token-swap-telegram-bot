import { botEnum } from '../constants/botEnum';
import { TokenTrackModel } from '../models/token.track.model';
import { sleep, timeGapString, timeGapStringDetails } from '../utils/common';
import { currencyFormat } from '../utils/global.functions';
import { getTrackMarkup } from '../utils/inline.markups';
import Logging from '../utils/logging';
import { getNativeCurrencySymbol } from '../web3/chain.parameters';
import { prefetchTokensOnChain, queryTokenInfoOnChain } from '../web3/multicall';
import { getBN } from '../web3/web3.operation';
import { getAppUser } from './app.user.service';
import { chainGasPrice, chainPrice } from './chain.service';
import { getPNL, getPriceImpact } from './monitor.service';
import { formatTokenprice, getTokenPrice, getTokenTaxInfo } from './token.service';
import { getTokenInfo, startToken } from './token.service';
import { getWallet } from './wallet.service';

export async function startTokenTrack(telegramId: string, chain: string, token: string) {
	const user = await getAppUser(telegramId);

	await TokenTrackModel.updateMany({ user: user._id }, { primary: false });

	let track = await TokenTrackModel.findOne({ user: user._id, chain: chain, address: token });

	if (track === null) {
		track = new TokenTrackModel({
			user: user._id,
			chain: chain,
			address: token,
			state: 'enabled'
		});
	}

	await track.save()

	return track
}

export async function moveTokenTrack(telegramId: string, trackId: string, bPrev: boolean) {
	const tracks = await getAllTracks(telegramId)

	if (tracks.length <= 1) return null

	const track = tracks.find((t) => t._id.toString() === trackId)
	let index;
	if (track === undefined) {
		index = 0;
	} else {
		const foundIndex = tracks.indexOf(track)

		if (bPrev === true) {
			index = (foundIndex + tracks.length - 1) % tracks.length
		} else {
			index = (foundIndex + 1) % tracks.length
		}
	}

	return tracks[index]
}

export async function getAllTracks(telegramId: string) {
	const user = await getAppUser(telegramId)
	return await TokenTrackModel.find({ user: user._id })
}

export async function getFirstTrack(telegramId: string) {
	const tracks = await getAllTracks(telegramId)
	if (tracks.length > 0) return tracks[0]
	else return null
}

export async function getTrackByToken(telegramId: string, chain: string, token: string) {
	const user = await getAppUser(telegramId);
	return await TokenTrackModel.findOne({ user: user._id, chain: chain, address: token })
}

export async function getTrackText(telegramId: string, chain: string, token: string) {
	const BN = getBN();

	const track = await getTrackByToken(telegramId, chain, token)
	const allTracks = await getAllTracks(telegramId)

	if (allTracks.length === 0) {
		return {
			text: '✅ Done! The monitor panel should show up shortly if you have any tracked trades.'
		}
	}

	if (track === null) {
		return {
			text: '❌ Invalid track'
		}
	}

	const foundIndex = allTracks.map((t, idx) => t.chain === track.chain && t.address === track.address ? idx : -1).find(t => t > -1)

	const nativeSymbol = await getNativeCurrencySymbol(track.chain)
	// const gasPrice = await chainGasPrice(track.chain);
	// const cp = await chainPrice(track.chain);

	const w = await getWallet(telegramId);

	const tokenInfo = await queryTokenInfoOnChain(telegramId, track.chain, track.address, w.address);

	const tokenPrice = await getTokenPrice(telegramId, track.chain, tokenInfo.address);
	const taxInfo = await getTokenTaxInfo(track.chain, track.address)
	const pnlInfo = await getPNL(track.chain, track.address, w.address.toLowerCase())
	let totalBurnt = BN(tokenInfo.burnt)
	const totalSupplyExcludingBurnt = BN(tokenInfo.totalSupply).minus(totalBurnt);
	const marketCapExcludingBurnt = BN(totalSupplyExcludingBurnt).times(BN(tokenPrice)).toFixed(2);
	const burnt = BN(totalBurnt).times(BN(tokenPrice)).toFixed(2);

	const impact = await getPriceImpact(track.chain, track.address, w.address.toLowerCase())

	let priceToShow = formatTokenprice(tokenPrice)

	let text = '📍 <b>Trade Monitor</b>\n';
	text += `\n`;
	text += `🪙 Token: <b>${tokenInfo.symbol}</b> - ${track.chain.toUpperCase()} ⏱ ${timeGapString(track.createdAt, new Date())}\n`
	text += `<code>${tokenInfo.address}</code>\n`
	text += `\n`;
	text += `🧢 Market Cap: <b>${currencyFormat().format(marketCapExcludingBurnt)}</b>\n`
	text += `📈 Price: <b>${priceToShow}</b>\n`;
	text += `\n`;

	text += `Initial: <b>${parseFloat(BN(pnlInfo.initial || '0').toFixed(4))} ${nativeSymbol}</b>\n`;
	text += `Worth: <b>${parseFloat(BN(pnlInfo.worth || '0').toFixed(4))} ${nativeSymbol}</b>\n`;
	text += `\n`;

	text += `💳 Holdings: <b>${BN(tokenInfo.balance).times(100).integerValue().div(100).toString()}</b> ${tokenInfo.symbol}\n`
	text += `⏳ Time elapsed: <b>${timeGapStringDetails(track.createdAt, new Date())}</b>\n`;
	text += '\n'

	text += `⚖️ Taxes: 🅑 <b>${parseFloat(BN(taxInfo?.buyTax || '0').toFixed(3))}</b>% 🅢 <b>${parseFloat(BN(taxInfo?.sellTax || '0').toFixed(3))}</b>%\n`;

	text += `\n`;
	text += `🧾 P/L after taxes: ${parseFloat(BN(pnlInfo.pnl || '0').toFixed(4))}%\n`
	text += `💥 Price impact: <b>${parseFloat(BN(impact || '0').toFixed(4))}</b>%\n`;
	text += `💸 Expected payout: <b>${parseFloat(BN(pnlInfo.worth).times(BN(100).minus(BN(taxInfo?.sellTax || '0'))).div(BN(100)).toFixed(4))}</b> ${nativeSymbol}\n`; // BN(payout || '0')
	text += `\n`;

	if (allTracks.length > 1) {
		text += `🗓️ <b>Other Trades</b>\n`;
	} else {
		text += `🗓️ <b>No Other Trades</b>\n`;
	}

	for (let i = 0; i < allTracks.length - 1; i++) {
		const t = allTracks[(i + foundIndex + 1) % allTracks.length];
		const tt = await queryTokenInfoOnChain(telegramId, t.chain, t.address, w.address);
		const pnlInfo = await getPNL(tt.chain, tt.address, w.address.toLowerCase())

		if (tt !== null) {
			text += `/${i + 1} 🪙 <b>${tt.symbol}</b> 🚀 <b>${parseFloat(BN(pnlInfo.pnl || '0')).toFixed(2)}</b>% ⏱ ${timeGapString(tt.createdAt, new Date())}\n`;
		}
	}

	// text += `\n`;
	// text += `ℹ Sell-Lo/Hi compare against the coin's P/L, not its P/L w/tax\n`;
	// text += `\n`;
	// text += `📢 Ad: Advertise with us @SwiftMarketer`;

	return {
		text,
		tokenInfo,
		chain: track.chain
	};

}

export async function resetTokenTracks(telegramId: string) {
	const user = await getAppUser(telegramId);

	await TokenTrackModel.deleteMany({ user: user._id });
}

export async function stopTokenTrack(telegramId: string, trackId: string) {
	let track = await TokenTrackModel.findById(trackId)
	if (track !== null) {
		track.state = 'stopped'
		await track.save()
	}
	return track
}

export async function enableTokenTrack(telegramId: string, trackId: string) {
	let track = await TokenTrackModel.findById(trackId)
	if (track !== null) {
		track.state = 'enabled'
		await track.save()
	}

	return track;
}

export async function deleteTokenTrack(telegramId: string, trackId: string) {
	let tracks = await getAllTracks(telegramId)
	if (tracks.length <= 0) return;

	let nextTrack
	const track = tracks.find((t) => t._id.toString() === trackId)
	if (track !== undefined) {
		const foundIndex = tracks.indexOf(track)
		if (tracks.length > 1) {
			nextTrack = tracks[(foundIndex + 1) % tracks.length];
		}
	}

	await TokenTrackModel.findByIdAndDelete(trackId)

	if (nextTrack) {
		return await TokenTrackModel.findById(nextTrack._id);
	} else return null
}

export async function pollTrackTokens(bot: any) {
	while (true) {
		const tracks: any[] = await TokenTrackModel.find({ state: 'enabled', primary: true })
		for (const t of tracks) {
			try {
				await t.populate('user')

				const telegramId = t.user.telegramId
				const chatId = t.user.chatId
				const msgId = t.msgId
				const chain = t.chain

				const track = await getPrimaryTokenTrack(telegramId)

				if (track !== null) {
					await prefetchTokensOnChain(track.chain, JSON.stringify([track.address]))

					const ptext = await getTrackText(telegramId, track.chain, track.address)

					await bot.telegram.editMessageText(chatId, msgId, 0, ptext.text, {
						parse_mode: botEnum.PARSE_MODE_V2,
						reply_markup: await getTrackMarkup(telegramId, chain, ptext.tokenInfo.address, '')
					})
				}
			} catch (err) {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
				Logging.error(`[pollTrackTokens] ${err.message}`)
				await TokenTrackModel.findByIdAndDelete(t._id)
			}
		}

		await sleep(3000)
	}
}

export async function getPrimaryTokenTrack(telegramId: string) {
	const user = await getAppUser(telegramId);
	return await TokenTrackModel.findOne({ user: user._id, primary: true })
}
