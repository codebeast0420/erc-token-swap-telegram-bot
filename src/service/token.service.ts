import { TokenSettingModel } from '../models/token.settings.model';
import { getSelectedChain, selectChain } from './connected.chain.service';
import { getWeb3, prefetchPairsOnChain, queryTokenInfoOnChain } from '../web3/multicall';
import { getWallet } from './wallet.service';
import { getAppUser, userVerboseLog } from './app.user.service';
import { getBN } from '../web3/web3.operation';
import { ChainModel } from '../models/chain.model';
import { TokenInfoModel } from '../models/token.info.model';
import { getAllChains } from './chain.service';
import Logging from '../utils/logging';
import { getBlockExplorerApiEndpoint, getBlockExplorerApiKey, getDedicatedSyncRPC, getDefaultRouterAndWETH, getDefaultWETH, getNativeCurrencySymbol } from '../web3/chain.parameters';
import axios from 'axios';
import { TOKEN_NOT_FOUND } from '../utils/common';
import { TokenTaxModel } from '../models/token.tax.model';
import { PairInfoModel } from '../models/pair.info.model';
import { DexInfoModel } from '../models/dex.info.model';
import { getTaxCollection } from '../web3/requests/tax_collect';
import { getV2PairPrice } from '../web3/dex/v2/v2.calculate';
import { getV3PairPrice } from '../web3/dex/v3/v3.calculate';
import { findBestPair } from '../web3/dex/common/bestpair';
import { botEnum } from '../constants/botEnum';
import { getTokenPasteMarkup } from '../utils/inline.markups';
import { getTokenStatusMessage } from '../utils/messages';
import { processQuickAutoBuy } from './autobuy.service';
import { processError } from './error';
import { currencyFormat } from '../utils/global.functions';
const Web3 = require('web3');

export async function startToken(telegramId: string, chain: string, address: string, newChain?: string) {
	// finding valid token address
	let chainArray = [chain];
	let allChainArray = getAllChains();

	for (const t of allChainArray) {
		if (t !== chain) {
			chainArray = [...chainArray, t];
		}
	}

	if (newChain) chainArray = [newChain]

	let tFound
	for (const ch of chainArray) {
		tFound = await getTokenInfo(ch, address)
		if (tFound) {
			if (ch !== chain) {
				await userVerboseLog(telegramId, `switched to [${ch}] from [${chain}] for token ${address}`)
				await selectChain(telegramId, ch)
			}
			break
		}
	}

	if (tFound === null) {
		await userVerboseLog(telegramId, `polling chains ${chainArray}`);

		const w = await getWallet(telegramId)
		const retOnChains: any[] = await Promise.all(chainArray.map(ch => {
			try {
				return queryTokenInfoOnChain(telegramId, ch, address, w.address)
			} catch (err) {
				return async () => { }
			}
		})
		)

		let chainFound
		for (const rr of retOnChains) {
			if (rr?.symbol?.length > 0) {
				if (rr.chain !== chain) {
					await userVerboseLog(telegramId, `switched to [${rr.chain}] from [${chain}] for token ${address}`)
					await selectChain(telegramId, rr.chain)
				}

				chainFound = rr.chain
				tFound = await updateToken(rr)
				break
			}
		}

		if (chainFound === undefined) return false
	}

	const user = await getAppUser(telegramId);

	const tokenItem = await TokenSettingModel.findOne({ user: user._id });

	if (tokenItem === null) {
		const newToken = new TokenSettingModel({
			user: user._id,
			token: tFound._id
		});

		await newToken.save();
	} else {
		tokenItem.token = tFound._id;

		await tokenItem.save();
	}

	const loadTaxInfo = async () => {
		try {
			const taxInfo: any = await getTaxCollection(getWeb3(chain, await getDedicatedSyncRPC(chain)), chain, address)
			if (taxInfo?.address) {
				await updateTokenTaxInfo(chain, taxInfo.address, taxInfo)
			}
		} catch (err) {
			console.error(err)
		}
	}

	loadTaxInfo()

	return true;
}

