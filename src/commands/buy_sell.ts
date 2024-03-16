import { botEnum } from '../constants/botEnum';
// import { walletAction } from '../utils/messages';
// import { walletConfigMarkup } from '../utils/inline.markups';
import { updateChatId, userVerboseLog } from '../service/app.user.service';
import { processError } from '../service/error';

module.exports = (bot: any) => {
    const buyTokens = async (ctx: any) => {
        const telegramId = ctx.from.id;
        try {
            await updateChatId(telegramId, ctx.chat.id);

            await bot.telegram.sendMessage(ctx.chat.id,
                "Enter a token address:", {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true,
                    input_field_placeholder: '0x62B65f42Fa6A...'
                }
            });
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    };
    bot.command(botEnum.buy.value, async (ctx: any) => {
        await buyTokens(ctx);
    });

    bot.action(botEnum.buy.value, async (ctx: any) => {
        await buyTokens(ctx);
    });

    bot.command(botEnum.sell.value, async (ctx: any) => {
        await buyTokens(ctx);
    });

    bot.action(botEnum.sell.value, async (ctx: any) => {
        await buyTokens(ctx);
    });
};
