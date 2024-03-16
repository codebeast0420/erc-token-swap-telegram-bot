import { botEnum } from '../constants/botEnum';
import { updateChatId, userVerboseLog } from '../service/app.user.service';
import { processError } from '../service/error';
import { getTrackText, moveTokenTrack, resetTokenTracks, enableTokenTrack, stopTokenTrack, deleteTokenTrack, startTokenTrack, getFirstTrack } from '../service/track.service';
import { getBotInstance } from '../web3/chain.parameters';
import { getTrackMarkup } from '../utils/inline.markups';
import { isTokenAutoSellSet, removeTokenAutoSell, addTokenAutoSell, getTokenAutoSellContext, updateTokenAutoSellContext } from '../service/autosell.service';
import { getTokenPrice } from '../service/token.service';
import { AUTO_BUY_LISTENER, AUTO_SELL_LISTENER, sleep } from '../utils/common';
import { addTokenAutoBuy, isTokenAutoBuySet, removeTokenAutoBuy } from '../service/autobuy.service';
import Logging from '../utils/logging';
import { TokenInfoModel } from '../models/token.info.model';
import { TokenTrackModel } from '../models/token.track.model';
import { AutoSellTokenModel } from '../models/auto.sell.token';
import { AutoBuyTokenModel } from '../models/auto.buy.token';
import { PairInfoModel } from '../models/pair.info.model';
import { findBestWETHPair } from '../web3/dex/common/bestpair';

export async function externalInvokeMonitor(telegramId: string, chatId: number, chain: string, token: string) {
	try {
		await userVerboseLog(telegramId, '/monitor from external command');

		const track = await startTokenTrack(telegramId, chain, token)
		const t = await getTrackText(telegramId, track.chain, track.address)

		const bot = getBotInstance()

		const msg = await bot.telegram.sendMessage(chatId, t.text, {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getTrackMarkup(telegramId, track.chain, track.address, '')
		});

		track.msgId = msg.message_id
		await track.save()
	} catch (err) {
		await processError(getBotInstance(), telegramId, err)
	}
}

