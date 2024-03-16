import { Scenes } from 'telegraf';
import { botEnum } from '../../../constants/botEnum';
import { getSelectedChain } from '../../../service/connected.chain.service';
import { getNativeCurrencySymbol } from '../../../web3/chain.parameters';
import { MANUAL_TRADE_LISTENER } from '../../../utils/common';
import { SceneStageService } from '../../../service/scene.stage.service';
import { userETHBalance } from '../../../web3/nativecurrency/nativecurrency.query';
import { processError } from '../../../service/error';
import { getBN } from '../../../web3/web3.operation';

export const manualTradeListener = new Scenes.BaseScene(MANUAL_TRADE_LISTENER);

// send a prompt message when user enters scene
manualTradeListener.enter(async (ctx: any) => {
    const telegramId = ctx.from.id;

    const context = {
        inputType: ctx.scene.state.input_type,
        msgId: ctx.scene.state.msgId,
        chain: ctx.scene.state.chain,
        token: null,
        amount: null,
    }

    const BN = getBN()
    try {
        const chain = context.chain
        const label = await getNativeCurrencySymbol(chain)
        const myETHBal = await userETHBalance(telegramId, chain)

        if (context.inputType === 'manual_buy_start') {
            const ret = await ctx.telegram.sendMessage(
                ctx.chat.id,
                `How much <code>${label}</code> do you want to buy by? You can use <b>% notation</b> or a regular number.\n\n` +
                'If you type <b>100%</b>, it will transfer the entire balance.\n' +
                `You currently have <code>${parseFloat(BN(myETHBal).toFixed(6))} ${label}</code>`,
                {
                    parse_mode: botEnum.PARSE_MODE_V2,
                    reply_markup: {
                        force_reply: true
                    }
                }
            );

            await new SceneStageService().saveScene(telegramId, MANUAL_TRADE_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        } else if (context.inputType === 'manual_sell_start') {
            const ret = await ctx.telegram.sendMessage(ctx.chat.id, `Which token do you want to sell?`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });
    
            await new SceneStageService().saveScene(telegramId, MANUAL_TRADE_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        }
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});
