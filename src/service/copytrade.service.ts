import { botEnum } from '../constants/botEnum';
import { CopyTradeModel } from '../models/copytrade.model';
import { ALREADY_EXIST } from '../utils/common';
import { getNativeCurrencySymbol } from '../web3/chain.parameters';
import { getBN } from '../web3/web3.operation';
import { getAppUser, userVerboseLog } from './app.user.service';
import { chainGasPrice } from './chain.service';
import { getSettings } from './settings.service';

export async function getCopyTradeText(telegramId: string, chain: string) {
    const user = await getAppUser(telegramId);

    const f = await CopyTradeModel.find({ user: user._id, chain: chain });
    

    let text = '©️ <b>Copy-Trade Menu</b>\n';
    text += `Copy-Trading list: ${f.length}\n\n`;
    text += `ℹ️ Add or remove wallets whose trades you'd like to copy!`;

    return text;
}

export async function registerNewCopyTradeAddress(telegramId: string, chain: string, name: string, address: string) {
    const user = await getAppUser(telegramId);

    const fSet = await CopyTradeModel.findOne({ user: user._id, chain: chain, address: address });
    if (null !== fSet) {
        throw new Error(ALREADY_EXIST + `\n<code>${address}</code>\n🔗 <b>${chain}</b> has already been configured for this address with name <code>${fSet.name}</code>`);
    }

    const nSet = await CopyTradeModel.findOne({ user: user._id, chain: chain, name: name });
    if (null !== nSet) {
        throw new Error(ALREADY_EXIST + `\n<code>${name}</code>\n🔗 <b>${chain}</b> has already been configured for <code>${nSet.address}</code> with name <code>${name}</code>`);
    }

    const newSave = new CopyTradeModel({
        user: user._id,
        chain: chain,
        name: name,
        address: address,
        state: 'off',
        isAutoBuy: true,
        isCopySell: true,
        autoBuySmartSlippage: '2' // enabled
    });

    await newSave.save();

    await userVerboseLog(telegramId, `registered new copy trade address ${address} on chain [${chain}] - name [${name}]`);
}

export async function getCopyTradeAddresses(telegramId: string, chain: string) {
    const user = await getAppUser(telegramId);

    const f = await CopyTradeModel.find({ user: user._id, chain: chain }).populate('user').populate('transactions');
    return f;
}

export async function deleteCopyTradeAddress(copyTradeId: string) {
    await CopyTradeModel.findByIdAndDelete(copyTradeId);
}

export async function updateCopyTradeAddress(copyTradeId: string, info: any) {
    const fItem = await CopyTradeModel.findById(copyTradeId);
    if (fItem === null) {
        throw new Error('Not found copy trade item');
    }

    for (const ch in info) {
        fItem[ch] = info[ch];
    }

    await fItem.save();
}

