import { Scenes } from 'telegraf';
import { botEnum } from '../../../constants/botEnum';
import { IAddressPagination } from '../../../models/address.model';
import { createRandomWallet, getAdditionalWalletByName, getMultiWalletsPagination, isAdditionalWalletNameExist } from '../../../service/wallet.service';
import { markupMultiWalletMainPaginate } from '../../../utils/inline.markups';
import { multiWalletMessage } from '../../../utils/messages';
import { PV_KEY_MNEMONIC_MULTI_WALLET_GENERATE_LISTENER } from '../../../utils/common';
import { ISceneResponse, SceneStageService } from '../../../service/scene.stage.service';
import Logging from '../../../utils/logging';
import { getSettings } from '../../../service/settings.service';
import { processError } from '../../../service/error';

const listener = new Scenes.BaseScene(PV_KEY_MNEMONIC_MULTI_WALLET_GENERATE_LISTENER);

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

        const context = {
            initiator: JSON.stringify(ctx.update.callback_query),
            chain: ctx.scene.state.chain,
            message: JSON.stringify(ret),
            name: null,
            pvKeyMnemonic: null,
            msgId: ctx.update.callback_query.message.message_id,
        };


        await new SceneStageService().saveScene(telegramId, PV_KEY_MNEMONIC_MULTI_WALLET_GENERATE_LISTENER, JSON.stringify(context), new Date());
        await ctx.scene.leave();
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});


export class PvKeyMnemonicMultiWalletGenerateListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`PvKeyMnemonicMultiWalletGenerateListener.class processing scene message [${text}]`)
        const context = JSON.parse(sceneContext.scene.text)

        if (context.name == null) {
            if (text.length > 8) {
                sendError(ctx, "8 letters max, only numbers and letters. Let's try again, what would you like to name this wallet?");
                return;
            }
            if (!/^[A-Za-z0-9]*$/.test(text)) {
                sendError(ctx, "name contains special characters, only numbers and letters. Let's try again, what would you like to name this wallet?");
                return;
            }
            if (await isAdditionalWalletNameExist(telegramId, text)) {
                sendError(ctx, `a wallet with the name <code>${text}</code> already exists. Please choose another name`);
                return;
            } else {
                await generateWallet(ctx, telegramId, context.chain, text, context.msgId);
                await new SceneStageService().deleteScene(telegramId)
            }
        }
    }
}

export async function sendError(ctx: any, message: string) {
    await ctx.telegram.sendMessage(ctx.from.id, message, {
        parse_mode: botEnum.PARSE_MODE_V2
    });
}

async function generateWallet(ctx: any, telegramId: string, chain: string, name: string, msgId: string) {
    if (await createRandomWallet(telegramId, true, name)) {
        const w = await getAdditionalWalletByName(telegramId, name);

        await ctx.telegram.sendMessage(
            ctx.chat.id,
            `✅ Chain: <b>${chain}</b>\n${'\nAddress: <code>' + w.address + '</code>\nPrivate Key: <code>' + w.privateKey + '</code>\nMnemonic: <code>' + w.mnemonic + '</code>'}\n` +
            `\n<i>⚠️ Make sure to save this mnemonic phrase OR private key using pen and paper only. Do NOT copy-paste it anywhere. You could also import it to your Metamask/Trust Wallet. After you finish saving/importing the wallet credentials, delete this message. The bot will not display this information again.</i>`,
            {
                parse_mode: botEnum.PARSE_MODE_V2
            }
        );

        let data: IAddressPagination = await getMultiWalletsPagination(telegramId);
        if (data.metaData[0].totalPages !== data.metaData[0].pageNumber + 1) {
            data = await getMultiWalletsPagination(telegramId, data.metaData[0].totalPages, 4);
        }
        const message = await multiWalletMessage(telegramId, chain, data.data);
        const setting = await getSettings(telegramId, chain)
        await ctx.telegram.editMessageText(telegramId, msgId, 0, message, {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: markupMultiWalletMainPaginate(chain, data)
        });
    }
}

export default listener;
