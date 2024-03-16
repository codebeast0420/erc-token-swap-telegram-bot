import { chainConfig } from './chain.config'
import { SnipeTokenModel } from '../models/snipe.godmode.token';
import { prefetchPairsOnChain, prefetchTokensOnChain, prefetchDexOnChain, getWeb3 } from './multicall';
import { sleep } from '../utils/common';
import Logging from '../utils/logging';
import { CopyTradeModel } from '../models/copytrade.model';
import { ChainModel } from '../models/chain.model'
import { handleSnipePendingTxn } from './snipe/snipe.trigger';
import { processSnipeLiquidity, processSnipeMethodId } from './snipe/snipe.trade'
import { executeRouterFunction } from './copytrade/execute'
import { getRPC } from './chain.parameters'
import { core_info } from '../service/multicore/config'
import { sendCopytradeMessage, sendIPCMessage } from '../service/multicore/service'
import CircularBuffer from 'circular-buffer'
import { analyzeLog, getDexPairEvents, getDexPairV3Events, getERC20Events, getRouterContract, getSmartRouterContract } from './abi/decode';
import { PairInfoModel } from '../models/pair.info.model';
import { getRouterAndWETH, getTokenInfo, getTokenTaxInfo } from '../service/token.service';
import { executeCopyTradeEvent } from './copytrade/event_tx';
import { sendBotMessage } from '../service/app.service';
import { getRawTransaction } from './web3.operation';

const Web3 = require('web3')

async function batchRequestsToChain(web3: any, chain: string, scanNo: number) {
	const blockCountChains = {
		bsc: 10,
		arbitrum: 200, // don't change this value, RPC server may not respond
		ethereum: 7,
	}
	const BIG_BLOCK_NUMBER = 1000000000000000000

	const batchBlockRequests = new web3.eth.BatchRequest()

	const blockNumbers = Array.from(Array(blockCountChains[chain]).keys()).map(idx => idx + scanNo)
	const totalBlocks = blockNumbers.length
	let counterBlocks = 0
	let blocks = []
	let errorBlocks = []

	const tick = (new Date()).getTime()
	const printInfo = (printText) => {
		console.log('>>>', chain, printText, ((new Date()).getTime() - tick) / 1000)
	}

	// printInfo(`before reading blocks from ${scanNo}`)

	const blocksRet: any[] = await new Promise(function (resolve, reject) {
		blockNumbers.forEach(blockNumber => {
			batchBlockRequests.add(
				web3.eth.getBlock.request(blockNumber, true, (error, data) => {
					counterBlocks++;
					if (!error && data) {
						blocks.push(data)
					} else {
						errorBlocks.push(blockNumber)
					}
					if (counterBlocks === totalBlocks) resolve(blocks)
				})
			)
		});

		return batchBlockRequests.execute()
	})

	// printInfo(`from block ${scanNo}, ${blocksRet.length} blocks read, ${errorBlocks.length} blocks error`)

	if (errorBlocks.length > 0 && errorBlocks[0] + errorBlocks.length < blockNumbers[blockNumbers.length - 1]) {
		Logging.error(`Error reading blocks`)
		console.log(chain, errorBlocks)
		await sleep(3000)
		return
	}

	const errorMinBlockNumber = errorBlocks.reduce((prev, cur) => prev > cur ? cur : prev, BIG_BLOCK_NUMBER)
	const maxBlockNumber = blocksRet.reduce((prev, cur) => prev > cur.number ? prev : cur.number, 0)

	const nextScanNo = (errorMinBlockNumber < BIG_BLOCK_NUMBER) ? errorMinBlockNumber : maxBlockNumber + 1

	const blocksScanned = blocksRet.filter(b => b?.number > 0 && b?.number < nextScanNo)
	if (blocksScanned.length === 0) return

	blocksScanned.sort((b1, b2) => b1.number < b2.number ? -1 : b1.number > b2.number ? 1 : 0)
	const allTxs = blocksScanned.map(bl => bl.transactions).reduce((prev, cur) => [...prev, ...cur], [])
	let txHashes = allTxs.map(tx => tx.hash)
	let allReceipts = []

	let txReadCounter = 3
	while (txHashes.length > 0 && txReadCounter > 0) {
		txReadCounter--

		const batchTxRequests = new web3.eth.BatchRequest()
		const totalTxs = txHashes.length
		let counterTxs = 0
		let txs = []
		let errorTxs = []

		const txsRet: any[] = await new Promise(function (resolve, reject) {
			txHashes.forEach(txHash => {
				batchTxRequests.add(
					web3.eth.getTransactionReceipt.request(txHash, (error, data) => {
						counterTxs++;
						if (!error && data) {
							txs.push(data)
						} else {
							errorTxs.push(txHash)
						}
						if (counterTxs === totalTxs) resolve(txs)
					})
				)
			});

			batchTxRequests.execute()
		})

		allReceipts = [...allReceipts, ...txsRet]
		txHashes = errorTxs
		if (errorTxs.length > 0) {
			await sleep(3000)
		}
	}

	if (txHashes.length > 0) {
		Logging.error(`[${chain}] transactions invalid`)
		console.log(txHashes)
	}

	// printInfo(`${blocksScanned.length} blocks, ${allTxs.length} transactions, ${allReceipts.length} receipts`)

	return {
		nextScanNo,
		chain: chain,
		blocks: blocksScanned,
		transactions: allTxs,
		receipts: allReceipts.map(r => {
			return {
				...r,
				transaction: allTxs.find(tx => tx.hash === r.transactionHash)
			}
		})
	}
}

