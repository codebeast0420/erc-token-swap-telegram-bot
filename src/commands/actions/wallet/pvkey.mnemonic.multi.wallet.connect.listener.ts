import { Scenes } from 'telegraf';
import { botEnum } from '../../../constants/botEnum';
import { IAddressPagination } from '../../../models/address.model';
import { getAdditionalWalletByPvKeyOrMnemonic, getMultiWalletsPagination, importWallet, isAdditionalWalletNameExist, isAdditionalWalletPrivateKeyExist } from '../../../service/wallet.service';
import { markupMultiWalletMainPaginate } from '../../../utils/inline.markups';
import { multiWalletViewMessage } from '../../../utils/messages';
import { PV_KEY_MNEMONIC_MULTI_WALLET_CONNECT_LISTENER } from '../../../utils/common';
import { ISceneResponse, SceneStageService } from '../../../service/scene.stage.service';
import Logging from '../../../utils/logging';
import { getSettings } from '../../../service/settings.service';
import { processError } from '../../../service/error';

const listener = new Scenes.BaseScene(PV_KEY_MNEMONIC_MULTI_WALLET_CONNECT_LISTENER);

// send a prompt message when user enters scene
listener.enter(async (ctx: any) => {
    const telegramId = ctx.from.id;

    try {
        const ret = await ctx.telegram.sendMessage(ctx.chat.id, 'what would you like to name this wallet? 8 letters max, only numbers and letters', {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: {
                force_reply: true,
                input_field_placeholder: 'Alpha'
            }
        });


        // try { await ctx.answerCbQuery() } catch { }

        const context = {
            initiator: JSON.stringify(ctx.update.callback_query),
            chain: ctx.scene.state.chain,
            message: JSON.stringify(ret),
            name: null,
            pvKeyMnemonic: null,
            msgId: ctx.update.callback_query.message.message_id,
        };

        await new SceneStageService().saveScene(telegramId, PV_KEY_MNEMONIC_MULTI_WALLET_CONNECT_LISTENER, JSON.stringify(context), new Date());
        await ctx.scene.leave();
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});


export class PvKeyMnemonicMultiWalletConnectListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`PvKeyMnemonicMultiWalletConnectListener.class processing scene message [${text}]`)
        const context = JSON.parse(sceneContext.scene.text)
        if (context.name === null) {
            if (text.length > 8) {
                sendError(ctx, "8 letters max, only numbers and letters.");
                await new SceneStageService().deleteScene(telegramId)
                return
            }
            if (!/^[A-Za-z0-9]*$/.test(text)) {
                sendError(ctx, "name contains special characters, only numbers and letters.");
                await new SceneStageService().deleteScene(telegramId)
                return
            }
            if (await isAdditionalWalletNameExist(telegramId, text)) {
                sendError(ctx, `a wallet with the name <code>${text}</code> already exists. Please choose another name`);
                await new SceneStageService().deleteScene(telegramId)
                return
            } else {
                await ctx.telegram.sendMessage(ctx.from.id, "What's the private key of this wallet? You may also use a 12-word mnemonic phrase.", {
                    parse_mode: botEnum.PARSE_MODE_V2,
                    reply_markup: {
                        force_reply: true,
                        input_field_placeholder: '4ccee444e88dfc7....'
                    }
                });

                context.name = text;
                await new SceneStageService().saveScene(telegramId, PV_KEY_MNEMONIC_MULTI_WALLET_CONNECT_LISTENER, JSON.stringify(context), new Date());
            }
        } else if (context.pvKeyMnemonic == null) {
            if (await isAdditionalWalletPrivateKeyExist(telegramId, text)) {
                sendError(ctx, `The wallet with the private key provided already exists. Please choose another private key`);
                await new SceneStageService().deleteScene(telegramId)
                return
            }
            await receivePvKeyOrMnemonic(ctx, text, telegramId, context.chain, context.name, context.msgId);
        }
    }
}

async function sendError(ctx: any, message: string) {
    await ctx.telegram.sendMessage(ctx.from.id, message, {
        parse_mode: botEnum.PARSE_MODE_V2
    });
}

async function receivePvKeyOrMnemonic(ctx: any, pvKeyMnemonic: string, telegramId: string, chain: string, name: string, callbackMessageId: any) {
    try {
        if (await importWallet(telegramId, pvKeyMnemonic, true, name)) {
            const w = await getAdditionalWalletByPvKeyOrMnemonic(telegramId, pvKeyMnemonic);

            await ctx.telegram.sendMessage(ctx.chat.id, `Added ${chain} wallet (${name})`, {
                parse_mode: botEnum.PARSE_MODE_V2
            });


            let data: IAddressPagination = await getMultiWalletsPagination(telegramId);
            if (data.metaData[0].totalPages !== data.metaData[0].pageNumber + 1) {
                data = await getMultiWalletsPagination(telegramId, data.metaData[0].totalPages, 4);
            }
            const message = await multiWalletViewMessage();
            const setting = await getSettings(telegramId, chain)
            await ctx.telegram.editMessageText(telegramId, callbackMessageId, 0, message, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: markupMultiWalletMainPaginate(chain, data)
            });

            await new SceneStageService().deleteScene(telegramId)
            return true;
        }
    } catch (e) {
        Logging.info(`ops`)
    }
}

export default listener;
