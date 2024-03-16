import { ContractCallResults, ContractCallContext } from 'ethereum-multicall'
import ERC20 from '../abi/ERC20.json'
import Pair from '../abi/IPancakePair.json'
import Pool from '../abi/UniswapV3Pool.json'
import Factory from '../abi/IPancakeFactory.json'
import Router from '../abi/IPancakeRouter02.json'
import PriceFeed from '../abi/IPriceFeed.json'
import FactoryV3 from '../abi/FactoryV3.json'
import { AddressDead, AddressZero, getBN } from '../web3.operation'

function getTokenDeadAddresses() {
    return [AddressZero, AddressDead]
}

export function tokenBalanceCallCtx(addresses: string[], users: string[][], ex?: string) {
    const cc2: ContractCallContext[] = addresses.map((address, idx) => {
        return {
            reference: `token-balance-${address}${idx}${ex ? `-${ex}` : ''}`,
            contractAddress: address,
            abi: ERC20.abi,
            calls: [
                {
                    reference: `decimals`,
                    methodName: 'decimals',
                    methodParameters: []
                },
                ...users[idx].map(u => {
                    return {
                        reference: `userBalance-${u}`,
                        methodName: 'balanceOf',
                        methodParameters: [u]
                    }
                })
            ]
        }
    })

    return cc2
}

export function tokenBalanceCallRes(ret: ContractCallResults, addresses: string[], idx: number, user: string, ex?: string) {
    const BN = getBN()

    const address = addresses[idx]
    const ctx = ret.results[`token-balance-${address}${idx}${ex ? `-${ex}` : ''}`].callsReturnContext
    return {
        balance: BN(ctx?.find((c) => c.decoded === true && c.reference === `userBalance-${user}`)?.returnValues[0].hex || '0'),
        decimals: ctx?.find((c) => c.decoded === true && c.reference === `decimals`)?.returnValues[0]
    }
}

export function pairIntrinsicCallCtx(lpArray: string[], ex?: string) {

    const cc1: ContractCallContext[] = lpArray.map(addr => {
        return {
            reference: `pair-intrinsic1-${addr}${ex ? `-${ex}` : ''}`,
            contractAddress: addr,
            abi: Pair.abi,
            calls: [
                {
                    reference: `token0`,
                    methodName: 'token0',
                    methodParameters: []
                },
                {
                    reference: `token1`,
                    methodName: 'token1',
                    methodParameters: []
                },
                {
                    reference: `name`,
                    methodName: 'name',
                    methodParameters: []
                },
                {
                    reference: `symbol`,
                    methodName: 'symbol',
                    methodParameters: []
                },
                {
                    reference: `decimals`,
                    methodName: 'decimals',
                    methodParameters: []
                },
                {
                    reference: `getReserves`,
                    methodName: 'getReserves',
                    methodParameters: []
                },
                {
                    reference: `totalSupply`,
                    methodName: 'totalSupply',
                    methodParameters: []
                }
            ]
        }
    })

    const cc2: ContractCallContext[] = lpArray.map(addr => {
        return {
            reference: `pair-intrinsic2-${addr}${ex ? `-${ex}` : ''}`,
            contractAddress: addr,
            abi: Pool,
            calls: [
                {
                    reference: `fee`,
                    methodName: 'fee',
                    methodParameters: []
                },
                {
                    reference: `slot0`,
                    methodName: 'slot0',
                    methodParameters: []
                },
                {
                    reference: `liquidity`,
                    methodName: 'liquidity',
                    methodParameters: []
                }
            ]
        }
    })

    return [...cc1, ...cc2]
}

