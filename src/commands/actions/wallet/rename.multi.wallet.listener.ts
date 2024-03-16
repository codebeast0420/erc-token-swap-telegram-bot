import { Scenes } from 'telegraf';
import { botEnum } from '../../../constants/botEnum';
import { getMultiWalletsPagination, isAdditionalWalletNameExist, renameAddress } from '../../../service/wallet.service';
import { getMultiWalletPaginationDetails, IPageAndLimit } from '../../../utils/global.functions';
import { manageAdditionalDynamicWalletMainMenu } from '../../../utils/inline.markups';
import { multiWalletMessage } from '../../../utils/messages';
import { sendError } from './pvkey.mnemonic.multi.wallet.generate.listener';
import { ISceneResponse, SceneStageService } from '../../../service/scene.stage.service';
import { RENAME_MULTI_WALLET_LISTENER } from '../../../utils/common';
import Logging from '../../../utils/logging';
import { processError } from '../../../service/error';

const listener = new Scenes.BaseScene(RENAME_MULTI_WALLET_LISTENER);

// send a prompt message when user enters scene
listener.enter(async (ctx: any) => {
    const telegramId = ctx.update.callback_query.from.id;

    try {
        const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);

        const ret = await ctx.telegram.sendMessage(ctx.chat.id, 'what would you like to name this wallet? 8 letters max, only numbers and letters', {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: {
                force_reply: true,
                input_field_placeholder: 'Alpha'
            }
        });

        const context = {
            initiator: JSON.stringify(ctx.update.callback_query),
            chain: pageLimit.chain,
            message: JSON.stringify(ret),
            pageLimit: pageLimit,
            name: null,
            msgId: ctx.update.callback_query.message.message_id,
        };

        await new SceneStageService().saveScene(telegramId, RENAME_MULTI_WALLET_LISTENER, JSON.stringify(context), new Date());
        await ctx.scene.leave();
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});


export class RenameMultiWalletListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`RenameMultiWalletListener.class processing scene message [${text}]`)
        const context = JSON.parse(sceneContext.scene.text)
        if (context.name === null) {
            if (text.length > 8) {
                sendError(ctx, "8 letters max, only numbers and letters. Let's try again, what would you like to name this wallet?");
                await new SceneStageService().deleteScene(telegramId)
                return;
            }
            if (!/^[A-Za-z0-9]*$/.test(text)) {
                sendError(ctx, "name contains special characters, only numbers and letters. Let's try again, what would you like to name this wallet?");
                await new SceneStageService().deleteScene(telegramId)
                return;
            }
            if (await isAdditionalWalletNameExist(telegramId, text)) {
                sendError(ctx, `a wallet with the name <code>${text}</code> already exists. Please choose another name`);
                await new SceneStageService().deleteScene(telegramId)
                return;
            }
            else {
                await renameWallet(ctx, telegramId, context.pageLimit, text, context.msgId);
                await new SceneStageService().deleteScene(telegramId)
            }
        }
    }
}

async function renameWallet(ctx: any, telegramId: string, pageLimit: IPageAndLimit, name: string, msgId: string) {
    let address = await renameAddress(pageLimit.addressId, name);

    const chain = pageLimit.chain

    const addresses = await getMultiWalletsPagination(telegramId, pageLimit.page, pageLimit.limit);
    const message = await multiWalletMessage(telegramId, chain, addresses.data);

    await ctx.telegram.editMessageText(telegramId, msgId, 0, message, {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: await manageAdditionalDynamicWalletMainMenu(telegramId, chain, address, false, pageLimit)
    });
}

export default listener;