export async function getCurrentToken(telegramId: string, chain: string) {
	const user = await getAppUser(telegramId);

	const tFound: any = await TokenSettingModel.findOne({ user: user._id });
	if (tFound === null) {
		throw new Error(TOKEN_NOT_FOUND);
	}
	const token = await tFound.populate('token');

	if (token.token.chain !== chain) {
		await selectChain(telegramId, token.token.chain);
	}

	return token === null ? '' : token.token.address;
}

export async function getTokenPrice(telegramId: string, chain: string, token: string) {
	const chainData = await ChainModel.findOne({ name: chain });
	if (chainData === null) {
		await userVerboseLog(telegramId, `getTokenPrice: Invalid chain detected [${chain}]`)
		throw new Error(`Invalid chain detected [${chain}]`)
	}

	const BN = getBN()
	const tokenDB = await TokenInfoModel.findOne({ chain: chain, address: token })
	if (tokenDB === null) throw new Error(`Invalid token ${token} on [${chain}]`)

	const foundIndex = chainData.tokens.indexOf(tokenDB.address)
	if (foundIndex > -1) {
		return chainData.prices[foundIndex]
	}

	const lpArray = await Promise.all(tokenDB.lp.map(p => PairInfoModel.findOne({ chain: chain, address: p })))
	const bestPair: any = findBestPair(tokenDB.address, lpArray)

	let price

	try {
		if (bestPair) {
			const pairDB = bestPair

			let pairPrice
			if (pairDB.version === 3) {
				pairPrice = getV3PairPrice(pairDB)
			} else if (pairDB.version === 2) {
				pairPrice = getV2PairPrice(pairDB)
			}

			let pairedToken
			if (pairDB.token0 === tokenDB.address) {
				pairedToken = pairDB.token1;
			} else {
				pairedToken = pairDB.token0;
				pairPrice = BN(1).div(BN(pairPrice)).toString()
			}

			const f = chainData.tokens.indexOf(pairedToken)
			if (f > -1) {
				price = BN(chainData.prices[f]).times(pairPrice).toString()
			}
		}
	} catch (err) { }

	if (price) {
		updateTokenInfo(chain, tokenDB.address, { price: price });
		return price
	}
}

export async function updateToken(tokenInfo: any) {
	if (0 === (await TokenInfoModel.countDocuments({ chain: tokenInfo.chain, address: tokenInfo.address }))) {
		const token = new TokenInfoModel(tokenInfo)
		await token.save();
	}

	let token = await TokenInfoModel.findOne({ chain: tokenInfo.chain, address: tokenInfo.address });

	if (token.age === null || token.age === undefined || typeof token.age === undefined) {
		const createdDate = await getContractCreatedDate(tokenInfo.chain, tokenInfo.address);
		// Logging.info(`age [${createdDate}]`);

		if (createdDate !== undefined && !isNaN(createdDate)) {
			await TokenInfoModel.updateMany({ chain: tokenInfo.chain, address: tokenInfo.address }, { age: createdDate });
		}
	}

	return token;
}

export async function updateTokenInfo(chain: string, token: string, addInfo: any) {
	try {
		let tFound = await TokenInfoModel.findOne({ chain: chain, address: token });

		if (tFound !== null) {
			for (const ch in addInfo) {
				tFound[ch] = addInfo[ch];
			}

			await tFound.save();
		}
	} catch (err) { }
}

export async function getTokenInfo(chain: string, address: string) {
	const t = await TokenInfoModel.findOne({ chain: chain, address: address });
	return t;
}

async function getContractCreatedDate(chain: string, contractAddress: string) {
	const rpc = await getDedicatedSyncRPC(chain)
	const web3 = new Web3(rpc);
	let block = await web3.eth.getBlock('latest');

	const apiKey = await getBlockExplorerApiKey(chain);

	const apiEndpoint = await getBlockExplorerApiEndpoint(chain);

	let createdDate;

	await axios
		.get(`${apiEndpoint}/api?module=account&action=txlist&address=${contractAddress}&startblock=0&endblock=${block.number}&page=1&offset=10&sort=asc&apikey=${apiKey}`)
		.then((res) => {
			if (res.data.result != null && res.data.result.length > 0) {
				createdDate = new Date(res.data.result[0].timeStamp * 1000);
			}
		})
		.catch((err) => {
			Logging.error(`[getContractCreatedDate] axios error`);
		});

	return createdDate;
}