export async function getCopyTradeDetail(copyTradeId: string) {
    const fItem = await CopyTradeModel.findById(copyTradeId);
    if (fItem === null) {
        return '❌ Not valid copytrade configuration';
    }

    const BN = getBN()
    const nativeSymbol = await getNativeCurrencySymbol(fItem.chain)
    let text = '';

    const tUser: any = await fItem.populate('user')
    const settings = await getSettings(tUser.user.telegramId, fItem.chain)
    const globalSmartSlippage = settings.smartSlippage === true ? '✅ Enabled' : '❌ Disabled'
    const defGasPrice = await chainGasPrice(fItem.chain)

    text += `🔗 ${fItem.chain}\n`;
    text += `Name: <code>${fItem.name}</code>\n`;
    text += `Wallet: <code>${fItem.address}</code>\n`;
    text += `\n`;
    text += `📌 <b>Auto Buy</b>\n`;
    text += `Multi: ${fItem.multi === true ? '✅ Enabled' : '❌ Disabled - Wallet Disabled ⚠️'}\n`;
    text += `Auto Buy: ${fItem.isAutoBuy === true ? '✅ Enabled' : '❌ Disabled - Wallet Disabled ⚠️'}\n`;
    text += `Amount: <b>${BN(fItem.autoBuyAmount || '0').eq(BN(0)) ? '❌ Disabled' : `${fItem.autoBuyAmount} ${nativeSymbol}`}</b>\n`;
    text += `Slippage: <b>${BN(fItem.autoBuySlippage || '100').eq(BN(100)) ? 'Default (100%)' : `${fItem.autoBuySlippage}%`} </b>\n`;
    text += `Smart Slippage: ${fItem.autoBuySmartSlippage === '0' ? '❌ Disabled' : fItem.autoBuySmartSlippage === '1' ? `Global (${globalSmartSlippage})` : fItem.autoBuySmartSlippage === '2' ? '✅ Enabled' : 'Unknown'}\n`;
    if (fItem.chain === 'ethereum') {
        text += `Gas Delta: <b>Default (${parseFloat(BN(defGasPrice).toFixed(3))} gwei) + Delta (${parseFloat(BN(fItem.autoBuyGasPrice || '0').toFixed(3))} gwei)</b>\n`;
    } else {
        text += `Gas Price: <b>${BN(fItem.autoBuyGasPrice || '0').eq(BN(0)) ? `Default (${defGasPrice} gwei)` : `${fItem.autoBuyGasPrice} gwei`} </b>\n`;
    }
    text += `Max MC: <b>Global (Disabled)</b>\n`;
    text += `Min Liquidity: <b>Global (Disabled)</b>\n`;
    text += `Max Liquidity: <b>Global (Disabled)</b>\n`;
    text += `Min MC/Liq: <b>Global (Disabled)</b>\n`;
    text += `Max Buy Tax: <b>${BN(fItem.maxBuyTax || '0').eq(BN(0)) ? '❌ Disabled' : `${fItem.maxBuyTax}%`}</b>\n`;
    text += `Max Sell Tax: <b>${BN(fItem.maxSellTax || '0').eq(BN(0)) ? '❌ Disabled' : `${fItem.maxSellTax}%`}</b>\n`;
    text += `\n`;
    text += `📌 <b>Sell</b>\n`;
    text += `Auto Sell: Global (❌ Disabled)\n`;
    text += `Trailing Sell: Global (❌ Disabled)\n`;
    text += `Auto Sell (high): <b>Default (+100%)</b>\n`;
    text += `Sell Amount (high): <b>Default (100%)</b>\n`;
    text += `Auto Sell (low): <b>Default(-50%)</b>\n`;
    text += `Sell Amount (low): <b>Default (100%)</b>\n`;
    text += `\n`;
    // text += `ℹ️ <i>Sell-Lo/Hi compare against the coin's P/L, not its P/L w/tax.</i>\n`;
    text += `ℹ️ <i>Channel gas and slippage settings are only active for autobuys. Manual buys will use wallet settings.</i>`;

    return text;
}

