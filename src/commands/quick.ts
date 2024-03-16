import { botEnum } from '../constants/botEnum';
import { updateChatId, userVerboseLog } from '../service/app.user.service';
import { getQuickAutoBuyContext, updateQuickAutoBuyParam } from '../service/autobuy.service';
import { getSelectedChain, selectChain, selectOtherChain } from '../service/connected.chain.service';
import { processError } from '../service/error';
import { AUTO_BUY_LISTENER } from '../utils/common';
import { getQuickMarkup } from '../utils/inline.markups';
import { getQuickMessage } from '../utils/messages';

const invokeQuick = async (ctx: any) => {
    // ctx.update.callback_query.from

    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, '/quick');

        await updateChatId(telegramId, ctx.chat.id)
        const chain = await getSelectedChain(telegramId)
        const text = await getQuickMessage(telegramId, chain)
        await ctx.telegram.sendMessage(ctx.chat.id, text, {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: await getQuickMarkup(telegramId, chain)
        });
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

export const refreshQuick = async (ctx: any, chain: string) => {
    // ctx.update.callback_query.from

    const telegramId = ctx.from.id;

    try {
        const text = await getQuickMessage(telegramId, chain)
        await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, text, {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: await getQuickMarkup(telegramId, chain)
        });
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const invokePrevQuickChain = async (ctx: any, chain: string) => {
    // ctx.update.callback_query.from

    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, '/quick prev chain');

        await updateChatId(telegramId, ctx.chat.id)

        const prevChain = await selectOtherChain(chain, true)
        await selectChain(telegramId, prevChain)
        await refreshQuick(ctx, prevChain)
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const invokeNextQuickChain = async (ctx: any, chain: string) => {
    // ctx.update.callback_query.from

    const telegramId = ctx.from.id

    try {
        await userVerboseLog(telegramId, '/quick next chain')

        await updateChatId(telegramId, ctx.chat.id)

        const nextChain = await selectOtherChain(chain, false)
        await selectChain(telegramId, nextChain)
        await refreshQuick(ctx, nextChain)
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const invokeToggleMultiQuick = async (ctx: any, chain: string) => {
    // ctx.update.callback_query.from

    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, '/quick toggle multi-wallets');

        await updateChatId(telegramId, ctx.chat.id);

        const item = await getQuickAutoBuyContext(telegramId, chain);

        await updateQuickAutoBuyParam(telegramId, chain, {
            multi: item.multi === true ? false : true
        })

        await refreshQuick(ctx, chain)
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const invokeToggleSmartSlippageQuick = async (ctx: any, chain: string) => {
    // ctx.update.callback_query.from

    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, '/quick toggle smart-slippage');

        await updateChatId(telegramId, ctx.chat.id);

        const item = await getQuickAutoBuyContext(telegramId, chain)

        await updateQuickAutoBuyParam(telegramId, chain, {
            smartSlippage: item.smartSlippage === true ? false : true
        });

        await refreshQuick(ctx, chain)
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const invokeToggleEnabledQuick = async (ctx: any, chain: string) => {
    // ctx.update.callback_query.from

    const telegramId = ctx.from.id

    try {
        await userVerboseLog(telegramId, '/quick toggle enabled')
        await updateChatId(telegramId, ctx.chat.id)

        const item = await getQuickAutoBuyContext(telegramId, chain)

        await updateQuickAutoBuyParam(telegramId, chain, {
            enabled: item.enabled === true ? false : true
        });

        await refreshQuick(ctx, chain)
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const removeBuyGasQuick = async (ctx: any, chain: string) => {
    // ctx.update.callback_query.from

    const telegramId = ctx.from.id

    try {
        await userVerboseLog(telegramId, '/quick remove gas price')
        await updateChatId(telegramId, ctx.chat.id)

        const item = await getQuickAutoBuyContext(telegramId, chain)

        await updateQuickAutoBuyParam(telegramId, chain, {
            gasPrice: undefined
        });

        await refreshQuick(ctx, chain)
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const removeBuySlippageQuick = async (ctx: any, chain: string) => {
    // ctx.update.callback_query.from

    const telegramId = ctx.from.id

    try {
        await userVerboseLog(telegramId, '/quick remove gas price')
        await updateChatId(telegramId, ctx.chat.id)

        const item = await getQuickAutoBuyContext(telegramId, chain)

        await updateQuickAutoBuyParam(telegramId, chain, {
            slippage: undefined
        });

        await refreshQuick(ctx, chain)
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

module.exports = (bot: any) => {
    bot.command(botEnum.quick.value, invokeQuick)
    bot.action(botEnum.quick.value, invokeQuick)

    bot.action(RegExp('^' + botEnum.prevQuickChain.value + '_.+'), async (ctx: any) => {
        const chain = ctx.update.callback_query.data.slice(botEnum.prevQuickChain.value.length + 1)
        await invokePrevQuickChain(ctx, chain)
    })

    bot.action(RegExp('^' + botEnum.nextQuickChain.value + '_.+'), async (ctx: any) => {
        const chain = ctx.update.callback_query.data.slice(botEnum.nextQuickChain.value.length + 1)
        await invokeNextQuickChain(ctx, chain)
    })

    bot.action(RegExp('^' + botEnum.quickChainMulti + '_.+'), async (ctx: any) => {
        const chain = ctx.update.callback_query.data.slice(botEnum.quickChainMulti.length + 1)
        await invokeToggleMultiQuick(ctx, chain)
    })

    bot.action(RegExp('^' + botEnum.quickChainSmartSlippage + '_.+'), async (ctx: any) => {
        const chain = ctx.update.callback_query.data.slice(botEnum.quickChainSmartSlippage.length + 1)
        await invokeToggleSmartSlippageQuick(ctx, chain)
    })

    bot.action(RegExp('^' + botEnum.autoBuyPastedContract + '_.+'), async (ctx: any) => {
        const chain = ctx.update.callback_query.data.slice(botEnum.autoBuyPastedContract.length + 1)
        await invokeToggleEnabledQuick(ctx, chain)
    })

    bot.action(RegExp('^' + botEnum.pastedContractBuyAmount + '_.+'), async (ctx: any) => {
        const chain = ctx.update.callback_query.data.slice(botEnum.pastedContractBuyAmount.length + 1)
        await ctx.scene.enter(AUTO_BUY_LISTENER, { input_type: 'quick-auto-buy-amount', msgId: ctx.update.callback_query?.message.message_id, chain: chain })
    })

    bot.action(RegExp('^' + botEnum.quickBuyGas + '_.+'), async (ctx: any) => {
        const chain = ctx.update.callback_query.data.slice(botEnum.quickBuyGas.length + 1)
        await ctx.scene.enter(AUTO_BUY_LISTENER, { input_type: 'quick-auto-buy-gas-amount', msgId: ctx.update.callback_query?.message.message_id, chain: chain })
    })

    bot.action(RegExp('^' + botEnum.quickBuyGasRemove + '_.+'), async (ctx: any) => {
        const chain = ctx.update.callback_query.data.slice(botEnum.quickBuyGasRemove.length + 1)
        await removeBuyGasQuick(ctx, chain)
    })

    bot.action(RegExp('^' + botEnum.quickSlippage + '_.+'), async (ctx: any) => {
        const chain = ctx.update.callback_query.data.slice(botEnum.quickSlippage.length + 1)
        await ctx.scene.enter(AUTO_BUY_LISTENER, { input_type: 'quick-auto-buy-slippage', msgId: ctx.update.callback_query?.message.message_id, chain: chain })
    })

    bot.action(RegExp('^' + botEnum.quickSlippageRemove + '_.+'), async (ctx: any) => {
        const chain = ctx.update.callback_query.data.slice(botEnum.quickSlippageRemove.length + 1)
        await removeBuySlippageQuick(ctx, chain)
    })
};