export async function getLockedLiquidity(chain: string, contractAddress: string) {
	const rpc = await getDedicatedSyncRPC(chain)
	const web3 = new Web3(rpc);
	let block = await web3.eth.getBlock('latest');

	const apiKey = await getBlockExplorerApiKey(chain);

	const apiEndpoint = await getBlockExplorerApiEndpoint(chain);

	await axios
		.get(`${apiEndpoint}/api?module=account&action=txlist&address=${contractAddress}&startblock=0&endblock=${block.number}&page=2&offset=10&sort=dsc&apikey=${apiKey}`)
		.then((res) => {
		})
		.catch((err) => {
			Logging.error(`[getLockedLiquidity] axios error`);
		});
}

async function getContractDetails(chain: string, contractAddress: string) {
	const rpc = await getDedicatedSyncRPC(chain);
	const web3 = new Web3(rpc);
	let block = await web3.eth.getBlock('latest');

	const apiKey = await getBlockExplorerApiKey(chain);

	const apiEndpoint = await getBlockExplorerApiEndpoint(chain);

	let info;

	await axios
		.get(`${apiEndpoint}/api?module=token&action=tokeninfo&address=${contractAddress}&apikey=${apiKey}`)
		.then((res) => {
		})
		.catch((err) => {
			Logging.error(`[getContractDetails] axios error`);
		});

	return info;
}

export async function getTokenTaxInfo(chain: string, address: string) {
	const f = await TokenTaxModel.findOne({ chain: chain, address: address.toLowerCase() })
	return f
}

export async function updateTokenTaxInfo(chain: string, address: string, info: any) {
	if (0 === await TokenTaxModel.countDocuments({ chain: chain, address: address.toLowerCase() })) {
		const newT = new TokenTaxModel({
			chain: chain,
			address: address.toLowerCase()
		})
		await newT.save()
	}

	const f = await TokenTaxModel.findOne({ chain: chain, address: address.toLowerCase() })
	for (const ch in info) {
		if (info[ch] !== undefined) {
			f[ch] = info[ch]
		}
	}

	await f.save()
}

export async function updateDexAndPairs(chain: string, dexInfos: any[]) {
	for (const dex of dexInfos) {
		const dexFound: any = await DexInfoModel.findOne({ chain: chain, factory: dex.factory })

		let router = dexFound?.router
		if (chain === 'ethereum') {
			if (dex.factory === '0x1f98431c8ad98523631ae4a59f267346ea31f984') {
				router = '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45' // force uniswap router v3
			} else if (dex.factory === '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f') {
				router = '0x7a250d5630b4cf539739df2c5dacb4c659f2488d' // force uniswap router v2
			} else if (dex.factory === '0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac') {
				router = '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f'
			} else if (dex.factory === '0x115934131916c8b277dd010ee02de363c09d037c') {
				router = '0x03f7724180aa6b939894b5ca4314783b0b36b329'
			}
		} else if (chain === 'bsc') {
			if (dex.factory === '0xca143ce32fe78f1f7019d7d551a6402fc5350c73') {
				router = '0x10ed43c718714eb63d5aa57b78b54704e256024e'
			} else if (dex.factory === '0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865') {
				router = '0x13f4ea83d0bd40e75c8222255bc855a974568dd4'
			} else if (dex.factory === '0x0841bd0b734e4f5853f0dd8d7ea041c241fb0da6') {
				router = '0xcf0febd3f17cef5b47b0cd257acf6025c5bff3b7'
			} else if (dex.factory === '0xc35dadb65012ec5796536bd9864ed8773abc74c4') {
				router = '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506'
			} else if (dex.factory === '0xdda79ec4af818d1e95f0a45b3e7e60461d5228cb') {
				router = '0x8547e2e16783fdc559c435fdc158d572d1bd0970'
			}
		} else if (chain === 'arbitrum') {
			if (dex.factory === '0xc35dadb65012ec5796536bd9864ed8773abc74c4') {
				router = '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506'
			} else if (dex.factory === '0x1f98431c8ad98523631ae4a59f267346ea31f984') {
				router = '0xe592427a0aece92de3edee1f18e0157c05861564'
			} else if (dex.factory === '0x6eccab422d763ac031210895c81787e87b43a652') {
				router = '0xc873fecbd354f5a56e00e710b90ef4201db2448d'
			}
		}

		if (router === undefined) {
			router = dex.router
		}

		if (null === dexFound) {
			const newDex = new DexInfoModel({
				chain: chain,
				router: router,
				weth: dex.weth,
				factory: dex.factory,
				version: dex.v2 === true ? 2 : dex.v3 === true ? 3 : 1,
			})

			await newDex.save()
		} else if (router !== dexFound?.router) {
			await DexInfoModel.updateMany({ chain: chain, factory: dex.factory }, { router: router })
		}
	}
}


