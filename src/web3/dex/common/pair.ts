
export function getPairedToken(pair: any, token: string) {
    if (pair.token0 === token) return pair.token1
    if (pair.token1 === token) return pair.token0
    else ''
}
