import { Scenes } from 'telegraf';
import { botEnum } from '../../../constants/botEnum';
import { chainGasPrice } from '../../../service/chain.service';
import { getNativeCurrencySymbol } from '../../../web3/chain.parameters';
import { AUTO_BUY_LISTENER, SEND_AMOUNT_PLACEHOLDER } from '../../../utils/common';
import { SceneStageService } from '../../../service/scene.stage.service';
import { AutoBuyTokenModel } from '../../../models/auto.buy.token';
import { processError } from '../../../service/error';
import { getTrackText } from '../../../service/track.service';
import { getTokenAutoBuyContext } from '../../../service/autobuy.service';

export const autoBuyInputListener = new Scenes.BaseScene(AUTO_BUY_LISTENER);

// send a prompt message when user enters scene
autoBuyInputListener.enter(async (ctx: any) => {
    const telegramId = ctx.from.id;

    try {
        const context = {
            inputType: ctx.scene.state.input_type,
            msgId: ctx.scene.state.msgId,
            chain: ctx.scene.state.chain,
            autoBuyId: ctx.scene.state.autoBuyId
        }

        const chain = ctx.scene.state.chain

        let ret;
        if (ctx.scene.state.input_type === 'auto-buy-price-percentage') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `You are setting the buy price limit in percentage. Please specify a value for this trade monitor.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, AUTO_BUY_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();

        } else if (ctx.scene.state.input_type === 'auto-buy-price-usd') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `You are setting the buy price in USD at which you want to buy the token. Please specify a value for this trade monitor`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, AUTO_BUY_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();

        } else if (ctx.scene.state.input_type === 'auto-buy-price-marketcap') {
            const autoBuyCtx = await AutoBuyTokenModel.findById(context.autoBuyId)
            const chain = autoBuyCtx.chain
            const t = await getTrackText(telegramId, chain, autoBuyCtx.token)

            const info = await getTokenAutoBuyContext(telegramId, chain, autoBuyCtx.token)

            const price = parseFloat(info.priceStamp);

            const mc = parseFloat(t.tokenInfo.totalSupply) * price;

            ret = await ctx.telegram.sendMessage(
                ctx.chat.id,
                `You are setting the market cap in USD at which you want to buy the token.\nCurrently <code>${mc}</code> <b>USD</b>.\nThe bot will automatically convert your choice to percentage terms.`,
                {
                    parse_mode: botEnum.PARSE_MODE_V2,
                    reply_markup: {
                        force_reply: true
                    }
                }
            );

            await new SceneStageService().saveScene(telegramId, AUTO_BUY_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();

        } else if (ctx.scene.state.input_type === 'auto-buy-amount') {
            const autoBuyCtx = await AutoBuyTokenModel.findById(ctx.scene.state.autoBuyId)
            const nativeSymbol = await getNativeCurrencySymbol(autoBuyCtx.chain)
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `You are setting the <b>${nativeSymbol}</b> amount or percentage to buy at the dip. Please specify a value for this trade monitor.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true,
                    input_field_placeholder: SEND_AMOUNT_PLACEHOLDER,
                }
            });

            await new SceneStageService().saveScene(telegramId, AUTO_BUY_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();


        } else if (ctx.scene.state.input_type === 'quick-auto-buy-amount') {
            const nativeSymbol = await getNativeCurrencySymbol(chain)
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `You are setting the <b>${nativeSymbol}</b> amount or percentage to buy automatically when pasting contract address.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true,
                    input_field_placeholder: SEND_AMOUNT_PLACEHOLDER,
                }
            });

            await new SceneStageService().saveScene(telegramId, AUTO_BUY_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();

        } else if (ctx.scene.state.input_type === 'quick-auto-buy-gas-amount') {
            const gasPrice = chain === 'ethereum' ? '0' : await chainGasPrice(chain)
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired <b>buy</b> gas ${chain === 'ethereum' ? 'delta' : 'price'} (in GWEI). 1 GWEI = 10 ^ 9 wei. <b>Minimum</b> is <b>${gasPrice}</b>!`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, AUTO_BUY_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();

        } else if (ctx.scene.state.input_type === 'quick-auto-buy-slippage') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired slippage percentage. <b>Minimum</b> is <b>0</b>%. <b>Max</b> is <b>100</b>%!`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, AUTO_BUY_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        }
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});