const tempRingBuffer = Array.from(Array(128).keys()).map(t => {
	return {
		core: t
	}
})

export async function processAllDataFromChain(coreId: number, data: any) {
	if (!tempRingBuffer[coreId][data.chain]) {
		tempRingBuffer[coreId][data.chain] = {
			blocks: new CircularBuffer(1024),
			transactions: new CircularBuffer(65536),
			receipts: new CircularBuffer(65536),
		}
	}

	const rb = tempRingBuffer[coreId][data.chain]

	data.blocks.forEach(bl => rb.blocks.enq(JSON.stringify(bl)))
	data.transactions.forEach(tx => rb.transactions.enq(JSON.stringify(tx)))
	data.receipts.forEach(rt => rb.receipts.enq(JSON.stringify(rt)))
}

export async function processChainData(coreId: number, chain: string) {
	const web3 = new Web3(chainConfig[chain].rpcUrls[0])
	const events = {
		['ERC20']: getERC20Events(web3),
		['Pair']: getDexPairEvents(web3),
		['PairV3']: getDexPairV3Events(web3)
	}

	while (true) {
		try {
			const rb = tempRingBuffer[coreId][chain]

			const data = {
				chain: chain,
				blocks: [],
				transactions: [],
				receipts: []
			}

			if (rb?.blocks) {
				let maxPop = 10
				while (maxPop > 0 && rb?.blocks.size() > 0) {
					data.blocks = [...data.blocks, JSON.parse(rb?.blocks.deq())]
					maxPop--
				}
			}
			if (rb?.transactions) {
				let maxPop = 400
				while (maxPop > 0 && rb?.transactions.size() > 0) {
					data.transactions = [...data.transactions, JSON.parse(rb?.transactions.deq())]
					maxPop--
				}
			}
			if (rb?.receipts) {
				let maxPop = 400
				while (maxPop > 0 && rb?.receipts.size() > 0) {
					data.receipts = [...data.receipts, JSON.parse(rb?.receipts.deq())]
					maxPop--
				}
			}

			if (data.blocks.length > 0 || data.transactions.length > 0 || data.receipts.length > 0) {
				// if (chain === 'bsc') console.log('>>>', coreId, chain, rb?.blocks.size(), rb?.transactions.size(), rb?.receipts.size())
				await processAllDataFromChain1(web3, events, data)
			} else {
				await sleep(100)
			}
		} catch (err) {
			console.error(err)
		}
	}
}

export async function processAllDataFromChain1(web3: any, events: any, data: any) {
	const chain = data.chain

	const allTxHandleSyncTokensPairs = async () => {
		await handleSyncTokensPairs(web3, chain, events, data.receipts)
	}

	const allTxAnalyze = async () => {
		handleTx(chain, web3, data.transactions)
	}

	const allTxAnalyzeEvents = async () => {
		const allLogs = data.receipts.map(receipt => receipt.logs.map(lg => { return { log: lg, receipt: receipt } })).reduce((prev, cur) => [...prev, ...cur], [])
		analyzeEvents(chain, web3, events, allLogs)
	}

	const tick = (new Date()).getTime()

	await allTxHandleSyncTokensPairs()
	await allTxAnalyze()
	await allTxAnalyzeEvents()

	// console.log('>>>', chain, data.blocks.length, data.transactions.length, data.receipts.length, ((new Date()).getTime() - tick) / 1000)
}

export async function scanAndProcessFromChain(chain: string) {
	// Logging.info(`Starting to scan and process transactions on [${chain}]...`)

	// const chainInfo = await ChainModel.findOne({ name: chain })

	// const web3 = listenContext[chain].web3

	// let scanNo = chainInfo.blockScanned
	// if (chainInfo.blockScanned === undefined || chainInfo.blockScanned === 0) {
	//     scanNo = await web3.eth.getBlockNumber()
	// }

	// const tick = (new Date()).getTime()
	// const startNo = scanNo
	// const printInfo = (printText) => {
	//     console.log('>>>', chain, printText, ((new Date()).getTime() - tick) / 1000)
	// }

	// while (true) {
	//     try {
	//         const ret = await batchRequestsToChain(web3, chain, scanNo)

	//         if (ret === undefined) {
	//             await sleep(1000)
	//             continue
	//         }

	//         processAllDataFromChain(ret)

	//         chainInfo.blockScanned = ret.nextScanNo
	//         chainInfo.blockScanCount = ret.nextScanNo - startNo
	//         chainInfo.blockScanDuration = ((new Date()).getTime() - tick) / 1000
	//         await chainInfo.save()

	//         scanNo = ret.nextScanNo
	//         // if (chain === 'bsc') printInfo(scanNo - startNo)
	//     } catch (err) {
	//         Logging.error(`[scanAndProcessFromChain]`)
	//         console.error(err)
	//     }
	// }
}

