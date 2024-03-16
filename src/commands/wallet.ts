import { botEnum } from '../constants/botEnum';
import { walletAction } from '../utils/messages';
import { walletConfigMarkup } from '../utils/inline.markups';
import { updateChatId, userVerboseLog } from '../service/app.user.service';
import { processError } from '../service/error';

module.exports = (bot: any) => {
    const invokeWallets = async (ctx: any) => {
        const telegramId = ctx.from.id;
        try {
            await userVerboseLog(telegramId, '/wallets');

            await updateChatId(telegramId, ctx.chat.id);

            await bot.telegram.sendMessage(ctx.chat.id, walletAction, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: walletConfigMarkup()
            });
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    };
    bot.command(botEnum.wallets.value, async (ctx: any) => {
        await invokeWallets(ctx);
    });

    bot.action(botEnum.wallets.value, async (ctx: any) => {
        await invokeWallets(ctx);
    });
};
