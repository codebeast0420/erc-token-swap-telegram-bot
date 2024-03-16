import { botEnum } from '../../../../constants/botEnum';
import { userVerboseLog } from '../../../../service/app.user.service';
import { processError } from '../../../../service/error';
import { getAddressById } from '../../../../service/wallet.service';
import { MULTI_WALLET_TRANSFER_NATIVE_CURRENCY_LISTENER, MULTI_WALLET_TRANSFER_TOKEN_LISTENER } from '../../../../utils/common';
import { getMultiWalletPaginationDetails, IPageAndLimit } from '../../../../utils/global.functions';
import { getNativeCurrencySymbol } from '../../../../web3/chain.parameters';
import { getETHBalance } from '../../../../web3/nativecurrency/nativecurrency.query';
import { getBN } from '../../../../web3/web3.operation';

module.exports = (bot: any) => {
    // transfer native currency
    const expression = /^tnc_(.*)$/;
    const regex = RegExp(expression);

    bot.action(regex, async (ctx: any) => {
        const telegramId = ctx.from.id;
        try {
            await userVerboseLog(telegramId, 'multi wallet transfer native currency');

            if (ctx.update.callback_query.message.chat.type === 'private') {
                const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);
                const chain = pageLimit.chain

                const address = await getAddressById(pageLimit.addressId);

                const ethBal = await getETHBalance(telegramId, chain, address.address);
                const BN = getBN();

                if (BN(ethBal).eq(0)) {
                    await ctx.telegram.sendMessage(ctx.chat.id, `❌ You have no ${await getNativeCurrencySymbol(chain)}`);
                } else {
                    await ctx.scene.enter(MULTI_WALLET_TRANSFER_NATIVE_CURRENCY_LISTENER);
                }
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Transfer native currency is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

    // transfer native currency
    const expressionTokenTransfer = /^tt_(.*)$/;
    const regexTokenTransfer = RegExp(expressionTokenTransfer);

    bot.action(regexTokenTransfer, async (ctx: any) => {
        const telegramId = ctx.from.id;
        try {
            await userVerboseLog(telegramId, 'multi wallet transfer token');

            if (ctx.update.callback_query.message.chat.type === 'private') {
                const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);
                const address = await getAddressById(pageLimit.addressId);

                if (address == null || typeof address === undefined) {
                    await ctx.telegram.sendMessage(ctx.chat.id, `❌ address not found`, { parse_mode: botEnum.PARSE_MODE_V2 });
                } else {
                    await ctx.scene.enter(MULTI_WALLET_TRANSFER_TOKEN_LISTENER);
                }
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Transfer native currency is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });
};
