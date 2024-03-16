import { PairInfoModel } from "../../../models/pair.info.model";
import { getTokenInfo } from "../../../service/token.service";
import { getPathFromTokenV2, getPathToTokenV2 } from "../v2/v2.path";
import { getPathFromTokenV3, getPathToTokenV3 } from "../v3/v3.path";
import { findBestPair } from "./bestpair";

export async function getBestPathFromToken(chain: string, token: string) {
    const tInfo = await getTokenInfo(chain, token)
    const lpArray = (await Promise.all(tInfo.lp.map(addr => PairInfoModel.findOne({ chain: chain, address: addr })))).filter(lp => lp !== null)
    const bestPair = findBestPair(token, lpArray)
    if (bestPair?.version === 2) {
        try {
            return await getPathFromTokenV2(chain, token)
        } catch (err) {
            return await getPathFromTokenV3(chain, token)
        }
    } else if (bestPair?.version === 3) {
        try {
            return await getPathFromTokenV3(chain, token)
        } catch (err) {
            return await getPathFromTokenV2(chain, token)
        }
    }
}

export async function getBestPathToToken(chain: string, token: string) {
    const tInfo = await getTokenInfo(chain, token)
    const lpArray = (await Promise.all(tInfo.lp.map(addr => PairInfoModel.findOne({ chain: chain, address: addr })))).filter(lp => lp !== null)
    const bestPair = findBestPair(token, lpArray)
    if (bestPair?.version === 2) {
        try {
            return await getPathToTokenV2(chain, token)
        } catch (err) {
            return await getPathToTokenV3(chain, token)
        }
    } else if (bestPair?.version === 3) {
        try {
            return await getPathToTokenV3(chain, token)
        } catch (err) {
            return await getPathToTokenV2(chain, token)
        }
    }
}