const invokeMonitor = async (ctx: any) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/monitor');

		await updateChatId(telegramId, ctx.chat.id)
		const track = await getFirstTrack(telegramId)

		if (track === null) {
			await ctx.telegram.sendMessage(ctx.chat.id, '✅ Done! The monitor panel should show up shortly if you have any tracked trades.', {
				parse_mode: botEnum.PARSE_MODE_V2
			})
			return
		}

		const t = await getTrackText(telegramId, track.chain, track.address)

		const msg = await ctx.telegram.sendMessage(ctx.chat.id, t.text, {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getTrackMarkup(telegramId, track.chain, track.address, '')
		});

		track.msgId = msg.message_id
		await track.save()

		if (ctx.update.callback_query?.message.message_id) {
			await ctx.telegram.pinChatMessage(ctx.chat.id, ctx.update.callback_query.message.message_id);
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const gotoPrevTrack = async (ctx: any, trackId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'go to prev track');

		const prevTrack = await moveTokenTrack(telegramId, trackId, true)
		if (prevTrack === null) return

		const t = await getTrackText(telegramId, prevTrack.chain, prevTrack.address)

		const msgId = ctx.update.callback_query.message.message_id;

		await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, t.text, {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getTrackMarkup(telegramId, prevTrack.chain, prevTrack.address, '')
		});
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const gotoNextTrack = async (ctx: any, trackId: string) => {
	const telegramId = ctx.from.id

	try {
		await userVerboseLog(telegramId, 'go to next track')

		const nextTrack = await moveTokenTrack(telegramId, trackId, false)
		if (nextTrack === null) return

		const t = await getTrackText(telegramId, nextTrack.chain, nextTrack.address)

		const msgId = ctx.update.callback_query.message.message_id;

		await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, t.text, {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getTrackMarkup(telegramId, nextTrack.chain, nextTrack.address, '')
		});
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeRefreshTrack = async (ctx: any, trackId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'refresh track');

		const track = await TokenTrackModel.findById(trackId)
		if (track === null) return

		const t = await getTrackText(telegramId, track.chain, track.address)

		const msgId = ctx.update.callback_query.message.message_id;

		await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, t.text, {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getTrackMarkup(telegramId, track.chain, track.address, '')
		});
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeEnableTrack = async (ctx: any, trackId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'enable track');

		await updateChatId(telegramId, ctx.chat.id);

		const track = await enableTokenTrack(telegramId, trackId)
		if (track !== null) {
			const t = await getTrackText(telegramId, track.chain, track.address)

			if (ctx.update.callback_query?.message.message_id) {
				if (t.tokenInfo) {
					await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
						parse_mode: botEnum.PARSE_MODE_V2,
						reply_markup: await getTrackMarkup(telegramId, track.chain, track.address, '')
					});
				} else {
					await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
						parse_mode: botEnum.PARSE_MODE_V2
					});
				}
			}
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeResetTracks = async (ctx: any) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'reset tracks');

		await updateChatId(telegramId, ctx.chat.id)
		await resetTokenTracks(telegramId)

		if (ctx.update.callback_query?.message.message_id !== undefined) {
			try {
				await ctx.deleteMessage();
			} catch { }
		}

		await ctx.telegram.sendMessage(ctx.chat.id, '✅ Done! The monitor panel should show up shortly if you have any tracked trades.', {
			parse_mode: botEnum.PARSE_MODE_V2
		})
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeStopTrack = async (ctx: any, trackId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'stop track');

		await updateChatId(telegramId, ctx.chat.id);
		const track = await stopTokenTrack(telegramId, trackId)

		if (track !== null) {
			const t = await getTrackText(telegramId, track.chain, track.address)

			if (ctx.update.callback_query?.message.message_id) {
				if (t.tokenInfo) {
					await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
						parse_mode: botEnum.PARSE_MODE_V2,
						reply_markup: await getTrackMarkup(telegramId, track.chain, track.address, '')
					});
				} else {
					await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
						parse_mode: botEnum.PARSE_MODE_V2
					});
				}
			}
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeDeleteTrack = async (ctx: any, trackId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'delete track');

		await updateChatId(telegramId, ctx.chat.id);
		const track = await deleteTokenTrack(telegramId, trackId)

		if (ctx.update.callback_query?.message.message_id !== undefined) {
			try {
				await ctx.deleteMessage();
			} catch { }
		}

		if (track !== null) {
			const t = await getTrackText(telegramId, track.chain, track.address)

			await ctx.telegram.sendMessage(ctx.chat.id, t.text, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getTrackMarkup(telegramId, track.chain, track.address, '')
			});
		} else {
			await ctx.telegram.sendMessage(ctx.chat.id, '✅ Done! The monitor panel should show up shortly if you have any tracked trades.', {
				parse_mode: botEnum.PARSE_MODE_V2
			});
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeAutoSellTrack = async (ctx: any, tokenInfoId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'auto sell track');

		await updateChatId(telegramId, ctx.chat.id);

		const tokenDB = await TokenInfoModel.findById(tokenInfoId)
		const chain = tokenDB.chain

		const isAS = await isTokenAutoSellSet(telegramId, tokenDB.chain, tokenDB.address);
		if (isAS === true) {
			await removeTokenAutoSell(telegramId, tokenDB.chain, tokenDB.address);
			await userVerboseLog(telegramId, `removed ${tokenDB.address} from auto sell`);
		} else {
			const tokenPrice = await getTokenPrice(telegramId, chain, tokenDB.address)
			if (tokenPrice === undefined) {
				throw new Error(`invokeAutoSellTrack: unresolvable token price [${chain}] ${tokenDB.address}`)
			}
			const lpArray = await Promise.all(tokenDB.lp.map(p => PairInfoModel.findOne({ chain: chain, address: p })))
			const bestWETHPair = await findBestWETHPair(tokenDB.address, lpArray)
			await addTokenAutoSell(telegramId, chain, tokenDB.address, tokenPrice, bestWETHPair ? bestWETHPair.address : undefined)
			await userVerboseLog(telegramId, `added ${tokenDB.address} to auto buy`);
		}

		if (ctx.update.callback_query?.message.message_id) {
			await ctx.telegram.editMessageReplyMarkup(ctx.chat.id, ctx.update.callback_query?.message.message_id, undefined, await getTrackMarkup(telegramId, chain, tokenDB.address, ''))
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeAntiRugTrack = async (ctx: any, tokenInfoId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'auto sell anti-rug');

		await updateChatId(telegramId, ctx.chat.id);

		const tokenDB = await TokenInfoModel.findById(tokenInfoId)
		const chain = tokenDB.chain

		const autoSellItem = await getTokenAutoSellContext(telegramId, tokenDB.chain, tokenDB.address);
		if (autoSellItem !== null) {
			await updateTokenAutoSellContext(telegramId, tokenDB.chain, tokenDB.address, { antiRug: autoSellItem.antiRug === true ? false : true });
			await userVerboseLog(telegramId, `toggled anti-rug of ${tokenDB.address} from auto sell`);

			if (ctx.update.callback_query?.message.message_id) {
				await ctx.telegram.editMessageReplyMarkup(ctx.chat.id, ctx.update.callback_query?.message.message_id, undefined, await getTrackMarkup(telegramId, chain, tokenDB.address, ''))
			}
		} else {
			await ctx.telegram.sendMessage(ctx.chat.id, 'Please enable <b>Auto-Sell</b> first', { parse_mode: botEnum.PARSE_MODE_V2 })
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeTrailingSellTrack = async (ctx: any, tokenInfoId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'auto sell trailing sell');

		await updateChatId(telegramId, ctx.chat.id);

		const tokenDB = await TokenInfoModel.findById(tokenInfoId)
		const chain = tokenDB.chain

		const autoSellItem = await getTokenAutoSellContext(telegramId, tokenDB.chain, tokenDB.address);
		if (autoSellItem !== null) {
			await updateTokenAutoSellContext(telegramId, tokenDB.chain, tokenDB.address, { trailingSell: autoSellItem.trailingSell === true ? false : true });
			await userVerboseLog(telegramId, `toggled trailing sell of ${tokenDB.address} from auto sell`);

			if (ctx.update.callback_query?.message.message_id) {
				await ctx.telegram.editMessageReplyMarkup(ctx.chat.id, ctx.update.callback_query?.message.message_id, undefined, await getTrackMarkup(telegramId, chain, tokenDB.address, ''))
			}
		} else {
			await ctx.telegram.sendMessage(ctx.chat.id, 'Please enable <b>Auto-Sell</b> first', { parse_mode: botEnum.PARSE_MODE_V2 })
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

async function invokeNewTrack(ctx: any, tokenInfoId: string) {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, `track [${tokenInfoId}]`);

		const tokenInfo = await TokenInfoModel.findById(tokenInfoId)

		if (tokenInfo === null) {
			await ctx.telegram.sendMessage(ctx.chat.id, '❌ Invalid token to snipe', {
				parse_mode: botEnum.PARSE_MODE_V2
			});
		} else {
			const track = await startTokenTrack(telegramId, tokenInfo.chain, tokenInfo.address)
			const t = await getTrackText(telegramId, track.chain, track.address)

			let msg
			if (t.tokenInfo) {
				msg = await ctx.telegram.sendMessage(ctx.chat.id, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2,
					reply_markup: await getTrackMarkup(telegramId, track.chain, track.address, '')
				});
			} else {
				msg = await ctx.telegram.sendMessage(ctx.chat.id, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2
				});
			}

			track.msgId = msg.message_id
			await track.save()

			await sleep(1000);

			await ctx.telegram.pinChatMessage(ctx.chat.id, ctx.update.callback_query.message.message_id);
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const invokeAutoSellLowPriceLimit = async (ctx: any, autoSellId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'track auto sell low price limit');

		await updateChatId(telegramId, ctx.chat.id);

		const autoSellCtx = await AutoSellTokenModel.findById(autoSellId)
		const chain = autoSellCtx.chain
		const t = await getTrackText(telegramId, chain, autoSellCtx.token)

		if (ctx.update.callback_query?.message.message_id) {
			if (t.tokenInfo) {
				const markup = await getTrackMarkup(telegramId, chain, autoSellCtx.token, 'show-auto-sell-low-price-limit')
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2,
					reply_markup: await getTrackMarkup(telegramId, chain, autoSellCtx.token, 'show-auto-sell-low-price-limit')
				});
			} else {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2
				});
			}
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeAutoSellLowPriceLimitCancel = async (ctx: any, autoSellId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'track auto sell low price limit cancel');

		await updateChatId(telegramId, ctx.chat.id)

		const autoSellCtx = await AutoSellTokenModel.findById(autoSellId)

		const chain = autoSellCtx.chain
		const t = await getTrackText(telegramId, chain, autoSellCtx.token)

		if (ctx.update.callback_query?.message.message_id) {
			if (t.tokenInfo) {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2,
					reply_markup: await getTrackMarkup(telegramId, chain, autoSellCtx.token, '')
				});
			} else {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2
				});
			}
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeAutoSellHighPriceLimit = async (ctx: any, autoSellId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'track auto sell high price limit');

		await updateChatId(telegramId, ctx.chat.id);

		const autoSellCtx = await AutoSellTokenModel.findById(autoSellId)
		const chain = autoSellCtx.chain
		const t = await getTrackText(telegramId, chain, autoSellCtx.token)

		if (ctx.update.callback_query?.message.message_id) {
			if (t.tokenInfo) {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2,
					reply_markup: await getTrackMarkup(telegramId, chain, autoSellCtx.token, 'show-auto-sell-high-price-limit')
				});
			} else {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2
				});
			}
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeAutoSellHighPriceLimitCancel = async (ctx: any, autoSellId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'track auto sell high price limit cancel');

		await updateChatId(telegramId, ctx.chat.id)

		const autoSellCtx = await AutoSellTokenModel.findById(autoSellId)

		const chain = autoSellCtx.chain
		const t = await getTrackText(telegramId, chain, autoSellCtx.token)

		if (ctx.update.callback_query?.message.message_id) {
			if (t.tokenInfo) {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2,
					reply_markup: await getTrackMarkup(telegramId, chain, autoSellCtx.token, '')
				});
			} else {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2
				});
			}
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeAutoSellAmountSwitch = async (ctx: any, autoSellId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'track auto sell amount switch');

		await updateChatId(telegramId, ctx.chat.id);

		const autoSellCtx = await AutoSellTokenModel.findById(autoSellId)
		const chain = autoSellCtx.chain
		const t = await getTrackText(telegramId, chain, autoSellCtx.token)

		if (ctx.update.callback_query?.message.message_id) {
			if (t.tokenInfo) {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2,
					reply_markup: await getTrackMarkup(telegramId, chain, autoSellCtx.token, 'show-auto-sell-amount')
				});
			} else {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2
				});
			}
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeAutoSellLoHiSwitch = async (ctx: any, autoSellId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'track auto sell lo - high switch');

		await updateChatId(telegramId, ctx.chat.id);

		const autoSellCtx = await AutoSellTokenModel.findById(autoSellId)
		const chain = autoSellCtx.chain
		const t = await getTrackText(telegramId, chain, autoSellCtx.token)

		if (ctx.update.callback_query?.message.message_id) {
			if (t.tokenInfo) {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2,
					reply_markup: await getTrackMarkup(telegramId, chain, autoSellCtx.token, '')
				});
			} else {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2
				});
			}
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeAutoBuyTrack = async (ctx: any, tokenInfoId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'auto buy track');

		await updateChatId(telegramId, ctx.chat.id)

		const tokenDB = await TokenInfoModel.findById(tokenInfoId)

		const chain = tokenDB.chain
		const t = await getTrackText(telegramId, chain, tokenDB.address)

		const isAS = await isTokenAutoBuySet(telegramId, chain, tokenDB.address)
		if (isAS === true) {
			await removeTokenAutoBuy(telegramId, chain, tokenDB.address)
			await userVerboseLog(telegramId, `removed ${tokenDB.address} from auto buy`);
		} else {
			const tokenPrice = await getTokenPrice(telegramId, chain, tokenDB.address)
			if (tokenPrice === undefined) {
				throw new Error(`invokeAutoBuyTrack: unresolvable token price [${chain}] ${tokenDB.address}`)
			}
			const lpArray = await Promise.all(tokenDB.lp.map(p => PairInfoModel.findOne({ chain: chain, address: p })))
			const bestWETHPair = await findBestWETHPair(tokenDB.address, lpArray)
			await addTokenAutoBuy(telegramId, chain, tokenDB.address, tokenPrice, bestWETHPair ? bestWETHPair.address : undefined);
			await userVerboseLog(telegramId, `added ${tokenDB.address} to auto buy`);
		}

		if (ctx.update.callback_query?.message.message_id) {
			if (t.tokenInfo) {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2,
					reply_markup: await getTrackMarkup(telegramId, chain, tokenDB.address, '')
				});
			} else {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2
				});
			}
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeAutoBuyPriceLimit = async (ctx: any, autoBuyId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'track auto buy price limit');

		await updateChatId(telegramId, ctx.chat.id)

		const autoBuyCtx = await AutoBuyTokenModel.findById(autoBuyId)

		const chain = autoBuyCtx.chain
		const t = await getTrackText(telegramId, chain, autoBuyCtx.token)

		if (ctx.update.callback_query?.message.message_id) {
			if (t.tokenInfo) {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2,
					reply_markup: await getTrackMarkup(telegramId, chain, autoBuyCtx.token, 'show-auto-buy-price-limit')
				});
			} else {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2
				});
			}
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeAutoBuyPriceLimitCancel = async (ctx: any, autoBuyId: string) => {
	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, 'track auto buy price limit cancel');

		await updateChatId(telegramId, ctx.chat.id);

		const autoBuyCtx = await AutoBuyTokenModel.findById(autoBuyId)
		const chain = autoBuyCtx.chain
		const t = await getTrackText(telegramId, chain, autoBuyCtx.token)

		if (ctx.update.callback_query?.message.message_id) {
			if (t.tokenInfo) {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2,
					reply_markup: await getTrackMarkup(telegramId, chain, autoBuyCtx.token, '')
				});
			} else {
				await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, t.text, {
					parse_mode: botEnum.PARSE_MODE_V2
				});
			}
		}
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

