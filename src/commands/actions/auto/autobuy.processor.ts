import { botEnum } from "../../../constants/botEnum"
import { AutoBuyTokenModel } from "../../../models/auto.buy.token"
import { userVerboseLog } from "../../../service/app.user.service"
import { getTokenAutoBuyContext, updateQuickAutoBuyParam, updateTokenAutoBuyContext } from "../../../service/autobuy.service"
import { chainGasPrice } from "../../../service/chain.service"
import { processError } from "../../../service/error"
import { ISceneResponse, SceneStageService } from "../../../service/scene.stage.service"
import { getTrackText } from "../../../service/track.service"
import { INVALID_VALUE_SET, convertValue } from "../../../utils/common"
import { getTrackMarkup, getQuickMarkup } from "../../../utils/inline.markups"
import Logging from "../../../utils/logging"
import { getQuickMessage } from "../../../utils/messages"
import { getNativeCurrencySymbol } from "../../../web3/chain.parameters"
import { userETHBalance } from "../../../web3/nativecurrency/nativecurrency.query"
import { getBN } from "../../../web3/web3.operation"

export class AutoBuyListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`AutoBuyListener.class processing scene message [${text}]`)
        const context = JSON.parse(sceneContext.scene.text)

        try {
            if (context.inputType === 'auto-buy-price-percentage') {
                await processAutoBuyPricePercentage(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'auto-buy-price-usd') {
                await processAutoBuyPriceUsd(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'auto-buy-price-marketcap') {
                await processAutoBuyPriceMarketCap(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'auto-buy-amount') {
                await processAutoBuyAmount(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'quick-auto-buy-amount') {
                await processQuickAutoBuyAmount(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'quick-auto-buy-gas-amount') {
                await processQuickAutoBuyGasAmount(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'quick-auto-buy-slippage') {
                await processQuickAutoBuySlippage(telegramId, text, ctx, context)
            }
        }
        catch (err) {
            await processError(ctx, telegramId, err)
        }
    }
}

async function processAutoBuyPricePercentage(telegramId: string, text: string, ctx: any, context: any) {
    const idx = text.indexOf('%');
    if (idx < 0) throw new Error(INVALID_VALUE_SET + '\nNot %');

    const p = text.slice(0, idx);
    const percentage = parseFloat(p);

    if (isNaN(percentage) || percentage < -100 || percentage > 0) {
        await new SceneStageService().deleteScene(telegramId)
        throw new Error(INVALID_VALUE_SET +
            '\nThe value you entered resulted in an unsuitable buy percentage. The percentage needs to be between <b>-100%</b> and <b>0.00%</b> (your P/L). Please choose another value.'
        );
    }

    const autoBuyCtx = await AutoBuyTokenModel.findById(context.autoBuyId)
    const chain = autoBuyCtx.chain
    const t = await getTrackText(telegramId, chain, autoBuyCtx.token)

    await updateTokenAutoBuyContext(telegramId, chain, autoBuyCtx.token, {
        priceLimit: percentage.toString() + '%'
    });

    await userVerboseLog(telegramId, `${autoBuyCtx.token} auto buy price set to ${percentage.toString() + '%'}`);

    await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t.text, {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: await getTrackMarkup(telegramId, chain, autoBuyCtx.token, '')
    });

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set buy price to <b>${percentage.toString()}%</b>`, { parse_mode: botEnum.PARSE_MODE_V2 })

    await new SceneStageService().deleteScene(telegramId)
}

async function processAutoBuyPriceUsd(telegramId: string, text: string, ctx: any, context: any) {
    const autoBuyCtx = await AutoBuyTokenModel.findById(context.autoBuyId)
    const chain = autoBuyCtx.chain
    const t = await getTrackText(telegramId, chain, autoBuyCtx.token)

    const info = await getTokenAutoBuyContext(telegramId, chain, autoBuyCtx.token)

    const value = parseFloat(text);

    if (isNaN(value) || value <= 0 || value >= parseFloat(info.priceStamp)) {
        await new SceneStageService().deleteScene(telegramId)
        throw new Error(INVALID_VALUE_SET + `\nPlease input lower than <b>$${parseFloat(info.priceStamp)}</b>`)
    }

    await updateTokenAutoBuyContext(telegramId, chain, autoBuyCtx.token, {
        priceLimit: value.toString()
    });

    await userVerboseLog(telegramId, `${autoBuyCtx.token} auto buy price set to ${value.toString() + '$'}`);

    await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t.text, {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: await getTrackMarkup(telegramId, chain, autoBuyCtx.token, '')
    });

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set buy price to <b>${value.toString()}$</b>`, { parse_mode: botEnum.PARSE_MODE_V2 })

    await new SceneStageService().deleteScene(telegramId)
}

async function processAutoBuyPriceMarketCap(telegramId: string, text: string, ctx: any, context: any) {
    const BN = getBN()
    const autoBuyCtx = await AutoBuyTokenModel.findById(context.autoBuyId)
    const chain = autoBuyCtx.chain
    const t = await getTrackText(telegramId, chain, autoBuyCtx.token)

    const info = await getTokenAutoBuyContext(telegramId, chain, autoBuyCtx.token)

    const price = parseFloat(info.priceStamp);
    const mc = parseFloat(t.tokenInfo.totalSupply) * price;

    const value = convertValue(mc.toString(), text, BN);
    if (isNaN(price) || price === 0) throw new Error(INVALID_VALUE_SET + '\nInvalid auto buy reference price');

    if (isNaN(value) || value <= 0 || value >= mc) {
        await new SceneStageService().deleteScene(telegramId)
        throw new Error(INVALID_VALUE_SET + `\nPlease input lower than <b>$${mc}</b>`)
    }

    const percentage = Math.floor(((value - mc) * 10000) / mc) / 100;

    await updateTokenAutoBuyContext(telegramId, chain, autoBuyCtx.token, {
        priceLimit: percentage.toString() + '%'
    });

    await userVerboseLog(telegramId, `${autoBuyCtx.token} auto buy price set to ${percentage.toString() + '%'} by marketcap`);

    await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t.text, {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: await getTrackMarkup(telegramId, chain, autoBuyCtx.token, '')
    });

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set buy price to <b>${percentage.toString()}%</b> by marketcap`, { parse_mode: botEnum.PARSE_MODE_V2 })

    await new SceneStageService().deleteScene(telegramId)
}

async function processAutoBuyAmount(telegramId: string, text: string, ctx: any, context: any) {
    const idx = text.indexOf('%')

    const autoBuyCtx = await AutoBuyTokenModel.findById(context.autoBuyId)
    const chain = autoBuyCtx.chain
    const t = await getTrackText(telegramId, chain, autoBuyCtx.token)

    let amountAtLimit;
    if (idx >= 0) {
        const p = text.slice(0, idx);
        const percentage = parseFloat(p);

        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
            await new SceneStageService().deleteScene(telegramId)
            throw new Error(INVALID_VALUE_SET +
                '\nThe value you entered resulted in an unsuitable buy percentage. The percentage needs to be between <b>0%</b> and <b>100%</b> (your P/L). Please choose another value.'
            );
        }

        amountAtLimit = percentage.toString() + '%';
    } else {
        const value = parseFloat(text)
        const info = await getTokenAutoBuyContext(telegramId, chain, autoBuyCtx.token)
        const ethBal = await userETHBalance(telegramId, chain)

        if (isNaN(value) || value <= 0 || value >= ethBal) throw new Error(INVALID_VALUE_SET + `\nPlease input lower than or equal to <b>${ethBal}</b>`);

        amountAtLimit = value.toString();
    }

    await updateTokenAutoBuyContext(telegramId, chain, autoBuyCtx.token, {
        amountAtLimit: amountAtLimit
    });

    await userVerboseLog(telegramId, `${autoBuyCtx.token} auto buy amount set to ${amountAtLimit}`);

    await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t.text, {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: await getTrackMarkup(telegramId, chain, autoBuyCtx.token, '')
    });

    const nativeSymbol = await getNativeCurrencySymbol(chain)
    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set buy amount to <b>${amountAtLimit.toString()} ${nativeSymbol}</b>`, { parse_mode: botEnum.PARSE_MODE_V2 })

    await new SceneStageService().deleteScene(telegramId)
}

