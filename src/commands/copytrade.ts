import { botEnum } from '../constants/botEnum';
import { CopyTradeModel } from '../models/copytrade.model';
import { updateChatId, userVerboseLog } from '../service/app.user.service';
import { getSelectedChain, selectOtherChain } from '../service/connected.chain.service';
import { deleteCopyTradeAddress, getCopyTradeDetail, getCopyTradeDetailMarkup, getCopyTradeText, updateCopyTradeAddress } from '../service/copytrade.service';
import { processError } from '../service/error';
import { COPY_TRADE_LISTENER } from '../utils/common';
import { getCopyTradeMarkup } from '../utils/inline.markups';

const invokeCopyTrade = async (ctx: any) => {
    // ctx.update.callback_query.from

    const telegramId = ctx.from.id;

    try {
        if (ctx.update?.message?.text === undefined) {
            await ctx.deleteMessage();
        }
    } catch { }

    try {
        await userVerboseLog(telegramId, '/copytrade')
        await updateChatId(telegramId, ctx.chat.id)
        const chain = await getSelectedChain(telegramId)
        const text = await getCopyTradeText(telegramId,chain)
        await ctx.telegram.sendMessage(ctx.chat.id, text, {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: await getCopyTradeMarkup(telegramId, chain)
        });
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

export const refreshCopyTrade = async (ctx: any, chain: string) => {
    // ctx.update.callback_query.from

    const telegramId = ctx.from.id;

    try {
        const text = await getCopyTradeText(telegramId,chain)
        await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, text, {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: await getCopyTradeMarkup(telegramId, chain)
        })
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
}

export const refreshCopyTradeMoreSettings = async (ctx: any, copyTradeId: string) => {
    const telegramId = ctx.from.id;

    try {
        const text = await getCopyTradeDetail(copyTradeId)

        await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, text, {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: await getCopyTradeDetailMarkup(copyTradeId)
        });
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

export const invokeNextChainCopyTrade = async (ctx: any, chain: string) => {
    const telegramId = ctx.from.id

    try {
        const newChain = await selectOtherChain(chain, false)
        await userVerboseLog(telegramId, `/copytrade next chain to [${newChain}]`)
        await refreshCopyTrade(ctx, newChain)
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

export const invokePrevChainCopyTrade = async (ctx: any, chain: string) => {
    const telegramId = ctx.from.id;

    try {
        const newChain = await selectOtherChain(chain, true);
        await userVerboseLog(telegramId, `/copytrade prev chain to [${newChain}]`)
        await refreshCopyTrade(ctx, newChain)
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

export const invokeCopyTradeMoreSettings = async (ctx: any, copyTradeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await updateChatId(telegramId, ctx.chat.id);
        await userVerboseLog(telegramId, `/copytrade more settings of [${copyTradeId}]`)

        await refreshCopyTradeMoreSettings(ctx, copyTradeId)
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

export const invokeCopyTradeToggleOnOff = async (ctx: any, copyTradeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await updateChatId(telegramId, ctx.chat.id)
        await userVerboseLog(telegramId, `/copytrade toggle on/off [${copyTradeId}]`)

        const copyTradeDB = await CopyTradeModel.findById(copyTradeId)

        if (copyTradeDB) {
            const chain = copyTradeDB.chain
            await updateCopyTradeAddress(copyTradeId, { state: copyTradeDB.state === 'on' ? 'off' : 'on' });
            await refreshCopyTrade(ctx, chain)
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
}

export const invokeCopyTradeDelete = async (ctx: any, copyTradeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await updateChatId(telegramId, ctx.chat.id)
        await userVerboseLog(telegramId, `/copytrade delete [${copyTradeId}]`)

        const copyTradeDB = await CopyTradeModel.findById(copyTradeId)
        const chain = copyTradeDB.chain

        await deleteCopyTradeAddress(copyTradeId)
        await refreshCopyTrade(ctx, chain)
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
}

export const invokeCopyTradeToggleFrontRun = async (ctx: any, copyTradeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await updateChatId(telegramId, ctx.chat.id)
        await userVerboseLog(telegramId, `/copytrade toggle frontrun [${copyTradeId}]`)

        const copyTradeDB = await CopyTradeModel.findById(copyTradeId)

        if (copyTradeDB) {
            const chain = copyTradeDB.chain
            await updateCopyTradeAddress(copyTradeId, { isFrontRun: copyTradeDB.isFrontRun === true ? false : true });
            await refreshCopyTradeMoreSettings(ctx, copyTradeId)
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
}

export const invokeCopyTradeToggleMulti = async (ctx: any, copyTradeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await updateChatId(telegramId, ctx.chat.id)
        await userVerboseLog(telegramId, `/copytrade toggle multi [${copyTradeId}]`)

        const copyTradeDB = await CopyTradeModel.findById(copyTradeId)

        if (copyTradeDB) {
            const chain = copyTradeDB.chain
            await updateCopyTradeAddress(copyTradeId, { multi: copyTradeDB.multi === true ? false : true });
            await refreshCopyTradeMoreSettings(ctx, copyTradeId)
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
}

export const invokeCopyTradeToggleAutoBuy = async (ctx: any, copyTradeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await updateChatId(telegramId, ctx.chat.id);
        await userVerboseLog(telegramId, `/copytrade toggle autobuy [${copyTradeId}]`)

        const copyTradeDB = await CopyTradeModel.findById(copyTradeId)

        if (copyTradeDB) {
            const chain = copyTradeDB.chain
            await updateCopyTradeAddress(copyTradeId, { isAutoBuy: copyTradeDB.isAutoBuy === true ? false : true });
            await refreshCopyTradeMoreSettings(ctx, copyTradeId)
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
}

export const invokeCopyTradeToggleSmartSlippage = async (ctx: any, copyTradeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await updateChatId(telegramId, ctx.chat.id);
        await userVerboseLog(telegramId, `/copytrade toggle smartslippage [${copyTradeId}]`)

        const copyTradeDB = await CopyTradeModel.findById(copyTradeId)

        if (copyTradeDB) {
            const chain = copyTradeDB.chain
            await updateCopyTradeAddress(copyTradeId, { autoBuySmartSlippage: copyTradeDB.autoBuySmartSlippage === '0' ? '1' : copyTradeDB.autoBuySmartSlippage === '1' ? '2' : '0' });
            await refreshCopyTradeMoreSettings(ctx, copyTradeId)
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
}

export const invokeCopyTradeRemoveBuySlippage = async (ctx: any, copyTradeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await updateChatId(telegramId, ctx.chat.id);
        await userVerboseLog(telegramId, `/copytrade remove buy slippage [${copyTradeId}]`)

        const copyTradeDB = await CopyTradeModel.findById(copyTradeId)

        if (copyTradeDB) {
            await updateCopyTradeAddress(copyTradeId, { autoBuySlippage: 100 })
            await refreshCopyTradeMoreSettings(ctx, copyTradeId)
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
}

export const invokeCopyTradeRemoveBuyGasPrice = async (ctx: any, copyTradeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await updateChatId(telegramId, ctx.chat.id);
        await userVerboseLog(telegramId, `/copytrade remove buy gas price [${copyTradeId}]`)

        const copyTradeDB = await CopyTradeModel.findById(copyTradeId)

        if (copyTradeDB) {
            await updateCopyTradeAddress(copyTradeId, { autoBuyGasPrice: 0 })
            await refreshCopyTradeMoreSettings(ctx, copyTradeId)
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
}

export const invokeCopyTradeToggleCopySell = async (ctx: any, copyTradeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await updateChatId(telegramId, ctx.chat.id);
        await userVerboseLog(telegramId, `/copytrade toggle copy sell [${copyTradeId}]`)

        const copyTradeDB = await CopyTradeModel.findById(copyTradeId)

        if (copyTradeDB) {
            const chain = copyTradeDB.chain
            await updateCopyTradeAddress(copyTradeId, { isCopySell: copyTradeDB.isCopySell === true ? false : true });
            await refreshCopyTradeMoreSettings(ctx, copyTradeId)
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
}

export const invokeCopyTradeRemoveMaxBuyTax = async (ctx: any, copyTradeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await updateChatId(telegramId, ctx.chat.id);
        await userVerboseLog(telegramId, `/copytrade remove max buy tax [${copyTradeId}]`)

        const copyTradeDB = await CopyTradeModel.findById(copyTradeId)

        if (copyTradeDB) {
            const chain = copyTradeDB.chain
            await updateCopyTradeAddress(copyTradeId, { maxBuyTax: '' })
            await refreshCopyTradeMoreSettings(ctx, copyTradeId)
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
}

export const invokeCopyTradeRemoveMaxSellTax = async (ctx: any, copyTradeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await updateChatId(telegramId, ctx.chat.id);
        await userVerboseLog(telegramId, `/copytrade remove max sell tax [${copyTradeId}]`)

        const copyTradeDB = await CopyTradeModel.findById(copyTradeId)

        if (copyTradeDB) {
            const chain = copyTradeDB.chain
            await updateCopyTradeAddress(copyTradeId, { maxSellTax: '' })
            await refreshCopyTradeMoreSettings(ctx, copyTradeId)
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
}

module.exports = (bot: any) => {
    bot.command(botEnum.copytrade.value, invokeCopyTrade)
    bot.action(botEnum.copytrade.value, invokeCopyTrade)

    bot.action(RegExp('^' + botEnum.prevCopyTradeChain.value + '_.+'), async (ctx: any) => {
        const chain = ctx.update.callback_query.data.slice(botEnum.prevCopyTradeChain.value.length + 1);
        await invokePrevChainCopyTrade(ctx, chain)
    })

    bot.action(RegExp('^' + botEnum.nextCopyTradeChain.value + '_.+'), async (ctx: any) => {
        const chain = ctx.update.callback_query.data.slice(botEnum.nextCopyTradeChain.value.length + 1);
        await invokeNextChainCopyTrade(ctx, chain)
    })

    bot.action(RegExp('^' + botEnum.copyTradeAddWallet.value + '_.+'), async (ctx: any) => {
        const chain = ctx.update.callback_query.data.slice(botEnum.copyTradeAddWallet.value.length + 1)
        await ctx.scene.enter(COPY_TRADE_LISTENER, { input_type: 'copytrade-new-name', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
    })

    bot.action(RegExp('^' + botEnum.copyTradeMoreSetting + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeMoreSetting.length + 1);
        await invokeCopyTradeMoreSettings(ctx, ctId);
    });

    bot.action(RegExp('^' + botEnum.copyTradeRename + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeRename.length + 1);
        await ctx.scene.enter(COPY_TRADE_LISTENER, { input_type: 'copytrade-rename', msgId: ctx.update.callback_query?.message.message_id, copyTradeId: ctId });
    });

    bot.action(RegExp('^' + botEnum.copyTradeOnOff + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeOnOff.length + 1);
        await invokeCopyTradeToggleOnOff(ctx, ctId);
    });

    bot.action(RegExp('^' + botEnum.copyTradeDelete + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeDelete.length + 1);
        await invokeCopyTradeDelete(ctx, ctId);
    })

    bot.action(RegExp('^' + botEnum.copyTradeFrontRun + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeFrontRun.length + 1);
        await invokeCopyTradeToggleFrontRun(ctx, ctId)
    })

    bot.action(RegExp('^' + botEnum.copyTradeMulti + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeMulti.length + 1);
        await invokeCopyTradeToggleMulti(ctx, ctId)
    })

    bot.action(RegExp('^' + botEnum.copyTradeAutoBuy + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeAutoBuy.length + 1);
        await invokeCopyTradeToggleAutoBuy(ctx, ctId)
    })

    bot.action(RegExp('^' + botEnum.copyTradeSmartSlippage + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeSmartSlippage.length + 1);
        await invokeCopyTradeToggleSmartSlippage(ctx, ctId)
    })

    bot.action(RegExp('^' + botEnum.copyTradeBuyAmount + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeBuyAmount.length + 1);
        await ctx.scene.enter(COPY_TRADE_LISTENER, { input_type: 'copytrade-buy-amount', msgId: ctx.update.callback_query?.message.message_id, copyTradeId: ctId });
    })

    bot.action(RegExp('^' + botEnum.copyTradeBuySlippage + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeBuySlippage.length + 1);
        await ctx.scene.enter(COPY_TRADE_LISTENER, { input_type: 'copytrade-buy-slippage', msgId: ctx.update.callback_query?.message.message_id, copyTradeId: ctId });
    })

    bot.action(RegExp('^' + botEnum.copyTradeBuySlippageRemove + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeBuySlippageRemove.length + 1);
        await invokeCopyTradeRemoveBuySlippage(ctx, ctId)
    })

    bot.action(RegExp('^' + botEnum.copyTradeBuyGasPrice + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeBuyGasPrice.length + 1);
        await ctx.scene.enter(COPY_TRADE_LISTENER, { input_type: 'copytrade-buy-gas-price', msgId: ctx.update.callback_query?.message.message_id, copyTradeId: ctId });
    })

    bot.action(RegExp('^' + botEnum.copyTradeBuyGasPriceRemove + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeBuyGasPriceRemove.length + 1);
        await invokeCopyTradeRemoveBuyGasPrice(ctx, ctId)
    })

    bot.action(RegExp('^' + botEnum.copyTradeCopySell + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeCopySell.length + 1);
        await invokeCopyTradeToggleCopySell(ctx, ctId)
    })

    bot.action(RegExp('^' + botEnum.copyTradeMaxBuyTax + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeMaxBuyTax.length + 1);
        await ctx.scene.enter(COPY_TRADE_LISTENER, { input_type: 'copytrade-max-buy-tax', msgId: ctx.update.callback_query?.message.message_id, copyTradeId: ctId })
    })

    bot.action(RegExp('^' + botEnum.copyTradeMaxBuyTaxRemove + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeMaxBuyTaxRemove.length + 1);
        await invokeCopyTradeRemoveMaxBuyTax(ctx, ctId)
    })

    bot.action(RegExp('^' + botEnum.copyTradeMaxSellTax + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeMaxSellTax.length + 1);
        await ctx.scene.enter(COPY_TRADE_LISTENER, { input_type: 'copytrade-max-sell-tax', msgId: ctx.update.callback_query?.message.message_id, copyTradeId: ctId })
    })

    bot.action(RegExp('^' + botEnum.copyTradeMaxSellTaxRemove + '_.+'), async (ctx: any) => {
        const ctId = ctx.update.callback_query.data.slice(botEnum.copyTradeMaxSellTaxRemove.length + 1);
        await invokeCopyTradeRemoveMaxSellTax(ctx, ctId)
    })
};
