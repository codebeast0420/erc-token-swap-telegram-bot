import { botEnum } from "../../../constants/botEnum"
import { AutoSellTokenModel } from "../../../models/auto.sell.token"
import { userVerboseLog } from "../../../service/app.user.service"
import { getTokenAutoSellContext, updateTokenAutoSellContext } from "../../../service/autosell.service"
import { processError } from "../../../service/error"
import { ISceneResponse, SceneStageService } from "../../../service/scene.stage.service"
import { getTrackText } from "../../../service/track.service"
import { INVALID_VALUE_SET, convertValue } from "../../../utils/common"
import { getTrackMarkup } from "../../../utils/inline.markups"
import Logging from "../../../utils/logging"
import { getNativeCurrencySymbol } from "../../../web3/chain.parameters"
import { getBN } from "../../../web3/web3.operation"

export class AutoSellListener {
	public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
		Logging.info(`AutoSellListener.class processing scene message [${text}]`)
		const context = JSON.parse(sceneContext.scene.text)

		try {
			if (context.inputType === 'auto-sell-low-price-percentage') {
				await processAutoSellLowPricePercentage(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'auto-sell-low-price-usd') {
				await processAutoSellLowPriceUsd(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'auto-sell-low-price-marketcap') {
				await processAutoSellLowPriceMarketCap(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'auto-sell-high-price-percentage') {
				await processAutoSellHighPricePercentage(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'auto-sell-high-price-usd') {
				await processAutoSellHighPriceUsd(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'auto-sell-high-price-marketcap') {
				await processAutoSellHighPriceMarketCap(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'auto-sell-amount-low-price') {
				await processAutoSellAmountLowPrice(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'auto-sell-amount-high-price') {
				await processAutoSellAmountHighPrice(telegramId, text, ctx, context)
			}
		}
		catch (err) {
			await processError(ctx, telegramId, err)
		}
	}
}

async function processAutoSellLowPricePercentage(telegramId: string, text: string, ctx: any, context: any) {
	const idx = text.indexOf('%');
	if (idx < 0) throw new Error(INVALID_VALUE_SET + '\nNot %');

	const p = text.slice(0, idx);
	const percentage = parseFloat(p);

	if (isNaN(percentage) || percentage < -100 || percentage > 0) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET +
			'\nThe value you entered resulted in an unsuitable sell percentage. The percentage needs to be between <b>-100%</b> and <b>0.00%</b> (your P/L). Please choose another value.'
		);
	}

	const autoSellCtx = await AutoSellTokenModel.findById(context.autoSellId)
	const chain = autoSellCtx.chain
	const t = await getTrackText(telegramId, chain, autoSellCtx.token)

	await updateTokenAutoSellContext(telegramId, chain, autoSellCtx.token, {
		lowPriceLimit: percentage.toString() + '%'
	});

	await userVerboseLog(telegramId, `${autoSellCtx.token} auto sell low price set to ${percentage.toString() + '%'}`);

	await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t.text, {
		parse_mode: botEnum.PARSE_MODE_V2,
		reply_markup: await getTrackMarkup(telegramId, chain, autoSellCtx.token, '')
	});

	await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set low price to <b>${percentage.toString()}%</b>`, { parse_mode: botEnum.PARSE_MODE_V2 })

	await new SceneStageService().deleteScene(telegramId)
}

async function processAutoSellLowPriceUsd(telegramId: string, text: string, ctx: any, context: any) {
	const autoSellCtx = await AutoSellTokenModel.findById(context.autoSellId)
	const chain = autoSellCtx.chain
	const t = await getTrackText(telegramId, chain, autoSellCtx.token)

	const info = await getTokenAutoSellContext(telegramId, chain, autoSellCtx.token)

	const value = parseFloat(text)

	if (isNaN(value) || value <= 0 || value >= parseFloat(info.priceStamp)) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nPlease input lower than <b>${parseFloat(info.priceStamp)}</b>`);
	}

	await updateTokenAutoSellContext(telegramId, chain, autoSellCtx.token, {
		lowPriceLimit: value.toString()
	});

	await userVerboseLog(telegramId, `${autoSellCtx.token} auto sell low price set to ${value.toString()}$`);

	await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t.text, {
		parse_mode: botEnum.PARSE_MODE_V2,
		reply_markup: await getTrackMarkup(telegramId, chain, autoSellCtx.token, '')
	});

