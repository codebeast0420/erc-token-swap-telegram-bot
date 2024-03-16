import { AutoBuyTokenModel } from '../models/auto.buy.token';
import { AutoSellTokenModel } from '../models/auto.sell.token';
import { ChainModel } from '../models/chain.model';
import { PairInfoModel } from '../models/pair.info.model';
import { TokenInfoModel } from '../models/token.info.model';
import { TransactionHistoryModel } from '../models/transaction.history.model';
import { convertValue, sleep } from '../utils/common';
import Logging from '../utils/logging';
import { getErrorMessageResponse } from '../utils/messages';
import { getNativeCurrencySymbol } from '../web3/chain.parameters';
import { swapTokenForETH } from '../web3/dex.interaction';
import { getTokenSimpleInfo } from '../web3/token.interaction';
import { getBN } from '../web3/web3.operation';
import { sendBotMessage } from './app.service';
import { getAppUser } from './app.user.service';
import { commitAutoBuy } from './autobuy.service';
import { processError } from './error';
import { getTokenInfo, getTokenPrice } from './token.service';
import { getWallet } from './wallet.service';

export async function isTokenAutoSellSet(telegramId: string, chain: string, token: string) {
    const user = await getAppUser(telegramId);
    const sell = await AutoSellTokenModel.findOne({ user: user._id, chain: chain, token: token, state: 'pending' });
    return sell !== null;
}

export async function removeTokenAutoSell(telegramId: string, chain: string, token: string) {
    const user = await getAppUser(telegramId);
    await AutoSellTokenModel.deleteOne({ user: user._id, chain: chain, token: token, state: 'pending' });
}

export async function addTokenAutoSell(telegramId: string, chain: string, token: string, price: string, wethLP: string) {
    const user = await getAppUser(telegramId);
    if (0 === (await AutoSellTokenModel.countDocuments({ user: user._id, chain: chain, token: token, state: 'pending' }))) {
        const newAutoSellToken = new AutoSellTokenModel({
            user: user._id,
            chain: chain,
            token: token,
            state: 'pending',
            priceStamp: price,
            lowPriceLimit: '-50%',
            highPriceLimit: '100%',
            amountAtLowPrice: '100%',
            amountAtHighPrice: '100%',
            wethLP: wethLP
        });

        await newAutoSellToken.save();
    }
}

export async function updateTokenAutoSellContext(telegramId: string, chain: string, token: string, updateContext: any) {
    const user = await getAppUser(telegramId);

    const itemToUpdate = await AutoSellTokenModel.findOne({ user: user._id, chain: chain, token: token, state: 'pending' });

    if (itemToUpdate === null) {
        throw new Error(`Not enabled auto sell\n<code>${token}</code>`);
    }

    for (const ch in updateContext) {
        itemToUpdate[ch] = updateContext[ch];
    }

    await itemToUpdate.save();
}

export async function getTokenAutoSellContext(telegramId: string, chain: string, token: string) {
    const user = await getAppUser(telegramId);

    return await AutoSellTokenModel.findOne({ user: user._id, chain: chain, token: token, state: 'pending' });
}

export async function commitAutoSell(currentPrice: string, context: any, lowReach: boolean) {
    let telegramId
    try {
        const c = await context.populate('user');
        telegramId = c.user.telegramId

        const BN = getBN();
        const w = await getWallet(telegramId);
        const t = await getTokenSimpleInfo(telegramId, c.chain, c.token, w.address);

        let amount;
        if (true === lowReach) {
            amount = convertValue(t.balance, c.amountAtLowPrice, BN);
        } else {
            amount = convertValue(t.balance, c.amountAtHighPrice, BN);
        }

        let tr = null;

        try {
            if (BN(amount).gt(BN(0))) {
                const nativeSymbol = await getNativeCurrencySymbol(c.chain)
                const label = `⛓<b>${c.chain}</b>\nAuto Selling <b>${amount} ${t.symbol}</b> at <b>${BN(t.marketCap).times(BN(currentPrice)).toFixed(2)}$ MC</b> to <b>${nativeSymbol}</b>`
                const receipt = await swapTokenForETH(
                    telegramId,
                    c.chain,
                    {
                        token: c.token,
                        amount: BN(amount).times(BN(`1e${t.decimals}`)).integerValue().toString(),
                        recipient: w.address
                    },
                    {
                    },
                    label
                );
                tr = await TransactionHistoryModel.findOne({ transactionHash: receipt.transactionHash });
            }
        } catch { }

        c.state = 'completed';
        if (tr !== null) c.transaction = tr._id;

        await c.save();
    } catch (err) {
        console.error(`==> ${new Date().toLocaleString()}`)
        console.error(err)
        Logging.error(`[commitAutoSell] ${err.message}`);
        const errMsg = await getErrorMessageResponse(telegramId, err.message);
        if (errMsg !== null) {
            await sendBotMessage(telegramId, errMsg)
            await AutoSellTokenModel.findByIdAndDelete(context._id)
        }
    }
}