export async function scanPendingTransactions(chain: string) {
	// eugeigne test code
	// return

	const options = {
		timeout: 30000, // ms

		clientConfig: {
			// Useful if requests are large
			maxReceivedFrameSize: 100000000,   // bytes - default: 1MiB
			maxReceivedMessageSize: 100000000, // bytes - default: 8MiB

			// Useful to keep a connection alive
			keepalive: true,
			keepaliveInterval: -1 // ms
		},

		// Enable auto reconnection
		reconnect: {
			auto: true,
			delay: 1000, // ms
			maxAttempts: 10,
			onTimeout: true
		}
	};

	const provider = new Web3.providers.WebsocketProvider(chainConfig[chain].wsUrls[0], options);
	const web3 = new Web3(provider)

	Logging.info('websocket subscribing on ' + chain)

	await ChainModel.updateMany({ name: chain }, { pendingTxnCount: 0, pendingTxnDuration: 0 })

	let pendingTxnCount = 0
	const tickold = (new Date()).getTime()
	let pendingTxnTick = tickold

	const subscription = web3.eth.subscribe('pendingTransactions', (err, res) => {
		if (!err) {
			// res = '0x05cd569c5e21ba61d01d8d38cc0e790f05f46edbd4e2e3251684107ccc1b40bc'
			// res = '0xd078b18a2a906c6f1a29f42b381fbf45344f126f48c58913199975ee46b60428'
			// res = '0x06963946bf1f9c896998df11cafa74a5f6c7eba051ca8879772f0ba63141ac7d'
			web3.eth.getTransaction(res)
				.then(async tx => {
					if (tx !== null) {
						getRawTransaction(web3, tx)
							.then(raw => {
								try {
									const obj = {
										discriminator: 'sync-data',
										blocks: [],
										transactions: [{ ...tx, raw }],
										receipts: []
									}

									const ticknow = (new Date()).getTime()
									pendingTxnCount++

									if (ticknow > pendingTxnTick + 3000) {
										pendingTxnTick += 3000
										// console.log('>>> scanPendingTransactions', chain, pendingTxnCount, (pendingTxnTick - tickold) / 1000)
										ChainModel.updateMany({ name: chain }, { pendingTxnCount: pendingTxnCount, pendingTxnDuration: (pendingTxnTick - tickold) / 1000 })
											.then(() => { }).catch(err => { })
									}

									if (obj.blocks?.length > 0
										|| obj.transactions?.length > 0
										|| obj.receipts?.length > 0) {
										const data1 = JSON.stringify(obj)
										sendIPCMessage(core_info[chain].tx, chain, data1)
									}
								} catch (err) {
								}
							})
					}
				})
		} else {
			console.log(`chain [${chain}] pending tx monitor--->`, err)
		}
	})

	subscription.on('data', (event) => {
		// console.log(event)
	});

	subscription.on('changed', (event) => {
		// console.log(event)
	});

	subscription.on('error', (event) => {
		Logging.error(`websocket error on [${chain}] + ${event}`)
	});

	subscription.on('connected', (event) => {
		Logging.info(`websocket subscription on [${chain}] ${event}`);
	});

	while (true) {
		await sleep(1000)
	}
}

