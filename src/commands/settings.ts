import { botEnum } from '../constants/botEnum';
import { updateChatId, userVerboseLog } from '../service/app.user.service';
import { getBotGeneralConfiguration, getBotPresetMessage, getLotusSettingText } from '../utils/messages';
import { getSelectedChain, selectChain, selectOtherChain } from '../service/connected.chain.service';
import { processError } from '../service/error';
// import { getBotGasPresetsMarkup, getLotusSettingsMarkup, getSettingsMarkup } from '../utils/inline.markups';
import { getBotGasPresetsMarkup, getSettingsMarkup } from '../utils/inline.markups';
import { getSettings, updateSettingsInfo } from '../service/settings.service';
import { SETTINGS_LISTENER } from '../utils/common';

const invokeSettings = async (ctx: any) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		if (ctx.update?.message?.text === undefined) {
			await ctx.deleteMessage();
		}
	} catch { }

	try {
		await userVerboseLog(telegramId, '/settings');

		await updateChatId(telegramId, ctx.chat.id);
		const chain = await getSelectedChain(telegramId)
		await ctx.telegram.sendMessage(ctx.chat.id, await getBotGeneralConfiguration(telegramId, chain, 'general'), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'general')
		});
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

export const refreshSettings = async (ctx: any, chain: string, markup: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, await getBotGeneralConfiguration(telegramId, chain, markup), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, markup)
		});
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokePrevSettingsChain = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/settings prev chain');

		await updateChatId(telegramId, ctx.chat.id);

		const newChain = await selectOtherChain(chain, true);
		await selectChain(telegramId, newChain)
		await refreshSettings(ctx, newChain, 'general');
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeNextSettingsChain = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/settings next chain');

		await updateChatId(telegramId, ctx.chat.id);

		const newChain = await selectOtherChain(chain, false);
		await selectChain(telegramId, newChain)
		await refreshSettings(ctx, newChain, 'general');
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const invokeToggleAntiRugSettings = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/settings toggle anti-rug');

		await updateChatId(telegramId, ctx.chat.id);

		const fItem = await getSettings(telegramId, chain)
		await updateSettingsInfo(telegramId, chain, {
			antiRug: fItem.antiRug === true ? false : true
		})

		await refreshSettings(ctx, chain, 'general');
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const invokeToggleAntiMEVSettings = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/settings toggle anti-MEV');

		await updateChatId(telegramId, ctx.chat.id);

		const fItem = await getSettings(telegramId, chain)
		await updateSettingsInfo(telegramId, chain, {
			antiMEV: fItem.antiMEV === true ? false : true
		})

		await refreshSettings(ctx, chain, 'general');
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const invokeToggleSmartSlippageSettings = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/settings toggle smart slippage');

		await updateChatId(telegramId, ctx.chat.id);

		const fItem = await getSettings(telegramId, chain)
		await updateSettingsInfo(telegramId, chain, {
			smartSlippage: fItem.smartSlippage === true ? false : true
		})

		await refreshSettings(ctx, chain, 'general');
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const invokeBuySettings = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/settings buy');

		await updateChatId(telegramId, ctx.chat.id);

		await refreshSettings(ctx, chain, 'buy');
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const invokeSellSettings = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/settings sell');

		await updateChatId(telegramId, ctx.chat.id);

		await refreshSettings(ctx, chain, 'sell');
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const invokeApproveSettings = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/settings approve');

		await updateChatId(telegramId, ctx.chat.id);

		await refreshSettings(ctx, chain, 'approve');
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const invokeToggleBuyDupeBuySettings = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/settings toggle buy dupe buy');

		await updateChatId(telegramId, ctx.chat.id);

		const fItem = await getSettings(telegramId, chain)
		await updateSettingsInfo(telegramId, chain, {
			buyDupeBuy: fItem.buyDupeBuy === true ? false : true
		})

		await refreshSettings(ctx, chain, 'buy');
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const invokeToggleBuyAutoBuySettings = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/settings toggle buy auto buy');

		await updateChatId(telegramId, ctx.chat.id);

		const fItem = await getSettings(telegramId, chain)
		await updateSettingsInfo(telegramId, chain, {
			buyAutoBuy: fItem.buyAutoBuy === true ? false : true
		})

		await refreshSettings(ctx, chain, 'buy');
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const invokeToggleSellConfirmTradeSellSettings = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/settings toggle sell confirm trade sell');

		await updateChatId(telegramId, ctx.chat.id);

		const fItem = await getSettings(telegramId, chain)
		await updateSettingsInfo(telegramId, chain, {
			sellConfirmTradeSell: fItem.sellConfirmTradeSell === true ? false : true
		})

		await refreshSettings(ctx, chain, 'sell');
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const invokeToggleSellAutoSellSettings = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/settings toggle sell auto sell');

		await updateChatId(telegramId, ctx.chat.id);

		const fItem = await getSettings(telegramId, chain)
		await updateSettingsInfo(telegramId, chain, {
			sellAutoSell: fItem.sellAutoSell === true ? false : true
		})

		await refreshSettings(ctx, chain, 'sell');
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const invokeToggleSellTrailingSellSettings = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/settings toggle sell trailing sell');

		await updateChatId(telegramId, ctx.chat.id);

		const fItem = await getSettings(telegramId, chain)
		await updateSettingsInfo(telegramId, chain, {
			sellTrailingSell: fItem.sellTrailingSell === true ? false : true
		})

		await refreshSettings(ctx, chain, 'sell');
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const invokeToggleApproveAutoSettings = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/settings toggle approve auto');

		await updateChatId(telegramId, ctx.chat.id);

		const fItem = await getSettings(telegramId, chain)
		await updateSettingsInfo(telegramId, chain, {
			approveAuto: fItem.approveAuto === true ? false : true
		})

		await refreshSettings(ctx, chain, 'approve');
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}