export function pairIntrinsicCallRes(ret: ContractCallResults, address: string, ex?: string) {
    const BN = getBN()
    const ctx = ret.results[`pair-intrinsic1-${address}${ex ? `-${ex}` : ''}`].callsReturnContext
    const decimals = ctx?.find((c) => c.decoded === true && c.reference === `decimals`)?.returnValues[0]
    const totalSupply = ctx?.find((c) => c.decoded === true && c.reference === `totalSupply`)?.returnValues[0]

    const token0 = ctx?.find((c) => c.decoded === true && c.reference === `token0`)?.returnValues[0]?.toLowerCase()
    const token1 = ctx?.find((c) => c.decoded === true && c.reference === `token1`)?.returnValues[0]?.toLowerCase()

    const ctx2 = ret.results[`pair-intrinsic2-${address}${ex ? `-${ex}` : ''}`].callsReturnContext
    const fee = ctx2?.find((c) => c.decoded === true && c.reference === `fee`)?.returnValues[0]
    const sqrtPriceX96 = ctx2?.find((c) => c.decoded === true && c.reference === `slot0`)?.returnValues[0]
    const liquidity = ctx2?.find((c) => c.decoded === true && c.reference === `liquidity`)?.returnValues[0]

    return {
        address: address.toLowerCase(),
        name: ctx?.find((c) => c.decoded === true && c.reference === `name`)?.returnValues[0],
        symbol: ctx?.find((c) => c.decoded === true && c.reference === `symbol`)?.returnValues[0],
        decimals: decimals,
        token0,
        token1,
        totalSupply: totalSupply ? BN(totalSupply.hex).div(BN(`1e${decimals}`)).toString() : undefined,
        version: fee > 0 ? 3 : 2,
        fee,
        sqrtPriceX96: sqrtPriceX96 ? BN(sqrtPriceX96.hex).toString() : undefined,
        liquidity: liquidity ? BN(liquidity.hex).toString() : undefined
    }
}

export function pairReserveCallCtxFromIntrinsic(pinfos: any[], ex?: string) {
    const cc2: ContractCallContext[] = pinfos.map(pinfo => {
        return [{
            reference: `pair-rsv-${pinfo.address}-${pinfo.token0}${ex ? `-${ex}` : ''}`,
            contractAddress: pinfo.token0,
            abi: ERC20.abi,
            calls: [
                {
                    reference: 'pairBalance',
                    methodName: 'balanceOf',
                    methodParameters: [pinfo.address]
                },
                {
                    reference: 'decimals',
                    methodName: 'decimals',
                    methodParameters: []
                }
            ]
        },
        {
            reference: `pair-rsv-${pinfo.address}-${pinfo.token1}${ex ? `-${ex}` : ''}`,
            contractAddress: pinfo.token1,
            abi: ERC20.abi,
            calls: [
                {
                    reference: 'pairBalance',
                    methodName: 'balanceOf',
                    methodParameters: [pinfo.address]
                },
                {
                    reference: 'decimals',
                    methodName: 'decimals',
                    methodParameters: []
                }
            ]
        }]
    }).reduce((prev, cur) => [...prev, ...cur], [])

    return cc2
}

export function pairReserveCallResFromIntrinsic(ret: ContractCallResults, pinfo: any, ex?: string) {
    const BN = getBN()
    const ctx0 = ret.results[`pair-rsv-${pinfo.address}-${pinfo.token0}${ex ? `-${ex}` : ''}`].callsReturnContext
    const ctx1 = ret.results[`pair-rsv-${pinfo.address}-${pinfo.token1}${ex ? `-${ex}` : ''}`].callsReturnContext

    const decimal0 = ctx0.find(t => t.decoded === true && t.reference === 'decimals')?.returnValues[0] || 18
    const balance0 = BN(ctx0.find(t => t.decoded === true && t.reference === 'pairBalance')?.returnValues[0].hex || '0').toString()
    const decimal1 = ctx1.find(t => t.decoded === true && t.reference === 'decimals')?.returnValues[0] || 18
    const balance1 = BN(ctx1.find(t => t.decoded === true && t.reference === 'pairBalance')?.returnValues[0].hex || '0').toString()

    return {
        ...pinfo,
        decimal0,
        balance0,
        decimal1,
        balance1
    }
}

export function tokenIntrinsicCallCtx(addresses: string[], ex?: string) {
    const cc2: ContractCallContext[] = addresses.map(address => {
        return {
            reference: `token-intrinsic-${address}${ex ? `-${ex}` : ''}`,
            contractAddress: address,
            abi: ERC20.abi,
            calls: [
                {
                    reference: 'name',
                    methodName: 'name',
                    methodParameters: []
                },
                {
                    reference: 'owner',
                    methodName: 'owner',
                    methodParameters: []
                },
                {
                    reference: 'symbol',
                    methodName: 'symbol',
                    methodParameters: []
                },
                {
                    reference: 'decimals',
                    methodName: 'decimals',
                    methodParameters: []
                },
                {
                    reference: 'totalSupply',
                    methodName: 'totalSupply',
                    methodParameters: []
                },
                ...getTokenDeadAddresses().map(a => {
                    return {
                        reference: `balance-${a}`,
                        methodName: 'balanceOf',
                        methodParameters: [a]
                    }
                })
            ]
        }
    })

    return cc2
}