export async function scanFromChain(chain: string) {
	Logging.info(`Starting to scan transactions on [${chain}]...`)

	const chainInfo = await ChainModel.findOne({ name: chain })

	const web3 = new Web3(chainConfig[chain].rpcUrls[0])

	let scanNo = chainInfo?.blockScanned || 0
	// if (chainInfo.blockScanned === undefined || chainInfo.blockScanned === 0) {
	scanNo = await web3.eth.getBlockNumber()
	// }

	const tick = (new Date()).getTime()
	const startNo = scanNo
	const printInfo = (printText) => {
		console.log('>>>', chain, printText, ((new Date()).getTime() - tick) / 1000)
	}

	const subIdArray = core_info[chain].receipt

	{
		////////////////////////////
		//
		// swapExactETHForTokens
		// bsc: 0x5ff1759322e4e8250d35615058d2d6c444e20d14e612c40f36b02a65b72007ba, 0x939c98714ce7ca69b12f67570d2b8c629bf7a98ab627750c51eca9d7c6fe9f5f
		//      error: 0xbcc6988bf969113c88065535ca665e29278d62d38a570bd4ae3190d14916a777
		// arbitrum: 0xde4c76470f599095b01da921c10c6e185bfea015b4d58536372535128e62a30f, 0x7732a4a9463933be3d074cbd792a4831e993ceae959832dd8ee141f8d3ca2619
		//
		// swapExactTokensForETH
		// bsc: 0x0e66bc5c2f43aa5cb397918bd55c5a52cb04e261eff4a3e2b59c9d0c7842b2a3, 0x84b93be7cf74e01c88b64ead7183dede8d8a4390518d77c57050e9570253982f, 0xdcf076e863e851d1724531708f158d2050c9834eff2c32a27dc9bd66845b5902, 0x039a18e881b0d3635a7ab47edb9132fbeb88133b36f7b64f248d38154cd6bbbf
		//
		// swapTokensForExactTokens
		// ethereum: 0xfadf8e06d6ea79e0b81220e37dc450c5fadb3fbdd4907cf4145ddaf0ce065294
		// bsc: 0x73162fb882a7f2f8abff03a5a321b2614952a76b334f5c6ecae955f2a28a5fa3, 0xf60f0590882428bb0c60b1da4698b72e1a7a3007da90a8f81ec3f72ae87f1a46, 0xa867df05a2831c0b4e05e4534cf0b4fc4228a01257cb05d5460206bbb42f4dcd
		//
		// swapExactTokensForTokens
		// arbitrum: 0x075927492e9ffd8cd0f24aef87c555c5d968ca3f94557fda3a1278a4024c8cf8, 0xe5570ed42bb29bcc1c70794c4ad17114c5edab043091e2c071e3925a556084ea, 0xe489f74371c177fe95aea1967d00012ea64805e4aabe4a90e0ff79ecc6df73cc
		// bsc: 0x2c1474e06de3d71a47b17107480e57209ed076499ee3383494ec14e0fcfcbeb5, 0xd8c792bbcfe062f7b6059923cded49336130cc4b1874df6b3cb6b83dd1937f3c
		//
		// swapETHForExactTokens
		// bsc: 0xf72c9453ee7d27545df1bff3be89af71e34f04df559280c939ad9954282c24b0, 0xf3df000f5ec2d40835a4d862269b77c382b25ded4b60eb0d6ea88105dbee0081
		// arbitrum: 0xf332e6b2a40650a20fef2cf2ae51733586b7215c501c29a02a8ff57b5c42ce36
		//
		// swapExactTokensForETHSupportingFeeOnTransferTokens
		// bsc: 0x0535b1961e347e8b1192f792844e7d667ceca9c12c3a7c0799c06f3b2fa6a4ce
		//
		// swapExactTokensForTokensSupportingFeeOnTransferTokens
		// arbitrum: 0x718baf3ccf28ec1b3d8eeb3d8178adb06fd8faf7f49044dabce02157070858e6
		// bsc: 0x922c85671f543a9fed98cb3d561d758aff0fb55c92c4026526dfe9d182873450
		//
		// swapExactETHForTokensSupportingFeeOnTransferTokens
		// bsc: 0x399f0764b3a900f752486ebd20f670d986b4bca925b32462295c30b177adf5d0, 0x4f33333c866cad25939681f4085d72783e0dfe420255b8f5946128ef50f48b68
		//
		// swapTokensForExactETH
		// bsc: 0x48a5c344c26d44e91cfcdce28e118f5291979c1919e06c4091ac2e0c0bf872fb, 0xb386c9407344ad41887d959d65620cb3e65c1aa4dd655f580dbb72b53fa53436, 0x5d3fc20ca6422fe9579bc56c9c86d17d4670adbcf10489093060aed044f3d12a
		//
		// exactInputSingle
		// bsc: 0xfc869396e5ad9b0a4ad2302a4e98e5886d7f948ad16e5fc327faad2dd9e20039
		// arbitrum: 0x149186e4de9708fc60a27f558738a38302b236432f0337ebf96e122627c7494d, 0xf6056bb6abb13e0beb01a7da721791cf9673e407fe4e15bc6c6adc75416004be,
		//
		// exactInput
		// arbitrum: 0x3da954ee0d7ad9ef548311c98225cda42349bab157fc6bb924d793f7786532ed
		//
		// exactOutputSingle
		//
		// exactOutput
		//
		// multicall
		// arbitrum: 0xb3ecb1f889ec4a340674fa20a26b3af5570d8fad25b880982ade7031a0a6b2a6, 0xac692ba09330d6fe32f15cc85e241c981433d8ef7074c0eb4b7d14f810951d0a
		////////////////////////////

		/////////////////////////////
		///////////////////////////// eugeigne test part
		// await sleep(6000)
		// if (chain === 'bsc') {
		//     const transaction = await web3.eth.getTransaction('0xc036471a326521ab3350f86ea734e4aae8245a59ce8d90f6ca0893b4d084af80')
		//     const data = JSON.stringify({
		//         discriminator: 'sync-data',
		//         blocks: [],
		//         transactions: [transaction],
		//         receipts: []
		//     })
		//     sendIPCMessage(subIdArray[0], chain, data)
		// }
		// return
		// if (chain === 'arbitrum') {
		//     const transaction = await web3.eth.getTransaction('0xac692ba09330d6fe32f15cc85e241c981433d8ef7074c0eb4b7d14f810951d0a')
		//     const data = JSON.stringify({
		//         discriminator: 'sync-data',
		//         blocks: [],
		//         transactions: [transaction],
		//         receipts: []
		//     })
		//     sendIPCMessage(subIdArray[0], data)
		// }
		// return
		/////////////////////////////
	}

	while (true) {
		try {
			const ret = await batchRequestsToChain(web3, chain, scanNo)

			if (ret === undefined) {
				await sleep(1000)
				continue
			}

			// printInfo(`block scan no: ${scanNo}, ${ret?.blocks?.length} blocks, ${ret?.transactions?.length} transactions, ${ret?.receipts?.length} receipts`)

			subIdArray.forEach((id, idx) => {
				const b = [Math.floor(idx * ret.blocks.length / subIdArray.length), Math.floor((idx + 1) * ret.blocks.length / subIdArray.length)]
				// const t = [Math.floor(idx * ret.transactions.length / subIdArray.length), Math.floor((idx + 1) * ret.transactions.length / subIdArray.length)]
				const r = [Math.floor(idx * ret.receipts.length / subIdArray.length), Math.floor((idx + 1) * ret.receipts.length / subIdArray.length)]

				const obj1 = {
					discriminator: 'sync-data',
					blocks: ret.blocks.slice(b[0], b[1]),
					transactions: [], //ret.transactions.slice(t[0], t[1]),
					receipts: ret.receipts.slice(r[0], r[1])
				}

				// console.log(`${chain}-${id} - ${obj1.blocks.length} blocks, ${obj1.transactions.length} transactions, ${obj1.receipts.length} receipts`)

				if (obj1.blocks?.length > 0
					|| obj1.transactions?.length > 0
					|| obj1.receipts?.length > 0) {
					const data1 = JSON.stringify(obj1)
					sendIPCMessage(id, chain, data1)
				}
			})

			if (chain === 'arbitrum') { // does not support pending transactions
				const obj = {
					discriminator: 'sync-data',
					blocks: [],
					transactions: ret.transactions,
					receipts: []
				}

				if (obj.blocks?.length > 0
					|| obj.transactions?.length > 0
					|| obj.receipts?.length > 0) {
					const data1 = JSON.stringify(obj)
					sendIPCMessage(core_info[chain].tx, chain, data1)
				}
			}

			const chainInfo = await ChainModel.findOne({ name: chain })

			chainInfo.blockScanned = ret.nextScanNo
			chainInfo.blockScanCount = ret.nextScanNo - startNo
			chainInfo.blockScanDuration = ((new Date()).getTime() - tick) / 1000
			await chainInfo.save()

			scanNo = ret.nextScanNo

			// if (chain === 'bsc') printInfo(scanNo - startNo)
		} catch (err) {
			console.error(`==> ${new Date().toLocaleString()}`)
			console.error(err)
			Logging.error(`[scanFromChain]`)
		}
	}
}

