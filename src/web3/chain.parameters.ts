import { ChainModel } from '../models/chain.model';
import { chainConfig } from './chain.config';
import Logging from '../utils/logging';
import { sleep } from '../utils/common';
import { ContractCallResults, ContractCallContext } from 'ethereum-multicall';
import { AddressZero, getBN } from './web3.operation';
import { getMulticall, getWeb3, queryAndSyncToken } from './multicall';
import { getConfiguredChain } from '../service/connected.chain.service';
import { pricefeedCallCtx, pricefeedCallRes } from './requests/multicall_param';
import { DexInfoModel } from '../models/dex.info.model';

let botInstance: any;

export function getBotInstance() {
	return botInstance;
}

export function setBotInstance(bot: any) {
	botInstance = bot
}

export async function loadChainParameters() {
	Logging.info('Fetching chains...');

	for (const ch in chainConfig) {
		const info = chainConfig[ch];
		if (0 === (await ChainModel.countDocuments({ name: ch }))) {
			const newChain = new ChainModel({
				name: ch,
				chainId: info.chainId,
				currency: info.nativeCurrency.label,
				decimals: info.nativeCurrency.decimals,
				rpcUrls: info.rpcUrls,
				wsUrls: info.wsUrls,
				blockExplorer: info.blockExplorer,
				blockExplorerApiKey: info.blockExplorerApiKey,
				blockExplorerApiEndpoint: info.blockExplorerApiEndpoint,
				router: info.router,
				factory: info.factory,
				tokens: info.tokens.map((t) => t.toLowerCase()),
				priceFeeds: info.priceFeeds.map((p) => p.toLowerCase()),
				lpLocksAddresses: info.lpLocksAddress,
				feeDistributor: info.feeDistributor,
			});
			await newChain.save();
			Logging.info(`New chain ${ch} added`);
		} else {
			await ChainModel.findOneAndUpdate(
				{ name: ch },
				{
					chainId: info.chainId,
					currency: info.nativeCurrency.label,
					decimals: info.nativeCurrency.decimals,
					rpcUrls: info.rpcUrls,
					wsUrls: info.wsUrls,
					blockExplorer: info.blockExplorer,
					blockExplorerApiKey: info.blockExplorerApiKey,
					blockExplorerApiEndpoint: info.blockExplorerApiEndpoint,
					router: info.router,
					factory: info.factory,
					tokens: info.tokens.map((t) => t.toLowerCase()),
					priceFeeds: info.priceFeeds,
					lpLocksAddresses: info.lpLocksAddress,
					feeDistributor: info.feeDistributor,
				}
			);
			Logging.info(`Chain ${ch} updated`);
		}
	}

	// load token initial information...
	const chains1 = await ChainModel.find();
	for (const chain of chains1) {
		Logging.info(`loading ${chain.name} tokens...`);

		try {

			let symbols = [];
			for (const t of chain.tokens) {
				const tokenInfo = await queryAndSyncToken(undefined, chain.name, t.toLowerCase(), AddressZero);
				if (tokenInfo?.symbol === undefined) {
					console.log('>>>', chain.name, t, tokenInfo)
				} else
					symbols = [...symbols, tokenInfo.symbol];
			}

			await ChainModel.findOneAndUpdate({ name: chain.name }, { symbols: symbols });
		} catch (err) {
			console.error(`==> ${new Date().toLocaleString()}`)
			console.error(err)
			Logging.error(`[loadChainParameters] ${err.message}`);
		}
	}

	Logging.info('polling chains...')
	while (true) {
		const chains2 = await ChainModel.find();
		for (const chain of chains2) {
			try {
				const web3 = getWeb3(chain.name, chain.rpcUrls[0])
				const gasPrice = await web3.eth.getGasPrice()

				const mc = getMulticall(chain.name, chain.rpcUrls[0])
				const cc1 = pricefeedCallCtx(chain.priceFeeds)

				const ret1: ContractCallResults = await mc.call(cc1)
				let prices = []
				for (const pr of chain.priceFeeds) {
					prices = [...prices, pricefeedCallRes(ret1, pr)]
				}

				await ChainModel.findOneAndUpdate({ name: chain.name }, { gasPrice: gasPrice.toString(), prices: prices })
			} catch (err) {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
				Logging.error(chain.name + ' --> ' + err)
			}
		}

		await sleep(10000);
	}
}