export function tokenIntrinsicCallRes(ret: ContractCallResults, address: string, ex?: string) {
    const BN = getBN()
    const ctx = ret.results[`token-intrinsic-${address}${ex ? `-${ex}` : ''}`].callsReturnContext
    const decimals = ctx.find(t => t.decoded === true && t.reference === 'decimals')?.returnValues[0] || 18

    const bal = getTokenDeadAddresses().map(a => ctx.find(t => t.decoded === true && t.reference === `balance-${a}`)?.returnValues[0]?.hex)
    const valid = bal.filter(b => b === undefined).length === 0
    const burnt = valid === true ? bal.reduce((prev, cur) => prev.plus(BN(cur)), BN(0)).div(BN(`1e${decimals}`)).toString() : undefined

    return {
        address: address.toLowerCase(),
        name: ctx.find(t => t.decoded === true && t.reference === 'name')?.returnValues[0] || '',
        symbol: ctx.find(t => t.decoded === true && t.reference === 'symbol')?.returnValues[0] || '',
        decimals: decimals,
        owner: ctx.find(t => t.decoded === true && t.reference === 'owner')?.returnValues[0]?.toLowerCase() || '',
        totalSupply: BN(ctx.find(t => t.decoded === true && t.reference === 'totalSupply')?.returnValues[0]?.hex || '0').div(BN(`1e${decimals}`)).toString(),
        valid,
        burnt
    }
}

export function tokenPairReqCallCtx(addresses: string[], factories: string[], chainTokens: string[], ex?: string) {
    let allFactoryInfo = {}
    factories.forEach(f => {
        let allPairs = []
        addresses.forEach(a => {
            chainTokens.forEach(c => {
                allPairs.push([a, c])
            })
        })
        allFactoryInfo[f] = allPairs
    })

    const cc1: ContractCallContext[] = Object.keys(allFactoryInfo).map(factory => {
        return {
            reference: `factoryv2-pair-get-${factory}${ex ? `-${ex}` : ''}`,
            contractAddress: factory,
            abi: Factory.abi,
            calls: allFactoryInfo[factory].map(pair => {
                return {
                    reference: `token-${pair[0]}-${pair[1]}`,
                    methodName: 'getPair',
                    methodParameters: [pair[0], pair[1]]
                };
            })
        }
    })

    const cc2: ContractCallContext[] = Object.keys(allFactoryInfo).map(factory => {
        return {
            reference: `factoryv3-pair-get-${factory}${ex ? `-${ex}` : ''}`,
            contractAddress: factory,
            abi: FactoryV3,
            calls: allFactoryInfo[factory].map(pair => {
                return [
                    {
                        reference: `token-${pair[0]}-${pair[1]}-500`,
                        methodName: 'getPool',
                        methodParameters: [pair[0], pair[1], 500]
                    },
                    {
                        reference: `token-${pair[0]}-${pair[1]}-3000`,
                        methodName: 'getPool',
                        methodParameters: [pair[0], pair[1], 3000]
                    },
                    {
                        reference: `token-${pair[0]}-${pair[1]}-10000`,
                        methodName: 'getPool',
                        methodParameters: [pair[0], pair[1], 10000]
                    }
                ]
            }).reduce((prev, cur) => [...prev, ...cur], [])
        }
    })

    return [...cc1, ...cc2]
}

export function tokenPairReqCallRes(ret: ContractCallResults, token: string, factories: string[], chainTokens: string[], ex?: string) {
    let retPairsAndPools = []
    factories.forEach(factory => {
        const ctx1 = ret.results[`factoryv2-pair-get-${factory}${ex ? `-${ex}` : ''}`].callsReturnContext
        const ctx2 = ret.results[`factoryv3-pair-get-${factory}${ex ? `-${ex}` : ''}`].callsReturnContext

        retPairsAndPools = [
            ...retPairsAndPools,
            ...chainTokens.map(c => ctx1.find(t => t.decoded === true && t.reference === `token-${token}-${c}`)?.returnValues[0]?.toLowerCase()).filter(t => t !== undefined && t !== AddressZero).map(a => { return { address: a, factory: factory } }),
            ...chainTokens.map(c => ctx2.find(t => t.decoded === true && t.reference === `token-${token}-${c}-500`)?.returnValues[0]?.toLowerCase()).filter(t => t !== undefined && t !== AddressZero).map(a => { return { address: a, factory: factory } }),
            ...chainTokens.map(c => ctx2.find(t => t.decoded === true && t.reference === `token-${token}-${c}-3000`)?.returnValues[0]?.toLowerCase()).filter(t => t !== undefined && t !== AddressZero).map(a => { return { address: a, factory: factory } }),
            ...chainTokens.map(c => ctx2.find(t => t.decoded === true && t.reference === `token-${token}-${c}-10000`)?.returnValues[0]?.toLowerCase()).filter(t => t !== undefined && t !== AddressZero).map(a => { return { address: a, factory: factory } })
        ]
    })
    return retPairsAndPools
}