export function analyzeEvents(chain: string, web3: any, eventPackage: any, logs: any[]) {
	let transferLogs = []
	for (const cn in eventPackage) {
		for (const log of logs) {
			try {
				const ret = analyzeLog(web3, eventPackage[cn], log.log)
				if (ret && ret.name === 'Transfer') {
					if (ret.from === undefined || ret.to === undefined) { // NFT transfer
						continue
					}
					transferLogs = [...transferLogs, { log: log, ev: ret }]
				}
			} catch (err) {
				console.error(err)
			}
		}
	}

	handleCopytradeTransferEvent(web3, chain, transferLogs)
}

export function handleTx(chain: string, web3: any, transactions: any[]) {
	handleSnipePendingTxn(web3, chain, transactions)
	handleCopyTradeByMethodID(web3, chain, transactions)
}

export async function handleSyncTokensPairs(web3: any, chain: string, eventPackage: any, receipts: any) {
	let pairArray = []
	let tokenArray = []
	// let sellArray = []
	// let buyArray = []
	let dexInfoArray = []

	for (const receipt of receipts) {
		if (receipt?.logs?.length === 0) continue

		let logs = []

		for (const log of receipt.logs) {
			for (const cn in eventPackage) {
				try {
					const ret = analyzeLog(web3, eventPackage[cn], log);
					if (ret && (ret.name === 'Transfer' || ret.name === 'Swap')) {
						logs = [...logs, {
							package: cn,
							ret: ret,
							log: log
						}]
						break
					}
				} catch (err) {
				}
			}
		}

		let i
		for (i = 0; i < logs.length; i++) {
			const lg = logs[i]

			if (lg.ret.name === 'Swap') {
				const pairAddress = lg.log.address.toLowerCase()

				if (lg.package === 'Pair' || lg.package === 'PairV3') {
					if (pairArray.indexOf(pairAddress) < 0 || receipt.to !== null) {
						pairArray = [...pairArray, pairAddress]
						dexInfoArray = [...dexInfoArray, {
							router: receipt.to,
							pair: pairAddress
						}]
					}
				}
			}
		}

		let iStart = 0
		for (i = 0; i < logs.length; i++) {
			const lg = logs[i]

			if (lg.ret.name === 'Swap') {
				const pairAddress = lg.log.address.toLowerCase()

				if (lg.package === 'Pair' || lg.package === 'PairV3') {

					{ // sell token
						let sellTokenAddress = [] // with repetition
						let fromAddress = []

						for (let j = iStart; j < i; j++) {
							const sublg = logs[j]
							if (sublg.ret.name === 'Transfer' && sublg.package === 'ERC20') {
								if (sublg.ret.to?.toLowerCase() === pairAddress && sublg.log.address?.toLowerCase() !== sublg.ret.from?.toLowerCase() && pairAddress !== sublg.log.address?.toLowerCase()) {
									sellTokenAddress = [...sellTokenAddress, sublg.log.address.toLowerCase()]
									fromAddress = [...fromAddress, sublg.ret.from.toLowerCase()]
								}
							}
						}

						if (sellTokenAddress.length > 0) {
							sellTokenAddress.forEach(ta => {
								if (tokenArray.indexOf(ta) < 0) {
									tokenArray = [...tokenArray, ta]
								}
							})
						}

						// for (let sidx = 0; sidx < sellTokenAddress.length; sidx++) {
						//     const sta = sellTokenAddress[sidx]
						//     const fa = fromAddress[sidx]

						//     let totalSellAmount = BN(0)
						//     let totalPairAmount = BN(0)

						//     for (let j = iStart; j < i; j++) {
						//         const sublg = logs[j]
						//         if (sublg.ret.name === 'Transfer' && sublg.package === 'ERC20' && sta === sublg.log.address?.toLowerCase()) {
						//             if (sublg.ret.from?.toLowerCase() === sublg.ret.to?.toLowerCase()) continue;

						//             if (sublg.ret.from?.toLowerCase() === fa) {
						//                 totalSellAmount = totalSellAmount.plus(BN(sublg.ret.value))

						//                 if (sublg.ret.to.toLowerCase() === pairAddress) {
						//                     totalPairAmount = totalPairAmount.plus(BN(sublg.ret.value))
						//                 }
						//             }
						//         }
						//     }

						//     let stax = '0'
						//     if (totalSellAmount.gt(0)) {
						//         const sellTax = BN(100).minus(totalPairAmount.times(100).div(totalSellAmount)).toString()
						//         if (BN(sellTax).lt(100)) {
						//             stax = sellTax
						//         }
						//     }

						//     sellArray = [
						//         ...sellArray,
						//         {
						//             from: fa,
						//             token: sta,
						//             pair: pairAddress,
						//             sellAmount: totalSellAmount,
						//             log: lg,
						//             receipt: receipt,
						//             sellTax: stax
						//         }
						//     ]
						// }
					}

					{ // buy token
						let buyTokenAddress = [] // with repetition
						// let toAddress = []

						for (let j = iStart; j < i; j++) {
							const sublg = logs[j]
							if (sublg.ret.name === 'Transfer' && sublg.package === 'ERC20') {
								if (sublg.ret.from?.toLowerCase() === pairAddress.toLowerCase() && sublg.log.address?.toLowerCase() !== pairAddress.toLowerCase()) {
									if (buyTokenAddress.indexOf(sublg.log.address?.toLowerCase()) < 0) {
										buyTokenAddress = [...buyTokenAddress, sublg.log.address?.toLowerCase()]
									}
								}
							}
						}

						// buyTokenAddress.forEach(bta => {
						//     let ta = ''
						//     let maxToAmount = BN(0)
						//     if (bta) {
						//         for (let j = iStart; j < i; j++) {
						//             const sublg = logs[j]
						//             if (sublg.ret.name === 'Transfer' && sublg.package === 'ERC20') {
						//                 if (sublg.log.address?.toLowerCase() === bta && sublg.ret.from?.toLowerCase() === pairAddress.toLowerCase() && BN(sublg.ret.value).gt(maxToAmount)) {
						//                     maxToAmount = BN(sublg.ret.value)
						//                     ta = sublg.ret.to.toLowerCase()
						//                 }
						//             }
						//         }
						//     }

						//     toAddress = [...toAddress, ta]
						// })

						if (buyTokenAddress.length > 0) {
							buyTokenAddress.forEach(bta => {
								if (tokenArray.indexOf(bta) < 0) {
									tokenArray = [...tokenArray, bta]
								}
							})
						}

						// buyTokenAddress.forEach((bta, idx) => {
						//     let totalBuyAmount = BN(0)
						//     let totalPairAmount = BN(0)
						//     const ta = toAddress[idx]

						//     if (ta === undefined || ta === '') { }
						//     else {
						//         for (let j = iStart; j < i; j++) {
						//             const sublg = logs[j]
						//             if (sublg.ret.name === 'Transfer' && sublg.package === 'ERC20' && sublg.log.address?.toLowerCase() === bta) {
						//                 if (sublg.ret.from?.toLowerCase() === sublg.ret.to?.toLowerCase()) continue;

						//                 if (sublg.ret.from?.toLowerCase() === pairAddress.toLowerCase()) {
						//                     totalPairAmount = totalPairAmount.plus(BN(sublg.ret.value))
						//                     if (sublg.ret.to.toLowerCase() === ta.toLowerCase()) {
						//                         totalBuyAmount = totalBuyAmount.plus(BN(sublg.ret.value))
						//                     }
						//                 }
						//             }
						//         }

						//         let btax = '0'

						//         if (totalPairAmount.gt(0)) {
						//             const buyTax = BN(100).minus(totalBuyAmount.times(100).div(totalPairAmount)).toString()
						//             if (BN(buyTax).lt(100)) {
						//                 btax = buyTax
						//             }
						//         }

						//         buyArray = [
						//             ...buyArray,
						//             {
						//                 to: ta,
						//                 token: bta,
						//                 pair: pairAddress,
						//                 buyAmount: totalBuyAmount,
						//                 log: lg,
						//                 receipt: receipt,
						//                 buyTax: btax
						//             }
						//         ]
						//     }
						// })
					}
				}
				iStart = i + 1
			}
		}
	}

	// const sTokens = sellArray.filter((t, idx) => sellArray.indexOf(sellArray.find(s => s.token === t.token)) === idx).map(t => t.token)

	// const uniqueSellArray = sTokens.map(t => sellArray.filter(s => s.token === t))
	// const sMap = sTokens.map((t, idx) => {
	//     let taxMax
	//     let log
	//     uniqueSellArray[idx].forEach(u => {
	//         if (taxMax === undefined || taxMax.lt(BN(u.sellTax))) {
	//             taxMax = BN(u.sellTax)
	//             log = u.log
	//         }
	//     })
	//     return {
	//         token: t,
	//         log: log,
	//         sellTax: taxMax.toString()
	//     }
	// })

	// *************************************************************
	const uniquePairArray = pairArray.filter((p, idx) => pairArray.indexOf(p) === idx)
	// if (chain === 'bsc') console.log('>>> pair sync', chain, transactions[0].blockNumber, uniquePairArray.length)

	const MAX_DEX_SYNC = 20
	await Promise.all(Array.from(Array(Math.floor((dexInfoArray.length + MAX_DEX_SYNC - 1) / MAX_DEX_SYNC)).keys()).map(idx => {
		return prefetchDexOnChain(chain, JSON.stringify(dexInfoArray.slice(idx * MAX_DEX_SYNC, (idx + 1) * MAX_DEX_SYNC)))
	}))

	const uniqueTokenArray = tokenArray.filter((p, idx) => tokenArray.indexOf(p) === idx)
	// if (chain === 'bsc') console.log('>>> token sync', chain, transactions[0].blockNumber, uniqueTokenArray.length)

	const MAX_TOKEN_SYNC = 5
	await Promise.all(Array.from(Array(Math.floor((uniqueTokenArray.length + MAX_TOKEN_SYNC - 1) / MAX_TOKEN_SYNC)).keys()).map(idx => {
		return prefetchTokensOnChain(chain, JSON.stringify(uniqueTokenArray.slice(idx * MAX_TOKEN_SYNC, (idx + 1) * MAX_TOKEN_SYNC)))
	}))

	const MAX_PAIR_COUNT_TO_SYNC = 10
	await Promise.all(Array.from(Array(Math.floor((uniquePairArray.length + MAX_PAIR_COUNT_TO_SYNC - 1) / MAX_PAIR_COUNT_TO_SYNC)).keys()).map(idx => {
		return prefetchPairsOnChain(chain, JSON.stringify(uniquePairArray.slice(idx * MAX_PAIR_COUNT_TO_SYNC, (idx + 1) * MAX_PAIR_COUNT_TO_SYNC)))
	}))
}

