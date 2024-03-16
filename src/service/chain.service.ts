import { getConfiguredChain } from './connected.chain.service';
import { getBN, newWeb3 } from '../web3/web3.operation';
import { chainConfig } from '../web3/chain.config';
import { getNativeCurrencyPrice } from '../web3/chain.parameters';
import { UserStatModel } from '../models/user.stat.model';
import { getAppUser } from './app.user.service';

export async function chainGasPrice(chain: string) {
    const BN = getBN();
    const p = await getGasPrice(chain);
    return BN(p.toString()).div(BN('1e9')).toString();
}

export async function chainPrice(chain: string) {
    return await getNativeCurrencyPrice(chain);
}

export async function chainTxFee(telegramId: string, chain: string) {
    const user = await getAppUser(telegramId);
    const stat = await UserStatModel.findOne({ user: user._id, chain: chain });
    const gasPriceInGwei = await chainGasPrice(chain);
    const ethPrice = await chainPrice(chain);

    const BN = getBN();
    return {
        avg: BN(stat?.txAvgGas.toString() || '21000')
            .times(gasPriceInGwei)
            .times(ethPrice)
            .div(BN('1e9'))
            .toString(),
        max: BN(stat?.txMaxGas.toString() || '21000')
            .times(gasPriceInGwei)
            .times(ethPrice)
            .div(BN('1e9'))
            .toString(),
        min: BN(stat?.txMinGas.toString() || '21000')
            .times(gasPriceInGwei)
            .times(ethPrice)
            .div(BN('1e9'))
            .toString()
    };
}

export async function getGasPrice(chain: string, details?: boolean) {
    const BN = getBN()
    const web3 = await newWeb3('', chain)
    const ret = await Promise.all([
        getConfiguredChain(chain),
        web3.eth.getBlock('pending'),
        web3.eth.getBlock('latest')
    ])
    if (details === true) {
        return {
            chain: ret[0].gasPrice,
            pending: ret[1].baseFeePerGas,
            latest: ret[2].baseFeePerGas
        }
    } else {
        const gasBal = ret[1].baseFeePerGas || ret[0].gasPrice
        if (BN(gasBal).lt(BN(ret[0]))) return ret[0].gasPrice
        return gasBal
    }
}

export function getAllChains() {
    let ret = ['ethereum'];
    for (const ch in chainConfig) {
        if (ret.indexOf(ch) < 0) {
        ret = [...ret, ch];
    }
    }

    return ret;
}