const invokeSettingsGasPresets = async (ctx: any) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		if (ctx.update?.message?.text === undefined) {
			await ctx.deleteMessage();
		}
	} catch { }

	try {
		await userVerboseLog(telegramId, '/presets');

		await updateChatId(telegramId, ctx.chat.id);
		const chain = await getSelectedChain(telegramId)
		await ctx.telegram.sendMessage(ctx.chat.id, await getBotPresetMessage(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getBotGasPresetsMarkup(telegramId, chain)
		});
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

export const refreshSettingsGasPresets = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, await getBotPresetMessage(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getBotGasPresetsMarkup(telegramId, chain)
		});
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokePrevSettingsGasPresetsChain = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/presets prev chain');

		await updateChatId(telegramId, ctx.chat.id);

		const newChain = await selectOtherChain(chain, true);
		await refreshSettingsGasPresets(ctx, newChain);
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const invokeNextSettingsGasPresetsChain = async (ctx: any, chain: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, '/presets next chain');

		await updateChatId(telegramId, ctx.chat.id);

		const newChain = await selectOtherChain(chain, false);
		await refreshSettingsGasPresets(ctx, newChain);
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

const invokeGasPresetSettings = async (ctx: any, chain: string, preset: string) => {
	// ctx.update.callback_query.from

	const telegramId = ctx.from.id;

	try {
		await userVerboseLog(telegramId, `/presets set to [${preset}]`);

		await updateChatId(telegramId, ctx.chat.id);

		const fItem = await getSettings(telegramId, chain)
		await updateSettingsInfo(telegramId, chain, {
			gasPreset: preset
		})

		await refreshSettingsGasPresets(ctx, chain);
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
}

// const invokeLotusSettings = async (ctx: any) => {
// 	// ctx.update.callback_query.from

// 	const telegramId = ctx.from.id;

// 	try {
// 		if (ctx.update?.message?.text === undefined) {
// 			await ctx.deleteMessage();
// 		}
// 	} catch { }

// 	try {
// 		await userVerboseLog(telegramId, '/lotus_settings');

// 		await updateChatId(telegramId, ctx.chat.id);
// 		const chain = await getSelectedChain(telegramId)
// 		await ctx.telegram.sendMessage(ctx.chat.id, await getLotusSettingText(telegramId, chain), {
// 			parse_mode: botEnum.PARSE_MODE_V2,
// 			reply_markup: await getLotusSettingsMarkup(telegramId, chain)
// 		});
// 	} catch (err) {
// 		await processError(ctx, telegramId, err);
// 	}
// };

// export const refreshLotusSettings = async (ctx: any, chain: string) => {
// 	// ctx.update.callback_query.from

// 	const telegramId = ctx.from.id;

// 	try {
// 		await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, await getLotusSettingText(telegramId, chain), {
// 			parse_mode: botEnum.PARSE_MODE_V2,
// 			reply_markup: await getLotusSettingsMarkup(telegramId, chain)
// 		});
// 	} catch (err) {
// 		await processError(ctx, telegramId, err);
// 	}
// };

module.exports = (bot: any) => {
	bot.command(botEnum.settings.value, invokeSettings)
	bot.action(botEnum.settings.value, invokeSettings)
	// bot.action(botEnum.lotus.value, invokeLotusSettings)

	bot.action(RegExp('^' + botEnum.prevSettingsChain.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.prevSettingsChain.value.length + 1)
		await invokePrevSettingsChain(ctx, chain)
	})
	bot.action(RegExp('^' + botEnum.nextSettingsChain.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.nextSettingsChain.value.length + 1)
		await invokeNextSettingsChain(ctx, chain)
	})

	bot.action(RegExp('^' + botEnum.settingsAntiMEV.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsAntiMEV.value.length + 1)
		await invokeToggleAntiMEVSettings(ctx, chain)
	})

	bot.action(RegExp('^' + botEnum.settingsAntiRug.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsAntiRug.value.length + 1)
		await invokeToggleAntiRugSettings(ctx, chain)
	})

	bot.action(RegExp('^' + botEnum.settingsSmartSlippage.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSmartSlippage.value.length + 1)
		await invokeToggleSmartSlippageSettings(ctx, chain)
	})

	bot.action(RegExp('^' + botEnum.settingsBuy.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuy.value.length + 1)
		await invokeBuySettings(ctx, chain)
	})

	bot.action(RegExp('^' + botEnum.settingsSell.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSell.value.length + 1)
		await invokeSellSettings(ctx, chain)
	})

	bot.action(RegExp('^' + botEnum.settingsApprove.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsApprove.value.length + 1)
		await invokeApproveSettings(ctx, chain)
	})

	bot.action(RegExp('^' + botEnum.settingsMaxGasPrice.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsMaxGasPrice.value.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'max-gas-price', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsMaxGasPriceRemove.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsMaxGasPriceRemove.value.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'max-gas-price-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsSlippage.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSlippage.value.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'slippage', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsSlippageRemove.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSlippageRemove.value.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'slippage-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsMaxGasLimit.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsMaxGasLimit.value.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'max-gas-limit', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsMaxGasLimitRemove.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsMaxGasLimitRemove.value.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'max-gas-limit-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsBuyDupeBuy + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyDupeBuy.length + 1)
		await invokeToggleBuyDupeBuySettings(ctx, chain)
	})

	bot.action(RegExp('^' + botEnum.settingsBuyAutoBuy + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyAutoBuy.length + 1)
		await invokeToggleBuyAutoBuySettings(ctx, chain)
	})

	bot.action(RegExp('^' + botEnum.settingsBuyMaxMC + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyMaxMC.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'buy-max-marketcap', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsBuyMaxMCRemove + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyMaxMCRemove.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'buy-max-marketcap-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsBuyMinLiquidity + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyMinLiquidity.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'buy-min-liquidity', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsBuyMinLiquidityRemove + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyMinLiquidityRemove.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'buy-min-liquidity-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsBuyMaxLiquidity + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyMaxLiquidity.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'buy-max-liquidity', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsBuyMaxLiquidityRemove + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyMaxLiquidityRemove.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'buy-max-liquidity-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsBuyMinMCLiq + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyMinMCLiq.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'buy-min-marketcap-liquidity', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsBuyMinMCLiqRemove + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyMinMCLiqRemove.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'buy-min-marketcap-liquidity-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsBuyMaxBuyTax + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyMaxBuyTax.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'buy-max-buy-tax', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsBuyMaxBuyTaxRemove + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyMaxBuyTaxRemove.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'buy-max-buy-tax-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsBuyMaxSellTax + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyMaxSellTax.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'buy-max-sell-tax', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsBuyMaxSellTaxRemove + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyMaxSellTaxRemove.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'buy-max-sell-tax-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsBuyGasPrice + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyGasPrice.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'buy-gas-price', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsBuyGasPriceRemove + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsBuyGasPriceRemove.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'buy-gas-price-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsSellConfirmTradeSell + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSellConfirmTradeSell.length + 1)
		await invokeToggleSellConfirmTradeSellSettings(ctx, chain)
	})

	bot.action(RegExp('^' + botEnum.settingsSellAutoSell + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSellAutoSell.length + 1)
		await invokeToggleSellAutoSellSettings(ctx, chain)
	})

	bot.action(RegExp('^' + botEnum.settingsSellTrailingSell + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSellTrailingSell.length + 1)
		await invokeToggleSellTrailingSellSettings(ctx, chain)
	})

	bot.action(RegExp('^' + botEnum.settingsSellHighPrice + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSellHighPrice.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'sell-high-price', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsSellHighPriceRemove + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSellHighPriceRemove.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'sell-high-price-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsSellLowPrice + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSellLowPrice.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'sell-low-price', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsSellLowPriceRemove + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSellLowPriceRemove.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'sell-low-price-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsSellHighAmount + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSellHighAmount.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'sell-high-amount', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsSellHighAmountRemove + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSellHighAmountRemove.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'sell-high-amount-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsSellLowAmount + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSellLowAmount.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'sell-low-amount', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsSellLowAmountRemove + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSellLowAmountRemove.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'sell-low-amount-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsSellGasPrice + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSellGasPrice.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'sell-gas-price', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsSellGasPriceRemove + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsSellGasPriceRemove.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'sell-gas-price-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsApproveAuto + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsApproveAuto.length + 1)
		await invokeToggleApproveAutoSettings(ctx, chain)
	})

	bot.action(RegExp('^' + botEnum.settingsApproveGasPrice + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsApproveGasPrice.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'approve-gas-price', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.action(RegExp('^' + botEnum.settingsApproveGasPriceRemove + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsApproveGasPriceRemove.length + 1)
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'approve-gas-price-remove', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})

	bot.command(botEnum.gasPresets.value, invokeSettingsGasPresets)
	bot.action(botEnum.gasPresets.value, invokeSettingsGasPresets)
	bot.action(RegExp('^' + botEnum.prevSettingsGasPresetChain.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.prevSettingsGasPresetChain.value.length + 1)
		await invokePrevSettingsGasPresetsChain(ctx, chain)
	})
	bot.action(RegExp('^' + botEnum.nextSettingsGasPresetChain.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.nextSettingsGasPresetChain.value.length + 1)
		await invokeNextSettingsGasPresetsChain(ctx, chain)
	})

	bot.action(RegExp('^' + botEnum.settingsGasPresetSlow.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsGasPresetSlow.value.length + 1)
		await invokeGasPresetSettings(ctx, chain, "slow")
	})

	bot.action(RegExp('^' + botEnum.settingsGasPresetAverage.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsGasPresetAverage.value.length + 1)
		await invokeGasPresetSettings(ctx, chain, "avg")
	})

	bot.action(RegExp('^' + botEnum.settingsGasPresetFast.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsGasPresetFast.value.length + 1)
		await invokeGasPresetSettings(ctx, chain, "fast")
	})

	bot.action(RegExp('^' + botEnum.settingsGasPresetMaxSpeed.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.settingsGasPresetMaxSpeed.value.length + 1)
		await invokeGasPresetSettings(ctx, chain, "max")
	})

	bot.action(RegExp('^' + botEnum.lotusDefaultBuyETHAmount.value + '_.+'), async (ctx: any) => {
		const chain = ctx.update.callback_query.data.slice(botEnum.lotusDefaultBuyETHAmount.value.length + 1)
		try {
			await ctx.answerCbQuery()
		} catch { }
		await ctx.scene.enter(SETTINGS_LISTENER, { input_type: 'lotus-default-buy-eth-amount', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
	})
};