export async function handleCopytradeTransferEvent(web3: any, chain: string, ctxArray: any[]) {
	for (const ctx of ctxArray) {
		const tx = ctx.log.receipt.transaction
		if (tx === null) continue

		const d = decodeByRouter(web3, tx)
		if (d !== undefined) continue // already copied in pending transactions

		const pendingDB1: any = await CopyTradeModel.findOne({ chain: chain, state: 'on', address: ctx.ev.from.toLowerCase() })
		const pendingDB2: any = await CopyTradeModel.findOne({ chain: chain, state: 'on', address: ctx.ev.to.toLowerCase() })

		if (pendingDB1 && pendingDB1.address === tx.from?.toLowerCase()) {
			const lpFound = await PairInfoModel.findOne({ chain: chain, address: ctx.ev.to.toLowerCase() })
			if (lpFound) {
				const rw = await getRouterAndWETH(chain, lpFound.factory)

				if (ctx.log.log.address.toLowerCase() !== rw.weth?.toLowerCase()) {
					await pendingDB1.populate('user')
					sendCopytradeMessage(chain, JSON.stringify({
						discriminator: 'bot-action-data',
						chain: chain,
						type: 'copytrade',
						log: ctx.log,
						db: pendingDB1,
						event: {
							token: ctx.log.log.address.toLowerCase(),
							from: ctx.ev.from.toLowerCase(),
							to: ctx.ev.to.toLowerCase(),
							value: ctx.ev.value,
							target: ctx.ev.from.toLowerCase(),
						}
					}))
				}
			}
		}

		if (pendingDB2 && pendingDB2.address === tx.from?.toLowerCase()) {
			const lpFound = await PairInfoModel.findOne({ chain: chain, address: ctx.ev.from.toLowerCase() })
			if (lpFound) {
				const rw = await getRouterAndWETH(chain, lpFound.factory)

				if (ctx.log.log.address.toLowerCase() !== rw.weth?.toLowerCase()) {
					await pendingDB2.populate('user')
					sendCopytradeMessage(chain, JSON.stringify({
						discriminator: 'bot-action-data',
						chain: chain,
						type: 'copytrade',
						log: ctx.log,
						db: pendingDB2,
						event: {
							token: ctx.log.log.address.toLowerCase(),
							from: ctx.ev.from.toLowerCase(),
							to: ctx.ev.to.toLowerCase(),
							value: ctx.ev.value,
							target: ctx.ev.to.toLowerCase(),
						}
					}))
				}
			}
		}
	}
}