export function pairLockedCallCtx(lpArray: string[], lockers: string[], ex?: string) {
    const cc2: ContractCallContext[] = lpArray.map(addr => {
        return {
            reference: `lp-locked-${addr}${ex ? `-${ex}` : ''}`,
            contractAddress: addr,
            abi: Pair.abi,
            calls: lockers.map(la => {
                return {
                    reference: `lockedSupply-${la}`,
                    methodName: 'balanceOf',
                    methodParameters: [la]
                }
            })
        }
    })

    return cc2
}

export function pairFactoryReqCallCtx(token0Array: string[], token1Array: string[], factories: string[], ex?: string) {
    let allFactoryInfo = {}
    factories.forEach(f => {
        let allPairs = []
        token0Array.forEach((a, idx) => {
            allPairs.push([a, token1Array[idx]])
        })
        allFactoryInfo[f] = allPairs
    })

    const cc1: ContractCallContext[] = Object.keys(allFactoryInfo).map(factory => {
        return {
            reference: `pair-factoryv2-${factory}${ex ? `-${ex}` : ''}`,
            contractAddress: factory,
            abi: Factory.abi,
            calls: allFactoryInfo[factory].map(pair => {
                return {
                    reference: `token-${pair[0]}-${pair[1]}`,
                    methodName: 'getPair',
                    methodParameters: [pair[0], pair[1]]
                };
            })
        }
    })

    const cc2: ContractCallContext[] = Object.keys(allFactoryInfo).map(factory => {
        return {
            reference: `pair-factoryv3-${factory}${ex ? `-${ex}` : ''}`,
            contractAddress: factory,
            abi: FactoryV3,
            calls: allFactoryInfo[factory].map(pair => {
                return [
                    {
                        reference: `token-${pair[0]}-${pair[1]}-500`,
                        methodName: 'getPool',
                        methodParameters: [pair[0], pair[1], 500]
                    },
                    {
                        reference: `token-${pair[0]}-${pair[1]}-3000`,
                        methodName: 'getPool',
                        methodParameters: [pair[0], pair[1], 3000]
                    },
                    {
                        reference: `token-${pair[0]}-${pair[1]}-10000`,
                        methodName: 'getPool',
                        methodParameters: [pair[0], pair[1], 10000]
                    }
                ]
            }).reduce((prev, cur) => [...prev, ...cur], [])
        }
    })

    return [...cc1, ...cc2]
}

export function pairFactoryReqCallRes(ret: ContractCallResults, pair: string, token0: string, token1: string, factories: string[], ex?: string) {
    for (const factory of factories) {
        const ctx1 = ret.results[`pair-factoryv2-${factory}${ex ? `-${ex}` : ''}`].callsReturnContext
        const ctx2 = ret.results[`pair-factoryv3-${factory}${ex ? `-${ex}` : ''}`].callsReturnContext

        const v2Pair = ctx1.find(t => t.decoded === true && t.reference === `token-${token0}-${token1}`)?.returnValues[0]?.toLowerCase()
        const v3Pair500 = ctx2.find(t => t.decoded === true && t.reference === `token-${token0}-${token1}-500`)?.returnValues[0]?.toLowerCase()
        const v3Pair3000 = ctx2.find(t => t.decoded === true && t.reference === `token-${token0}-${token1}-3000`)?.returnValues[0]?.toLowerCase()
        const v3Pair10000 = ctx2.find(t => t.decoded === true && t.reference === `token-${token0}-${token1}-10000`)?.returnValues[0]?.toLowerCase()

        if ([v2Pair, v3Pair500, v3Pair3000, v3Pair10000].find(a => a === pair)) return factory
    }
}

