import { botEnum } from "../../../constants/botEnum";
import { TokenInfoModel } from "../../../models/token.info.model";
import { updateChatId } from "../../../service/app.user.service";
import { processError } from "../../../service/error";
import { ISceneResponse, SceneStageService } from "../../../service/scene.stage.service";
import { getWallet } from "../../../service/wallet.service";
import Logging from "../../../utils/logging";
import { getNativeCurrencySymbol } from "../../../web3/chain.parameters";
import { userSwapETHForTokens, userSwapETHForTokensByTokenAmount } from "../../../web3/dex.interaction";
import { getTokenSimpleInfo } from "../../../web3/token.interaction";

export class TokenBuyXETHAmountListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`TokenBuyXETHAmountListener.class processing scene message [${text}]`)
        await updateChatId(telegramId, ctx.chat.id)

        const context = JSON.parse(sceneContext.scene.text)
        if (context.amount === null) {
            try {
                const tokenInfo = await TokenInfoModel.findById(context.tokenInfoId)
                const chain = tokenInfo.chain
                const token = tokenInfo.address

                const symbol = await getNativeCurrencySymbol(chain)

                await ctx.telegram.sendMessage(ctx.chat.id, `You are buying by <b>${text} ${symbol}</b>\n`, {
                    parse_mode: botEnum.PARSE_MODE_V2
                });

                await new SceneStageService().deleteScene(telegramId);

                await buyTokenByAmount(telegramId, ctx, chain, token, text)

            } catch (err) {
                await new SceneStageService().deleteScene(telegramId)
                await ctx.telegram.sendMessage(ctx.chat.id, `${err.message}`, { parse_mode: botEnum.PARSE_MODE_V2 })
            }
        }
    }
}

export class TokenBuyXTokenAmountListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`TokenBuyXTokenAmountListener.class processing scene message [${text}]`)
        await updateChatId(telegramId, ctx.chat.id)

        const context = JSON.parse(sceneContext.scene.text)
        if (context.amount === null) {
            try {
                const tokenInfo = await TokenInfoModel.findById(context.tokenInfoId)
                const chain = tokenInfo.chain
                const token = tokenInfo.address

                let tx;
                try {
                    tx = await userSwapETHForTokensByTokenAmount(telegramId, chain, token, text);
                } catch (err) {
                    await processError(ctx, telegramId, err);
                    return;
                }
                const w = await getWallet(telegramId);
                const tInfo = await getTokenSimpleInfo(telegramId, chain, token, w.address);
                if (tx?.transactionHash) {
                } else {
                    await ctx.reply(`You have <b>${tInfo.balance} 💦${tInfo.symbol}</b>`, {
                        parse_mode: botEnum.PARSE_MODE_V2
                    });
                }

                await new SceneStageService().deleteScene(telegramId);

            } catch (err) {
                await new SceneStageService().deleteScene(telegramId)
                await ctx.telegram.sendMessage(ctx.chat.id, `${err.message}`, { parse_mode: botEnum.PARSE_MODE_V2 })
            }
        }
    }
}

async function buyTokenByAmount(telegramId: string, ctx: any, chain: string, token: string, amount: string) {
    let tx;
    try {
        tx = await userSwapETHForTokens(telegramId, chain, token, amount);
    } catch (err) {
        await processError(ctx, telegramId, err);
        return;
    }
    const w = await getWallet(telegramId);
    const tokenInfo = await getTokenSimpleInfo(telegramId, chain, token, w.address);
    if (tx?.transactionHash) {
    } else {
        await ctx.reply(`You have <b>${tokenInfo.balance} 💦${tokenInfo.symbol}</b>`, {
            parse_mode: botEnum.PARSE_MODE_V2
        });
    }
}
