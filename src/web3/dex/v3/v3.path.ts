import { DexInfoModel } from "../../../models/dex.info.model";
import { PairInfoModel } from "../../../models/pair.info.model";
import { TokenInfoModel } from "../../../models/token.info.model";
import { LP_NOT_FOUND, TOKEN_NOT_FOUND } from "../../../utils/common";
import { chainConfig } from "../../chain.config";
import { getDefaultFactory } from "../../chain.parameters";
import { getBN } from "../../web3.operation";
import { findBestPair } from "../common/bestpair";
import { getPairedToken } from "../common/pair";

export async function getPathFromTokenV3(chain: string, token: string) {
    let wethAddr = chainConfig[chain].tokens[0].toLowerCase();

    const t: any = await TokenInfoModel.findOne({ chain: chain, address: token });
    if (t === null) {
        throw new Error(TOKEN_NOT_FOUND + '\nUnable to find path for dex\n' + `<b>${token}</b>`);
    }

    const lpArray = (await Promise.all(t.lp.map(addr => PairInfoModel.findOne({ chain: t.chain, address: addr, version: 3 })))).filter(lp => lp !== null)
    const bestLP = findBestPair(token, lpArray)

    if (bestLP === undefined) {
        throw new Error(LP_NOT_FOUND + `\nUnable to find best LP for <b>${t.symbol}</b>`)
    }

    let factoryAddress = bestLP.factory

    const dexFound: any = await DexInfoModel.findOne({ chain: chain, factory: factoryAddress })
    if (dexFound !== null) {
        wethAddr = dexFound.weth
    }

    let curToken = t;

    let pathRet = [token];
    let fee = []
    let pairSelected = []

    while (curToken !== null) {
        const curLPArray = (await Promise.all(curToken.lp.map(addr => PairInfoModel.findOne({ chain: curToken.chain, address: addr, version: 3, factory: factoryAddress })))).filter(lp => lp !== null && pairSelected.find(p => p === lp.address) === undefined)

        const wethBestLP = findBestPair(curToken.address, curLPArray.filter(lp => lp.token0 === wethAddr || lp.token1 === wethAddr))
        if (wethBestLP) {
            return {
                factory: factoryAddress,
                path: [...pathRet, wethAddr],
                fee: [...fee, wethBestLP.fee],
                version: 3,
            }
        }

        const curBestLP = findBestPair(curToken.address, curLPArray)

        if (curBestLP === undefined) {
            throw new Error(LP_NOT_FOUND + `\n<b>${t.symbol} => ${curToken.symbol} => native currency</b>`)
        }

        pairSelected = [...pairSelected, curBestLP.address]
        const pairedToken = getPairedToken(curBestLP, curToken.address)

        if (pairedToken === wethAddr) {
            return {
                factory: factoryAddress,
                path: [...pathRet, wethAddr],
                fee: [...fee, curBestLP.fee],
                version: 3,
            }
        }

        pathRet = [...pathRet, pairedToken]
        fee = [...fee, curBestLP.fee]
        curToken = await TokenInfoModel.findOne({ chain: chain, address: pairedToken })
    }

    throw new Error(LP_NOT_FOUND + `\n<b>${t.symbol}</b>`);
}

export async function getPathToTokenV3(chain: string, token: string) {
    let wethAddr = chainConfig[chain].tokens[0].toLowerCase();

    const t: any = await TokenInfoModel.findOne({ chain: chain, address: token });
    if (t === null) {
        throw new Error(TOKEN_NOT_FOUND + '\nUnable to find path for dex\n' + `<b>${token}</b>`);
    }

    const lpArray = (await Promise.all(t.lp.map(addr => PairInfoModel.findOne({ chain: t.chain, address: addr, version: 3 })))).filter(lp => lp !== null)
    const bestLP = findBestPair(token, lpArray)

    if (bestLP === undefined) {
        throw new Error(LP_NOT_FOUND + `\nUnable to find best LP for <b>${t.symbol}</b>`)
    }

    let factoryAddress = bestLP.factory

    const dexFound: any = await DexInfoModel.findOne({ chain: chain, factory: factoryAddress })
    if (dexFound !== null) {
        wethAddr = dexFound.weth
    }

    let curToken = t;

    let pathRet = [token];
    let fee = []
    let pairSelected = []

    while (curToken !== null) {
        const curLPArray = (await Promise.all(curToken.lp.map(addr => PairInfoModel.findOne({ chain: curToken.chain, address: addr, version: 3, factory: factoryAddress })))).filter(lp => lp !== null && pairSelected.find(p => p === lp.address) === undefined)

        const wethBestLP = findBestPair(curToken.address, curLPArray.filter(lp => lp.token0 === wethAddr || lp.token1 === wethAddr))
        if (wethBestLP) {
            return {
                factory: factoryAddress,
                path: [wethAddr, ...pathRet],
                fee: [wethBestLP.fee, ...fee],
                version: 3
            }
        }

        const curBestLP = findBestPair(curToken.address, curLPArray)

        if (curBestLP === undefined) {
            throw new Error(LP_NOT_FOUND + `\n<b>${t.symbol} => ${curToken.symbol} => native currency</b>`)
        }

        pairSelected = [...pairSelected, curBestLP.address]
        const pairedToken = getPairedToken(curBestLP, curToken.address)

        if (pairedToken === wethAddr) {
            return {
                factory: factoryAddress,
                path: [wethAddr, ...pathRet],
                fee: [curBestLP.fee, ...fee],
                version: 3
            }
        }

        pathRet = [pairedToken, ...pathRet]
        fee = [curBestLP.fee, ...fee]
        curToken = await TokenInfoModel.findOne({ chain: chain, address: pairedToken })
    }

    throw new Error(LP_NOT_FOUND + `\n<b>${t.symbol}</b>`);
}
