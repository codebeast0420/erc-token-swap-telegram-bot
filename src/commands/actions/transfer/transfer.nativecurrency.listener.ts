import { Scenes } from 'telegraf';
import { botEnum } from '../../../constants/botEnum';
import { getSelectedChain } from '../../../service/connected.chain.service';
import { processError } from '../../../service/error';
import Logging from '../../../utils/logging';
import { getNativeCurrencySymbol } from '../../../web3/chain.parameters';
import { ADDRESS_PLACEHOLDER, SEND_AMOUNT_PLACEHOLDER, TRANSFER_NATIVE_CURRENCY_LISTENER } from '../../../utils/common';
import { ISceneResponse, SceneStageService } from '../../../service/scene.stage.service';
import { userETHBalance } from '../../../web3/nativecurrency/nativecurrency.query';
import { userTransferETH } from '../../../web3/nativecurrency/nativecurrency.transaction';
import { isValidAddress } from '../../../web3/web3.operation';

export const transferNativeCurrencyToListener = new Scenes.BaseScene(TRANSFER_NATIVE_CURRENCY_LISTENER);

// send a prompt message when user enters scene
transferNativeCurrencyToListener.enter(async (ctx: any) => {
    const telegramId = ctx.from.id;

    const context = {
        to: null,
        amount: null,
        inputType: ctx.scene.state.input_type,
        msgId: ctx.scene.state.msgId,
        chain: ctx.scene.state.chain,
    };

    const chain = context.chain

    try {
        let label = await getNativeCurrencySymbol(chain);

        const ret = await ctx.telegram.sendMessage(ctx.chat.id, `What address do you want to send ${label} to?`, {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: {
                force_reply: true,
                input_field_placeholder: ADDRESS_PLACEHOLDER,
            }
        });

        try { await ctx.answerCbQuery() } catch { }

        await new SceneStageService().saveScene(telegramId, TRANSFER_NATIVE_CURRENCY_LISTENER, JSON.stringify(context), new Date());
        await ctx.scene.leave();
    } catch (err) {
        await processError(ctx, telegramId, err)
        await ctx.scene.leave()
    }
});

export class TransferNativeCurrencyToListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`TransferNativeCurrencyToListener.class processing scene message [${text}]`)
        const context = JSON.parse(sceneContext.scene.text)
        if (context.to === null) {
            const addr = text.toLowerCase()
            if (isValidAddress(addr)) {
                let label;
                let myETHBal;

                const multiResponse = await Promise.all([
                    await getNativeCurrencySymbol(context.chain),
                    await userETHBalance(telegramId, context.chain),
                ]);

                label = multiResponse[0]
                myETHBal = multiResponse[1]

                await ctx.telegram.sendMessage(
                    ctx.chat.id,
                    `How much <b>${label}</b> do you want to send? You can use <b>% notation</b> or a regular number.\n\n` +
                    'If you type <b>100%</b>, it will transfer the entire balance.\n' +
                    `You currently have <code>${myETHBal} ${label}</code>`,
                    {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: {
                            force_reply: true,
                            input_field_placeholder: SEND_AMOUNT_PLACEHOLDER,
                        }
                    }
                );
                context.to = addr;

                await new SceneStageService().saveScene(telegramId, TRANSFER_NATIVE_CURRENCY_LISTENER, JSON.stringify(context), new Date());

            } else {
                await ctx.reply(`❌ Invalid address ${addr}`);
                await new SceneStageService().deleteScene(telegramId)
            }
        } else if (context.amount == null) {
            try {
                const tx = await userTransferETH(telegramId, context.chain, context.to, text);
                const bal = await userETHBalance(telegramId, context.chain);
                const symbol = await getNativeCurrencySymbol(context.chain);
                if (tx?.transactionHash) {
                } else {
                    await ctx.reply(`You have <b>${bal} ${symbol}</b>`, {
                        parse_mode: botEnum.PARSE_MODE_V2
                    });
                }

                await new SceneStageService().deleteScene(telegramId);
            }
            catch (err) {
                await new SceneStageService().deleteScene(telegramId)
                await ctx.telegram.sendMessage(ctx.chat.id, `${err.message}`, { parse_mode: botEnum.PARSE_MODE_V2 })
                return;
            }
        }
    }
}