	await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set low price to <b>${value.toString()}$</b>`, { parse_mode: botEnum.PARSE_MODE_V2 })

	await new SceneStageService().deleteScene(telegramId)
}

async function processAutoSellLowPriceMarketCap(telegramId: string, text: string, ctx: any, context: any) {
	const BN = getBN()
	const autoSellCtx = await AutoSellTokenModel.findById(context.autoSellId)
	const chain = autoSellCtx.chain
	const t = await getTrackText(telegramId, chain, autoSellCtx.token)

	const info = await getTokenAutoSellContext(telegramId, chain, autoSellCtx.token)

	const price = parseFloat(info.priceStamp)
	const mc = parseFloat(t.tokenInfo.totalSupply) * price;

	const value = convertValue(mc.toString(), text, BN);
	if (isNaN(price) || price === 0) throw new Error(INVALID_VALUE_SET + '\nInvalid auto sell reference price');

	if (isNaN(value) || value <= 0 || value >= mc) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nPlease input lower than <b>${mc}$</b>`);
	}

	const percentage = Math.floor(((value - mc) * 10000) / mc) / 100;

	await updateTokenAutoSellContext(telegramId, chain, autoSellCtx.token, {
		lowPriceLimit: percentage.toString() + '%'
	});

	await userVerboseLog(telegramId, `${autoSellCtx.token} auto sell low price set to ${percentage.toString() + '%'} by marketcap`);

	await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t.text, {
		parse_mode: botEnum.PARSE_MODE_V2,
		reply_markup: await getTrackMarkup(telegramId, chain, autoSellCtx.token, '')
	});

	await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set low price to <b>${percentage.toString()}%</b> by marketcap`, { parse_mode: botEnum.PARSE_MODE_V2 })

	await new SceneStageService().deleteScene(telegramId)
}

async function processAutoSellHighPricePercentage(telegramId: string, text: string, ctx: any, context: any) {
	const idx = text.indexOf('%');
	if (idx < 0) throw new Error(INVALID_VALUE_SET + '\nNot %');

	const p = text.slice(0, idx);
	const percentage = parseFloat(p);

	if (percentage < 0) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET +
			'\nThe value you entered resulted in an unsuitable sell percentage. The percentage needs to be greater than <b>0.00%</b> (your P/L). Please choose another value.'
		);
	}

	const autoSellCtx = await AutoSellTokenModel.findById(context.autoSellId)
	const chain = autoSellCtx.chain
	const t = await getTrackText(telegramId, chain, autoSellCtx.token)

	await updateTokenAutoSellContext(telegramId, chain, autoSellCtx.token, {
		highPriceLimit: percentage.toString() + '%'
	});

	await userVerboseLog(telegramId, `${autoSellCtx.token} auto sell high price set to ${percentage.toString() + '%'}`);

	await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t.text, {
		parse_mode: botEnum.PARSE_MODE_V2,
		reply_markup: await getTrackMarkup(telegramId, chain, autoSellCtx.token, '')
	});

	await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set high price to <b>${percentage.toString()}%</b>`, { parse_mode: botEnum.PARSE_MODE_V2 })

	await new SceneStageService().deleteScene(telegramId)
}

async function processAutoSellHighPriceUsd(telegramId: string, text: string, ctx: any, context: any) {
	const autoSellCtx = await AutoSellTokenModel.findById(context.autoSellId)
	const chain = autoSellCtx.chain
	const t = await getTrackText(telegramId, chain, autoSellCtx.token)

	const info = await getTokenAutoSellContext(telegramId, chain, autoSellCtx.token)

	const value = parseFloat(text);

	if (value < parseFloat(info.priceStamp)) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nPlease input greater than or equal to <b>${parseFloat(info.priceStamp)}$</b>`);
	}

	await updateTokenAutoSellContext(telegramId, chain, autoSellCtx.token, {
		highPriceLimit: value.toString()
	});

	await userVerboseLog(telegramId, `${autoSellCtx.token} auto sell high price set to ${value.toString()}$`);

	await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t.text, {
		parse_mode: botEnum.PARSE_MODE_V2,
		reply_markup: await getTrackMarkup(telegramId, chain, autoSellCtx.token, '')
	});

	await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set high price to <b>${value.toString()}$</b>`, { parse_mode: botEnum.PARSE_MODE_V2 })

	await new SceneStageService().deleteScene(telegramId)
}