export async function pollAutoSellBuy(bot: any) {
    const BN = getBN();
    Logging.info('polling autosell/autobuy...')

    while (true) {
        const chains = await ChainModel.find();
        for (const chain of chains) {
            const autoSellRecords = await AutoSellTokenModel.find({ chain: chain.name, state: 'pending' });
            const autoBuyRecords = await AutoBuyTokenModel.find({ chain: chain.name, state: 'pending' });

            for (const as of autoSellRecords) {
                try {
                    const asUser: any = await as.populate('user')
                    let tokenPrice = await getTokenPrice(asUser.user.telegramId, as.chain, as.token)

                    if (BN(as.priceStamp).eq(BN(0)) || as.lowPriceLimit === undefined || as.highPriceLimit === undefined) {
                        Logging.error(`[pollAutoSellBuy] autosell: chain ${as.chain}, token ${as.token}, price ${as.priceStamp} cancelled`)
                        await AutoSellTokenModel.findByIdAndDelete(as._id)
                        continue
                    }

                    if (tokenPrice) {
                        const lowBias1 = convertValue(as.priceStamp, as.lowPriceLimit, BN);
                        const targetLowPrice = BN(lowBias1).eq(BN(as.lowPriceLimit))? BN(as.lowPriceLimit): BN(as.priceStamp).plus(BN(lowBias1))
                        const highBias1 = convertValue(as.priceStamp, as.highPriceLimit, BN);
                        const targetHighPrice = BN(highBias1).eq(BN(as.highPriceLimit))? BN(as.highPriceLimit): BN(as.priceStamp).plus(BN(highBias1))

                        if (true === BN(tokenPrice).lte(targetLowPrice)) {
                            await commitAutoSell(tokenPrice, as, true);
                        } else if (true === BN(tokenPrice).gte(targetHighPrice)) {
                            await commitAutoSell(tokenPrice, as, false);
                        }
                    }
                } catch (err) {
                    console.error(`==> ${new Date().toLocaleString()}`)
                    console.error(err)
                    Logging.error('[pollAutoSellBuy] autosell ' + as.token + ':' + chain.name + ' --> ' + err);
                }
            }

            for (const ab of autoBuyRecords) {
                try {
                    const abUser: any = await ab.populate('user')
                    let tokenPrice = await getTokenPrice(abUser.user.telegramId, ab.chain, ab.token)

                    if (BN(ab.priceStamp).eq(BN(0)) || ab.priceLimit === undefined) {
                        Logging.error(`[pollAutoSellBuy] autobuy: chain ${ab.chain}, token ${ab.token}, price ${ab.priceStamp} cancelled`)
                        await AutoBuyTokenModel.findByIdAndDelete(ab._id)
                        continue
                    }

                    if (tokenPrice) {
                        const lowBias1 = convertValue(ab.priceStamp, ab.priceLimit, BN);
                        const targetPrice = BN(lowBias1).eq(BN(ab.priceLimit))? BN(ab.priceLimit): BN(ab.priceStamp).plus(BN(lowBias1))

                        if (true === BN(tokenPrice).lte(targetPrice)) {
                            await commitAutoBuy(tokenPrice, ab);
                        }
                    }
                } catch (err) {
                    console.error(`==> ${new Date().toLocaleString()}`)
                    console.error(err)
                    Logging.error('[pollAutoSellBuy] autosell ' + ab.token + ':' + chain.name + ' --> ' + err);
                }
            }
        }

        await sleep(1000)
    }
}