export function pairLockedCallRes(ret: ContractCallResults, lp: string, locker: string, ex?: string) {
    const BN = getBN()
    const ctx = ret.results[`lp-locked-${lp}${ex ? `-${ex}` : ''}`].callsReturnContext
    return BN(ctx?.find(t => t.decoded === true && t.reference === `lockedSupply-${locker}`)?.returnValues[0]?.hex || '0')
}

export function pricefeedCallCtx(priceFeeds: string[], ex?: string) {
    const cc2: ContractCallContext[] = priceFeeds.map(addr => {
        return {
            reference: `pricefeed-${addr}${ex ? `-${ex}` : ''}`,
            contractAddress: addr,
            abi: PriceFeed.abi,
            calls: [
                {
                    reference: 'latestAnswer',
                    methodName: 'latestAnswer',
                    methodParameters: []
                }
            ]
        }
    })

    return cc2
}

export function pricefeedCallRes(ret: ContractCallResults, priceFeed: string, ex?: string) {
    const BN = getBN()
    const ctx = ret.results[`pricefeed-${priceFeed}${ex ? `-${ex}` : ''}`].callsReturnContext
    return BN(ctx?.find(t => t.decoded === true && t.reference === `latestAnswer`)?.returnValues[0]?.hex || '0').div(BN(`1e8`)).toString()
}

export function routerIntrinsicCallCtx(routerArray: string[], ex?: string) {
    const cc1: ContractCallContext[] = routerArray.map(addr => {
        return {
            reference: `router-intrinsic-${addr}${ex ? `-${ex}` : ''}`,
            contractAddress: addr,
            abi: Router.abi,
            calls: [
                {
                    reference: `factory`,
                    methodName: 'factory',
                    methodParameters: []
                },
                {
                    reference: `WETH-0`,
                    methodName: 'WETH',
                    methodParameters: []
                },
                {
                    reference: `WETH-1`,
                    methodName: 'WBNB',
                    methodParameters: []
                },
                {
                    reference: `WETH-2`,
                    methodName: 'WETH9',
                    methodParameters: []
                }
            ]
        }
    })

    return cc1
}

export function routerIntrinsicCallRes(ret: ContractCallResults, router: string, ex?: string) {
    const ctx = ret.results[`router-intrinsic-${router}${ex ? `-${ex}` : ''}`].callsReturnContext
    const factory = ctx?.find(t => t.decoded === true && t.reference === `factory`)?.returnValues[0]?.toLowerCase()
    const weth = [0, 1, 2].map(idx => ctx?.find(t => t.decoded === true && t.reference === `WETH-${idx}`)?.returnValues[0]?.toLowerCase()).find(addr => addr !== undefined)

    return {
        factory,
        weth
    }
}

export function factoryIntrinsicCallCtx(factoryArray: string[], ex?: string) {
    const cc1: ContractCallContext[] = factoryArray.map(addr => {
        return {
            reference: `factory-intrinsic-${addr}${ex ? `-${ex}` : ''}`,
            contractAddress: addr,
            abi: [
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "tokenA",
                            "type": "address"
                        },
                        {
                            "internalType": "address",
                            "name": "tokenB",
                            "type": "address"
                        }
                    ],
                    "name": "getPair",
                    "outputs": [
                        {
                            "internalType": "address",
                            "name": "pair",
                            "type": "address"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "tokenA",
                            "type": "address"
                        },
                        {
                            "internalType": "address",
                            "name": "tokenB",
                            "type": "address"
                        },
                        {
                            "internalType": "uint24",
                            "name": "fee",
                            "type": "uint24"
                        }
                    ],
                    "name": "getPool",
                    "outputs": [
                        {
                            "internalType": "address",
                            "name": "pair",
                            "type": "address"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
            ],
            calls: [
                {
                    reference: `getPairV2`,
                    methodName: 'getPair',
                    methodParameters: [AddressZero, AddressZero]
                },
                {
                    reference: `getPairV3`,
                    methodName: 'getPool',
                    methodParameters: [AddressZero, AddressZero, '1000']
                }
            ]
        }
    })

    return cc1
}

export function factoryIntrinsicCallRes(ret: ContractCallResults, factory: string, ex?: string) {
    const ctx = ret.results[`factory-intrinsic-${factory}${ex ? `-${ex}` : ''}`].callsReturnContext
    const v2 = ctx?.find(t => t.decoded === true && t.reference === `getPairV2`)?.returnValues[0] !== undefined
    const v3 = ctx?.find(t => t.decoded === true && t.reference === `getPairV3`)?.returnValues[0] !== undefined
    return { v2, v3 }
}
