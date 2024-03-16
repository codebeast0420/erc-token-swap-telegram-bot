import { botEnum } from '../constants/botEnum';
import { updateChatId, userVerboseLog } from '../service/app.user.service';
import { getAllChains } from '../service/chain.service';
import { getSelectedChain, selectChain } from '../service/connected.chain.service';
import { processError } from '../service/error';
import { MANUAL_TRADE_LISTENER } from '../utils/common';
import { getTradeMarkup } from '../utils/inline.markups';
import { getChainStatus } from '../utils/messages';
import { getNativeCurrencySymbol } from '../web3/chain.parameters';
import { userETHBalance } from '../web3/nativecurrency/nativecurrency.query';
import { getBN } from '../web3/web3.operation';

const invokeTrade = async (ctx: any) => {
    const telegramId = ctx.from.id;

    try {
        userVerboseLog(telegramId, '/trade');

        await updateChatId(telegramId, ctx.chat.id);
        const chain = await getSelectedChain(telegramId);

        await ctx.telegram.sendMessage(ctx.chat.id, await getChainStatus(telegramId, chain), {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: await getTradeMarkup(telegramId, chain)
        });
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const refreshTrade = async (ctx: any, telegramId: string, chain: string) => {
    try {
        userVerboseLog(telegramId, `/trade switch to ${chain}`);

        await updateChatId(telegramId, ctx.chat.id);
        await selectChain(telegramId, chain)

        await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, await getChainStatus(telegramId, chain), {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: await getTradeMarkup(telegramId, chain)
        });
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

module.exports = (bot: any) => {
    bot.command(botEnum.trade.value, invokeTrade);
    bot.action(botEnum.trade.value, invokeTrade);

    bot.action(RegExp('^' + botEnum.prevTradeChain.value + '_.+'), async (ctx: any) => {
        const telegramId = ctx.from.id;
        const chain = ctx.update.callback_query.data.slice(botEnum.prevTradeChain.value.length + 1)
        const chains = getAllChains()

        const idx = chains.indexOf(chain)
        const chainTo = idx < 0? chains[0]: chains[(idx + chains.length - 1) % chains.length]

        await refreshTrade(ctx, telegramId, chainTo)
    });

    bot.action(RegExp('^' + botEnum.nextTradeChain.value + '_.+'), async (ctx: any) => {
        const telegramId = ctx.from.id;
        const chain = ctx.update.callback_query.data.slice(botEnum.nextTradeChain.value.length + 1)
        const chains = getAllChains()

        const idx = chains.indexOf(chain)
        const chainTo = idx < 0? chains[0]: chains[(idx + 1) % chains.length]

        await refreshTrade(ctx, telegramId, chainTo)
    });

    bot.action(RegExp('^' + botEnum.manualBuy.value + '_.+'), async (ctx: any) => {
        const telegramId = ctx.from.id;
        const chain = ctx.update.callback_query.data.slice(botEnum.manualBuy.value.length + 1)

        try {
            await userVerboseLog(telegramId, 'manual buy');

            const ethBal = await userETHBalance(telegramId, chain);
            const BN = getBN();
            const nativeSymbol = await getNativeCurrencySymbol(chain)

            if (BN(ethBal).eq(0)) {
                await ctx.telegram.sendMessage(ctx.chat.id, `❌ You have no <b>${nativeSymbol}</b>`);
            } else {
                await ctx.scene.enter(MANUAL_TRADE_LISTENER, { input_type: 'manual_buy_start', msgId: ctx.update.callback_query?.message.message_id, chain: chain })
            }
        } catch (err) {
            await processError(ctx, telegramId, err);
        }
    });

    bot.action(RegExp('^' + botEnum.manualSell.value + '_.+'), async (ctx: any) => {
        const telegramId = ctx.from.id;
        const chain = ctx.update.callback_query.data.slice(botEnum.manualSell.value.length + 1)
        try {
            await userVerboseLog(telegramId, 'manual sell');
            await ctx.scene.enter(MANUAL_TRADE_LISTENER, { input_type: 'manual_sell_start', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });
};
