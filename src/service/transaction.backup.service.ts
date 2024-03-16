import { externalInvokeMonitor } from '../commands/monitor';
import { botEnum } from '../constants/botEnum';
import { IAffiliateInfluencer } from '../models/affiliate.influencer.model';
import { TransactionBackupModel } from '../models/transaction.backup.model';
import { TransactionHistoryModel } from '../models/transaction.history.model';
import { getBlockExplorer } from '../web3/chain.parameters';
import { queryTokenInfoOnChain } from '../web3/multicall';
import { getBN, sendTxnAdvanced } from '../web3/web3.operation';
import { AffiliateService } from './affiliate.service';
import { getAppUser } from './app.user.service';
import { getPNL, updateBuyMonitorInfo, updateSellMonitorInfo } from './monitor.service';
import { createCard } from './plcard.service';
import { updateUserState } from './stat.service';
import { getTokenTaxInfo } from './token.service';

export async function newTransactionBackup(info: any) {
    const { telegramId, chain, to, data, value, address, gasPrice, label, exInfo } = info;

    const user = await getAppUser(telegramId);
    const newItem = new TransactionBackupModel({
        user: user._id,
        chain: chain,
        to: to.toLowerCase(),
        data: data,
        address: address ? JSON.stringify(address) : undefined,
        value: value,
        gasPrice: gasPrice ? parseFloat(gasPrice) : undefined,
        exInfo: JSON.stringify(exInfo)
    });

    await newItem.save();

    const findItems = await TransactionBackupModel.find({ user: user._id, chain: chain });
    if (findItems.length === 0) {
        throw new Error('Unexpected database error while appending a new transaction backup');
    }

    return await TransactionBackupModel.findById(findItems[findItems.length - 1]._id);
}

export async function updateTransactionBackup(id: any, updateInfo: any) {
    const tFound = await TransactionBackupModel.findById(id);
    if (updateInfo['transaction']) {
        const txFound = await TransactionHistoryModel.findOne({ chain: tFound.chain, transactionHash: updateInfo['transaction'] });
        updateInfo['transaction'] = txFound._id;
    }
    await TransactionBackupModel.findByIdAndUpdate(id, updateInfo);
}

export async function getTransactionBackup(telegramId: string, msgId: number) {
    const user = await getAppUser(telegramId);
    return await TransactionBackupModel.findOne({ user: user._id, msgId: msgId });
}

export async function getTransactionBackupById(id: any) {
    return await TransactionBackupModel.findById(id);
}

