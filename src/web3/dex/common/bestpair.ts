import { DexInfoModel } from "../../../models/dex.info.model"
import { getBN } from "../../web3.operation"
import { getV3PairPrice } from "../v3/v3.calculate"
import { getReserves } from "./reserve"

export function findBestPair(token: string, lpArray: any[]) {
    const BN = getBN()

    let retPair
    let maxLP = BN(0)

    for (const lp of lpArray) {
        if (lp === null || lp === undefined) continue

        let reserves = getReserves(lp)

        if (reserves[0].isNaN() || reserves[1].isNaN()) continue

        if (token.toLowerCase() === lp.token0.toLowerCase()) {
            if (maxLP.lt(reserves[0])) {
                maxLP = reserves[0]
                retPair = lp
            }
        } else if (token.toLowerCase() === lp.token1.toLowerCase()) {
            if (maxLP.lt(reserves[1])) {
                maxLP = reserves[1]
                retPair = lp
            }
        }
    }

    if (retPair === undefined && lpArray.length > 0) {
        retPair = lpArray[0]
    }

    return retPair
}

export async function findBestWETHPair(token: string, lpArray: any[]) {
    const validPairs = lpArray.filter(p => p !== null && p !== undefined)
    const dexArray = (await Promise.all(validPairs.map(p => DexInfoModel.findOne({ chain: p.chain, factory: p.factory })))).filter(d => d !== null)
    const lpWETHArray = validPairs.filter(p => {
        return dexArray.find(d => (d.weth === p.token0 && token === p.token1) || (d.weth === p.token1 && token === p.token0)) !== undefined
    })

    return findBestPair(token, lpWETHArray)
}
