import { botEnum } from '../constants/botEnum';
import { updateChatId, userVerboseLog } from '../service/app.user.service';
import { processError } from '../service/error';

const invokeHelp = async (ctx: any) => {
    // ctx.update.callback_query.from

    const telegramId = ctx.from.id;

    try {
        let text = '';

        userVerboseLog(telegramId, '/help');

        await updateChatId(telegramId, ctx.chat.id);

        text += `Public Commands:
<b>/start</b> - Let's get this party started! 🎉
<b>/sniper</b> - Summons the sniperbot main panel
<b>/state</b> - Shows private key or mnemonic, native currency balance of current user
<b>/transfer</b> - Transfers native currency, or token to other wallet
<b>/trade</b> - Buy/Sell a token in a basic way
<b>/wallets</b> - Reveals all of your connected wallets
<b>/monitor</b> - Spawns the trade monitor panel in case the user deletes it by accident
<b>/quick</b> - Summons the sniperbot quick panel
<b>/copytrade</b> - Configures wallets to follow trades on exchanges
<b>/scraper</b> - Search the tg link to scrape off of
<b>/presales</b> - Shows the presale main panel
<b>/settings</b> - Configures buy/sell/approve settings for trades
<b>/cleartrade</b> - Clear all copytrade/snipe settings
<b>/help</b> - Prints this help message
        `;

        await ctx.telegram.sendMessage(ctx.chat.id, text, {
            parse_mode: botEnum.PARSE_MODE_V2
        });
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

module.exports = (bot: any) => {
    bot.command(botEnum.help.value, invokeHelp);
    bot.action(botEnum.help.value, invokeHelp);
};
