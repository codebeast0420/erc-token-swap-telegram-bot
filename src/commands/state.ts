import { botEnum } from '../constants/botEnum';
import { getSelectedChain, selectChain } from '../service/connected.chain.service';
import { postStartAction } from './actions/default.action';
import { updateChatId, userVerboseLog } from '../service/app.user.service';
import { processError } from '../service/error';
import { getBotGeneralConfiguration } from '../utils/messages';

const refreshState = async (ctx: any, chainTo: string) => {
    const telegramId = ctx.from.id;

    try {
        let text = '';

        try {
            if (ctx.update?.message?.text === undefined) {
                await ctx.deleteMessage();
            }
        } catch { }

        await updateChatId(telegramId, ctx.chat.id);

        if (chainTo !== '') {
            await selectChain(telegramId, chainTo)
        }

        const chain = await getSelectedChain(telegramId);
        if (chain === '') {
            postStartAction(ctx);
            return;
        } else {
            text = await getBotGeneralConfiguration(telegramId, chain)
        }

        await ctx.telegram.sendMessage(ctx.chat.id, text, {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: botEnum.menu.key,
                            callback_data: botEnum.menu.value
                        }
                    ],
                    [
                        {
                            text: botEnum.eth_state.key,
                            callback_data: botEnum.eth_state.value
                        },
                        {
                            text: botEnum.arb_state.key,
                            callback_data: botEnum.arb_state.value
                        },
                        {
                            text: botEnum.bsc_state.key,
                            callback_data: botEnum.bsc_state.value
                        }
                    ]
                ]
            }
        });
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
}

module.exports = (bot: any) => {
    bot.command(botEnum.state.value, async (ctx: any) => {
        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, '/state')

        await refreshState(ctx, '')
    })

    bot.action(botEnum.state.value, async (ctx: any) => {
        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, '/state')

        await refreshState(ctx, '')
    })

    bot.action(botEnum.bsc_state.value, async (ctx: any) => {
        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, 'switch to bsc state')

        await refreshState(ctx, 'bsc')
    })

    bot.action(botEnum.eth_state.value, async (ctx: any) => {
        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, 'switch to ethereum state')

        await refreshState(ctx, 'ethereum')
    })

    bot.action(botEnum.arb_state.value, async (ctx: any) => {
        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, 'switch to arbitrum state')

        await refreshState(ctx, 'arbitrum')
    })
};