export function decodeByRouter(web3: any, tx: any) {
	const routerInst = getRouterContract()
	const smartRouterInst = getSmartRouterContract()
	const fns = [...routerInst._jsonInterface.filter((f) => f.type === 'function'), ...smartRouterInst._jsonInterface.filter((f) => f.type === 'function')]

	let decoded
	let fnTx
	for (const fn of fns) {
		if (fn.signature.toLowerCase() === tx?.input.slice(0, 10).toLowerCase()) {
			try {
				decoded = web3.eth.abi.decodeParameters(fn.inputs, '0x' + tx.input.slice(10));
				fnTx = fn;

				return { decoded: decoded, fn: fnTx }
			} catch (err) {
			}
		}
	}
}

export async function handleCopyTradeByMethodID(web3: any, chain: string, transactions: any[]) {
	for (const tx of transactions) {
		if (tx === null) continue

		const d = decodeByRouter(web3, tx)
		let decoded = d?.decoded
		let fnTx = d?.fn
		// eugeigne test code
		// {
		//     const pendingDB: any = await CopyTradeModel.findOne({ chain: chain, state: 'on' })

		//     if (decoded && pendingDB !== null) {
		//         await pendingDB.populate('user')
		//         const telegramId = pendingDB.user.telegramId

		//         // if (chain === 'bsc' && fnTx.name === 'exactInputStableSwap') console.log('++++++++++++++++++++++++++++++++', chain, fnTx.name, tx.hash)

		//         sendCopytradeMessage(chain, JSON.stringify({
		//             discriminator: 'bot-action-data',
		//             chain: chain,
		//             type: 'copytrade',
		//             functionABI: fnTx,
		//             msg: decoded,
		//             transaction: tx,
		//             db: pendingDB
		//         }))
		//     }
		//     continue
		// }

		const pendingDB: any = await CopyTradeModel.findOne({ chain: chain, state: 'on', address: tx.from.toLowerCase() })

		if (decoded && pendingDB !== null) {
			await pendingDB.populate('user')
			const telegramId = pendingDB.user.telegramId

			sendCopytradeMessage(chain, JSON.stringify({
				discriminator: 'bot-action-data',
				chain: chain,
				type: 'copytrade',
				functionABI: fnTx,
				msg: decoded,
				transaction: tx,
				db: pendingDB
			}))
		}
	}
}