export async function getRouter(chain: string) {
	const info = await ChainModel.findOne({ name: chain });
	return info?.router || '';
}

export async function getChainTokens(chain: string) {
	const info = await ChainModel.findOne({ name: chain });
	return info?.tokens.map((t) => t.toLowerCase()) || [];
}

export async function getFactory(chain: string) {
	const info = await ChainModel.findOne({ name: chain });
	return info?.factory || '';
}

export async function getRPC(telegramId: string, chain: string) {
	// const info = await ChainModel.findOne({ name: chain });
	// if (chain === 'ethereum') {
	//     let antiMEV = false
	//     try {
	//         const user = await getAppUser(telegramId)
	//         const setting = await SettingsModel.findOne({ user: user._id, chain: info._id })
	//         antiMEV = setting?.antiMEV
	//     } catch (err) {
	//     }
	//     return (antiMEV === true) ? info?.rpcUrls[1] : info?.rpcUrls[2]
	// } else {
	//     return info?.rpcUrls[1] || '';
	// }
	return chainConfig[chain].rpcUrls[0]
}

export async function getDedicatedSyncRPC(chain: string) {
	const info = await ChainModel.findOne({ name: chain });
	return info?.rpcUrls[0] || '';
}

export async function getBlockExplorerApiKey(chain: string) {
	const info = await ChainModel.findOne({ name: chain });
	return info?.blockExplorerApiKey || '';
}

export async function getBlockExplorerApiEndpoint(chain: string) {
	const info = await ChainModel.findOne({ name: chain });
	return info?.blockExplorerApiEndpoint || '';
}

export async function getBlockExplorer(chain: string) {
	const info = await ChainModel.findOne({ name: chain });
	return info?.blockExplorer || '';
}

export async function getNativeCurrencyDecimal(chain: string) {
	const info = await ChainModel.findOne({ name: chain });
	return info?.decimals || 0;
}

export async function getNativeCurrencySymbol(chain: string) {
	const info = await ChainModel.findOne({ name: chain });
	return info?.currency || '###';
}

export async function getLpLockProvider(chain: string) {
	const info = await ChainModel.findOne({ name: chain });
	return info?.lpLocksAddresses || [];
}


export async function getNativeCurrencyPrice(chain: string) {
	const ch = await getConfiguredChain(chain);

	const BN = getBN();
	return ch.prices[0]
}


const defaultDexList = {
	['ethereum']: [
		{
			factory: '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f',
			router: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
			weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
		},
		{
			factory: '0x1f98431c8ad98523631ae4a59f267346ea31f984',
			router: '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45',
			weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
		},
		{
			factory: '0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac',
			router: '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f',
			weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
		},
		{
			factory: '0x115934131916c8b277dd010ee02de363c09d037c',
			router: '0x03f7724180aa6b939894b5ca4314783b0b36b329',
			weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
		},
	],
	['bsc']: [
		{
			factory: '0xca143ce32fe78f1f7019d7d551a6402fc5350c73',
			router: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
			weth: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
		},
		{
			factory: '0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865',
			router: '0x13f4ea83d0bd40e75c8222255bc855a974568dd4',
			weth: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
		},
		{
			factory: '0x0841bd0b734e4f5853f0dd8d7ea041c241fb0da6',
			router: '0xcf0febd3f17cef5b47b0cd257acf6025c5bff3b7',
			weth: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
		},
		{
			factory: '0xc35dadb65012ec5796536bd9864ed8773abc74c4',
			router: '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506',
			weth: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
		},
		{
			factory: '0xdda79ec4af818d1e95f0a45b3e7e60461d5228cb',
			router: '0x8547e2e16783fdc559c435fdc158d572d1bd0970',
			weth: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
		},
	],
	['arbitrum']: [
		{
			factory: '0xc35dadb65012ec5796536bd9864ed8773abc74c4',
			router: '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506',
			weth: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
		},
		{
			factory: '0x1f98431c8ad98523631ae4a59f267346ea31f984',
			router: '0xe592427a0aece92de3edee1f18e0157c05861564',
			weth: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
		},
		{
			factory: '0x6eccab422d763ac031210895c81787e87b43a652',
			router: '0xc873fecbd354f5a56e00e710b90ef4201db2448d',
			weth: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
		},
	]
}

