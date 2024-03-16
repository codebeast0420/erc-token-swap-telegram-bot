import { botEnum } from '../../../constants/botEnum';
import { IAddressPagination } from '../../../models/address.model';
import { IPremium } from '../../../models/premium.model';
import { userVerboseLog } from '../../../service/app.user.service';
import { processError } from '../../../service/error';
import { PremiumService } from '../../../service/premium.service';
import { getSettings, updateSettingsInfo } from '../../../service/settings.service';
import { deleteAddress, getMultiWallets, getMultiWalletsPagination } from '../../../service/wallet.service';
import { PV_KEY_MNEMONIC_MULTI_WALLET_CONNECT_LISTENER, PV_KEY_MNEMONIC_MULTI_WALLET_GENERATE_LISTENER } from '../../../utils/common';
import { getMultiWalletPaginationDetails, IPageAndLimit } from '../../../utils/global.functions';
import { markupMultiWalletMainDefault, markupMultiWalletMainPaginate } from '../../../utils/inline.markups';
import { multiWalletMainMessage, multiWalletMessage, multiWalletViewMessage } from '../../../utils/messages';

module.exports = (bot: any) => {
    // main menu
    const expression = /^multi_wallet_chain(.*)$/;
    const regex = RegExp(expression);

    bot.action(regex, async (ctx: any) => {
        const telegramId = ctx.from.id

        try {
            const chain = ctx.update.callback_query.data.split("multi_wallet_chain_")[1]

            await userVerboseLog(telegramId, `multi wallet [${chain}]`);

            if (ctx.chat.type === 'private') {
                const addresses: IAddressPagination = await getMultiWalletsPagination(ctx.update.callback_query.from.id);
                const setting = await getSettings(telegramId, chain)


                try {
                    const message = await multiWalletMainMessage(addresses.metaData[0].totalAddresses);
                    const msgId = ctx.update.callback_query.message.message_id;
                    await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                    });
                } catch (e) {
                    const message = await multiWalletMainMessage(addresses.metaData[0].totalAddresses);
                    await ctx.telegram.sendMessage(ctx.chat.id, message, {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                    });
                }

            } else {
                try {
                    ctx.answerCbQuery();
                } catch (e) { }
                await ctx.telegram.sendMessage(ctx.chat.id, 'Multi Wallet is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

    // return to main menu
    bot.action(RegExp('^' + botEnum.multiWalletReturn.value + '_.+'), async (ctx: any) => {
        const telegramId = ctx.from.id

        try {
            const chain = ctx.update.callback_query.data.split("multi_wallet_chain_")[1]

            await userVerboseLog(telegramId, `multi wallet [${chain}]`);

            if (ctx.chat.type === 'private') {
                const addresses: IAddressPagination = await getMultiWalletsPagination(ctx.update.callback_query.from.id);
                const setting = await getSettings(telegramId, chain)


                try {
                    const message = await multiWalletMainMessage(addresses.metaData[0].totalAddresses);
                    const msgId = ctx.update.callback_query.message.message_id;
                    await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                    });
                } catch (e) {
                    const message = await multiWalletMainMessage(addresses.metaData[0].totalAddresses);
                    await ctx.telegram.sendMessage(ctx.chat.id, message, {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                    });
                }

            } else {
                try {
                    ctx.answerCbQuery();
                } catch (e) { }
                await ctx.telegram.sendMessage(ctx.chat.id, 'Multi Wallet is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

     // enable multi wallet
     const enableMultiWalletExpression = /^enable_mw_(.*)$/;
     const enableMultiWalletRegex = RegExp(enableMultiWalletExpression);
     bot.action(enableMultiWalletRegex, async (ctx: any) => {
         const telegramId = ctx.from.id;
         try {
             const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);
             const chain = pageLimit.chain
 
             await userVerboseLog(telegramId, `enable multi wallet`);
 
             if (ctx.chat.type === 'private') {
                 await updateSettingsInfo(telegramId, chain, { multiWallet: true })
                 const addresses: IAddressPagination = await getMultiWalletsPagination(ctx.update.callback_query.from.id);
                 const setting = await getSettings(telegramId, chain)
 
 
                 try {
                     const message = await multiWalletMainMessage(addresses.metaData[0].totalAddresses);
                     const msgId = ctx.update.callback_query.message.message_id;
                     await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                         parse_mode: botEnum.PARSE_MODE_V2,
                         reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                     });
                 } catch (e) {
                     const message = await multiWalletMainMessage(addresses.metaData[0].totalAddresses);
                     await ctx.telegram.sendMessage(ctx.chat.id, message, {
                         parse_mode: botEnum.PARSE_MODE_V2,
                         reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                     });
                 }
 
             } else {
                 try {
                     ctx.answerCbQuery();
                 } catch (e) { }
                 await ctx.telegram.sendMessage(ctx.chat.id, 'Multi Wallet is only allowed in private chat');
             }
         } catch (err) {
             await processError(ctx, telegramId, err)
         }
     });
 
     //disabled multi wallet
 
     const disableMultiWalletExpression = /^disable_mw_(.*)$/;
     const disableMultiWalletRegex = RegExp(disableMultiWalletExpression);
     bot.action(disableMultiWalletRegex, async (ctx: any) => {
         const telegramId = ctx.from.id;
         try {
             const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);
             const chain = pageLimit.chain
 
             await userVerboseLog(telegramId, `disable multi wallet`);
 
             if (ctx.chat.type === 'private') {
                 await updateSettingsInfo(telegramId, chain, { multiWallet: false })
                 const addresses: IAddressPagination = await getMultiWalletsPagination(ctx.update.callback_query.from.id);
                 const setting = await getSettings(telegramId, chain)
 
 
                 try {
                     const message = await multiWalletMainMessage(addresses.metaData[0].totalAddresses);
                     const msgId = ctx.update.callback_query.message.message_id;
                     await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                         parse_mode: botEnum.PARSE_MODE_V2,
                         reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                     });
                 } catch (e) {
                     const message = await multiWalletMainMessage(addresses.metaData[0].totalAddresses);
                     await ctx.telegram.sendMessage(ctx.chat.id, message, {
                         parse_mode: botEnum.PARSE_MODE_V2,
                         reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                     });
                 }
 
             } else {
                 try {
                     ctx.answerCbQuery();
                 } catch (e) { }
                 await ctx.telegram.sendMessage(ctx.chat.id, 'Multi Wallet is only allowed in private chat');
             }
         } catch (err) {
             await processError(ctx, telegramId, err)
         }
     });

    // connect wallet
    bot.action(RegExp('^' + botEnum.multiWalletConnectWallet.value + '_.+'), async (ctx: any) => {
        const telegramId = ctx.from.id;

        try {
            const chain = ctx.update.callback_query.data.slice(botEnum.multiWalletConnectWallet.value.length + 1)

            await userVerboseLog(telegramId, 'multi wallet connect wallet ');
            const premium: IPremium = await new PremiumService().getPremium(telegramId);

            let isPremiumUser = false;

            if (premium != null && premium.endDate != null && premium.endDate > new Date()) {
                isPremiumUser = true;
            }

            let addresses = await getMultiWallets(ctx.update.callback_query.from.id);
            if (addresses.length == 9 && !isPremiumUser) {
                try {
                    await ctx.telegram.answerCbQuery(ctx.callbackQuery.id, 'You have reached the maximum amount of additional wallets!', false, null, 40000);
                } catch (e) { }

                return;
            } else if (addresses.length >= 100 && isPremiumUser) {
                try {
                    await ctx.telegram.answerCbQuery(ctx.callbackQuery.id, 'You have reached the maximum amount of additional wallets!', false, null, 40000);
                } catch (e) { }

                return;
            }
            if (ctx.chat.type === 'private') {
                try {
                    //    ctx.answerCbQuery();
                } catch (e) { }
                await ctx.scene.enter(PV_KEY_MNEMONIC_MULTI_WALLET_CONNECT_LISTENER, { chain })
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Connect Multi Wallet is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

    // generate wallet
    bot.action(RegExp('^' + botEnum.multiWalletGenerateWallet.value + '_.+'), async (ctx: any) => {
        const telegramId = ctx.from.id;

        try {
            const chain = ctx.update.callback_query.data.slice(botEnum.multiWalletGenerateWallet.value.length + 1)

            await userVerboseLog(telegramId, 'multi wallet generate wallet ');
            const premium: IPremium = await new PremiumService().getPremium(telegramId);

            let isPremiumUser = false;

            if (premium != null && premium.endDate != null && premium.endDate > new Date()) {
                isPremiumUser = true;
            }

            let addresses = await getMultiWallets(ctx.update.callback_query.from.id);
            if (addresses.length == 9 && !isPremiumUser) {
                try {
                    await ctx.telegram.answerCbQuery(ctx.callbackQuery.id, 'You have reached the maximum amount of additional wallets!', false, null, 40000);
                } catch (e) { }

                return;
            } else if (addresses.length >= 100 && isPremiumUser) {
                try {
                    await ctx.telegram.answerCbQuery(ctx.callbackQuery.id, 'You have reached the maximum amount of additional wallets!', false, null, 40000);
                } catch (e) { }

                return;
            }

            if (ctx.chat.type === 'private') {
                try {
                    await ctx.answerCbQuery();
                } catch (e) { }
                await ctx.scene.enter(PV_KEY_MNEMONIC_MULTI_WALLET_GENERATE_LISTENER, { chain })
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Generate Multi Wallet is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

     // multiwallet view list
     bot.action(RegExp('^' + botEnum.multiWalletViewList.value + '(.*)$'), async (ctx: any) => {
        const telegramId = ctx.from.id;
        try {
            const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);
            const chain = pageLimit.chain

            await userVerboseLog(telegramId, `multi wallet [${chain}]`);

            if (ctx.chat.type === 'private') {
                const addresses: IAddressPagination = await getMultiWalletsPagination(ctx.update.callback_query.from.id, pageLimit.page, pageLimit.limit);

                const setting = await getSettings(telegramId, chain)

                if (addresses.data != null && addresses.data.length <= 0) {
                    try {
                        ctx.answerCbQuery();
                    } catch (e) { }
                    await ctx.telegram.sendMessage(ctx.chat.id, 'No additional wallets exist. You can add some by connecting an external wallet or generating a new one (recommended).', {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                    });

                    return true;
                } else {
                    try {
                        const message = await multiWalletViewMessage();
                        const msgId = ctx.update.callback_query.message.message_id;
                        await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                            parse_mode: botEnum.PARSE_MODE_V2,
                            reply_markup: markupMultiWalletMainPaginate(chain, addresses)
                        });
                    } catch (e) {
                        const message = await multiWalletViewMessage();
                        await ctx.telegram.sendMessage(ctx.chat.id, message, {
                            parse_mode: botEnum.PARSE_MODE_V2,
                            reply_markup: markupMultiWalletMainPaginate(chain, addresses)
                        });
                    }
                }
            } else {
                try {
                    ctx.answerCbQuery();
                } catch (e) { }
                await ctx.telegram.sendMessage(ctx.chat.id, 'Multi Wallet is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

    // delete additional wallet
    const deleteAdditionalWalletExpression = /^qww_d_(.*)$/;
    const deleteAdditionalWalletRegex = RegExp(deleteAdditionalWalletExpression);

    bot.action(deleteAdditionalWalletRegex, async (ctx: any) => {
        const telegramId = ctx.from.id;
        try {
            const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);
            const chain = pageLimit.chain

            await userVerboseLog(telegramId, `multi wallet [${chain}]`);

            if (ctx.chat.type === 'private') {
                const addresses: IAddressPagination = await getMultiWalletsPagination(ctx.update.callback_query.from.id, pageLimit.page, pageLimit.limit);

                const setting = await getSettings(telegramId, chain)

                if (addresses.data != null && addresses.data.length <= 0) {
                    try {
                        ctx.answerCbQuery();
                    } catch (e) { }
                    await ctx.telegram.sendMessage(ctx.chat.id, 'No additional wallets exist. You can add some by connecting an external wallet or generating a new one (recommended).', {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                    });

                    return true;
                } else {
                    try {
                        const message = await multiWalletViewMessage();
                        const msgId = ctx.update.callback_query.message.message_id;
                        await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                            parse_mode: botEnum.PARSE_MODE_V2,
                            reply_markup: markupMultiWalletMainPaginate(chain, addresses,true,pageLimit.addressId)
                        });
                    } catch (e) {
                        const message = await multiWalletViewMessage();
                        await ctx.telegram.sendMessage(ctx.chat.id, message, {
                            parse_mode: botEnum.PARSE_MODE_V2,
                            reply_markup: markupMultiWalletMainPaginate(chain, addresses,true,pageLimit.addressId)
                        });
                    }
                }
            } else {
                try {
                    ctx.answerCbQuery();
                } catch (e) { }
                await ctx.telegram.sendMessage(ctx.chat.id, 'Multi Wallet is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

    // confirm delete additional wallet
    const confirmDeleteAdditionalWalletExpression = /^qww_dc_(.*)$/;
    const confirmDeleteAdditionalWalletRegex = RegExp(confirmDeleteAdditionalWalletExpression);

    bot.action(confirmDeleteAdditionalWalletRegex, async (ctx: any) => {
        const telegramId = ctx.from.id;

        try {
            await userVerboseLog(telegramId, 'confirm delete additional multi wallet');

            const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);

            if (ctx.update.callback_query.message.chat.type === 'private') {
                const msgId = ctx.update.callback_query.message.message_id;
                const addresses: IAddressPagination = await getMultiWalletsPagination(ctx.update.callback_query.from.id, pageLimit.page, pageLimit.limit);

                const chain = pageLimit.chain

                if (addresses.data.length > 0) {
                    const result = await deleteAddress(telegramId, pageLimit.addressId);
                    if (result.acknowledged && result.deletedCount > 0) {
                        let foundIndex = null;
                        let found = false;
                        let count = 0;
                        for (let address of addresses.data) {
                            if (address._id.toString() === pageLimit.addressId) {
                                found = true;
                                foundIndex = count;
                            }
                            count++;
                        }

                        if (found) {
                            addresses.data.splice(foundIndex, 1);
                        }
                        if (addresses.data.length > 0) {
                            const chain = pageLimit.chain
                            const setting = await getSettings(telegramId, chain)
                            const message = await multiWalletMainMessage(addresses.metaData[0].totalAddresses);
                            await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                                parse_mode: botEnum.PARSE_MODE_V2,
                                reply_markup: markupMultiWalletMainPaginate(chain,addresses)
                            });
                        } else if (addresses.data.length == 0 && pageLimit.page > 1) {
                            const page = pageLimit.page - 1;
                            const addresses: IAddressPagination = await getMultiWalletsPagination(ctx.update.callback_query.from.id, page, pageLimit.limit);
                            const setting = await getSettings(telegramId, chain)
                            const message = await multiWalletMainMessage(addresses.metaData[0].totalAddresses);
                            await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                                parse_mode: botEnum.PARSE_MODE_V2,
                                reply_markup: markupMultiWalletMainPaginate(chain,addresses)
                            });
                        } else {
                            const chain = pageLimit.chain
                            const setting = await getSettings(telegramId, chain)
                            await ctx.telegram.editMessageText(
                                ctx.chat.id,
                                msgId,
                                0,
                                'No additional wallets exist. You can add some by connecting an external wallet or generating a new one (recommended).',
                                {
                                    parse_mode: botEnum.PARSE_MODE_V2,
                                    reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                                }
                            );
                            return true;
                        }
                    } else {
                        const chain = pageLimit.chain
                        const setting = await getSettings(telegramId, chain)
                        await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, 'Could not find address to delete', {
                            parse_mode: botEnum.PARSE_MODE_V2,
                            reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                        });

                        return;
                    }
                } else {
                    const chain = pageLimit.chain
                    const setting = await getSettings(telegramId, chain)
                    await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, 'No additional wallets exist. You can add some by connecting an external wallet or generating a new one (recommended).', {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                    });
                    return true;
                }
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Delete Additional Wallet is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });
};
