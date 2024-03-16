import { botEnum } from '../../../constants/botEnum';
import { IAddressPagination } from '../../../models/address.model';
import { userVerboseLog } from '../../../service/app.user.service';
import { processError } from '../../../service/error';
import { getAddressByAddress, getMultiWallets, getMultiWalletsPagination } from '../../../service/wallet.service';
import { IPageAndLimit, getMultiWalletPaginationDetails } from '../../../utils/global.functions';
import { markupTransferChangeMainWalletPaginate } from '../../../utils/inline.markups';
import { changeMainWalletMessage } from '../../../utils/messages';

module.exports = (bot: any) => {
    // main menu
    const expression = /^t_change_mw(.*)$/;
    const regex = RegExp(expression);

    bot.action(regex, async (ctx: any) => {
        const telegramId = ctx.from.id;
        try {
            await userVerboseLog(telegramId, 'select transfer main wallet');
            const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);
            const chain = pageLimit.chain

            if (ctx.chat.type === 'private') {
                const addresses: IAddressPagination = await getMultiWalletsPagination(ctx.update.callback_query.from.id, pageLimit.page, pageLimit.limit);
                let message = ctx.update.callback_query.message
                let currentAddress = message.text.substring(message.entities[1].offset, message.entities[1].offset + message.entities[1].length);
                let selectedAdress: any = await getAddressByAddress(currentAddress);


                if (addresses.data != null && addresses.data.length <= 0) {
                    try {
                        ctx.answerCbQuery();
                    } catch (e) { }
                    // TODO send default page
                    await ctx.telegram.sendMessage(ctx.chat.id, 'No additional wallets exist. You can add some by connecting an external wallet or generating a new one (recommended).', {
                        parse_mode: botEnum.PARSE_MODE_V2,
                    });

                    return true;
                } else {

                    try {
                        const message = await changeMainWalletMessage(selectedAdress, addresses.metaData[0].totalAddresses);
                        const msgId = ctx.update.callback_query.message.message_id;
                        await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                            parse_mode: botEnum.PARSE_MODE_V2,
                            reply_markup: await markupTransferChangeMainWalletPaginate(telegramId, chain, true, addresses, selectedAdress)
                        });
                    } catch (e) {
                        const message = await changeMainWalletMessage(selectedAdress, addresses.metaData[0].totalAddresses);
                        await ctx.telegram.sendMessage(ctx.chat.id, message, {
                            parse_mode: botEnum.PARSE_MODE_V2,
                            reply_markup: await markupTransferChangeMainWalletPaginate(telegramId, chain, true, addresses, selectedAdress)
                        });
                    }
                }

            } else {
                try {
                    ctx.answerCbQuery();
                } catch (e) { }
                await ctx.telegram.sendMessage(ctx.chat.id, 'Select main wallet transfer change is only allowed in private chat');
            }

        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });
};