export async function getRouterAndWETH(chain: string, factory: string) {
	const d = getDefaultRouterAndWETH(chain, factory)
	if (d.router && d.weth) return d

	const dexInfo = await DexInfoModel.findOne({ chain: chain, factory: factory })
	return {
		router: dexInfo?.router,
		weth: dexInfo?.weth
	}
}

export async function getWETH(chain: string, router: string) {
	const ret = getDefaultWETH(chain, router)
	if (ret) return ret

	const dexInfo = await DexInfoModel.findOne({ chain: chain, router: router })
	return dexInfo?.weth
}

export const printTickElapsed = (tickStart: any) => {
	const tickEnd = (new Date()).getTime()
	Logging.info(`token ca paste - tick elapsed ${((tickEnd - tickStart) / 1000).toString()}`)
}


export async function processContractAddress(ctx: any, telegramId: string, chain: string, tokenAddress: string, newChain: any, tickStart: any) {
	if (true === await startToken(telegramId, chain, tokenAddress, newChain)) {
		chain = await getSelectedChain(telegramId)
		const symbol = await getNativeCurrencySymbol(chain)

		await userVerboseLog(telegramId, `fetching token ${tokenAddress}`)

		const t = await getTokenStatusMessage(telegramId, chain, tokenAddress)

		processQuickAutoBuy(ctx, telegramId, chain, tokenAddress)
		printTickElapsed(tickStart)

		const msg = await ctx.telegram.sendMessage(ctx.chat.id, t.text, {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getTokenPasteMarkup(telegramId, 'buy', chain, symbol, t.symbol, tokenAddress)
		})

		setTimeout(() => {
			const reloadTokenInfo = async () => {
				try {
					const t = await getTokenStatusMessage(telegramId, chain, tokenAddress)

					await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, 0, t.text, {
						parse_mode: botEnum.PARSE_MODE_V2,
						reply_markup: await getTokenPasteMarkup(telegramId, 'buy', chain, symbol, t.symbol, tokenAddress)
					})
				} catch (err) {
					await processError(ctx, telegramId, err)
				}
			}

			reloadTokenInfo()
		}, 2000)
	} else {
		await ctx.telegram.sendMessage(ctx.chat.id, "❌ The token isn't valid.If the bot awaited your reply, a request timeout occurred after 60 seconds.", {
			parse_mode: botEnum.PARSE_MODE_V2
		})
	}
}

export function formatTokenprice(tokenPrice: any, decimals: number = 4, exponentialAfterXZeroes: number = 5) {
    const BN = getBN();
    let inputString = BN(tokenPrice).toString();
    const match = inputString.match(/^(0+)\.?(0*)(\d*)/);


    if (match) {
        const integerPart = match[1] || '';
        const leadingZeroes = match[2] || ''
        const fractionalPart = match[3] || '';

        const digitsAfterZeroes = fractionalPart.substr(0, decimals);
        if (leadingZeroes.length >= exponentialAfterXZeroes) {
            return `$${Number(`${integerPart}.${leadingZeroes}${digitsAfterZeroes}`).toExponential()}`;
        } else {
            return currencyFormat().format(Number(`${integerPart}.${leadingZeroes}${digitsAfterZeroes}`));
        }
    } else {
        return currencyFormat().format(BN(tokenPrice).toFixed(decimals))
    }
}