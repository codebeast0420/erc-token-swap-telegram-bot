import { IAddress } from "../../models/address.model";
import { isAntiMEVOn } from "../../service/app.user.service";
import { getWallet } from "../../service/wallet.service";
import { getNativeCurrencyDecimal } from "../chain.parameters";
import { getBN, newWeb3 } from "../web3.operation";


export async function getETHBalance(telegramId: string, chain: string, address: string) {
    const web3 = await newWeb3(telegramId, chain)

    const BN = getBN()
    const bal = await web3.eth.getBalance(address)

    const decimals = await getNativeCurrencyDecimal(chain)
    return BN(bal.toString())
        .div(BN(`1e${decimals}`))
        .toString();
}

export async function batchAddressBalances(telegramId: string, chain: string, addresses: IAddress[]) {
    const web3 = await newWeb3(telegramId, chain)

    const isAntiMEV = await isAntiMEVOn(telegramId, chain)
    const BN = getBN();
    const decimals = await getNativeCurrencyDecimal(chain);

    if (isAntiMEV) {
        const balArray = await Promise.all(addresses.map(ad => web3.eth.getBalance(ad.address)))
        addresses.forEach((ad, idx) => ad.balance = BN(balArray[idx]).div(BN(`1e${decimals}`)).toString())
    } else {
        const batch = new web3.BatchRequest();
        let counter = 0;

        await new Promise<void>((resolve, reject) => {
            if (addresses != null || typeof addresses !== undefined) {
                for (const element of addresses) {
                    batch.add(
                        (web3.eth.getBalance as any).request(element.address, 'latest', async function (error: any, balance: any) {
                            if (error) return reject(error);
                            if (balance != null) {
                                element.balance = BN(balance.toString())
                                    .div(BN(`1e${decimals}`))
                                    .toString();
                                counter++;
                            }
                            if (counter === addresses.length) resolve();
                        })
                    );
                }
            }
            batch.execute();
        });
    }

    return addresses;
}

export async function userETHBalance(telegramId: string, chain: string) {
    const w = await getWallet(telegramId);
    return await getETHBalance(telegramId, chain, w.address);
}