export async function getCopyTradeDetailMarkup(copyTradeId: string) {
    const fItem = await CopyTradeModel.findById(copyTradeId)
    if (fItem === null) {
        return {
            inline_keyboard: [
                [
                    {
                        text: botEnum.menu.key,
                        callback_data: botEnum.menu.value
                    },
                    {
                        text: 'Return',
                        callback_data: botEnum.copytrade.value
                    }
                ]
            ]
        };
    }

    return {
        inline_keyboard: [
            [
                {
                    text: botEnum.menu.key,
                    callback_data: botEnum.menu.value
                },
                {
                    text: 'Return',
                    callback_data: botEnum.copytrade.value
                }
            ],
            [
                {
                    text: fItem.isFrontRun === true ? '✅ Frontrun' : '❌ Frontrun',
                    callback_data: botEnum.copyTradeFrontRun + '_' + copyTradeId
                },
                {
                    text: fItem.multi === true ? '✅ Multi' : '❌ Multi',
                    callback_data: botEnum.copyTradeMulti + '_' + copyTradeId
                }
            ],
            [
                {
                    text: fItem.isAutoBuy === true ? '✅ Auto Buy' : '❌ Auto Buy',
                    callback_data: botEnum.copyTradeAutoBuy + '_' + copyTradeId
                }
            ],
            [
                {
                    text: fItem.autoBuySmartSlippage === '0' ? '❌ Smart Slippage' : fItem.autoBuySmartSlippage === '1' ? '🌐 Smart Slippage' : '✅ Smart Slippage',
                    callback_data: botEnum.copyTradeSmartSlippage + '_' + copyTradeId
                },
                {
                    text: '✏️ Buy Amount',
                    callback_data: botEnum.copyTradeBuyAmount + '_' + copyTradeId
                }
            ],
            [
                {
                    text: '✏️ Slippage',
                    callback_data: botEnum.copyTradeBuySlippage + '_' + copyTradeId
                },
                {
                    text: '⌫ Slippage',
                    callback_data: botEnum.copyTradeBuySlippageRemove + '_' + copyTradeId
                }
            ],
            [
                {
                    text: fItem.chain === 'ethereum' ? '✏️ Gas Delta' : '✏️ Gas Price',
                    callback_data: botEnum.copyTradeBuyGasPrice + '_' + copyTradeId
                },
                {
                    text: fItem.chain === 'ethereum' ? '⌫ Gas Delta' : '⌫ Gas Price',
                    callback_data: botEnum.copyTradeBuyGasPriceRemove + '_' + copyTradeId
                }
            ],
            [
                {
                    text: fItem.isCopySell === true ? '✅ Copy Sell' : '❌ Copy Sell',
                    callback_data: botEnum.copyTradeCopySell + '_' + copyTradeId
                }
            ],
            [
                {
                    text: '❌ Auto Sell',
                    callback_data: botEnum.copyTradeAutoSell + '_' + copyTradeId
                },
                {
                    text: '❌ Trailing Sell',
                    callback_data: botEnum.copyTradeTrailingSell + '_' + copyTradeId
                }
            ],
            [
                {
                    text: '✏️ Sell-Hi',
                    callback_data: botEnum.copyTradeSellHighPrice + '_' + copyTradeId
                },
                {
                    text: '⌫ Sell-Hi',
                    callback_data: botEnum.copyTradeSellHighPriceRemove + '_' + copyTradeId
                }
            ],
            [
                {
                    text: '✏️ Sell-Lo',
                    callback_data: botEnum.copyTradeSellLowPrice + '_' + copyTradeId
                },
                {
                    text: '⌫ Sell-Lo',
                    callback_data: botEnum.copyTradeSellLowPriceRemove + '_' + copyTradeId
                }
            ],
            [
                {
                    text: '✏️ Sell-Hi Amount',
                    callback_data: botEnum.copyTradeSellHighAmount + '_' + copyTradeId
                },
                {
                    text: '⌫ Sell-Hi Amount',
                    callback_data: botEnum.copyTradeSellHighAmountRemove + '_' + copyTradeId
                }
            ],
            [
                {
                    text: '✏️ Sell-Lo Amount',
                    callback_data: botEnum.copyTradeSellLowAmount + '_' + copyTradeId
                },
                {
                    text: '⌫ Sell-Lo Amount',
                    callback_data: botEnum.copyTradeSellLowAmountRemove + '_' + copyTradeId
                }
            ],
            [
                {
                    text: '✏️ Max MC',
                    callback_data: botEnum.copyTradeSellMaxMarketCap + '_' + copyTradeId
                },
                {
                    text: '⌫ Max MC',
                    callback_data: botEnum.copyTradeSellMaxMarketCapRemove + '_' + copyTradeId
                }
            ],
            [
                {
                    text: '✏️ Min Liquidity',
                    callback_data: botEnum.copyTradeSellMinLiquidity + '_' + copyTradeId
                },
                {
                    text: '⌫ Min Liquidity',
                    callback_data: botEnum.copyTradeSellMinLiquidityRemove + '_' + copyTradeId
                }
            ],
            [
                {
                    text: '✏️ Max Liquidity',
                    callback_data: botEnum.copyTradeSellMaxLiquidity + '_' + copyTradeId
                },
                {
                    text: '⌫ Max Liquidity',
                    callback_data: botEnum.copyTradeSellMaxLiquidityRemove + '_' + copyTradeId
                }
            ],
            [
                {
                    text: '✏️ Min MC/Liq',
                    callback_data: botEnum.copyTradeSellMinMarketCapLiquidity + '_' + copyTradeId
                },
                {
                    text: '⌫ Max Liquidity',
                    callback_data: botEnum.copyTradeSellMinMarketCapLiquidityRemove + '_' + copyTradeId
                }
            ],
            [
                {
                    text: '✏️ Max Buy Tax',
                    callback_data: botEnum.copyTradeMaxBuyTax + '_' + copyTradeId
                },
                {
                    text: '⌫ Max Buy Tax',
                    callback_data: botEnum.copyTradeMaxBuyTaxRemove + '_' + copyTradeId
                }
            ],
            [
                {
                    text: '✏️ Max Sell Tax',
                    callback_data: botEnum.copyTradeMaxSellTax + '_' + copyTradeId
                },
                {
                    text: '⌫ Max Sell Tax',
                    callback_data: botEnum.copyTradeMaxSellTaxRemove + '_' + copyTradeId
                }
            ]
        ]
    };
}

export async function clearCopyTrades(telegramId: string) {
    const user = await getAppUser(telegramId)
    await CopyTradeModel.deleteMany({ user: user._id })
}
