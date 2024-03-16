import { botEnum } from '../constants/botEnum';
import { updateChatId, userVerboseLog } from '../service/app.user.service';
import { processError } from '../service/error';

const invokePresales = async (ctx: any) => {
    // ctx.update.callback_query.from

    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, '/presales');

        await updateChatId(telegramId, ctx.chat.id);
        await ctx.telegram.sendMessage(ctx.chat.id, 'You are not subscribed to any presale.', {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: botEnum.menu.key,
                            callback_data: botEnum.menu.value
                        }
                    ],
                    [
                        {
                            text: botEnum.addPresale.key,
                            callback_data: botEnum.addPresale.value
                        }
                    ],
                    [
                        {
                            text: botEnum.presaleGasPrice.key,
                            callback_data: botEnum.presaleGasPrice.value
                        },
                        {
                            text: botEnum.presaleRemoveGasPrice.key,
                            callback_data: botEnum.presaleRemoveGasPrice.value
                        }
                    ]
                ]
            }
        });
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

module.exports = (bot: any) => {
    bot.command(botEnum.presales.value, invokePresales);
    bot.action(botEnum.presales.value, invokePresales);
};
