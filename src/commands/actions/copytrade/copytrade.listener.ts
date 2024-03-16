import { Scenes } from 'telegraf';
import { botEnum } from '../../../constants/botEnum';
import { COPY_TRADE_LISTENER } from '../../../utils/common';
import { SceneStageService } from '../../../service/scene.stage.service';
import { CopyTradeModel } from '../../../models/copytrade.model';
import { getNativeCurrencySymbol } from '../../../web3/chain.parameters';
import { chainGasPrice } from '../../../service/chain.service';
import { userETHBalance } from '../../../web3/nativecurrency/nativecurrency.query';
import { processError } from '../../../service/error';

export const copyTradeListener = new Scenes.BaseScene(COPY_TRADE_LISTENER);

// send a prompt message when user enters scene
copyTradeListener.enter(async (ctx: any) => {
    const telegramId = ctx.from.id;

    try {
        const context = {
            inputType: ctx.scene.state.input_type,
            msgId: ctx.scene.state.msgId,
            chain: ctx.scene.state.chain,
            copyTradeId: ctx.scene.state.copyTradeId,
            name: null,
            walletId: null,
        }
        let ret;
        if (ctx.scene.state.input_type === 'copytrade-new-name') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `What would you like to name this copy trade wallet?`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, COPY_TRADE_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();


        } else if (ctx.scene.state.input_type === 'copytrade-new-address') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with the desired <b>wallet address</b> you'd like to copy trades from.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, COPY_TRADE_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();

        } else if (ctx.scene.state.input_type === 'copytrade-rename') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `What would you like to rename this copy trade wallet?`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, COPY_TRADE_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        } else if (ctx.scene.state.input_type === 'copytrade-buy-amount') {
            const ctDB = await CopyTradeModel.findById(context.copyTradeId)
            const nativeSymbol = await getNativeCurrencySymbol(ctDB.chain)
            const userETHVal = await userETHBalance(telegramId, ctDB.chain)
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired buy <b>${nativeSymbol}</b> amount. You currently have <b>${userETHVal} ${nativeSymbol}</b>`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, COPY_TRADE_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        } else if (ctx.scene.state.input_type === 'copytrade-buy-slippage') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired slippage percentage.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, COPY_TRADE_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        } else if (ctx.scene.state.input_type === 'copytrade-buy-gas-price') {
            const ctDB = await CopyTradeModel.findById(context.copyTradeId)
            const gasPrice = await chainGasPrice(ctDB.chain)
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired gas ${ctDB.chain === 'ethereum' ? 'delta' : 'price'} (in GWEI). 1 GWEI = 10 ^ 9 wei. <b>Minimum</b> is <b>${ctDB.chain === 'ethereum' ? '0' : gasPrice}</b>!`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, COPY_TRADE_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        } else if (ctx.scene.state.input_type === 'copytrade-max-buy-tax') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired buy tax threshold!\n\n⚠️ <i>If the token's buy tax is higher than your set amount, auto buy will not be triggered.</i>`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, COPY_TRADE_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        } else if (ctx.scene.state.input_type === 'copytrade-max-sell-tax') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired sell tax threshold!\n\n⚠️ <i>If the token's sell tax is higher than your set amount, auto buy will not be triggered.</i>`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, COPY_TRADE_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        }
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});
