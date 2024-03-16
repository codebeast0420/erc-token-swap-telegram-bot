import { botEnum } from '../../../constants/botEnum';
import { createRandomWallet, getWallet } from '../../../service/wallet.service';
import { getWalletInfoOfChain, getWalletsDefaultMessage } from '../../../utils/messages';
import { userVerboseLog } from '../../../service/app.user.service';
import { markupWalletConnected, markupWalletDisconnected } from '../../../utils/inline.markups';
import { processError } from '../../../service/error';

module.exports = (bot: any) => {
    bot.action(RegExp('^' + botEnum.generate_wallet.value + '_.+'), async (ctx: any) => {
        const telegramId = ctx.from.id;

        try {
            const chain = ctx.update.callback_query.data.slice(botEnum.generate_wallet.value.length + 1)

            await userVerboseLog(telegramId, `generate wallet [${chain}]`);

            if (ctx.chat.type === 'private') {
                if (await createRandomWallet(ctx.update.callback_query.from.id)) {
                    const w = await getWallet(ctx.update.callback_query.from.id);
                    await ctx.telegram.sendMessage(
                        ctx.chat.id,
                        `✅ Chain: <b>${chain}</b>\n${'\nAddress: <code>' + w.address + '</code>\nPrivate Key: <code>' + w.privateKey + '</code>\nMnemonic: <code>' + w.mnemonic + '</code>'}\n` +
                        `\n<i>⚠️Make sure to save this mnemonic phrase OR private key using pen and paper only. Do NOT copy-paste it anywhere. You could also import it to your Metamask/Trust Wallet. After you finish saving/importing the wallet credentials, delete this message. The bot will not display this information again.</i>`,
                        {
                            parse_mode: botEnum.PARSE_MODE_V2
                        }
                    );

                    const msg = ctx.update.callback_query.message;
                    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, 0, await getWalletsDefaultMessage(telegramId, chain), {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: w.connected && w.selected ? markupWalletConnected(telegramId, chain) : markupWalletDisconnected(telegramId, chain)
                    });
                    return true;
                }
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Generate Wallet is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });
};