async function processAutoSellHighPriceMarketCap(telegramId: string, text: string, ctx: any, context: any) {
	const BN = getBN()
	const autoSellCtx = await AutoSellTokenModel.findById(context.autoSellId)
	const chain = autoSellCtx.chain
	const t = await getTrackText(telegramId, chain, autoSellCtx.token)

	const info = await getTokenAutoSellContext(telegramId, chain, autoSellCtx.token)

	const price = parseFloat(info.priceStamp);
	const mc = parseFloat(t.tokenInfo.totalSupply) * price;

	const value = convertValue(mc.toString(), text, BN);
	if (isNaN(price) || price === 0) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + '\nInvalid auto sell reference price');
	}

	if (value < mc) throw new Error(INVALID_VALUE_SET + `\nPlease input greater than or equal to <b>${mc}$</b>`);

	const percentage = Math.floor(((value - mc) * 10000) / mc) / 100;

	await updateTokenAutoSellContext(telegramId, chain, autoSellCtx.token, {
		highPriceLimit: percentage.toString() + '%'
	});

	await userVerboseLog(telegramId, `${autoSellCtx.token} auto sell high price set to ${percentage.toString() + '%'} by marketcap`);

	await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t.text, {
		parse_mode: botEnum.PARSE_MODE_V2,
		reply_markup: await getTrackMarkup(telegramId, chain, autoSellCtx.token, '')
	});

	await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set high price to <b>${percentage.toString()}%</b> by marketcap`, { parse_mode: botEnum.PARSE_MODE_V2 })

	await new SceneStageService().deleteScene(telegramId)
}

async function processAutoSellAmountLowPrice(telegramId: string, text: string, ctx: any, context: any) {
	const idx = text.indexOf('%');
	if (idx < 0) throw new Error(INVALID_VALUE_SET + '\nNot %');

	const p = text.slice(0, idx);
	const percentage = parseFloat(p);

	if (percentage < 0 || percentage > 100) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + '\nValue needs to be between <b>0% and 100%</b>.');
	}

	const autoSellCtx = await AutoSellTokenModel.findById(context.autoSellId)
	const chain = autoSellCtx.chain
	const t = await getTrackText(telegramId, chain, autoSellCtx.token)

	await updateTokenAutoSellContext(telegramId, chain, autoSellCtx.token, {
		amountAtLowPrice: percentage.toString() + '%'
	});

	await userVerboseLog(telegramId, `${autoSellCtx.token} auto sell amount at low price set to ${percentage.toString() + '%'}`);

	await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t.text, {
		parse_mode: botEnum.PARSE_MODE_V2,
		reply_markup: await getTrackMarkup(telegramId, chain, autoSellCtx.token, 'show-auto-sell-amount')
	});

	await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set amount at low price to <b>${percentage.toString()}%</b>`, { parse_mode: botEnum.PARSE_MODE_V2 })

	await new SceneStageService().deleteScene(telegramId)
}

async function processAutoSellAmountHighPrice(telegramId: string, text: string, ctx: any, context: any) {
	const idx = text.indexOf('%');
	if (idx < 0) throw new Error(INVALID_VALUE_SET + '\nNot %');

	const p = text.slice(0, idx);
	const percentage = parseFloat(p);

	if (percentage < 0 || percentage > 100) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + '\nValue needs to be between <b>0% and 100%</b>.');
	}

	const autoSellCtx = await AutoSellTokenModel.findById(context.autoSellId)
	const chain = autoSellCtx.chain
	const t = await getTrackText(telegramId, chain, autoSellCtx.token)

	await updateTokenAutoSellContext(telegramId, chain, autoSellCtx.token, {
		amountAtHighPrice: percentage.toString() + '%'
	});

	await userVerboseLog(telegramId, `${autoSellCtx.token} auto sell amount at high price set to ${percentage.toString() + '%'}`);

	await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t.text, {
		parse_mode: botEnum.PARSE_MODE_V2,
		reply_markup: await getTrackMarkup(telegramId, chain, autoSellCtx.token, 'show-auto-sell-amount')
	});

	await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set amount at high price to <b>${percentage.toString()}%</b>`, { parse_mode: botEnum.PARSE_MODE_V2 })

	await new SceneStageService().deleteScene(telegramId)
}
