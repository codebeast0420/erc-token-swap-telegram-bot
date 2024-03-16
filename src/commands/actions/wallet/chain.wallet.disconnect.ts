import { botEnum } from '../../../constants/botEnum';
import { userVerboseLog } from '../../../service/app.user.service';
import { processError } from '../../../service/error';
import { disconnectWallet } from '../../../service/wallet.service';
import { markupWalletConfirmDisconnect, markupWalletDisconnected } from '../../../utils/inline.markups';
import { getWalletInfoOfChain, getWalletsDefaultMessage } from '../../../utils/messages';

module.exports = (bot: any) => {
    bot.action(RegExp('^' + botEnum.disconnectWallet.value + '_.+'), async (ctx: any) => {
        const telegramId = ctx.from.id;

        try {
            const chain = ctx.update.callback_query.data.slice(botEnum.disconnectWallet.value.length + 1)

            await userVerboseLog(telegramId, `disconnect wallet before confirmation [${chain}]`);

            const msg = ctx.update.callback_query.message;

            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, 0, await getWalletsDefaultMessage(telegramId, chain), {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: markupWalletConfirmDisconnect(telegramId, chain)
            });
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

    bot.action(RegExp('^' + botEnum.confirmDisconnect.value + '_.+'), async (ctx: any) => {
        const telegramId = ctx.from.id;

        try {
            const chain = ctx.update.callback_query.data.slice(botEnum.confirmDisconnect.value.length + 1)

            await userVerboseLog(telegramId, `confirm disconnect wallet [${chain}]`);

            await disconnectWallet(telegramId);

            const msg = ctx.update.callback_query.message;

            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, 0, await getWalletsDefaultMessage(telegramId, chain), {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: await markupWalletDisconnected(telegramId, chain)
            });
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });
};
