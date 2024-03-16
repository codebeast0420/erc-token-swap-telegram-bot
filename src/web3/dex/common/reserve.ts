import { getBN } from "../../web3.operation"
import { getV3PairPrice } from "../v3/v3.calculate"

export function getReserves(pair: any) {
    const BN = getBN()
    let reserve0
    let reserve1
    if (pair.version === 2) {
        reserve0 = BN(pair.reserve0)
        reserve1 = BN(pair.reserve1)
    } else if (pair.version === 3) {
        const pairPrice = getV3PairPrice(pair)
        const lq = BN(pair.liquidity || '0')

        const L2 = lq.times(lq).div(BN(`1e${pair.decimal0}`).times(BN(`1e${pair.decimal1}`))) // converting to decimal number
        const x = L2.div(BN(pairPrice)).sqrt()
        const y = L2.times(BN(pairPrice)).sqrt()

        reserve0 = x
        reserve1 = y
    }

    return [reserve0, reserve1]
}