export async function createWeb3Service(chain: string) {
}

const snipeLock = {
	ethereum: {},
	arbitrum: {},
	bsc: {},
}

const copytradeLock = {
	ethereum: {},
	arbitrum: {},
	bsc: {},
}

export async function processBotWeb3Data(coreId: number, data: any) {
	try {
		const chain = data.chain
		if (data.type === 'snipe') {
			const locker = data.id
			if (snipeLock[chain][locker] === 1) return
			snipeLock[chain][locker] = 1

			const snipe: any = await SnipeTokenModel.findById(data.id).populate('user').populate('token')

			if (snipe !== null) {
				const telegramId = snipe.user.telegramId
				const web3 = await getWeb3(telegramId, await getRPC(telegramId, chain))

				if (snipe.method === 'liquidity') {
					await processSnipeLiquidity(telegramId, web3, chain, snipe, data.transaction)
				} else if (snipe.method === 'method-id') {
					await processSnipeMethodId(snipe.user.telegramId, web3, chain, snipe, data.transaction)
				} else if (snipe.method === 'auto') {
					if (data.mode === 'method-id') {
						await processSnipeMethodId(snipe.user.telegramId, web3, chain, snipe, data.transaction)
					} else if (data.mode === 'liquidity') {
						await processSnipeLiquidity(telegramId, web3, chain, snipe, data.transaction)
					}
				}

				await SnipeTokenModel.findByIdAndUpdate(snipe._id, { state: 'completed' })
			}
		} else if (data.type === 'copytrade') {
			if (data.transaction) {
				const locker = data.db._id + data.transaction.hash
				if (copytradeLock[chain][locker] === 1) return
				copytradeLock[chain][locker] = 1

				await executeRouterFunction(data.functionABI, data.msg, data.transaction, data.db)
			} else if (data.log) {
				const locker = data.db._id + data.log.log.transactionHash + data.log.log.logIndex.toString()
				if (copytradeLock[chain][locker] === 1) return
				copytradeLock[chain][locker] = 1

				await executeCopyTradeEvent(data.db, data.log, data.event)
			} else {
				Logging.error(`Unknown copytrade method`)
			}
		}
	} catch (err) {
		console.error(`==> ${new Date().toLocaleString()}`)
		console.error(err)
		Logging.error(`[processBotWeb3Data] ${err.message}`)
	}
}