const enabledFactory = {
	['ethereum']: [
		'0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f', // uniswap v2 factory
		'0x1f98431c8ad98523631ae4a59f267346ea31f984', // uniswap v3 factory
		'0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865', // pancake v3 factory
		'0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac', // sushiswap v2 factory
		'0x115934131916c8b277dd010ee02de363c09d037c', // shibaswap v2 factory
		'0x7de800467afce442019884f51a4a1b9143a34fac', // x7swap v2 factory
	],
	['arbitrum']: [
		'0xc35dadb65012ec5796536bd9864ed8773abc74c4', // sushiswap v2 factory
		'0x1f98431c8ad98523631ae4a59f267346ea31f984', // uniswap v3 factory
		'0x6eccab422d763ac031210895c81787e87b43a652', // camelot factory
		'0x1c6e968f2e6c9dec61db874e28589fd5ce3e1f2c', // arbdex factory
		'0xc7a590291e07b9fe9e64b86c58fd8fc764308c4a', // kyberswap factory
		'0xac2ee06a14c52570ef3b9812ed240bce359772e7', // zyberswap factory
		'0x20fafd2b0ba599416d75eb54f48cda9812964f46', // Oreoswap factory
		'0xe5552e0318531f9ec585c83bdc8956c08bf74b71', // Lfgswap factory
		'0xac9d019b7c8b7a4bbac64b2dbf6791ed672ba98b', // Alien factory
		'0x947d83b35cd2e71df4ac7b359c6761b07d0bce19', // Oasisswap factory
		'0xcf083be4164828f00cae704ec15a36d711491284', // Apeswap factory
		'0x855f2c70cf5cb1d56c15ed309a4dfefb88ed909e', // uniswap v3 factory
		'0xae4ec9901c3076d0ddbe76a520f9e90a6227acb7', // Joe factory
	],
	['bsc']: [
		'0xca143ce32fe78f1f7019d7d551a6402fc5350c73', // pancakeswap v2 factory
		'0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865', // pancakeswap v3 factory
		'0x0841bd0b734e4f5853f0dd8d7ea041c241fb0da6', // apeswap factory
		'0x86407bea2078ea5f5eb5a52b2caa963bc1f889da', // babyswap factory
		'0xc35dadb65012ec5796536bd9864ed8773abc74c4', // sushiswap v2 factory
		'0x9a272d734c5a0d7d84e0a892e891a553e8066dce', // fstswap factory
		'0x858e3312ed3a876947ea49d572a7c42de08af7ee', // biswap factory
		'0x01bf7c66c6bd861915cdaae475042d3c4bae16a7', // bakeryswap factory
		'0xd04a80baeef12fd7b1d1ee6b1f8ad354f81bc4d7', // W3swap factory
		'0x3cd1c46068daea5ebb0d3f55f6915b10648062b8', // mdex factory
		'0xdb1d10011ad0ff90774d0c6bb92e5c5c8b4461f7', // uniswap v3 factory
		'0x738b815eadd06e0041b52b0c9d4f0d0d277b24ba', // uniswap v2 factory
		'0xbcfccbde45ce874adcb698cc183debcf17952812', // pancakeswap factory
		'0xd6715a8be3944ec72738f0bfdc739d48c3c29349', // Nomiswap factory
		'0x4693b62e5fc9c0a45f89d62e6300a03c85f43137', // babydoge factory
		'0x381fefadab5466bff0e8e96842e8e76a143e8f73', // Ample factory
	],
}

export async function getAllFactories(chain: string) {
	const dexes = await DexInfoModel.find({ chain: chain })
	const factories = dexes.map(d => d.factory)
	const uniqueOnes = factories.filter((val, idx) => factories.indexOf(val) === idx)
	return uniqueOnes.filter(t => enabledFactory[chain].find(addr => addr === t) !== undefined)
}

export function getDefaultFactory(chain: string, version: number) {
	const factories = enabledFactory[chain]
	if (factories) {
		if (version === 2) return factories[0]
		else if (version === 3) return factories[1]
	}
}


export function getDefaultRouterAndWETH(chain: string, factory?: string) {
	if (factory === undefined) {
		return defaultDexList[chain][0]
	}

	const dexFound = defaultDexList[chain]?.find(d => d.factory.toLowerCase() === factory?.toLowerCase())
	return {
		router: dexFound?.router,
		weth: dexFound?.weth
	}
}

export function getDefaultWETH(chain: string, router: string) {
	const dexFound = defaultDexList[chain]?.find(d => d.router.toLowerCase() === router?.toLowerCase())
	return dexFound?.weth
}
