import { Scenes } from 'telegraf';
import { botEnum } from '../../../constants/botEnum';
import { getWallet } from '../../../service/wallet.service';
import Logging from '../../../utils/logging';
import { getTokenSimpleInfo, userTransferToken } from '../../../web3/token.interaction';
import { ADDRESS_PLACEHOLDER, SEND_AMOUNT_PLACEHOLDER, TRANSFER_TOKEN_TOKEN_LISTENER } from '../../../utils/common';
import { ISceneResponse, SceneStageService } from '../../../service/scene.stage.service';
import { processError } from '../../../service/error';
import { isValidAddress } from '../../../web3/web3.operation';

export const transferTokenTokenListener = new Scenes.BaseScene(TRANSFER_TOKEN_TOKEN_LISTENER);

// send a prompt message when user enters scene
transferTokenTokenListener.enter(async (ctx: any) => {
    const telegramId = ctx.update.callback_query.from.id;
    const context = {
        to: null,
        amount: null,
        inputType: ctx.scene.state.input_type,
        msgId: ctx.scene.state.msgId,
        chain: ctx.scene.state.chain,
    };

    try {
        const ret = await ctx.telegram.sendMessage(ctx.chat.id, `What token do you want to send?`, {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: {
                force_reply: true,
                input_field_placeholder: ADDRESS_PLACEHOLDER,
            }
        });

        try { await ctx.answerCbQuery() } catch { }

        await new SceneStageService().saveScene(telegramId, TRANSFER_TOKEN_TOKEN_LISTENER, JSON.stringify(context), new Date());
        await ctx.scene.leave();
    } catch (err) {
        await processError(ctx, telegramId, err)
        await ctx.scene.leave();
    }
});

export class TransferTokenTokenListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, tt: string, ctx: any) {
        const text = tt.toLowerCase()
        Logging.info(`TransferTokenTokenListener.class processing scene message [${text}]`)
        const context = JSON.parse(sceneContext.scene.text)
        const chain = context.chain
        if (context.token == null) {
            if (isValidAddress(text)) {
                try {
                    const wallet = await getWallet(telegramId);
                    const tokenInfo = await getTokenSimpleInfo(telegramId, chain, text, wallet.address);
                    const symbol = tokenInfo.symbol;

                    context.tokenSymbol = tokenInfo.symbol;
                    context.tokenBalance = tokenInfo.balance;
                    context.addressFrom = wallet.address;

                    await ctx.telegram.sendMessage(ctx.chat.id, `<i><code>${ctx.update.message.text}</code></i>\n Please input wallet address to transfer <b>${symbol}</b> to`, {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: {
                            force_reply: true,
                            input_field_placeholder: ADDRESS_PLACEHOLDER,
                        }
                    });

                    context.token = text
                    await new SceneStageService().saveScene(telegramId, TRANSFER_TOKEN_TOKEN_LISTENER, JSON.stringify(context), new Date());
                } catch (err) {
                    console.error(`==> ${new Date().toLocaleString()}`)
                    console.error(err)
                    Logging.error(err)

                    await ctx.reply(`❌ Invalid CA ${text} for check if wallet connected /wallet`);
                    await new SceneStageService().deleteScene(telegramId)
                }

            } else {
                await ctx.reply(`❌ Invalid CA ${text}`);
                await new SceneStageService().deleteScene(telegramId)
            }
        }
        else if (context.to == null) {
            try {
                if (isValidAddress(text)) {
                    await ctx.telegram.sendMessage(
                        ctx.chat.id,
                        `How many <b>${context.tokenSymbol}</b> do you want to send? You can use <b>% notation</b> or a regular number.\n\n` + 'If you type <b>100%</b>, it will transfer the entire balance.\n' + `You currently have <code>${context.tokenBalance} ${context.tokenSymbol}</code>`,
                        {
                            parse_mode: botEnum.PARSE_MODE_V2,
                            reply_markup: {
                                force_reply: true,
                                input_field_placeholder: SEND_AMOUNT_PLACEHOLDER,
                            }
                        }
                    )


                    context.to = text;
                    await new SceneStageService().saveScene(telegramId, TRANSFER_TOKEN_TOKEN_LISTENER, JSON.stringify(context), new Date());
                } else {
                    throw new Error('Invalid address')
                }
            } catch (err) {
                await ctx.reply(`❌ Invalid address ${text}`);
                await new SceneStageService().deleteScene(telegramId)
            }
        }
        else if (context.amount == null) {
            try {
                const tx = await userTransferToken(telegramId, chain, context.token, context.to, text);
                const tokenInfo = await getTokenSimpleInfo(telegramId, chain, context.token, context.addressFrom);

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
