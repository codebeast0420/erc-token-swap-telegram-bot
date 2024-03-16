import Logging from '../utils/logging';
import { botEnum } from '../constants/botEnum';
import { BotMessage } from '../service/api.bot.message'
import { markupStart } from '../utils/inline.markups';
import { createAppUserIfNotExist, updateChatId, userVerboseLog } from '../service/app.user.service';
import { getTransactionBackupById, retryTx } from '../service/transaction.backup.service';
import { processError } from '../service/error';
import { AffiliateService } from '../service/affiliate.service';
import { getSelectedChain, selectChain } from '../service/connected.chain.service';
import { getAllChains } from '../service/chain.service';
import { processContractAddress } from '../service/token.service';
import { createRandomWallet, getWallet } from '../service/wallet.service';
import { getETHBalance } from '../web3/nativecurrency/nativecurrency.query';

const invokeStart = async (ctx: any) => {
    const telegramId = ctx.from.id;
    // check if user exist, save if not found
    try {
        await userVerboseLog(telegramId, '/start' + ' ' + JSON.stringify(ctx.from));

        const accountExistsOrCreated = await createAppUserIfNotExist(telegramId, ctx.from.first_name, ctx.from.last_name, ctx.from.username, ctx.chat.id);
        if (accountExistsOrCreated) {
            await userVerboseLog(telegramId, 'already exists in database');
        }

        try {
            let chain = await getSelectedChain(telegramId)
        } catch (err) {
            const allChains = getAllChains()
            await selectChain(telegramId, allChains[0])
        }
        const chain = await getSelectedChain(telegramId)

        await updateChatId(telegramId, ctx.chat.id);

        try {
            if (ctx.update?.message?.text === undefined) {
                await ctx.deleteMessage();
            }
        } catch { }

        const wallet = await getWallet(ctx.chat.id, true)
        if (ctx.chat.type === 'private' && !wallet) {
            await ctx.telegram.sendMessage(ctx.chat.id, "No default wallet found, Creating a new wallet just for you ...", {
                parse_mode: botEnum.PARSE_MODE_V2,
            })

            if (await createRandomWallet(ctx.chat.id)) {
                const w = await getWallet(ctx.chat.id);
                await ctx.telegram.sendMessage(
                    ctx.chat.id,
                    `✅ Chain: <b>${chain}</b>\n${'\nAddress: <code>' + w.address + '</code>\nPrivate Key: <code>' + w.privateKey + '</code>\nMnemonic: <code>' + w.mnemonic + '</code>'}\n` +
                    `\n<i>⚠️Make sure to save this mnemonic phrase OR private key using pen and paper only. Do NOT copy-paste it anywhere. You could also import it to your Metamask/Trust Wallet. After you finish saving/importing the wallet credentials, delete this message. The bot will not display this information again.</i>`,
                    {
                        parse_mode: botEnum.PARSE_MODE_V2
                    }
                );
            }
        }

        // process start with address on payload
        if ((ctx.startPayload !== undefined && ctx.startPayload !== null) && ctx.startPayload.length > 0 && /^0x[a-fA-F0-9]{40}$/.test(ctx.startPayload)) {
            const address = ctx.startPayload
            await processContractAddress(ctx, telegramId, chain, address, undefined, (new Date()).getTime())
        } else {
            const wallet = await getWallet(telegramId, true)
            const bal = await getETHBalance(telegramId, chain, wallet?.address);
            await ctx.telegram.sendMessage(telegramId, BotMessage.startMessage(wallet?.address || "", bal), {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: markupStart(telegramId, ctx.from.first_name),
                disable_web_page_preview: true
            });
        }
    } catch (err) {
        await processError(ctx, telegramId, err)
    }


    // process start subscription
    if ((ctx.startPayload !== undefined && ctx.startPayload !== null) && ctx.startPayload.length > 0 && /chartai_code/.test(ctx.startPayload)) {
        const code = ctx.startPayload.split("_").splice(-1)[0]
        await new AffiliateService().processSubscription(ctx, telegramId, `https://chartai.tech/${code}`)
    }
};

module.exports = (bot: any) => {
    bot.start(invokeStart);
    bot.action(botEnum.menu.value, invokeStart);

    bot.action(RegExp('^' + botEnum.closeTxMessage + '_.+'), async (ctx: any) => {
        try {
            const tbckId = ctx.update.callback_query.data.slice(botEnum.closeTxMessage.length + 1);
            const tbck: any = await getTransactionBackupById(tbckId);
            if (tbck === null) {
                await ctx.telegram.sendMessage(ctx.chat.id, '❌ No valid action');
            } else {
                await tbck.populate('user');
                await ctx.telegram.deleteMessage(tbck.user.chatId, tbck.msgId);
            }
        } catch (err) {
            await processError(ctx, ctx.from.id, err)
        }
    });

    bot.action(RegExp('^' + botEnum.retryTxMessage + '_.+'), async (ctx: any) => {
        try {
            const tbckId = ctx.update.callback_query.data.slice(botEnum.retryTxMessage.length + 1);
            await retryTx(ctx, tbckId);
        } catch (err) {
            await processError(ctx, ctx.from.id, err)
        }
    });
};
