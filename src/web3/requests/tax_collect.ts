import { chainConfig } from "../chain.config"
import { AddressDead, getBN } from "../web3.operation"
import Simulator from '../abi/SimulateTax.json'
import { PairInfoModel } from "../../models/pair.info.model"
import Logging from "../../utils/logging"

async function getPairChain(chain: string, token: string, weth: string) {
    const p = await PairInfoModel.findOne({ chain: chain, $or: [{ token0: token, token1: weth }, { token1: token, token0: weth }] })
    if (p !== null) return [p.address]

    let tokenFirst = token
    let retPairs = []
    while (tokenFirst !== weth) {
        const p = (await PairInfoModel.find({ chain: chain, $or: [{ token0: tokenFirst }, { token1: tokenFirst }] })).filter(p => retPairs.find(r => r === p.address) === undefined)
        if (p.length === 0) return []

        retPairs = [...retPairs, p[0].address]
        tokenFirst = (p[0].token0 === tokenFirst) ? p[0].token1 : p[0].token0
    }

    return retPairs
}

export async function getTaxCollection(web3: any, chain: string, token: string) {
    try {
    const BN = getBN()
    const simulator = chainConfig[chain].simulator
    const weth = chainConfig[chain].tokens[0].toLowerCase()

    const pairChain = await getPairChain(chain, token, weth)

    const getAmountOutDeductTax = {
        ethereum: '30',
        bsc: '25',
        arbitrum: '30'
    }

    const fnr = Simulator.abi.find(t => t.name === 'testTax')
    const encodedAgain = web3.eth.abi.encodeFunctionCall(fnr, [token, weth, pairChain, getAmountOutDeductTax[chain]])

    const testValues = ['0x3B9ACA00', '0xE8D4A51000', '0x38D7EA4C68000']

    for (const tst of testValues) {
        try {
            const ret: any = await new Promise((resolve, reject) => {
                web3.currentProvider.send({
                    method: "eth_call",
                    params: [
                        {
                            "from": AddressDead,
                            "to": simulator,
                            "value": tst,
                            "data": encodedAgain
                        },
                        "latest"
                    ],
                    jsonrpc: "2.0",
                    id: 1
                }, function (err, result) {
                    if (err === null && !result.error) {
                        const ret = result.result
                        if (ret?.slice(0, 2) === '0x') {
                            let idx
                            let values = []
                            for (idx = 0; idx < 4; idx++) {
                                values = [...values, BN('0x' + ret.slice(2 + idx * 64, 2 + (idx + 1) * 64))]
                            }
                            const buyTax = BN(100).minus(values[1].times(100).div(values[0]).toString()).toString()
                            const sellTax = BN(100).minus(values[3].times(100).div(values[2]).toString()).toString()
                            resolve({
                                address: token.toLowerCase(),
                                buyTax,
                                sellTax
                            })
                        } else {
                            resolve(undefined)
                        }
                    } else {
                        reject(err === null ? result.error.message : err.message)
                    }
                })
            })

            return ret
        } catch (err) {
            // Logging.error('[getTaxCollection]')
            // console.log('[getTaxCollection]', chain, token, err)
        }
        // try {
        //     const ret = await fastQuery('', chain, simulator, Simulator.abi, 'testTax', [token, weth, pairChain, getAmountOutDeductTax[chain]], tst)
        //     console.log('>>>>', ret)
        //     if (ret) {
        //         const buyTax = BN(100).minus(BN(ret.boughtAmount).times(100).div(BN(ret.totalBuyAmount)).toString()).toString()
        //         const sellTax = BN(100).minus(BN(ret.soldAmount).times(100).div(BN(ret.totalSellAmount)).toString()).toString()
        //         return {
        //             address: token.toLowerCase(),
        //             buyTax,
        //             sellTax
        //         }
        //     }
        // } catch (err) {
        //     Logging.error('[getTaxCollection]')
        //     console.log('[getTaxCollection]', chain, token, err)
        // }
    }
    } catch (err) {
        console.error(`[getTaxCollection] ${(new Date()).toLocaleString()}`)
        console.error(err);
    }
}

