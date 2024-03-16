import { botEnum } from '../constants/botEnum';
import { updateChatId, userVerboseLog } from '../service/app.user.service';
import { processError } from '../service/error';

const invokeScraper = async (ctx: any) => {
    // ctx.update.callback_query.from

    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, '/scraper');

        await updateChatId(telegramId, ctx.chat.id);
        await ctx.telegram.sendMessage(ctx.chat.id, "Select all channels you'd like to subscribe to! 🩸", {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: botEnum.menu.key,
                            callback_data: botEnum.menu.value
                        },
                        {
                            text: botEnum.searchTgLink.key,
                            callback_data: botEnum.searchTgLink.value
                        }
                    ],
                    [
                        {
                            text: '✅ Me',
                            callback_data: 'tg_link_me'
                        },
                        {
                            text: '✅ Scraper',
                            callback_data: 'tg_link_scraper'
                        },
                        {
                            text: '❌ caesarsgambles',
                            callback_data: 'tg_link_caesarsgambles'
                        }
                    ],
                    [
                        {
                            text: '❌ Venom',
                            callback_data: 'tg_link_venom'
                        },
                        {
                            text: '❌ Gubbins',
                            callback_data: 'tg_link_gubbins'
                        },
                        {
                            text: '❌ Caesar',
                            callback_data: 'tg_link_caesar'
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
    bot.command(botEnum.scraper.value, invokeScraper);
    bot.action(botEnum.scraper.value, invokeScraper);
};
