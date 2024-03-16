import { botEnum } from "../../../constants/botEnum";
import { TokenInfoModel } from "../../../models/token.info.model";
import { updateChatId } from "../../../service/app.user.service";
import { processError } from "../../../service/error";
import { ISceneResponse, SceneStageService } from "../../../service/scene.stage.service";
import { getWallet } from "../../../service/wallet.service";
import Logging from "../../../utils/logging";
import { userSwapTokenForETH, userSwapTokenForETHByETHAmount } from "../../../web3/dex.interaction";
import { getTokenSimpleInfo } from "../../../web3/token.interaction";

export class TokenSellXEthAmountListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`TokenSellXEthAmountListener.class processing scene message [${text}]`)
        await updateChatId(telegramId, ctx.chat.id)

        const context = JSON.parse(sceneContext.scene.text)
        if (context.amount === null) {
            try {
                const tInfo = await TokenInfoModel.findById(context.tokenInfoId)
                const chain = tInfo.chain
                const token = tInfo.address

                let tx;
                try {
                    tx = await userSwapTokenForETHByETHAmount(telegramId, chain, token, text);
                } catch (err) {
                    await processError(ctx, telegramId, err);
                    return;
                }
                const w = await getWallet(telegramId);
                const tokenInfo = await getTokenSimpleInfo(telegramId, chain, token, w.address);
                if (tx?.transactionHash) {
                } else {
                    await ctx.reply(`You have <b>${tokenInfo.balance} ${tokenInfo.symbol}</b>`, {
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

export class TokenSellXTokenAmountListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`TokenSellXTokenAmountListener.class processing scene message [${text}]`)
        await updateChatId(telegramId, ctx.chat.id)

        const context = JSON.parse(sceneContext.scene.text)
        if (context.amount === null) {
            try {
                const tInfo = await TokenInfoModel.findById(context.tokenInfoId)
                const chain = tInfo.chain
                const token = tInfo.address

                let tx;
                try {
                    tx = await userSwapTokenForETH(telegramId, chain, token, text);
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
                await new SceneStageService().deleteScene(telegramId);
            } catch (err) {
                await new SceneStageService().deleteScene(telegramId)
                await ctx.telegram.sendMessage(ctx.chat.id, `${err.message}`, { parse_mode: botEnum.PARSE_MODE_V2 })
            }
        }
    }
}