//         console.log('////////////////////////////////////////////////////////')
    //         const abi = `[
    // 	{
    // 		"inputs": [
    // 			{
    // 				"internalType": "address",
    // 				"name": "token",
    // 				"type": "address"
    // 			},
    // 			{
    // 				"internalType": "address",
    // 				"name": "pair",
    // 				"type": "address"
    // 			},
    // 			{
    // 				"internalType": "address",
    // 				"name": "user",
    // 				"type": "address"
    // 			}
    // 		],
    // 		"name": "testTax",
    // 		"outputs": [
    // 			{
    // 				"internalType": "uint256",
    // 				"name": "",
    // 				"type": "uint256"
    // 			},
    // 			{
    // 				"internalType": "uint256",
    // 				"name": "",
    // 				"type": "uint256"
    // 			},
    // 			{
    // 				"internalType": "uint256",
    // 				"name": "",
    // 				"type": "uint256"
    // 			},
    // 			{
    // 				"internalType": "uint256",
    // 				"name": "",
    // 				"type": "uint256"
    // 			}
    // 		],
    // 		"stateMutability": "nonpayable",
    // 		"type": "function"
    // 	}
    // ]`
    //         fastQuery('0', ch, '0x509e7433A0241E9B347fD23AC18CD9D8463f1e34', JSON.parse(abi), 'testTax', ['0x1400ab77651a26104239ff4a900073dc9fcd16a7', '0x9179A0F3cA25308afc4BeEE3C7f9aA1A2913370b', '0x289c4e3bE3ACC43f3F5a1674f047Ca975008fE88'])
    //             .then(ret => {
    //                 console.log('++++++++++++++++++++++++++', ret)
    //             })
    //             .catch(err => {
    //                 console.error(err)
    //             })
    //         console.log('////////////////////////////////////////////////////////')

    // const simulation_params = { // simulate contract example
    //     "from": '0x289c4e3bE3ACC43f3F5a1674f047Ca975008fE88',

    //     "to": '0x509e7433A0241E9B347fD23AC18CD9D8463f1e34',

    //     "data": '0x84ff2fe00000000000000000000000001400ab77651a26104239ff4a900073dc9fcd16a70000000000000000000000009179a0f3ca25308afc4beee3c7f9aa1a2913370b000000000000000000000000289c4e3be3acc43f3f5a1674f047ca975008fe88'
    // }

    // listenContext[ch].web3.currentProvider.send({
    //     method: "debug_traceCall",
    //     params: [
    //         {
    //             "from": '0x9179A0F3cA25308afc4BeEE3C7f9aA1A2913370b',
    //             "to": '0x1400ab77651a26104239ff4a900073dc9fcd16a7',
    //             "data": '0xa9059cbb000000000000000000000000289c4e3be3acc43f3f5a1674f047ca975008fe880000000000000000000000000000000000000000000000000000000000002710'
    //         },
    //         "latest",
    //         { "tracer": "callTracer" }
    //     ],
    //     jsonrpc: "2.0",
    //     id: "2"
    // }, function (err, result) {
    //     console.log('++++++++++++++++++++++++++++', err, result)
    //     console.log('++++++++++++++++++++', result.result.calls)
    // })

    // bsc, token: 0x9fba4c6fa59c832fc56c30a3f384bb8f0e30ff05, buy tax 8%, sell tax 9%, pair: 0x24b9b51f6a307b65106845bffa8df05d99fdde06
    // calldata: 0xee6cd38b0000000000000000000000009fba4c6fa59c832fc56c30a3f384bb8f0e30ff05000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000100000000000000000000000024b9b51f6a307b65106845bffa8df05d99fdde06
    // bsc, token: 0x1400ab77651a26104239ff4a900073dc9fcd16a7, buy tax 0%, sell tax 0%, pair: 0x9179A0F3cA25308afc4BeEE3C7f9aA1A2913370b
    // calldata: 0xee6cd38b0000000000000000000000001400ab77651a26104239ff4a900073dc9fcd16a7000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000009179a0f3ca25308afc4beee3c7f9aa1a2913370b

    // const BN = getBN()
    // listenContext[ch].web3.currentProvider.send({
    //     method: "debug_traceCall",
    //     params: [
    //         {
    //             "from": '0x289c4e3bE3ACC43f3F5a1674f047Ca975008fE88',
    //             "to": '0xcc396b18C15f9437fB6d0ffa981640d38D504428',
    //             "value": '0x2540BE400',
    //             "data": '0xee6cd38b0000000000000000000000001400ab77651a26104239ff4a900073dc9fcd16a7000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000009179a0f3ca25308afc4beee3c7f9aa1a2913370b'
    //         },
    //         "latest",
    //         { "tracer": "callTracer" }
    //     ],
    //     jsonrpc: "2.0",
    //     id: "2"
    // }, function (err, result) {
    //     console.log('++++++++++++++++++++++++++++', err, result)
    //     console.log('++++++++++++++++++++', result.result.calls)

    //     const ret = result.result.output
    //     if (ret.slice(0, 2) === '0x') {
    //         let idx
    //         let values = []
    //         for (idx = 0; idx < 4; idx++) {
    //             values = [...values, BN('0x' + ret.slice(2 + idx * 64, 2 + (idx + 1) * 64))]
    //         }
    //         const buyTax = BN(100).minus(values[1].times(100).div(values[0]).toString()).toString()
    //         const sellTax = BN(100).minus(values[3].times(100).div(values[2]).toString()).toString()
    //         console.log('***********', values.map(t => t.toString()), buyTax, sellTax)
    //     }
    // })