module.exports = (bot: any) => {
	bot.command(botEnum.monitor.value, invokeMonitor)
	bot.action(botEnum.monitor.value, invokeMonitor)

	bot.action(RegExp('^' + botEnum.track.value + '_.+'), async (ctx: any) => {
		const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.track.value.length + 1)
		await invokeNewTrack(ctx, tokenInfoId)
	})

	bot.action(RegExp('^' + botEnum.prevTrack.value + '_.+'), async (ctx: any) => {
		const trackId = ctx.update.callback_query.data.slice(botEnum.prevTrack.value.length + 1)
		await gotoPrevTrack(ctx, trackId)
	})

	bot.action(RegExp('^' + botEnum.nextTrack.value + '_.+'), async (ctx: any) => {
		const trackId = ctx.update.callback_query.data.slice(botEnum.nextTrack.value.length + 1)
		await gotoNextTrack(ctx, trackId)
	})

	bot.action(RegExp('^' + botEnum.refreshTrack.value + '_.+'), async (ctx: any) => {
		const trackId = ctx.update.callback_query.data.slice(botEnum.refreshTrack.value.length + 1)
		await invokeRefreshTrack(ctx, trackId)
	})

	bot.action(RegExp('^' + botEnum.enableTrack.value + '_.+'), async (ctx: any) => {
		const trackId = ctx.update.callback_query.data.slice(botEnum.enableTrack.value.length + 1)
		await invokeEnableTrack(ctx, trackId)
	})

	bot.action(botEnum.resetTracks.value, invokeResetTracks)

	bot.action(RegExp('^' + botEnum.stopTrack.value + '_.+'), async (ctx: any) => {
		const trackId = ctx.update.callback_query.data.slice(botEnum.stopTrack.value.length + 1)
		await invokeStopTrack(ctx, trackId)
	})

	bot.action(RegExp('^' + botEnum.deleteTrack.value + '_.+'), async (ctx: any) => {
		const trackId = ctx.update.callback_query.data.slice(botEnum.deleteTrack.value.length + 1)
		await invokeDeleteTrack(ctx, trackId)
	})

	bot.action(RegExp('^' + botEnum.autoSellTrack.value + '_.+'), async (ctx: any) => {
		const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.autoSellTrack.value.length + 1)
		await invokeAutoSellTrack(ctx, tokenInfoId)
	})

	bot.action(RegExp('^' + botEnum.antiRugTrack.value + '_.+'), async (ctx: any) => {
		const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.antiRugTrack.value.length + 1)
		await invokeAntiRugTrack(ctx, tokenInfoId)
	})

	bot.action(RegExp('^' + botEnum.trailingTrack.value + '_.+'), async (ctx: any) => {
		const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.trailingTrack.value.length + 1)
		await invokeTrailingSellTrack(ctx, tokenInfoId)
	})

	bot.action(RegExp('^' + botEnum.autoSellLowPriceLimit.value + '_.+'), async (ctx: any) => {
		const autoSellId = ctx.update.callback_query.data.slice(botEnum.autoSellLowPriceLimit.value.length + 1)
		await invokeAutoSellLowPriceLimit(ctx, autoSellId)
	})

	bot.action(RegExp('^' + botEnum.trackAutoSellLowPriceLimitCancel + '_.+'), async (ctx: any) => {
		const autoSellId = ctx.update.callback_query.data.slice(botEnum.trackAutoSellLowPriceLimitCancel.length + 1)
		await invokeAutoSellLowPriceLimitCancel(ctx, autoSellId)
	})

	bot.action(RegExp('^' + botEnum.trackAutoSellLowPriceLimitPercentage + '_.+'), async (ctx: any) => {
		const autoSellId = ctx.update.callback_query.data.slice(botEnum.trackAutoSellLowPriceLimitPercentage.length + 1)
		await ctx.scene.enter(AUTO_SELL_LISTENER, { input_type: 'auto-sell-low-price-percentage', msgId: ctx.update.callback_query?.message.message_id, autoSellId })
	})

	bot.action(RegExp('^' + botEnum.trackAutoSellLowPriceLimitUsd + '_.+'), async (ctx: any) => {
		const autoSellId = ctx.update.callback_query.data.slice(botEnum.trackAutoSellLowPriceLimitUsd.length + 1)
		await ctx.scene.enter(AUTO_SELL_LISTENER, { input_type: 'auto-sell-low-price-usd', msgId: ctx.update.callback_query?.message.message_id, autoSellId });
	})

	bot.action(RegExp('^' + botEnum.trackAutoSellLowPriceLimitMarketcap + '_.+'), async (ctx: any) => {
		const autoSellId = ctx.update.callback_query.data.slice(botEnum.trackAutoSellLowPriceLimitMarketcap.length + 1)
		await ctx.scene.enter(AUTO_SELL_LISTENER, { input_type: 'auto-sell-low-price-marketcap', msgId: ctx.update.callback_query?.message.message_id, autoSellId });
	})

	bot.action(RegExp('^' + botEnum.autoSellHighPriceLimit.value + '_.+'), async (ctx: any) => {
		const autoSellId = ctx.update.callback_query.data.slice(botEnum.autoSellHighPriceLimit.value.length + 1)
		await invokeAutoSellHighPriceLimit(ctx, autoSellId)
	})

	bot.action(RegExp('^' + botEnum.trackAutoSellHighPriceLimitCancel + '_.+'), async (ctx: any) => {
		const autoSellId = ctx.update.callback_query.data.slice(botEnum.trackAutoSellHighPriceLimitCancel.length + 1)
		await invokeAutoSellHighPriceLimitCancel(ctx, autoSellId)
	})

	bot.action(RegExp('^' + botEnum.trackAutoSellHighPriceLimitPercentage + '_.+'), async (ctx: any) => {
		const autoSellId = ctx.update.callback_query.data.slice(botEnum.trackAutoSellHighPriceLimitPercentage.length + 1)
		await ctx.scene.enter(AUTO_SELL_LISTENER, { input_type: 'auto-sell-high-price-percentage', msgId: ctx.update.callback_query?.message.message_id, autoSellId });
	})

	bot.action(RegExp('^' + botEnum.trackAutoSellHighPriceLimitUsd + '_.+'), async (ctx: any) => {
		const autoSellId = ctx.update.callback_query.data.slice(botEnum.trackAutoSellHighPriceLimitUsd.length + 1)
		await ctx.scene.enter(AUTO_SELL_LISTENER, { input_type: 'auto-sell-high-price-usd', msgId: ctx.update.callback_query?.message.message_id, autoSellId })
	})

	bot.action(RegExp('^' + botEnum.trackAutoSellHighPriceLimitMarketcap + '_.+'), async (ctx: any) => {
		const autoSellId = ctx.update.callback_query.data.slice(botEnum.trackAutoSellHighPriceLimitMarketcap.length + 1)
		await ctx.scene.enter(AUTO_SELL_LISTENER, { input_type: 'auto-sell-high-price-marketcap', msgId: ctx.update.callback_query?.message.message_id, autoSellId });
	})

	bot.action(RegExp('^' + botEnum.trackLoHi.value + '_.+'), async (ctx: any) => {
		const autoSellId = ctx.update.callback_query.data.slice(botEnum.trackLoHi.value.length + 1)
		await invokeAutoSellAmountSwitch(ctx, autoSellId)
	})

	bot.action(RegExp('^' + botEnum.autoSellAmountSwitch.value + '_.+'), async (ctx: any) => {
		const autoSellId = ctx.update.callback_query.data.slice(botEnum.autoSellAmountSwitch.value.length + 1)
		await invokeAutoSellLoHiSwitch(ctx, autoSellId)
	})

	bot.action(RegExp('^' + botEnum.autoSellAmountAtLowPrice + '_.+'), async (ctx: any) => {
		const autoSellId = ctx.update.callback_query.data.slice(botEnum.autoSellAmountAtLowPrice.length + 1)
		await ctx.scene.enter(AUTO_SELL_LISTENER, { input_type: 'auto-sell-amount-low-price', msgId: ctx.update.callback_query?.message.message_id, autoSellId });
	})

	bot.action(RegExp('^' + botEnum.autoSellAmountAtHighPrice + '_.+'), async (ctx: any) => {
		const autoSellId = ctx.update.callback_query.data.slice(botEnum.autoSellAmountAtHighPrice.length + 1)
		await ctx.scene.enter(AUTO_SELL_LISTENER, { input_type: 'auto-sell-amount-high-price', msgId: ctx.update.callback_query?.message.message_id, autoSellId });
	})

	bot.action(RegExp('^' + botEnum.buyDipTrack.value + '_.+'), async (ctx: any) => {
		const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.buyDipTrack.value.length + 1)
		await invokeAutoBuyTrack(ctx, tokenInfoId)
	})

	bot.action(RegExp('^' + botEnum.buyDipPriceThreshold.value + '_.+'), async (ctx: any) => {
		const autoBuyId = ctx.update.callback_query.data.slice(botEnum.buyDipPriceThreshold.value.length + 1)
		await invokeAutoBuyPriceLimit(ctx, autoBuyId)
	})

	bot.action(RegExp('^' + botEnum.trackAutoBuyPriceLimitPercentage + '_.+'), async (ctx: any) => {
		const autoBuyId = ctx.update.callback_query.data.slice(botEnum.trackAutoBuyPriceLimitPercentage.length + 1)
		await ctx.scene.enter(AUTO_BUY_LISTENER, { input_type: 'auto-buy-price-percentage', msgId: ctx.update.callback_query?.message.message_id, autoBuyId });
	})

	bot.action(RegExp('^' + botEnum.trackAutoBuyPriceLimitUsd + '_.+'), async (ctx: any) => {
		const autoBuyId = ctx.update.callback_query.data.slice(botEnum.trackAutoBuyPriceLimitUsd.length + 1)
		await ctx.scene.enter(AUTO_BUY_LISTENER, { input_type: 'auto-buy-price-usd', msgId: ctx.update.callback_query?.message.message_id, autoBuyId });
	})

	bot.action(RegExp('^' + botEnum.trackAutoBuyPriceLimitMarketcap + '_.+'), async (ctx: any) => {
		const autoBuyId = ctx.update.callback_query.data.slice(botEnum.trackAutoBuyPriceLimitMarketcap.length + 1)
		await ctx.scene.enter(AUTO_BUY_LISTENER, { input_type: 'auto-buy-price-marketcap', msgId: ctx.update.callback_query?.message.message_id, autoBuyId });
	})

	bot.action(RegExp('^' + botEnum.trackAutoBuyPriceLimitCancel + '_.+'), async (ctx: any) => {
		const autoBuyId = ctx.update.callback_query.data.slice(botEnum.trackAutoBuyPriceLimitCancel.length + 1)
		await invokeAutoBuyPriceLimitCancel(ctx, autoBuyId)
	})

	bot.action(RegExp('^' + botEnum.buyDipAmount.value + '_.+'), async (ctx: any) => {
		const autoBuyId = ctx.update.callback_query.data.slice(botEnum.buyDipAmount.value.length + 1)
		await ctx.scene.enter(AUTO_BUY_LISTENER, { input_type: 'auto-buy-amount', msgId: ctx.update.callback_query?.message.message_id, autoBuyId });
	})
};

module.exports.externalInvokeMonitor = externalInvokeMonitor
