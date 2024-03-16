import { botEnum } from '../../../constants/botEnum';

import { getWalletInfoOfChain, getWalletsDefaultMessage } from '../../../utils/messages';
import { selectChain } from '../../../service/connected.chain.service';
import { getWallet } from '../../../service/wallet.service';
import { userVerboseLog } from '../../../service/app.user.service';
import { markupWalletConnected, markupWalletDisconnected } from '../../../utils/inline.markups';
import { type } from 'os';
import { processError } from '../../../service/error';

module.exports = (bot: any) => {
    bot.action(RegExp('^' + botEnum.select_chain.value + '_.+'), async (ctx: any) => {
        const telegramId = ctx.from.id;

        try {
            await ctx.deleteMessage();
        } catch { }

        try {
            const chain = ctx.update.callback_query.data.slice(botEnum.select_chain.value.length + 1)
            await userVerboseLog(telegramId, `select chain [${chain}]`);

            await selectChain(telegramId, chain);

            let wallet;
            try {
                wallet = await getWallet(telegramId);
            } catch { }

            let walletConnected = true;

            if (typeof wallet === undefined || wallet === undefined || wallet === null) {
                walletConnected = false;
            }

            await bot.telegram.sendMessage(telegramId, await getWalletsDefaultMessage(telegramId, chain), {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: walletConnected ? markupWalletConnected(telegramId, chain) : markupWalletDisconnected(telegramId, chain)
            });
        } catch (err) {
            await processError(ctx, telegramId, err);
        }
    });
};
