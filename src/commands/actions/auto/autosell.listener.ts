import { Scenes } from 'telegraf';
import { botEnum } from '../../../constants/botEnum';
import { SceneStageService } from '../../../service/scene.stage.service';
import { AUTO_SELL_LISTENER } from '../../../utils/common';
import { processError } from '../../../service/error';
import { AutoSellTokenModel } from '../../../models/auto.sell.token';
import { getTrackText } from '../../../service/track.service';
import { getTokenAutoSellContext } from '../../../service/autosell.service';

export const autoSellInputListener = new Scenes.BaseScene(AUTO_SELL_LISTENER);

// send a prompt message when user enters scene
autoSellInputListener.enter(async (ctx: any) => {
    const telegramId = ctx.from.id;

    try {
        const context = {
            inputType: ctx.scene.state.input_type,
            msgId: ctx.scene.state.msgId,
            chain: ctx.scene.state.chain,
            autoSellId: ctx.scene.state.autoSellId,
        }

        let ret;
        if (ctx.scene.state.input_type === 'auto-sell-low-price-percentage') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `You are setting the sell low limit in percentage. Please specify a value for this trade monitor.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, AUTO_SELL_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();


        } else if (ctx.scene.state.input_type === 'auto-sell-low-price-usd') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `You are setting the price in USD at which you want to sell the token. Please specify a value for this trade monitor`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, AUTO_SELL_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();


        } else if (ctx.scene.state.input_type === 'auto-sell-low-price-marketcap') {
            const autoSellCtx = await AutoSellTokenModel.findById(context.autoSellId)
            const chain = autoSellCtx.chain
            const t = await getTrackText(telegramId, chain, autoSellCtx.token)

            const info = await getTokenAutoSellContext(telegramId, chain, autoSellCtx.token)

            const price = parseFloat(info.priceStamp)

            const mc = parseFloat(t.tokenInfo.totalSupply) * price;

            ret = await ctx.telegram.sendMessage(
                ctx.chat.id,
                `You are setting the market cap in USD at which you want to sell the token.\nCurrently <code>${mc}</code> <b>USD</b>.\nThe bot will automatically convert your choice to percentage terms.`,
                {
                    parse_mode: botEnum.PARSE_MODE_V2,
                    reply_markup: {
                        force_reply: true
                    }
                }
            );

            await new SceneStageService().saveScene(telegramId, AUTO_SELL_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();



        } else if (ctx.scene.state.input_type === 'auto-sell-high-price-percentage') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `You are setting the sell high limit. Please specify a value for this trade monitor.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });


            await new SceneStageService().saveScene(telegramId, AUTO_SELL_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();


        } else if (ctx.scene.state.input_type === 'auto-sell-high-price-usd') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `You are setting the price in USD at which you want to sell. Please specify a value for this trade monitor.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, AUTO_SELL_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();

        } else if (ctx.scene.state.input_type === 'auto-sell-high-price-marketcap') {
            const autoSellCtx = await AutoSellTokenModel.findById(context.autoSellId)
            const chain = autoSellCtx.chain
            const t = await getTrackText(telegramId, chain, autoSellCtx.token)

            const info = await getTokenAutoSellContext(telegramId, chain, autoSellCtx.token)

            const price = parseFloat(info.priceStamp)

            const mc = parseFloat(t.tokenInfo.totalSupply) * price;

            ret = await ctx.telegram.sendMessage(
                ctx.chat.id,
                `You are setting the market cap in USD at which you want to sell.\nCurrently <code>${mc}</code> <b>USD</b>.\nThe bot will automatically convert your choice to percentage terms.`,
                {
                    parse_mode: botEnum.PARSE_MODE_V2,
                    reply_markup: {
                        force_reply: true
                    }
                }
            );

            await new SceneStageService().saveScene(telegramId, AUTO_SELL_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();

        } else if (ctx.scene.state.input_type === 'auto-sell-amount-low-price') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `You are setting the % of your tokens to sell at the low limit. Please specify a value for this trade monitor.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, AUTO_SELL_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();

        } else if (ctx.scene.state.input_type === 'auto-sell-amount-high-price') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `You are setting the % of your tokens to sell at the high limit. Please specify a value for this trade monitor.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, AUTO_SELL_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        }
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});
