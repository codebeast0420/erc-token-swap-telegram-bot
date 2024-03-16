import { botEnum } from "../../../constants/botEnum"
import { CopyTradeModel } from "../../../models/copytrade.model"
import { userVerboseLog } from "../../../service/app.user.service"
import { chainGasPrice } from "../../../service/chain.service"
import { getCopyTradeDetail, getCopyTradeDetailMarkup, getCopyTradeText, registerNewCopyTradeAddress, updateCopyTradeAddress } from "../../../service/copytrade.service"
import { processError } from "../../../service/error"
import { ISceneResponse, SceneStageService } from "../../../service/scene.stage.service"
import { COPY_TRADE_LISTENER, INVALID_VALUE_SET } from "../../../utils/common"
import { getCopyTradeMarkup } from "../../../utils/inline.markups"
import Logging from "../../../utils/logging"
import { getNativeCurrencySymbol } from "../../../web3/chain.parameters"

export class CopyTradeListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`CopyTradeListener.class processing scene message [${text}]`)
        const context = JSON.parse(sceneContext.scene.text)

        try {
            if (context.inputType === 'copytrade-new-name') {
                await processCopyTradeNewName(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'copytrade-new-address') {
                await processCopyTradeNewAddress(telegramId, text.toLowerCase(), ctx, context)
            }
            else if (context.inputType === 'copytrade-rename') {
                await processCopyTradeRename(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'copytrade-buy-amount') {
                await processCopyTradeBuyAmount(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'copytrade-buy-slippage') {
                await processCopyTradeBuySlippage(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'copytrade-buy-gas-price') {
                await processCopyTradeBuyGasPrice(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'copytrade-max-buy-tax') {
                await processCopyTradeMaxBuyTax(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'copytrade-max-sell-tax') {
                await processCopyTradeMaxSellTax(telegramId, text, ctx, context)
            }
        }
        catch (err) {
            await processError(ctx, telegramId, err)
        }
    }
}

async function processCopyTradeNewName(telegramId: string, text: string, ctx: any, context: any) {
    context.name = text;
    context.inputType = 'copytrade-new-address'
    await ctx.scene.enter(COPY_TRADE_LISTENER, { input_type: 'copytrade-new-address', msgId: context.msgId, chain: context.chain });
    await new SceneStageService().saveScene(telegramId, COPY_TRADE_LISTENER, JSON.stringify(context), new Date());
    return false;
}

async function processCopyTradeNewAddress(telegramId: string, text: string, ctx: any, context: any) {
    const chain = context.chain

    if (true !== text.toLowerCase().startsWith('0x')) {
        throw new Error(INVALID_VALUE_SET + `\nPlease input correct token address`);
    }

    await registerNewCopyTradeAddress(telegramId, chain, context.name, text.toLowerCase());

    await userVerboseLog(telegramId, `/copytrade new address`)

    const newText = await getCopyTradeText(telegramId, chain)
    await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, undefined, newText,{parse_mode: botEnum.PARSE_MODE_V2})
    await ctx.telegram.editMessageReplyMarkup(ctx.chat.id, context.msgId, undefined, await getCopyTradeMarkup(telegramId, chain))

    await new SceneStageService().deleteScene(telegramId)
}

async function processCopyTradeRename(telegramId: string, text: string, ctx: any, context: any) {
    await updateCopyTradeAddress(context.copyTradeId, { name: text })
    const copyTradeDB = await CopyTradeModel.findById(context.copyTradeId)
    await userVerboseLog(telegramId, `/copytrade rename to ${text} [${context.copyTradeId}]`)
    await ctx.telegram.editMessageReplyMarkup(ctx.chat.id, context.msgId, undefined, await getCopyTradeMarkup(telegramId, copyTradeDB.chain))
}

async function processCopyTradeBuyAmount(telegramId: string, text: string, ctx: any, context: any) {
    const amount = parseFloat(text)
    const pindex = text.indexOf('%')

    const copyTradeDB = await CopyTradeModel.findById(context.copyTradeId)
    const nativeSymbol = await getNativeCurrencySymbol(copyTradeDB.chain)

    if (isNaN(amount) || amount < 0) {
        if (pindex < 0) {
            throw new Error(INVALID_VALUE_SET + `\n<b>${nativeSymbol}</b> amount should not be negative.`)
        } else if (amount > 100) {
            throw new Error(INVALID_VALUE_SET + `\nPercentage should be <b>between 0</b>% and <b>100</b>%`)
        }
    }
    const valueToSet = pindex < 0 ? amount.toString() : amount.toString() + '%'
    await updateCopyTradeAddress(context.copyTradeId, { autoBuyAmount: valueToSet })

    const t = await getCopyTradeDetail(context.copyTradeId)

    await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t, {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: await getCopyTradeDetailMarkup(context.copyTradeId)
    });

    await userVerboseLog(telegramId, `/copytrade buy amount to ${valueToSet} [${context.copyTradeId}]`)

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Copytrade <code>${copyTradeDB.name}</code> Buy Amount set to <b>${valueToSet}</b>`, {
        parse_mode: botEnum.PARSE_MODE_V2
    })
}

async function processCopyTradeBuySlippage(telegramId: string, text: string, ctx: any, context: any) {
    const amount = parseFloat(text)
    const pindex = text.indexOf('%')

    const copyTradeDB = await CopyTradeModel.findById(context.copyTradeId)

    if (pindex < 0) {
        throw new Error(INVALID_VALUE_SET + '\nNot %')
    }

    if (isNaN(amount) || amount < 0 || amount > 100) {
        throw new Error(INVALID_VALUE_SET + `\nPercentage should be <b>between 0</b>% and <b>100</b>%`)
    }

    await updateCopyTradeAddress(context.copyTradeId, { autoBuySlippage: amount })
    await userVerboseLog(telegramId, `/copytrade buy slippage to ${amount} [${context.copyTradeId}]`)

    const t = await getCopyTradeDetail(context.copyTradeId)

    await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t, {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: await getCopyTradeDetailMarkup(context.copyTradeId)
    });

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Copytrade <code>${copyTradeDB.name}</code> Buy Slippage set to <b>${amount}</b>%`, {
        parse_mode: botEnum.PARSE_MODE_V2,
    })
}

async function processCopyTradeBuyGasPrice(telegramId: string, text: string, ctx: any, context: any) {
    const amount = parseFloat(text)

    const copyTradeDB = await CopyTradeModel.findById(context.copyTradeId)
    const minGasPrice = copyTradeDB.chain === 'ethereum' ? 0 : parseFloat(await chainGasPrice(copyTradeDB.chain))

    if (isNaN(amount) || amount < minGasPrice) {
        throw new Error(INVALID_VALUE_SET + `\nMinimum gas ${copyTradeDB.chain === 'ethereum' ? 'delta' : 'price'} is <b>${minGasPrice}</b>`)
    }

    await updateCopyTradeAddress(context.copyTradeId, { autoBuyGasPrice: amount })
    await userVerboseLog(telegramId, `/copytrade buy gas price to ${amount} [${context.copyTradeId}]`)

    const t = await getCopyTradeDetail(context.copyTradeId)

    await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t, {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: await getCopyTradeDetailMarkup(context.copyTradeId)
    });

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Copytrade <code>${copyTradeDB.name}</code> Buy Gas ${copyTradeDB.chain === 'ethereum' ? "Delta" : 'Price'} set to <b>${amount}</b>`, {
        parse_mode: botEnum.PARSE_MODE_V2
    })
}

async function processCopyTradeMaxBuyTax(telegramId: string, text: string, ctx: any, context: any) {
    const amount = parseFloat(text)

    const copyTradeDB = await CopyTradeModel.findById(context.copyTradeId)

    if (isNaN(amount) || amount < 0 || amount > 100) {
        throw new Error(INVALID_VALUE_SET + `\nPercentage should be between <b>between 0</b>% and <b>100</b>%`)
    }

    await updateCopyTradeAddress(context.copyTradeId, { maxBuyTax: amount.toString() })
    await userVerboseLog(telegramId, `/copytrade max buy tax to ${amount} [${context.copyTradeId}]`)

    const t = await getCopyTradeDetail(context.copyTradeId)

    await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t, {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: await getCopyTradeDetailMarkup(context.copyTradeId)
    });

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Copytrade <code>${copyTradeDB.name}</code> Buy Tax set to <b>${amount}</b>%`, {
        parse_mode: botEnum.PARSE_MODE_V2
    })
}

async function processCopyTradeMaxSellTax(telegramId: string, text: string, ctx: any, context: any) {
    const amount = parseFloat(text)

    const copyTradeDB = await CopyTradeModel.findById(context.copyTradeId)

    if (isNaN(amount) || amount < 0 || amount > 100) {
        throw new Error(INVALID_VALUE_SET + `\nPercentage should be between <b>between 0</b>% and <b>100</b>%`)
    }

    await updateCopyTradeAddress(context.copyTradeId, { maxSellTax: amount.toString() })
    await userVerboseLog(telegramId, `/copytrade max sell tax to ${amount} [${context.copyTradeId}]`)

    const t = await getCopyTradeDetail(context.copyTradeId)

    await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, t, {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: await getCopyTradeDetailMarkup(context.copyTradeId)
    });

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Copytrade <code>${copyTradeDB.name}</code> Sell Tax set to <b>${amount}</b>%`, {
        parse_mode: botEnum.PARSE_MODE_V2
    })
}
