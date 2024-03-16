import { Scenes } from 'telegraf';
import { botEnum } from '../../../constants/botEnum';
import { getWallet, importWallet } from '../../../service/wallet.service';
import { markupWalletConnected } from '../../../utils/inline.markups';
import Logging from '../../../utils/logging';
import { getWalletInfoOfChain, getWalletsDefaultMessage } from '../../../utils/messages';
import { MNEMONIC_PLACEHOLDER, WALLET_KEY_LISTENER } from '../../../utils/common';
import { ISceneResponse, SceneStageService } from '../../../service/scene.stage.service';
import { processError } from '../../../service/error';

const listener = new Scenes.BaseScene(WALLET_KEY_LISTENER);

// send a prompt message when user enters scene
listener.enter(async (ctx: any) => {
    const telegramId = ctx.update.callback_query.from.id;

    try {
        const ret = await ctx.telegram.sendMessage(ctx.chat.id, "What's the private key of this wallet? You may also use a 12-word mnemonic phrase.", {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: {
                force_reply: true,
                input_field_placeholder: MNEMONIC_PLACEHOLDER,
            }
        });

        try { await ctx.answerCbQuery() } catch { }


        const context = {
            initiator: JSON.stringify(ctx.update.callback_query),
            chain: ctx.scene.state.chain,
            message: JSON.stringify(ret),
            lastMessage: ctx.update.callback_query.message.message_id
        };

        await new SceneStageService().saveScene(telegramId, WALLET_KEY_LISTENER, JSON.stringify(context), new Date());
        await ctx.scene.leave();
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
})


export class PvKeyMnemonicListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`PvKeyMnemonicListener.class processing scene message [${text}]`)
        const context = JSON.parse(sceneContext.scene.text);

        if (await importWallet(telegramId, text)) {
            const w = await getWallet(telegramId)
            const chain = context.chain
            await ctx.telegram.sendMessage(
                ctx.chat.id,
                `✅ Chain: <b>${chain}</b>\n${'\nAddress: <code>' + w.address + '</code>\nPrivate Key: <code>' + w.privateKey + '</code>\nMnemonic: <code>' + w.mnemonic + '</code>'}\n` +
                `\n<i>⚠️Make sure to save this mnemonic phrase OR private key using pen and paper only. Do NOT copy-paste it anywhere. You could also import it to your Metamask/Trust Wallet. After you finish saving/importing the wallet credentials, delete this message. The bot will not display this information again.</i>`,
                {
                    parse_mode: botEnum.PARSE_MODE_V2
                }
            );

            await ctx.telegram.editMessageText(ctx.chat.id, context.lastMessage, 0, await getWalletsDefaultMessage(telegramId, chain), {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: markupWalletConnected(telegramId, chain)
            });

            await new SceneStageService().deleteScene(telegramId);
        }
    }
}

// reply to all other types of messages
listener.on('message', async (ctx: any) => {
    try {
        await ctx.reply('Please input private key or mnemonic for ethereum wallet')
    } catch (err) {
        await processError(ctx, ctx.from.id, err)
    }
});

export default listener;
