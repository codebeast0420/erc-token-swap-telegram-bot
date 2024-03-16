import { IAddress } from "../../models/address.model";
import { ChainModel } from "../../models/chain.model";
import { SettingsModel } from "../../models/settings.model";
import { getAppUser } from "../../service/app.user.service";
import { getGasPrice } from "../../service/chain.service";
import { getSettings } from "../../service/settings.service";
import { updateUserState } from "../../service/stat.service";
import { getTxCallback } from "../../service/transaction.backup.service";
import { getMultiWallets, getWallet } from "../../service/wallet.service";
import { convertValue } from "../../utils/common";
import { getNativeCurrencyDecimal, getNativeCurrencySymbol } from "../chain.parameters";
import { estimateGasByProvider, getBN, getGasPriceByPreset, getUpperGas, newWeb3, sendTxnAdvanced } from "../web3.operation";
import { getETHBalance } from "./nativecurrency.query";


export async function transferETH(telegramId: string, chain: string, addressTo: string, amount: string, address?: IAddress) {
    const BN = getBN();
    const nativeSymbol = await getNativeCurrencySymbol(chain);
    const nativeDecimal = await getNativeCurrencyDecimal(chain);

    const userSetting = await getSettings(telegramId, chain)

    let realAmount = amount
    {
        const orgGasPrice = await getGasPrice(chain)
        let curGasPrice = BN(userSetting.maxGasPrice || '0').times(BN(`1e9`)).toString()
        if (chain === 'ethereum') {
            curGasPrice = BN(curGasPrice).plus(BN(orgGasPrice)).toString()
        } else {
            if (BN(curGasPrice).eq(BN(0))) {
                curGasPrice = orgGasPrice
            }
        }
        const gasPrice = getGasPriceByPreset(curGasPrice, userSetting.gasPreset)

        let w = address
        if (w === undefined) {
            w = await getWallet(telegramId)
        }

        const web3 = await newWeb3(telegramId, chain)
        const gas = await getUpperGas(chain, await estimateGasByProvider(chain, web3, {
            from: w.address, to: addressTo, value: amount || '0'
        }))

        const totalUse = BN(gas.toString()).times(BN(gasPrice.toString()))
        const myETHBal = await web3.eth.getBalance(w.address)

        if (BN(amount.toString()).plus(totalUse).gt(BN(myETHBal.toString()))) {
            const regAmount = BN(amount.toString()).plus(totalUse).minus(BN(myETHBal.toString()))
            if (regAmount.gt(0)) {
                realAmount = BN(amount.toString()).minus(regAmount).toString()
            }
        }
    }

    const label = `🔗<b>${chain}</b>\nTransferring <b>${BN(realAmount).div(BN(`1e${nativeDecimal}`).toString())} ${nativeSymbol}</b> to <code>${addressTo}</code>`;

    const callback = getTxCallback(label)
    const tx = await sendTxnAdvanced(telegramId, chain, {
        to: addressTo,
        value: realAmount,
        address: address
    }, {
        callback
    });

    await updateUserState(telegramId, chain, 0, 0, realAmount, undefined)

    return tx
}


export async function userTransferETH(telegramId: string, chain: string, addressTo: string, amount: string) {
    const w = await getWallet(telegramId);
    const bal = await getETHBalance(telegramId, chain, w.address);
    const BN = getBN();
    const ethDecimals = await getNativeCurrencyDecimal(chain);
    let amn = BN(convertValue(bal, amount, BN)).times(BN(`1e${ethDecimals}`)).integerValue().toString()

    return await transferETH(telegramId, chain, addressTo, amn);
}

export async function userTransferETHAdditionalAddress(telegramId: string, chain: string, addressFrom: IAddress, addressTo: string, amount: string) {
    const wallets = await getMultiWallets(telegramId);

    if (wallets === null || typeof wallets === undefined) {
        return null;
    }

    let address;

    for (let temp of wallets) {
        if (temp.address === addressFrom.address && temp._id.toString() === addressFrom._id.toString()) {
            address = temp;
        }
    }

    if (address === null || typeof address === undefined) {
        return null;
    }

    const bal = await getETHBalance(telegramId, chain, address.address);
    const BN = getBN();
    const ethDecimals = await getNativeCurrencyDecimal(chain);
    const amn = BN(convertValue(bal, amount, BN)).times(BN(`1e${ethDecimals}`)).integerValue().toString();

    return await transferETH(telegramId, chain, addressTo, amn, addressFrom);
}