async function processQuickAutoBuyAmount(telegramId: string, text: string, ctx: any, context: any) {
    const idx = text.indexOf('%');

    const chain = context.chain

    let amountSet;
    if (idx >= 0) {
        const p = text.slice(0, idx);
        const percentage = parseFloat(p);

        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
            await new SceneStageService().deleteScene(telegramId)
            throw new Error(INVALID_VALUE_SET +
                '\nThe value you entered resulted in an unsuitable buy percentage. The percentage needs to be between <b>0%</b> and <b>100%</b> (your P/L). Please choose another value.'
            );
        }


        amountSet = percentage.toString() + '%';
    } else {
        const value = parseFloat(text);
        const ethBal = await userETHBalance(telegramId, chain);

        if (isNaN(value) || value <= 0 || value >= ethBal) throw new Error(INVALID_VALUE_SET + `\nPlease input lower than or equal to <b>${ethBal}</b>`);

        amountSet = value.toString();
    }

    await updateQuickAutoBuyParam(telegramId, chain, { amount: amountSet });

    await userVerboseLog(telegramId, `[${chain}] quick auto buy amount set to ${amountSet}`);

    const tMsg = await getQuickMessage(telegramId, chain)
    await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, tMsg, {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: await getQuickMarkup(telegramId, chain)
    });

    const nativeSymbol = await getNativeCurrencySymbol(chain)
    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set quick autobuy <b>${nativeSymbol}</b> amount to <b>${amountSet.toString()} ${nativeSymbol}</b>`, { parse_mode: botEnum.PARSE_MODE_V2 })

    await new SceneStageService().deleteScene(telegramId)
}

async function processQuickAutoBuyGasAmount(telegramId: string, text: string, ctx: any, context: any) {
    const chain = context.chain
    const gasPrice = chain === 'ethereum' ? '0' : await chainGasPrice(chain);

    const value = parseFloat(text);
    const BN = getBN();

    if (isNaN(value) || BN(value).lt(BN(gasPrice))) {
        await new SceneStageService().deleteScene(telegramId)
        throw new Error(INVALID_VALUE_SET + `\nPlease input greater than or equal to <b>${gasPrice}</b>`)
    }

    await updateQuickAutoBuyParam(telegramId, chain, { gasPrice: value });

    await userVerboseLog(telegramId, `[${chain}] quick auto buy gas price set to ${value}`);

    const tMsg = await getQuickMessage(telegramId, chain)
    await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, tMsg, {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: await getQuickMarkup(telegramId, chain)
    });

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set quick autobuy gas amount to <b>${value.toString()} GWEI</b>`, { parse_mode: botEnum.PARSE_MODE_V2 })

    await new SceneStageService().deleteScene(telegramId)
}

async function processQuickAutoBuySlippage(telegramId: string, text: string, ctx: any, context: any) {
    const chain = context.chain
    const value = parseFloat(text);
    if (isNaN(value) || value < 0 || value > 100) {
        await new SceneStageService().deleteScene(telegramId)
        throw new Error(INVALID_VALUE_SET + `\nPlease input between <b>0</b> and <b>100</b>`)
    }

    await updateQuickAutoBuyParam(telegramId, chain, { slippage: value });

    await userVerboseLog(telegramId, `[${chain}] quick auto buy slippage set to ${value}%`);

    const tMsg = await getQuickMessage(telegramId, chain)
    await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, tMsg, {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: await getQuickMarkup(telegramId, chain)
    });

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set quick autobuy slippage to <b>${value.toString()}%</b>`, { parse_mode: botEnum.PARSE_MODE_V2 })

    await new SceneStageService().deleteScene(telegramId)
}

