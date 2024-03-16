import { botEnum } from '../../../constants/botEnum';
import { IAddress, IAddressPagination } from '../../../models/address.model';
import { userVerboseLog } from '../../../service/app.user.service';
import { processError } from '../../../service/error';
import { getSettings } from '../../../service/settings.service';
import { deleteAddress, enableDisableAdditionalAddress, getMultiWalletsPagination } from '../../../service/wallet.service';
import { RENAME_MULTI_WALLET_LISTENER } from '../../../utils/common';
import { getMultiWalletPaginationDetails, IPageAndLimit } from '../../../utils/global.functions';
import { manageAdditionalDynamicWalletMainMenu, markupMultiWalletMainDefault, markupMultiWalletMainPaginate } from '../../../utils/inline.markups';
import { multiWalletMessage } from '../../../utils/messages';

module.exports = (bot: any) => {
    // manage additional wallet main menu
    const expression = /^qwa_x_(.*)$/;
    const regex = RegExp(expression);

    bot.action(regex, async (ctx: any) => {
        const telegramId = ctx.from.id;

        try {
            const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);

            await userVerboseLog(telegramId, 'manage additional multi wallet');

            const chain = pageLimit.chain

            if (ctx.update.callback_query.message.chat.type === 'private') {
                const msgId = ctx.update.callback_query.message.message_id;
                const addresses: IAddressPagination = await getMultiWalletsPagination(ctx.update.callback_query.from.id, pageLimit.page, pageLimit.limit);
                const message = await multiWalletMessage(telegramId, chain, addresses.data);

                const cn = addresses.data.filter((w: IAddress) => w._id.toString() === pageLimit.addressId);

                if (cn.length !== 0) {
                    await ctx.telegram.editMessageText(telegramId, msgId, 0, message, {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: await manageAdditionalDynamicWalletMainMenu(telegramId, chain, cn[0], false, pageLimit)
                    });
                } else {
                    const setting = await getSettings(telegramId, chain)
                    await ctx.telegram.sendMessage(ctx.chat.id, 'Wallet not found, please try again', {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                    });
                    return true;
                }
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Mange Additional Wallet is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

    // enable additional wallet
    const enableAdditionalWalletExpression = /^qwa_e_(.*)$/;
    const enableAdditionalWalletRegex = RegExp(enableAdditionalWalletExpression);

    bot.action(enableAdditionalWalletRegex, async (ctx: any) => {
        const telegramId = ctx.from.id;
        try {
            await userVerboseLog(telegramId, 'enable additional multi wallet');

            const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);

            const chain = pageLimit.chain

            if (ctx.update.callback_query.message.chat.type === 'private') {
                const msgId = ctx.update.callback_query.message.message_id;
                const addresses: IAddressPagination = await getMultiWalletsPagination(ctx.update.callback_query.from.id, pageLimit.page, pageLimit.limit);
                let cn = addresses.data.filter((w: IAddress) => w._id.toString() === pageLimit.addressId);
                if (cn.length !== 0) {
                    const address = await enableDisableAdditionalAddress(pageLimit.addressId, true);

                    for (let temp of addresses.data) {
                        if (temp._id.toString() === address.id.toString()) {
                            temp.connected = address.connected;
                        }
                    }

                    const message = await multiWalletMessage(telegramId, chain, addresses.data);

                    await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: await manageAdditionalDynamicWalletMainMenu(telegramId, chain, address, false, pageLimit)
                    });
                } else {
                    const setting = await getSettings(telegramId, chain)
                    await ctx.telegram.sendMessage(ctx.chat.id, 'No additional wallets exist. You can add some by connecting an external wallet or generating a new one (recommended).', {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                    });

                    return true;
                }
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Enable Additional Wallet is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

    // disable additional wallet
    const disableAdditionalWalletExpression = /^qwa_ev_(.*)$/;
    const disableAdditionalWalletRegex = RegExp(disableAdditionalWalletExpression);

    bot.action(disableAdditionalWalletRegex, async (ctx: any) => {
        const telegramId = ctx.from.id;

        try {
            await userVerboseLog(telegramId, 'disable additional multi wallet');

            const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);

            const chain = pageLimit.chain

            if (ctx.update.callback_query.message.chat.type === 'private') {
                const msgId = ctx.update.callback_query.message.message_id;
                const addresses: IAddressPagination = await getMultiWalletsPagination(ctx.update.callback_query.from.id, pageLimit.page, pageLimit.limit);
                let cn = addresses.data.filter((w: IAddress) => w._id.toString() === pageLimit.addressId);
                if (cn.length !== 0) {
                    const address = await enableDisableAdditionalAddress(pageLimit.addressId, false);

                    for (let temp of addresses.data) {
                        if (temp._id.toString() === address.id.toString()) {
                            temp.connected = address.connected;
                        }
                    }
                    const message = await multiWalletMessage(telegramId, chain, addresses.data);

                    await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: await manageAdditionalDynamicWalletMainMenu(telegramId, chain, address, false, pageLimit)
                    });
                } else {
                    const setting = await getSettings(telegramId, chain)
                    await ctx.telegram.sendMessage(ctx.chat.id, 'No additional wallets exist. You can add some by connecting an external wallet or generating a new one (recommended).', {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: markupMultiWalletMainDefault(telegramId, chain, setting.multiWallet)
                    });
                    return true;
                }
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Enable Additional Wallet is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

    // delete additional wallet
    const deleteAdditionalWalletExpression = /^qwa_d_(.*)$/;
    const deleteAdditionalWalletRegex = RegExp(deleteAdditionalWalletExpression);

    bot.action(deleteAdditionalWalletRegex, async (ctx: any) => {
        const telegramId = ctx.from.id;

        try {
            await userVerboseLog(telegramId, 'delete additional multi wallet');

            const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);

            const chain = pageLimit.chain

            if (ctx.update.callback_query.message.chat.type === 'private') {
                const msgId = ctx.update.callback_query.message.message_id;
                const addresses: IAddressPagination = await getMultiWalletsPagination(ctx.update.callback_query.from.id, pageLimit.page, pageLimit.limit);
                let cn = addresses.data.filter((w: IAddress) => w._id.toString() === pageLimit.addressId);
                if (addresses.data.length > 0) {
                    const message = await multiWalletMessage(telegramId, chain, addresses.data);
                    await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: await manageAdditionalDynamicWalletMainMenu(telegramId, chain, cn[0], true, pageLimit)
                    });
                } else {
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

    // confirm delete additional wallet
    const confirmDeleteAdditionalWalletExpression = /^qwa_dc_(.*)$/;
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
                            const message = await multiWalletMessage(telegramId, chain, addresses.data);
                            await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                                parse_mode: botEnum.PARSE_MODE_V2,
                                reply_markup: markupMultiWalletMainPaginate(chain, addresses)
                            });
                        } else if (addresses.data.length == 0 && pageLimit.page > 1) {
                            const page = pageLimit.page - 1;
                            const addresses: IAddressPagination = await getMultiWalletsPagination(ctx.update.callback_query.from.id, page, pageLimit.limit);
                            const setting = await getSettings(telegramId, chain)
                            const message = await multiWalletMessage(telegramId, chain, addresses.data);
                            await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                                parse_mode: botEnum.PARSE_MODE_V2,
                                reply_markup: markupMultiWalletMainPaginate(chain, addresses)
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

    // rename additional wallet
    const renameAdditionalWalletExpression = /^rename_(.*)$/;
    const renameAdditionalWalletRegex = RegExp(renameAdditionalWalletExpression);

    bot.action(renameAdditionalWalletRegex, async (ctx: any) => {
        const telegramId = ctx.from.id;

        try {
            await userVerboseLog(telegramId, 'rename additional multi wallet');

            if (ctx.update.callback_query.message.chat.type === 'private') {
                await ctx.scene.enter(RENAME_MULTI_WALLET_LISTENER);
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Rename Additional Wallet is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });
};
