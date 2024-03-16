import { botEnum } from "../../../constants/botEnum";
import { processError } from "../../../service/error";
import { ISceneResponse, SceneStageService } from "../../../service/scene.stage.service"
import { getWallet } from "../../../service/wallet.service";
import { MANUAL_TRADE_LISTENER } from "../../../utils/common";
import Logging from "../../../utils/logging"
import { getNativeCurrencySymbol } from "../../../web3/chain.parameters";
import { userSwapETHForTokens, userSwapTokenForETH } from "../../../web3/dex.interaction";
import { getTokenSimpleInfo } from "../../../web3/token.interaction";
import { AddressZero, isValidAddress } from "../../../web3/web3.operation";

export class ManualTradeListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`ManualTradeListener.class processing scene message [${text}]`)

        try {
            const context = JSON.parse(sceneContext.scene.text)
            const chain = context.chain
            const label = await getNativeCurrencySymbol(chain);
            if (context.inputType === 'manual_buy_start') {
                if (context.amount === null) {
                    try {
                        await ctx.telegram.sendMessage(ctx.chat.id, `You are buying by <code>${text} ${label}</code>\n`, {
                            parse_mode: botEnum.PARSE_MODE_V2
                        });

                        await ctx.telegram.sendMessage(ctx.chat.id, `Which token do you want to buy?`, {
                            parse_mode: botEnum.PARSE_MODE_V2,
                            reply_markup: {
                                force_reply: true
                            }
                        })
                        context.amount = text;
                        await new SceneStageService().saveScene(telegramId, MANUAL_TRADE_LISTENER, JSON.stringify(context), new Date());

                    } catch (err) {
                        await new SceneStageService().deleteScene(telegramId)
                        await ctx.telegram.sendMessage(ctx.chat.id, `${err.message}`, { parse_mode: botEnum.PARSE_MODE_V2 })
                    }
                } else if (context.token === null) {
                    const addr = text.toLowerCase()
                    if (isValidAddress(addr)) {
                        let tokenInfo: any = await getTokenSimpleInfo(telegramId, chain, addr, AddressZero);
                        const symbol = tokenInfo.symbol;

                        await ctx.telegram.sendMessage(ctx.chat.id, `You are going to buy <code>${symbol}</code> by <b>${context.amount} ${label}</b>`, {
                            parse_mode: botEnum.PARSE_MODE_V2
                        });

                        const tx = await userSwapETHForTokens(telegramId, chain, addr, context.amount);
                    } else {
                        await ctx.reply(`❌ Invalid address ${addr}`);
                        await new SceneStageService().deleteScene(telegramId)
                    }
                }
            } else if (context.inputType === 'manual_sell_start') {
                if (context.token === null) {
                    const addr = text.toLowerCase()
                    if (isValidAddress(addr)) {
                        const w = await getWallet(telegramId)
                        const tokenInfo: any = await getTokenSimpleInfo(telegramId, chain, addr, w.address);
                        const symbol = tokenInfo.symbol;

                        ctx.telegram.sendMessage(
                            ctx.chat.id,
                            `How much <code>${symbol}</code> do you want to sell? You can use <b>% notation</b> or a regular number.\n\n` +
                            'If you type 100%, it will transfer the entire balance.\n' +
                            `You currently have <code>${tokenInfo.balance} ${symbol}</code>`,
                            {
                                parse_mode: botEnum.PARSE_MODE_V2,
                                reply_markup: {
                                    force_reply: true
                                }
                            }
                        );

                        context.token = addr;
                        await new SceneStageService().saveScene(telegramId, MANUAL_TRADE_LISTENER, JSON.stringify(context), new Date());

                    } else {
                        await ctx.reply(`❌ Invalid address ${addr}`);
                        await new SceneStageService().deleteScene(telegramId)
                    }
                } else if (context.amount === null) {
                    const tx = await userSwapTokenForETH(telegramId, chain, context.token.toLowerCase(), text);
                }
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    }
}