export function getTxCallback(label: string, success?: string) {
    const callback = async (bot: any, info: any, state: string) => {
        const { telegramId, chain, to, data, value, address, gasPrice, msgId, tx, error, exInfo } = info;

        let msgRet;
        if (state === 'pending') {
            const newBck: any = await newTransactionBackup(info);

            await newBck.populate('user');

            let labelTx = label
            if (tx) {
                const exp = await getBlockExplorer(chain)
                labelTx += `\n<i>Pending</i>\n${exp}/tx/${tx}`
            }

            msgRet = await bot.telegram.sendMessage(newBck.user.chatId, labelTx, {
                parse_mode: botEnum.PARSE_MODE_V2
            });

            await updateTransactionBackup(newBck._id, {
                msgId: msgRet.message_id,
                label: label
            });
        } else if (state === 'finished') {
            const bck: any = await getTransactionBackup(telegramId, msgId);
            await bck.populate('user');

            await updateTransactionBackup(bck._id, {
                transaction: tx,
                error: ''
            });

            const exp = await getBlockExplorer(bck.chain);

            try {
                await bot.telegram.editMessageText(bck.user.chatId, bck.msgId, 0, `${bck.label}\n${success ? success : '<i>Success</i>'}\n${exp}/tx/${tx}`, {
                    parse_mode: botEnum.PARSE_MODE_V2,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Repeat',
                                    callback_data: botEnum.retryTxMessage + '_' + bck._id
                                },
                                {
                                    text: 'Dismiss',
                                    callback_data: botEnum.closeTxMessage + '_' + bck._id
                                }
                            ]
                        ]
                    }
                });

                if (bck.exInfo) {
                    let parsedExInfo = JSON.parse(bck.exInfo)

                    if (parsedExInfo.type === "sell") {
                        const BN = getBN()
                        const tokenInfo = await queryTokenInfoOnChain(telegramId, chain, parsedExInfo.token, parsedExInfo.user);
                        const holdings = BN(tokenInfo.balance).times(100).integerValue().div(100)

                        const pnlInfo = await getPNL(chain, tokenInfo.address, parsedExInfo.user.toLowerCase())

                        // Check if sold everything
                        if (holdings.isZero()) {
                            let bufferCard = undefined
                            let userAffiliateLink: IAffiliateInfluencer = await new AffiliateService().getUserAffiliateLink(telegramId);

                            let hasLink = false;

                            if (userAffiliateLink != null && (userAffiliateLink.endDate == null || userAffiliateLink.endDate > new Date())) {
                                hasLink = true;
                            }

                            if (userAffiliateLink != null && userAffiliateLink.approved != null && userAffiliateLink.approved && (userAffiliateLink.endDate == null || userAffiliateLink.endDate > new Date())) {
                                if (hasLink) {
                                    bufferCard = await createCard({ entry: pnlInfo.initial, worth: parseFloat(BN(pnlInfo.worth || '0').toFixed(4)), reff: userAffiliateLink, pair: { chain: chain, token: tokenInfo.address } })
                                } else {
                                    bufferCard = await createCard({ entry: pnlInfo.initial, worth: parseFloat(BN(pnlInfo.worth || '0').toFixed(4)), pair: { chain: chain, token: tokenInfo.address } })
                                }
                            } else {
                                bufferCard = await createCard({ entry: pnlInfo.initial, worth: parseFloat(BN(pnlInfo.worth || '0').toFixed(4)), pair: { chain: chain, token: tokenInfo.address } })
                            }

                            await bot.telegram.sendPhoto(bck.user.chatId, { source: bufferCard });
                        }
                    }
                }

            } catch (e) {
                console.log(e);
            }
        } else if (state === 'error') {
            const bck: any = await getTransactionBackup(telegramId, msgId);
            await bck.populate('user');

            await updateTransactionBackup(bck._id, {
                error: error.message
            });

            const nFound = error.message.indexOf("execution reverted: ")
            let errString = error.message
            if (nFound > -1) {
                errString = error.message.slice(nFound + 20)
            }

            try {
                await bot.telegram.editMessageText(
                    bck.user.chatId,
                    bck.msgId,
                    0,
                    `${bck.label}
<b>${errString}</b>`,
                    {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: 'Retry',
                                        callback_data: botEnum.retryTxMessage + '_' + bck._id
                                    },
                                    {
                                        text: 'Dismiss',
                                        callback_data: botEnum.closeTxMessage + '_' + bck._id
                                    }
                                ]
                            ]
                        }
                    }
                );
            } catch { }
        }

        return msgRet;
    };

    return callback;
}

export async function retryTx(ctx: any, bckId: any) {
    const tFound: any = await TransactionBackupModel.findById(bckId);
    if (tFound === null) {
        await ctx.telegram.sendMessage(ctx.chat.id, '❌ No valid action');
        return;
    }

    await tFound.populate('user');

    const callback1 = getTxCallback('');
    const callback = async (bot: any, info: any, state: string) => {
        if (state === 'pending') {
            return { message_id: tFound.msgId };
        } else {
            await callback1(bot, info, state);
        }
    };

    let tx = await sendTxnAdvanced(
        tFound.user.telegramId,
        tFound.chain,
        {
            to: tFound.to,
            data: tFound.data,
            gasPrice: tFound.gasPrice,
            value: tFound.value,
            address: tFound.address ? JSON.parse(tFound.address) : undefined
        },
        {
            callback: callback
        }
    )

    let exInfo
    if (tFound.exInfo) {
        exInfo = JSON.parse(tFound.exInfo)
    }

    if (exInfo) {
        const BN = getBN()
        if (exInfo.type === 'buy') {
            await updateUserState(exInfo.telegramId, exInfo.chain, 0, 0, undefined, exInfo.ethAmount)
            const taxInfo = await getTokenTaxInfo(exInfo.chain, exInfo.token)
            await updateBuyMonitorInfo(exInfo.chain, exInfo.token, exInfo.user, BN(exInfo.tokenAmount).times(BN(100).minus(BN(taxInfo?.buyTax || '0')).div(100)).toString(), exInfo.ethAmount)

            if (tx?.transactionHash) {
                const user = await getAppUser(exInfo.telegramId)
                await externalInvokeMonitor(exInfo.telegramId, user.chatId, exInfo.chain, exInfo.token)
            }
        } else if (exInfo.type === 'sell') {
            const taxInfo = await getTokenTaxInfo(exInfo.chain, exInfo.token)
            await updateUserState(exInfo.telegramId, exInfo.chain, 0, 0, BN(exInfo.ethAmount).times(BN(100).minus(BN(taxInfo?.sellTax || '0')).div(100)).toString(), undefined)

            await updateSellMonitorInfo(exInfo.chain, exInfo.token, exInfo.user, exInfo.tokenAmount, BN(exInfo.ethAmount).times(BN(100).minus(BN(taxInfo?.sellTax || '0')).div(100)).toString())
        }
    }

    return tx
}
