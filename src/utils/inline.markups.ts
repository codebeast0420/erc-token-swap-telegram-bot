import * as dotenv from 'dotenv';
import path from 'path';
import { botEnum } from '../constants/botEnum';
import { IAddress, IAddressPagination } from '../models/address.model';
import { getQuickAutoBuyContext, getTokenAutoBuyContext, isTokenAutoBuySet } from '../service/autobuy.service';
import { getTokenAutoSellContext, isTokenAutoSellSet } from '../service/autosell.service';
import { getCopyTradeAddresses } from '../service/copytrade.service';
import { getNativeCurrencySymbol } from '../web3/chain.parameters';
import { IPageAndLimit } from './global.functions';
import { IAffiliateInfluencer } from '../models/affiliate.influencer.model';
// import { getLotusSettings, getSettings } from '../service/settings.service';
import { getSettings } from '../service/settings.service';
import { getTokenInfo } from '../service/token.service';
import { TokenInfoModel } from '../models/token.info.model';
import { getTrackByToken } from '../service/track.service';
import { PairInfoModel } from '../models/pair.info.model';
import { findBestPair } from '../web3/dex/common/bestpair';
import { getWallet } from '../service/wallet.service';
import { IMethodIdPagination, ISnipePagination } from '../models/snipe.godmode.token';

if (process.env.NODE_ENV == ('development' || 'development ')) {
	dotenv.config({ path: path.join(__dirname, '..', '.env.development') });
} else if (process.env.NODE_ENV == ('production' || 'production ')) {
	dotenv.config({ path: path.join(__dirname, '..', '.env') });
} else if (process.env.NODE_ENV == ('staging' || 'staging ')) {
	dotenv.config({ path: path.join(__dirname, '..', '.env.staging') });
}

async function getTokenExternalURL(chain: string, tokenAddress: string) {
	let url = 'https://www.dextools.io/app/en/pairs';
	const tokenInfo = await getTokenInfo(chain, tokenAddress)
	const lpArray = await Promise.all(tokenInfo.lp.map(p => PairInfoModel.findOne({ chain: chain, address: p })))
	const bestLP = findBestPair(tokenInfo.address, lpArray)

	if (chain === 'bsc') {
		if (bestLP !== undefined)
			url = `https://www.dextools.io/app/en/bnb/pair-explorer/${bestLP.address}?ref=chartAiSnipper`;
	} else if (chain === 'ethereum') {
		if (bestLP !== undefined)
			url = `https://www.dextools.io/app/en/ether/pair-explorer/${bestLP.address}?ref=chartAiSnipper`;
	} else if (chain === 'arbitrum') {
		if (bestLP !== undefined)
			url = `https://www.dextools.io/app/en/arbitrum/pair-explorer/${bestLP.address}?ref=chartAiSnipper`;
	}
	return url
}

export function markupStart(username: number, firstName: string) {
	return {
		inline_keyboard: [
			[
				{ text: botEnum.buy.key, callback_data: botEnum.buy.value },
				{ text: botEnum.sell.key, callback_data: botEnum.sell.value },
			],
			[
				// {
				// 	text: "ChartAi Sniper Bot",
				// 	callback_data: botEnum.menu.value
				// }
				{ text: botEnum.wallets.key, callback_data: botEnum.wallets.value },

			],
			[
				{ text: botEnum.transfer.key, callback_data: botEnum.transfer.value },
				{ text: botEnum.monitor.key, callback_data: botEnum.monitor.value },
			],
			[
				{
					text: botEnum.snipe.key,
					callback_data: botEnum.snipe.value
				},
			],
			// [
			// 	{
			// 		text: botEnum.markupStart,
			// 		callback_data: botEnum.markupStart
			// 	},
			// ],
			// [
			// 	{ text: "Houdini Swap 🪄", url: "https://t.me/houdiniswap_bot" }
			// ],
			[
				{ text: botEnum.settings.key, callback_data: botEnum.settings.value },
				{
					text: botEnum.affiliate.key,
					callback_data: botEnum.affiliate.value
				},
			],
			[
				{
					text: botEnum.copytrade.key,
					callback_data: botEnum.copytrade.value
				},

			]
		]
	};
}

export function verifyLink(telegramId: string) {
	return {
		inline_keyboard: [
			[
				{
					text: botEnum.verifyLink,
					callback_data: botEnum.verifyLink
				}
			]
		]
	};
}

export function disconnectWallet(chain: any) {
	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: botEnum.confirmDisconnect.key,
					callback_data: botEnum.confirmDisconnect.value + '_' + chain,
				},
				{
					text: botEnum.generate_wallet.key,
					callback_data: botEnum.generate_wallet.value + '_' + chain
				}
			],
			[
				{
					text: botEnum.wallets.key,
					callback_data: botEnum.wallets.value
				}
			]
		]
	};
}

export function walletConfigMarkup() {
	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: botEnum.eth.key,
					callback_data: botEnum.select_chain.value + '_' + 'ethereum'
				},
				{
					text: botEnum.bsc.key,
					callback_data: botEnum.select_chain.value + '_' + 'bsc'
				},
				{
					text: botEnum.arb.key,
					callback_data: botEnum.select_chain.value + '_' + 'arbitrum'
				}
			]
		]
	};
}

export function markupWalletConnected(telegramId: string, chain: string) {
	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: botEnum.disconnectWallet.key,
					callback_data: botEnum.disconnectWallet.value + '_' + chain
				},
			],
			[
				{
					text: botEnum.generate_wallet.key,
					callback_data: botEnum.generate_wallet.value + '_' + chain
				},
				{
					text: botEnum.multiWallet.key,
					callback_data: `multi_wallet_chain_${chain}`
				}
			],
			[
				{
					text: '⬅️ Return',
					callback_data: botEnum.wallets.value
				}
			]
		]
	};
}

export function markupWalletConfirmDisconnect(telegramId: string, chain: string) {
	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: botEnum.confirmDisconnect.key,
					callback_data: botEnum.confirmDisconnect.value + '_' + chain
				},
			],
			[
				{
					text: botEnum.generate_wallet.key,
					callback_data: botEnum.generate_wallet.value + '_' + chain
				},
				{
					text: botEnum.multiWallet.key,
					callback_data: `multi_wallet_chain_${chain}`
				}
			],
			[
				{
					text: '⬅️ Return',
					callback_data: botEnum.wallets.value
				}
			]
		]
	};
}

export function markupWalletDisconnected(telegramId: string, chain: string) {
	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				},
			],
			[
				{
					text: botEnum.connect_wallet.key,
					callback_data: botEnum.connect_wallet.value + '_' + chain
				},
				{
					text: botEnum.generate_wallet.key,
					callback_data: botEnum.generate_wallet.value + '_' + chain
				}
			],
			[
				{
					text: '⬅️ Return',
					callback_data: botEnum.wallets.value
				}
			]
		]
	};
}

export function markupMultiWalletMainDefault(telegramId: string, chain: string, isMultiWallet: Boolean) {
	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: botEnum.multiWalletViewList.key,
					callback_data: `${botEnum.multiWalletViewList.value}_chain?${chain}_page?${1}_limit?${4}`
				},
			],
			[
				{
					text: `${!isMultiWallet ? '❌' : '✅'} Multi-Wallet`,
					callback_data: !isMultiWallet ? `${botEnum.enableMultiWallet}_chain?${chain}` : `${botEnum.disableMultiWallet}_chain?${chain}`
				},
				{
					text: botEnum.multiWalletConnectWallet.key,
					callback_data: botEnum.multiWalletConnectWallet.value + '_' + chain
				},
			],
			[

				{
					text: botEnum.multiWalletGenerateWallet.key,
					callback_data: botEnum.multiWalletGenerateWallet.value + '_' + chain
				}
			],
			[
				{
					text: '⬅️ Return',
					callback_data: botEnum.select_chain.value + '_' + chain
				}
			]
		]
	};
}

export async function markupTransferChangeMainWalletPaginate(telegramId: string, chain: string, isMultiWallet: Boolean, data: IAddressPagination, currentSelectedAddress: IAddress) {
	let address1D = [];
	let address2D = [];
	let paginationButtons = [[]];

	let page = data.metaData[0].pageNumber;
	page++;
	let totalPages = data.metaData[0].totalPages++;
	let prevPage = page - 1;
	let nextPage = page + 1;

	const userWallet = await getWallet(telegramId)

	// if(currentSelectedAddress.address !== userWallet.address && page === 1){
	//     address1D.push({
	//         text: `📥 Main`,
	//         callback_data: `${botEnum.transfer.value}`
	//     });
	// }

	for (let address of data.data) {
		// if(currentSelectedAddress.address !== address.address){
		address1D.push({
			text: `📥 ${address.name}`,
			callback_data: `${botEnum.transfer.value}_${address._id}`
		});
		// }
	}

	while (address1D.length) address2D.push(address1D.splice(0, 2));

	if (page > 1) {
		paginationButtons[0].push({
			text: botEnum.multiWalletPaginationPrev.key,
			callback_data: `${botEnum.changeMainWallet.value}_chain?${chain}_page?${prevPage}_limit?4`
		});
	}

	paginationButtons[0].push({
		text: `${page} of ${totalPages}`,
		callback_data: `${botEnum.changeMainWallet.value}_chain?${chain}_page?${page}_limit?4`
	});

	if (page < totalPages) {
		paginationButtons[0].push({
			text: botEnum.multiWalletPaginationNext.key,
			callback_data: `${botEnum.changeMainWallet.value}_chain?${chain}_page?${nextPage}_limit?4`
		});
	}

	let firstRow = [{
		text: botEnum.menu.key,
		callback_data: botEnum.menu.value
	}]

	if (currentSelectedAddress.address !== userWallet.address) {
		firstRow.push({
			text: `📥 Main`,
			callback_data: `${botEnum.transfer.value}`
		});
	}

	return {
		inline_keyboard: [
			firstRow,
			...address2D,
			...paginationButtons,
			[
				{
					text: '⬅️ Return',
					callback_data: `${botEnum.transfer.value}_${currentSelectedAddress._id}`
				}
			],
		]
	};
}


// export function markupMultiWalletMainPaginate(telegramId: string, chain: string, isMultiWallet: Boolean, data: IAddressPagination) {
//     let address1D = [];
//     let address2D = [];
//     let paginationButtons = [[]];

//     let page = data.metaData[0].pageNumber;
//     page++;
//     let totalPages = data.metaData[0].totalPages++;
//     let prevPage = page - 1;
//     let nextPage = page + 1;

//     for (let address of data.data) {
//         address1D.push({
//             text: `⚙️ ${address.name}`,
//             callback_data: `${botEnum.manage_additional_dynamic_address}_chain?${chain}_Id?${address._id.toString()}_page?${page}_limit?${4}`
//         });
//     }

//     while (address1D.length) address2D.push(address1D.splice(0, 2));

//     if (page > 1) {
//         paginationButtons[0].push({
//             text: botEnum.multiWalletPaginationPrev.key,
//             callback_data: `multi_wallet_chain?${chain}_page?${prevPage}_limit?4`
//         });
//     }

//     // for (let pageLength = pageBefore; pageLength < pageAfter; pageLength++) {
//     //     paginationButtons[0].push({
//     //         text: `${(pageLength + 1)}`,
//     //         callback_data: `${botEnum.multi_wallet_pagination_to_page}_${(pageLength + 1)}`
//     //     })

//     // }

//     paginationButtons[0].push({
//         text: `${page} of ${totalPages}`,
//         callback_data: `multi_wallet_chain?${chain}_page?${page}_limit?4`
//     });

//     if (page < totalPages) {
//         paginationButtons[0].push({
//             text: botEnum.multiWalletPaginationNext.key,
//             callback_data: `multi_wallet_chain?${chain}_page?${nextPage}_limit?4`
//         });
//     }

//     return {
//         inline_keyboard: [
//             [
//                 {
//                     text: botEnum.menu.key,
//                     callback_data: botEnum.menu.value
//                 }
//             ],
//             [
//                 {
//                     text: `${!isMultiWallet ? '❌' : '✅'} Multi-Wallet`,
//                     callback_data: !isMultiWallet ? `${botEnum.enableMultiWallet}_chain?${chain}_page?${page}_limit?${4}` : `${botEnum.disableMultiWallet}_chain?${chain}_page?${page}_limit?${4}`
//                 },
//                 {
//                     text: 'Return',
//                     callback_data: botEnum.select_chain.value + '_' + chain
//                 }
//             ],
//             [
//                 {
//                     text: botEnum.multiWalletConnectWallet.key,
//                     callback_data: botEnum.multiWalletConnectWallet.value + '_' + chain
//                 },
//                 {
//                     text: botEnum.multiWalletGenerateWallet.key,
//                     callback_data: botEnum.multiWalletGenerateWallet.value + '_' + chain
//                 }
//             ],
//             ...address2D,
//             ...paginationButtons
//         ]
//     };
// }

export function markupMultiWalletMainPaginate(chain: string, data: IAddressPagination, confirmDelete: boolean = false, deleteId?: string) {
	let address1D = [];
	let address2D = [];
	let paginationButtons = [[]];

	let page = data.metaData[0].pageNumber;
	page++;
	let totalPages = data.metaData[0].totalPages++;
	let prevPage = page - 1;
	let nextPage = page + 1;


	for (let address of data.data) {
		address1D.push({
			text: `💳 ${address.name}`,
			callback_data: `${botEnum.manage_additional_dynamic_address}_chain?${chain}_Id?${address._id.toString()}_page?${page}_limit?${4}`
		});
		if (deleteId === address._id.toString() && confirmDelete === true) {
			address1D.push({
				text: `❌ Confirm`,
				callback_data: `qww_dc_chain?${chain}_Id?${address._id.toString()}_page?${page}_limit?${4}`
			});
		} else {
			address1D.push({
				text: `❌ Delete`,
				callback_data: `qww_d_chain?${chain}_Id?${address._id.toString()}_page?${page}_limit?${4}`
			});
		}
	}

	while (address1D.length) address2D.push(address1D.splice(0, 2));

	if (page > 1) {
		paginationButtons[0].push({
			text: botEnum.multiWalletPaginationPrev.key,
			callback_data: `${botEnum.multiWalletViewList.value}_chain?${chain}_page?${prevPage}_limit?4`
		});
	}

	// for (let pageLength = pageBefore; pageLength < pageAfter; pageLength++) {
	//     paginationButtons[0].push({
	//         text: `${(pageLength + 1)}`,
	//         callback_data: `${botEnum.multi_wallet_pagination_to_page}_${(pageLength + 1)}`
	//     })

	// }

	paginationButtons[0].push({
		text: `${page} of ${totalPages}`,
		callback_data: `${botEnum.multiWalletViewList.value}_chain?${chain}_page?${page}_limit?4`
	});

	if (page < totalPages) {
		paginationButtons[0].push({
			text: botEnum.multiWalletPaginationNext.key,
			callback_data: `${botEnum.multiWalletViewList.value}_chain?${chain}_page?${nextPage}_limit?4`
		});
	}

	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			...address2D,
			...paginationButtons,
			[

				{
					text: '⬅️ Return',
					callback_data: `multi_wallet_chain_${chain}`
				}
			]
		]
	};
}

export async function manageAdditionalDynamicWalletMainMenu(telegramId: string, chain: string, address: any, confirmDelete?: boolean, page?: IPageAndLimit) {
	let enableDisabledText = `${address.connected ? '✅ Enabled' : '❌ Disabled'}`;
	let enableDisabledCallback = address.connected ?
		`qwa_ev_chain?${chain}_Id?${address._id.toString()}_page?${page.page || 1}_limit?${page.limit || 4}`
		:
		`qwa_e_chain?${chain}_Id?${address._id.toString()}_page?${page.page || 1}_limit?${page.limit || 4}`

	let isDeleteOrConfirmDeleteText;
	let isDeleteOrConfirmDeleteCallback;
	if (confirmDelete == null || typeof confirmDelete == undefined || confirmDelete == false) {
		isDeleteOrConfirmDeleteText = `❌ Delete`;
		isDeleteOrConfirmDeleteCallback = `${botEnum.delete_additional_address.value}_chain?${chain}_Id?${address._id.toString()}_page?${page.page || 1}_limit?${page.limit || 4}`;
	} else if (confirmDelete) {
		isDeleteOrConfirmDeleteText = `❌ Confirm`;
		isDeleteOrConfirmDeleteCallback = `${botEnum.additional_address_confirm_delete}_chain?${chain}_Id?${address._id.toString()}_page?${page.page || 1}_limit?${page.limit || 4}`;
	}

	const symbol = await getNativeCurrencySymbol(chain);

	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: enableDisabledText,
					callback_data: enableDisabledCallback
				},
				{
					text: 'Return',
					callback_data: `${botEnum.multiWalletViewList.value}_chain?${chain}_page?${page.page || 1}_limit?${page.limit || 4}`
				}
			],
			[
				{
					text: `📤 ${symbol}`,
					callback_data: `tnc_chain?${chain}_Id?${address._id.toString()}_page?${page.page || 1}_limit?${page.limit || 4}`
				},
				{
					text: `📤 Tokens`,
					callback_data: `tt_chain?${chain}_Id?${address._id.toString()}_page?${page.page || 1}_limit?${page.limit || 4}`
				}
			],
			[
				{
					text: botEnum.rename_additional_address.key,
					callback_data: `${botEnum.rename_additional_address.value}_chain?${chain}_Id?${address._id.toString()}_page?${page.page || 1}_limit?${page.limit || 4}`
				},
				{
					text: isDeleteOrConfirmDeleteText,
					callback_data: isDeleteOrConfirmDeleteCallback
				}
			]
		]
	};
}

export async function getTrackMarkup(telegramId: string, chain: string, token: string, showOther: string) {
	const isAS = await isTokenAutoSellSet(telegramId, chain, token);
	let autoSellCtx;
	if (isAS === true) autoSellCtx = await getTokenAutoSellContext(telegramId, chain, token);

	const isAB = await isTokenAutoBuySet(telegramId, chain, token);
	let autoBuyCtx;
	if (isAB === true) autoBuyCtx = await getTokenAutoBuyContext(telegramId, chain, token);

	const url = await getTokenExternalURL(chain, token)

	const track = await getTrackByToken(telegramId, chain, token)
	const tokenInfo = await TokenInfoModel.findOne({ chain: chain, address: token })
	const tokenSymbol = tokenInfo.symbol
	const nativeSymbol = await getNativeCurrencySymbol(chain)

	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				},
				{
					text: botEnum.registerSnipe.key,
					callback_data: botEnum.registerSnipe.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				}
			],
			[
				{
					text: botEnum.prevTrack.key,
					callback_data: botEnum.prevTrack.value + '_' + ((track === null) ? '' : track._id.toString())
				},
				{
					text: botEnum.refreshTrack.key + ' ' + tokenSymbol,
					callback_data: botEnum.refreshTrack.value + '_' + ((track === null) ? '' : track._id.toString())
				},
				{
					text: botEnum.nextTrack.key,
					callback_data: botEnum.nextTrack.value + '_' + ((track === null) ? '' : track._id.toString())
				}
			],
			[
				{
					text: (autoSellCtx?.antiRug === true ? '🟢 ' : '❌ ') + botEnum.antiRugTrack.key,
					callback_data: botEnum.antiRugTrack.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				},
				{
					text: (isAS === true ? '🟢 ' : '❌ ') + botEnum.autoSellTrack.key,
					callback_data: botEnum.autoSellTrack.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				},
				{
					text: (autoSellCtx?.trailingSell === true ? '🟢 ' : '❌ ') + botEnum.trailingTrack.key,
					callback_data: botEnum.trailingTrack.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				}
			],
			isAS !== true
				? []
				: showOther === 'show-auto-sell-low-price-limit'
					? [
						{
							text: '%',
							callback_data: botEnum.trackAutoSellLowPriceLimitPercentage + '_' + ((autoSellCtx === null) ? '' : autoSellCtx._id.toString())
						},
						{
							text: 'Price',
							callback_data: botEnum.trackAutoSellLowPriceLimitUsd + '_' + ((autoSellCtx === null) ? '' : autoSellCtx._id.toString())
						},
						{
							text: 'MC',
							callback_data: botEnum.trackAutoSellLowPriceLimitMarketcap + '_' + ((autoSellCtx === null) ? '' : autoSellCtx._id.toString())
						},
						{
							text: '❌',
							callback_data: botEnum.trackAutoSellLowPriceLimitCancel + '_' + ((autoSellCtx === null) ? '' : autoSellCtx._id.toString())
						}
					]
					: showOther === 'show-auto-sell-high-price-limit'
						? [
							{
								text: '%',
								callback_data: botEnum.trackAutoSellHighPriceLimitPercentage + '_' + ((autoSellCtx === null) ? '' : autoSellCtx._id.toString())
							},
							{
								text: 'Price',
								callback_data: botEnum.trackAutoSellHighPriceLimitUsd + '_' + ((autoSellCtx === null) ? '' : autoSellCtx._id.toString())
							},
							{
								text: 'MC',
								callback_data: botEnum.trackAutoSellHighPriceLimitMarketcap + '_' + ((autoSellCtx === null) ? '' : autoSellCtx._id.toString())
							},
							{
								text: '❌',
								callback_data: botEnum.trackAutoSellHighPriceLimitCancel + '_' + ((autoSellCtx === null) ? '' : autoSellCtx._id.toString())
							}
						]
						: showOther === 'show-auto-sell-amount'
							? [
								{
									text: autoSellCtx.amountAtLowPrice,
									callback_data: botEnum.autoSellAmountAtLowPrice + '_' + ((autoSellCtx === null) ? '' : autoSellCtx._id.toString())
								},
								{
									text: botEnum.autoSellAmountSwitch.key,
									callback_data: botEnum.autoSellAmountSwitch.value + '_' + ((autoSellCtx === null) ? '' : autoSellCtx._id.toString())
								},
								{
									text: autoSellCtx.amountAtHighPrice,
									callback_data: botEnum.autoSellAmountAtHighPrice + '_' + ((autoSellCtx === null) ? '' : autoSellCtx._id.toString())
								}
							]
							: [
								{
									text: autoSellCtx.lowPriceLimit,
									callback_data: botEnum.autoSellLowPriceLimit.value + '_' + ((autoSellCtx === null) ? '' : autoSellCtx._id.toString())
								},
								{
									text: botEnum.trackLoHi.key,
									callback_data: botEnum.trackLoHi.value + '_' + ((autoSellCtx === null) ? '' : autoSellCtx._id.toString())
								},
								{
									text: autoSellCtx.highPriceLimit,
									callback_data: botEnum.autoSellHighPriceLimit.value + '_' + ((autoSellCtx === null) ? '' : autoSellCtx._id.toString())
								}
							],
			isAB !== true ?
				[
					{
						text: '❌ ' + botEnum.buyDipTrack.key,
						callback_data: botEnum.buyDipTrack.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					}
				] :
				showOther === 'show-auto-buy-price-limit'
					? [
						{
							text: '%',
							callback_data: botEnum.trackAutoBuyPriceLimitPercentage + '_' + ((autoBuyCtx === null) ? '' : autoBuyCtx._id.toString())
						},
						{
							text: 'Price',
							callback_data: botEnum.trackAutoBuyPriceLimitUsd + '_' + ((autoBuyCtx === null) ? '' : autoBuyCtx._id.toString())
						},
						{
							text: 'MC',
							callback_data: botEnum.trackAutoBuyPriceLimitMarketcap + '_' + ((autoBuyCtx === null) ? '' : autoBuyCtx._id.toString())
						},
						{
							text: '❌',
							callback_data: botEnum.trackAutoBuyPriceLimitCancel + '_' + ((autoBuyCtx === null) ? '' : autoBuyCtx._id.toString())
						}
					] : [
						{
							text: '🟢 ' + botEnum.buyDipTrack.key,
							callback_data: botEnum.buyDipTrack.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
						},
						{
							text: `${(autoBuyCtx.amountAtLimit && autoBuyCtx.amountAtLimit.indexOf('%') > -1) ? autoBuyCtx.amountAtLimit : autoBuyCtx.amountAtLimit + ' ' + nativeSymbol}`,
							callback_data: botEnum.buyDipAmount.value + '_' + ((autoBuyCtx === null) ? '' : autoBuyCtx._id.toString())
						},
						{
							text: botEnum.buyDipPriceThreshold.key,
							callback_data: botEnum.buyDipPriceThreshold.value + '_' + ((autoBuyCtx === null) ? '' : autoBuyCtx._id.toString())
						}
					],
			[
				{
					text: botEnum.buyXETH.key + ' ' + tokenSymbol,
					callback_data: botEnum.buyXETH.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				},
				{
					text: botEnum.buyApeMax.key,
					callback_data: botEnum.buyApeMax.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				},
				{
					text: botEnum.buyXToken.key + ' ' + tokenSymbol,
					callback_data: botEnum.buyXToken.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				}
			],
			[
				{
					text: botEnum.sellApprove.key,
					callback_data: botEnum.sellApprove.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				},
				{
					text: botEnum.sellUnknownSell.key,
					callback_data: botEnum.sellUnknownSell.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				},
				{
					text: botEnum.sellTokenX.key + ' ' + tokenSymbol,
					callback_data: botEnum.sellTokenX.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				},
				{
					text: `📈 ${botEnum.chart.key}`,
					url: url
				}
			],
			[
				{
					text: botEnum.sellToken25Percent.key,
					callback_data: botEnum.sellToken25Percent.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				},
				{
					text: botEnum.sellToken50Percent.key,
					callback_data: botEnum.sellToken50Percent.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				}
			],
			[
				{
					text: botEnum.sellToken75Percent.key,
					callback_data: botEnum.sellToken75Percent.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				},
				{
					text: botEnum.sellToken100Percent.key,
					callback_data: botEnum.sellToken100Percent.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				}
			],
			[
				{
					text: botEnum.sellTokenMaxTX.key,
					callback_data: botEnum.sellTokenMaxTX.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				},
				{
					text: botEnum.sellTokenForXETH.key + ' ' + nativeSymbol,
					callback_data: botEnum.sellTokenForXETH.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				},
				{
					text: botEnum.sellTokenX.key + ' ' + tokenSymbol,
					callback_data: botEnum.sellTokenX.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
				}
			],
			[
				{
					text: botEnum.resetTracks.key,
					callback_data: botEnum.resetTracks.value
				},
				{
					text: botEnum.enableTrack.key,
					callback_data: botEnum.enableTrack.value + '_' + ((track === null) ? '' : track._id.toString())
				},
				{
					text: botEnum.stopTrack.key,
					callback_data: botEnum.stopTrack.value + '_' + ((track === null) ? '' : track._id.toString())
				},
				{
					text: botEnum.deleteTrack.key,
					callback_data: botEnum.deleteTrack.value + '_' + ((track === null) ? '' : track._id.toString())
				}
			]
		]
	};
}

export async function getTokenPasteMarkup(telegramId: string, mode: string, chain: string, symbol: string, tokenSymbol: string, tokenAddress: string) {
	let url = await getTokenExternalURL(chain, tokenAddress)

	const tokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })

	const defArray = [
		[
			{
				text: botEnum.menu.key,
				callback_data: botEnum.menu.value
			},
			{
				text: botEnum.registerSnipe.key,
				callback_data: botEnum.registerSnipe.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
			},
			{
				text: botEnum.quickSnipe.key,
				callback_data: botEnum.quickSnipe.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
			}
		],
		[
			{
				text: botEnum.track.key,
				callback_data: botEnum.track.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
			},
			{
				text: `🔄 ${chain}`,
				callback_data: botEnum.select_chain.value + '_' + chain,
			}
		],
		[
			{
				text: `📈 ${botEnum.chart.key}`,
				url: url
			},
			{
				text: mode === 'buy' ? botEnum.switch_to_sell.key : mode === 'sell' ? botEnum.switch_to_buy.key : "❌",
				callback_data: mode === 'buy' ? botEnum.switch_to_sell.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString()) : mode === 'sell' ? botEnum.switch_to_buy.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString()) : ''
			}
		]
	]

	if (mode === 'buy') {
		return {
			inline_keyboard: [
				...defArray,
				[
					{
						text: botEnum.buy001ETH.key + ' ' + symbol,
						callback_data: botEnum.buy001ETH.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					},
					{
						text: botEnum.buy005ETH.key + ' ' + symbol,
						callback_data: botEnum.buy005ETH.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					}
				],
				[
					{
						text: botEnum.buy010ETH.key + ' ' + symbol,
						callback_data: botEnum.buy010ETH.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					},
					{
						text: botEnum.buy020ETH.key + ' ' + symbol,
						callback_data: botEnum.buy020ETH.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					}
				],
				[
					{
						text: botEnum.buy050ETH.key + ' ' + symbol,
						callback_data: botEnum.buy050ETH.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					},
					{
						text: botEnum.buy100ETH.key + ' ' + symbol,
						callback_data: botEnum.buy100ETH.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					}
				],
				[
					{
						text: botEnum.buyXETH.key + ' ' + symbol,
						callback_data: botEnum.buyXETH.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					},
					{
						text: botEnum.buyApeMax.key,
						callback_data: botEnum.buyApeMax.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					},
					{
						text: botEnum.buyXToken.key + ' ' + tokenSymbol,
						callback_data: botEnum.buyXToken.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					}
				]
			]
		};
	} else if (mode === 'sell') {
		return {
			inline_keyboard: [
				...defArray,
				[
					{
						text: botEnum.sellApprove.key,
						callback_data: botEnum.sellApprove.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					},
					{
						text: botEnum.sellUnknownSell.key,
						callback_data: botEnum.sellUnknownSell.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					}
				],
				[
					{
						text: botEnum.sellToken25Percent.key,
						callback_data: botEnum.sellToken25Percent.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					},
					{
						text: botEnum.sellToken50Percent.key,
						callback_data: botEnum.sellToken50Percent.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					}
				],
				[
					{
						text: botEnum.sellToken75Percent.key,
						callback_data: botEnum.sellToken75Percent.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					},
					{
						text: botEnum.sellToken100Percent.key,
						callback_data: botEnum.sellToken100Percent.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					}
				],
				[
					{
						text: botEnum.sellTokenMaxTX.key,
						callback_data: botEnum.sellTokenMaxTX.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					},
					{
						text: botEnum.sellTokenForXETH.key + ' ' + symbol,
						callback_data: botEnum.sellTokenForXETH.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					},
					{
						text: botEnum.sellTokenX.key + ' ' + tokenSymbol,
						callback_data: botEnum.sellTokenX.value + '_' + ((tokenInfo === null) ? '' : tokenInfo._id.toString())
					}
				]
			]
		};
	} else {
		return {
			inline_keyboard: defArray
		}
	}
}

export async function getQuickMarkup(telegramId: string, chain: string) {
	let tt = [];
	const quickItem = await getQuickAutoBuyContext(telegramId, chain)
	// for (const ch of chains)
	{
		tt = [
			...tt,
			[
				{
					text: botEnum.prevQuickChain.key,
					callback_data: botEnum.prevQuickChain.value + '_' + chain,
				},
				{
					text: '⚙️ ' + chain.toUpperCase(),
					callback_data: botEnum.quickChainLabel + '_' + chain
				},
				{
					text: botEnum.nextQuickChain.key,
					callback_data: botEnum.nextQuickChain.value + '_' + chain,
				}
			],
			[
				{
					text: (quickItem.enabled === true ? '✅' : '❌') + ' Auto-Buy Pasted Contracts',
					callback_data: botEnum.autoBuyPastedContract + '_' + chain,
				}
			],
			[
				{
					text: '✏️ Pasted-Contract Buy Amount',
					callback_data: botEnum.pastedContractBuyAmount + '_' + chain,
				}
			],
			[
				{
					text: (quickItem.multi === true ? '✅' : '❌') + ' Multi',
					callback_data: botEnum.quickChainMulti + '_' + chain,
				},
				{
					text: (quickItem.smartSlippage === true ? '✅' : '❌') + ' Smart Slippage',
					callback_data: botEnum.quickChainSmartSlippage + '_' + chain,
				}
			],
			[
				{
					text: chain === 'ethereum' ? '✏️ Buy Gas Delta' : '✏️ Buy Gas Price',
					callback_data: botEnum.quickBuyGas + '_' + chain,
				},
				{
					text: chain === 'ethereum' ? '🗑️ Buy Gas Delta' : '🗑️ Buy Gas Price',
					callback_data: botEnum.quickBuyGasRemove + '_' + chain,
				},
			],
			[
				{
					text: '📝 Slippage',
					callback_data: botEnum.quickSlippage + '_' + chain,
				},
				{
					text: '🗑️ Slippage',
					callback_data: botEnum.quickSlippageRemove + '_' + chain,
				}
			]
		];
	}

	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			...tt
		]
	};
}

export function affiliateNotFound() {
	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: botEnum.setupAffiliate.key,
					callback_data: botEnum.setupAffiliate.value
				},
				{
					text: 'Return',
					callback_data: botEnum.menu.value
				}
			]
		]
	};
}

export function affiliateMainMenu() {
	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: botEnum.deleteAffiliate.key,
					callback_data: botEnum.deleteAffiliate.value
				},
				{
					text: 'Return',
					callback_data: botEnum.menu.value
				}
			]
		]
	};
}

export async function getSnipeMainMenuMarkup(showActiveSnipe: boolean) {

	if (showActiveSnipe) {
		return {
			inline_keyboard: [
				[
					{
						text: botEnum.menu.key,
						callback_data: botEnum.menu.value
					},
				],
				[
					{
						text: botEnum.addSnipe.key,
						callback_data: botEnum.addSnipe.value
					},
					{
						text: botEnum.activeSnipe.key,
						callback_data: botEnum.activeSnipe.value
					}
				]

			]
		};
	} else {
		return {
			inline_keyboard: [
				[
					{
						text: botEnum.menu.key,
						callback_data: botEnum.menu.value
					},
				],
				[
					{
						text: botEnum.addSnipe.key,
						callback_data: botEnum.addSnipe.value
					}
				]

			]
		};
	}
}

export function markupSnipeChooseMethodId(data: IMethodIdPagination, snipeId: string) {
	let snipes1D = [];
	let snipes2D = [];
	let paginationButtons = [[]];

	let page = data.metaData.pageNumber;
	page++;
	let totalPages = data.metaData.totalPages++;
	let prevPage = page - 1;
	let nextPage = page + 1;

	const camelcaseToStrings = (str: string) => {
		str = str.charAt(0).toUpperCase() + str.slice(1); // Capitalize the first letter
		return str.replace(/([0-9A-Z])/g, ' $&')
	}

	for (let method of data.data) {

		snipes1D.push({
			text: `${camelcaseToStrings(method.name)}`,
			callback_data: `${botEnum.snipeSelectMethodId.value}_${method.method}`
		});
	}

	while (snipes1D.length) snipes2D.push(snipes1D.splice(0, 2));

	if (page > 1) {
		paginationButtons[0].push({
			text: `⬅️`,
			callback_data: `${botEnum.snipeChangeMethodIDPage.value}_page?${prevPage}_limit?6`
		});
	}

	paginationButtons[0].push({
		text: `${page} of ${totalPages}`,
		callback_data: `${botEnum.snipeChangeMethodIDPage.value}_page?${page}_limit?6`
	});

	if (page < totalPages) {
		paginationButtons[0].push({
			text: `➡️`,
			callback_data: `${botEnum.snipeChangeMethodIDPage.value}_page?${nextPage}_limit?6`
		});
	}


	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			...snipes2D,
			...paginationButtons,
			[
				{
					text: "⬅️ Return",
					callback_data: `${botEnum.snipeSettings.value}_${snipeId}`
				}
			]
		]
	};
}
export async function markupActiveSnipesPaginate(telegramId: string, data: ISnipePagination) {
	let snipes1D = [];
	let snipes2D = [];
	let paginationButtons = [[]];

	let page = data.metaData[0].pageNumber;
	page++;
	let totalPages = data.metaData[0].totalPages++;
	let prevPage = page - 1;
	let nextPage = page + 1;

	for (let snipe of data.data) {

		snipes1D.push({
			text: `${snipe.token.name}`,
			callback_data: `${botEnum.snipeSettings.value}_${snipe._id.toString()}`
		});
	}

	while (snipes1D.length) snipes2D.push(snipes1D.splice(0, 2));

	if (page > 1) {
		paginationButtons[0].push({
			text: botEnum.multiWalletPaginationPrev.key,
			callback_data: `${botEnum.activeSnipe.value}_page?${prevPage}_limit?4`
		});
	}

	paginationButtons[0].push({
		text: `${page} of ${totalPages}`,
		callback_data: `${botEnum.activeSnipe.value}_page?${page}_limit?4`
	});

	if (page < totalPages) {
		paginationButtons[0].push({
			text: botEnum.multiWalletPaginationNext.key,
			callback_data: `${botEnum.activeSnipe.value}_page?${nextPage}_limit?4`
		});
	}


	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			...snipes2D,
			...paginationButtons,
			[
				{
					text: '⬅️ Return',
					callback_data: `${botEnum.snipe.value}`
				}
			],
		]
	};
}

export async function getSnipeTokenMarkup(telegramId: string, snipe: any, method: string) {
	if (snipe === null || snipe === undefined) {
		return {
			inline_keyboard: [
				[
					{
						text: botEnum.menu.key,
						callback_data: botEnum.menu.value
					},
				],
				[
					{
						text: botEnum.addSnipe.key,
						callback_data: botEnum.addSnipe.value
					}
				]
			]
		};
	}

	const primary = await snipe.populate('token')

	const nativeSymbol = await getNativeCurrencySymbol(primary.token.chain);

	let methodsMarkup
	if (method === 'method-id') {
		methodsMarkup = [[
			{
				text: (primary.method === 'method-id' ? '✅ ' : '❌ ') + botEnum.doSnipeMethodId.key,
				callback_data: botEnum.doSnipeMethodId.value + '_' + snipe._id.toString()
			},
			{
				text: botEnum.snipeBlockDelay.key + (primary.blockDelay || 0),
				callback_data: botEnum.snipeBlockDelay.value + '_' + snipe._id.toString()
			}
		]]
	}
	else if (method === 'auto') {
		methodsMarkup = [[
			{
				text: (primary.method === 'auto' ? '✅ ' : '❌ ') + botEnum.doSnipeAuto.key,
				callback_data: botEnum.doSnipeAuto.value + '_' + snipe._id.toString()
			},
		],
		[
			{
				text: botEnum.snipeAutoMaxBuyTax.key + ` (${snipe.maxBuyTax === undefined ? 'Default' : ''} ${snipe.maxBuyTax || '100'}%)`,
				callback_data: botEnum.snipeAutoMaxBuyTax.value + '_' + snipe._id.toString()
			},
			{
				text: botEnum.snipeAutoMaxSellTax.key + ` (${snipe.maxSellTax === undefined ? 'Default' : ''} ${snipe.maxSellTax || '100'}%)`,
				callback_data: botEnum.snipeAutoMaxSellTax.value + '_' + snipe._id.toString()
			},
		]]
	} else {
		methodsMarkup = [[
			{
				text: (primary.method === 'liquidity' ? '✅ ' : '❌ ') + botEnum.doSnipeLiquidity.key,
				callback_data: botEnum.doSnipeLiquidity.value + '_' + snipe._id.toString()
			},
			{
				text: botEnum.snipeBlockDelay.key + (primary.blockDelay || 0),
				callback_data: botEnum.snipeBlockDelay.value + '_' + snipe._id.toString()
			}
		]]
	}

	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: botEnum.prevSnipe.key,
					callback_data: botEnum.prevSnipe.value + '_' + snipe._id.toString()
				},
				{
					text: botEnum.refreshSnipe.key + ' ' + primary.token.symbol,
					callback_data: botEnum.refreshSnipe.value + '_' + snipe._id.toString()
				},
				{
					text: botEnum.nextSnipe.key,
					callback_data: botEnum.nextSnipe.value + '_' + snipe._id.toString()
				}
			],
			primary.token.chain === 'ethereum' ? [{
				text: (primary.backupTx === true ? '✅ ' : '❌ ') + botEnum.snipeBackupTx.key,
				callback_data: botEnum.snipeBackupTx.value + '_' + snipe._id.toString()
			}] : [],
			primary.token.chain === 'ethereum' ?
				[
					{
						text: (primary.multi === true ? '✅ ' : '❌ ') + botEnum.snipeMulti.key,
						callback_data: botEnum.snipeMulti.value + '_' + snipe._id.toString()
					},
					{
						text: botEnum.snipeGasDelta.key + (primary.token.chain === 'ethereum' ? ' Gas Delta' : ' Gas Price'),
						callback_data: botEnum.snipeGasDelta.value + '_' + snipe._id.toString()
					},
					{
						text: botEnum.snipeBribeAmount.key,
						callback_data: botEnum.snipeBribeAmount.value + '_' + snipe._id.toString()
					}
				] : [
					{
						text: (primary.multi === true ? '✅ ' : '❌ ') + botEnum.snipeMulti.key,
						callback_data: botEnum.snipeMulti.value + '_' + snipe._id.toString()
					},
					{
						text: botEnum.snipeGasDelta.key + (primary.token.chain === 'ethereum' ? ' Gas Delta' : ' Gas Price'),
						callback_data: botEnum.snipeGasDelta.value + '_' + snipe._id.toString()
					}
				],
			[
				{
					text: (primary.method === 'liquidity' ? '✅ ' : '❌ ') + botEnum.snipeLiquidity.key,
					callback_data: botEnum.snipeLiquidity.value + '_' + snipe._id.toString()
				},
				{
					text: (primary.method === 'method-id' ? '✅ ' : '❌ ') + botEnum.snipeMethod.key,
					callback_data: botEnum.snipeMethod.value + '_' + snipe._id.toString()
				},
				{
					text: (primary.method === 'auto' ? '✅ ' : '❌ ') + botEnum.snipeAuto.key,
					callback_data: botEnum.snipeAuto.value + '_' + snipe._id.toString()
				}
			],
			...methodsMarkup,
			[
				{
					text: (primary.autoMaxTx === true ? '✅ ' : '❌ ') + botEnum.toggleAutoMaxTx.key,
					callback_data: botEnum.toggleAutoMaxTx.value + '_' + snipe._id.toString()
				},
				{
					text: (primary.nativeCurrencyAmount || '50%') + (!primary.nativeCurrencyAmount || primary.nativeCurrencyAmount.indexOf('%') < 0 ? ' ' + nativeSymbol : ''),
					callback_data: botEnum.snipeETHAmount.value + '_' + snipe._id.toString()
				},
				{
					text: (primary.tokenAmount || '0') + (!primary.tokenAmount || primary.tokenAmount.indexOf('%') < 0 ? ' ' + primary.token.symbol : ''),
					callback_data: botEnum.snipeTokenAmount.value + '_' + snipe._id.toString()
				},
			],
			[
				{
					text: botEnum.preApproveSnipe.key,
					callback_data: botEnum.preApproveSnipe.value + '_' + primary.token._id.toString()
				},
				{
					text: botEnum.snipeSlippage.key + ' ' + snipe.slippage + '%',
					callback_data: botEnum.snipeSlippage.value + '_' + snipe._id.toString()
				},
				{
					text: botEnum.snipeMaxGas.key + ` ${snipe.maxGas || '(Default)'}`,
					callback_data: botEnum.snipeMaxGas.value + '_' + snipe._id.toString()
				}
			],
			[
				{
					text: '⬅️ Return',
					callback_data: `${botEnum.activeSnipe.value}`
				},
				{
					text: botEnum.deleteSnipe.key,
					callback_data: botEnum.deleteSnipe.value + '_' + snipe._id.toString()
				}
			],
		]
	};
}

export async function affiliateEarningsSummaryMarkup() {
	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				},
				{
					text: 'Return',
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: botEnum.affiliateRename.key,
					callback_data: botEnum.affiliateRename.value
				},
				{
					text: botEnum.affiliateRefresh.key,
					callback_data: botEnum.affiliateRefresh.value,
				},
				{
					text: botEnum.affiliateDelete.key,
					callback_data: botEnum.affiliateDelete.value
				}
			]
		]
	};
}

export async function affiliateEarningsSummaryConfirmDeleteMarkup() {
	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: botEnum.withdrawAffiliate.key,
					callback_data: botEnum.withdrawAffiliate.value
				},
				{
					text: 'Return',
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: botEnum.affiliateRename.key,
					callback_data: botEnum.affiliateRename.value
				},
				{
					text: botEnum.affiliateConfirmDelete.key,
					callback_data: botEnum.affiliateConfirmDelete.value
				}
			]
		]
	};
}

export async function getCopyTradeMarkup(telegramId: string, chain: string) {
	const addresses = await getCopyTradeAddresses(telegramId, chain)

	const tMore = addresses.map((a) => {
		return [
			{
				text: '⚙ ' + a.name,
				callback_data: botEnum.copyTradeMoreSetting + '_' + a._id.toString()
			},
			{
				text: 'Rename',
				callback_data: botEnum.copyTradeRename + '_' + a._id.toString()
			},
			{
				text: a.state === 'on' ? '🟢 ON' : '🔴 OFF',
				callback_data: botEnum.copyTradeOnOff + '_' + a._id.toString()
			},
			{
				text: '❌',
				callback_data: botEnum.copyTradeDelete + '_' + a._id.toString()
			}
		];
	});

	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: botEnum.prevCopyTradeChain.key,
					callback_data: botEnum.prevCopyTradeChain.value + '_' + chain
				},
				{
					text: '⚙️ ' + chain.slice(0, 3).toUpperCase(),
					callback_data: botEnum.copyTradeChainLabel + '_' + chain
				},
				{
					text: botEnum.nextCopyTradeChain.key,
					callback_data: botEnum.nextCopyTradeChain.value + '_' + chain
				}
			],
			[
				{
					text: botEnum.copyTradeAddWallet.key,
					callback_data: botEnum.copyTradeAddWallet.value + '_' + chain
				}
			],
			...tMore
		]
	};
}

export function disableAffiliate(data: IAffiliateInfluencer) {
	return {
		inline_keyboard: [
			[
				{
					text: `❌ ${botEnum.disableAffiliate.key}`,
					callback_data: `${botEnum.disableAffiliate.value}_${data._id.toString()}`
				}
			]
		]
	};
}

export function approveRejectAffiliate(data: IAffiliateInfluencer) {
	return {
		inline_keyboard: [
			[
				{
					text: `✔️ ${botEnum.approveAffiliate.key}`,
					callback_data: `${botEnum.approveAffiliate.value}_${data._id.toString()}`
				},
				{
					text: `❌ ${botEnum.rejectAffiliate.key}`,
					callback_data: `${botEnum.rejectAffiliate.value}_${data._id.toString()}`
				}
			]
		]
	};
}

export async function getSettingsMarkup(telegramId: string, chain: string, mode: string) {
	const tSetting = await getSettings(telegramId, chain)

	if (mode === 'general') {
		return {
			inline_keyboard: [
				[
					{
						text: botEnum.menu.key,
						callback_data: botEnum.menu.value
					}
				],
				[
					{
						text: botEnum.prevSettingsChain.key,
						callback_data: botEnum.prevSettingsChain.value + '_' + chain
					},
					{
						text: '⚙️ ' + chain.toUpperCase(),
						callback_data: botEnum.settingsChainLabel
					},
					{
						text: botEnum.nextSettingsChain.key,
						callback_data: botEnum.nextSettingsChain.value + '_' + chain
					}
				],
				chain === 'ethereum' ?
					[
						{
							text: ((tSetting?.antiMEV === true) ? '✅ ' : '❌ ') + botEnum.settingsAntiMEV.key,
							callback_data: botEnum.settingsAntiMEV.value + '_' + chain
						},
						// {
						//     text: ((tSetting?.antiRug === true) ? '✅ ' : '❌ ') + botEnum.settingsAntiRug.key,
						//     callback_data: botEnum.settingsAntiRug.value + '_' + chain
						// },
						{
							text: ((tSetting?.smartSlippage === true) ? '✅ ' : '❌ ') + botEnum.settingsSmartSlippage.key,
							callback_data: botEnum.settingsSmartSlippage.value + '_' + chain
						}
					] : [
						// {
						//     text: ((tSetting?.antiRug === true) ? '✅ ' : '❌ ') + botEnum.settingsAntiRug.key,
						//     callback_data: botEnum.settingsAntiRug.value + '_' + chain
						// },
						{
							text: ((tSetting?.smartSlippage === true) ? '✅ ' : '❌ ') + botEnum.settingsSmartSlippage.key,
							callback_data: botEnum.settingsSmartSlippage.value + '_' + chain
						}
					],

				[
					{
						text: chain === 'ethereum' ? '✏️ Max Gas Delta' : botEnum.settingsMaxGasPrice.key,
						callback_data: botEnum.settingsMaxGasPrice.value + '_' + chain
					},
					{
						text: chain === 'ethereum' ? '⌫ Max Gas Delta' : botEnum.settingsMaxGasPriceRemove.key,
						callback_data: botEnum.settingsMaxGasPriceRemove.value + '_' + chain
					}
				],
				[
					{
						text: botEnum.settingsSlippage.key,
						callback_data: botEnum.settingsSlippage.value + '_' + chain
					},
					{
						text: botEnum.settingsSlippageRemove.key,
						callback_data: botEnum.settingsSlippageRemove.value + '_' + chain
					}
				],
				[
					{
						text: botEnum.settingsMaxGasLimit.key,
						callback_data: botEnum.settingsMaxGasLimit.value + '_' + chain
					},
					{
						text: botEnum.settingsMaxGasLimitRemove.key,
						callback_data: botEnum.settingsMaxGasLimitRemove.value + '_' + chain
					}
				],
				[
					{
						text: botEnum.gasPresets.key,
						callback_data: botEnum.gasPresets.value
					}
				],
				[
					{
						text: botEnum.settingsBuy.key,
						callback_data: botEnum.settingsBuy.value + '_' + chain
					},
					{
						text: botEnum.settingsSell.key,
						callback_data: botEnum.settingsSell.value + '_' + chain
					},
					{
						text: botEnum.settingsApprove.key,
						callback_data: botEnum.settingsApprove.value + '_' + chain
					}
				],
				[
					{
						text: botEnum.lotus.key,
						callback_data: botEnum.lotus.value
					}
				]
			]
		}
	} else if (mode === 'buy') {
		return {
			inline_keyboard: [
				[
					{
						text: botEnum.menu.key,
						callback_data: botEnum.menu.value
					}
				],
				[
					{
						text: 'Return',
						callback_data: botEnum.settings.value
					}
				],
				[
					{
						text: ((tSetting?.buyDupeBuy === true) ? '✅ ' : '❌ ') + 'Dupe Buy',
						callback_data: botEnum.settingsBuyDupeBuy + '_' + chain
					},
					{
						text: ((tSetting?.buyAutoBuy === true) ? '✅ ' : '❌ ') + 'Auto Buy',
						callback_data: botEnum.settingsBuyAutoBuy + '_' + chain
					}
				],
				[
					{
						text: '✏️ Max MC',
						callback_data: botEnum.settingsBuyMaxMC + '_' + chain
					},
					{
						text: '⌫ Max MC',
						callback_data: botEnum.settingsBuyMaxMCRemove + '_' + chain
					}
				],
				[
					{
						text: '✏️ Min Liquidity',
						callback_data: botEnum.settingsBuyMinLiquidity + '_' + chain
					},
					{
						text: '⌫ Min Liquidity',
						callback_data: botEnum.settingsBuyMinLiquidityRemove + '_' + chain
					}
				],
				[
					{
						text: '✏️ Max Liquidity',
						callback_data: botEnum.settingsBuyMaxLiquidity + '_' + chain
					},
					{
						text: '⌫ Max Liquidity',
						callback_data: botEnum.settingsBuyMaxLiquidityRemove + '_' + chain
					}
				],
				[
					{
						text: '✏️ Min MC/Liq',
						callback_data: botEnum.settingsBuyMinMCLiq + '_' + chain
					},
					{
						text: '⌫ Min MC/Liq',
						callback_data: botEnum.settingsBuyMinMCLiqRemove + '_' + chain
					}
				],
				[
					{
						text: '✏️ Max Buy Tax',
						callback_data: botEnum.settingsBuyMaxBuyTax + '_' + chain
					},
					{
						text: '⌫ Max Buy Tax',
						callback_data: botEnum.settingsBuyMaxBuyTaxRemove + '_' + chain
					}
				],
				[
					{
						text: '✏️ Max Sell Tax',
						callback_data: botEnum.settingsBuyMaxSellTax + '_' + chain
					},
					{
						text: '⌫ Max Sell Tax',
						callback_data: botEnum.settingsBuyMaxSellTaxRemove + '_' + chain
					}
				],
				[
					{
						text: chain === 'ethereum' ? '✏️ Gas Delta' : '✏️ Gas Price',
						callback_data: botEnum.settingsBuyGasPrice + '_' + chain
					},
					{
						text: chain === 'ethereum' ? '⌫ Gas Delta' : '⌫ Gas Price',
						callback_data: botEnum.settingsBuyGasPriceRemove + '_' + chain
					}
				]
			]
		}
	} else if (mode === 'sell') {
		return {
			inline_keyboard: [
				[
					{
						text: botEnum.menu.key,
						callback_data: botEnum.menu.value
					}
				],
				[
					{
						text: 'Return',
						callback_data: botEnum.settings.value
					}
				],
				// [
				//     {
				//         text: ((tSetting?.sellConfirmTradeSell === true) ? '✅ ' : '❌ ') + 'Confirm Trade Sell',
				//         callback_data: botEnum.settingsSellConfirmTradeSell + '_' + chain
				//     },
				// ],
				[
					{
						text: ((tSetting?.sellAutoSell === true) ? '✅ ' : '❌ ') + 'Auto Sell',
						callback_data: botEnum.settingsSellAutoSell + '_' + chain
					},
					// {
					//     text: ((tSetting?.sellTrailingSell === true) ? '✅ ' : '❌ ') + 'Trailing Sell',
					//     callback_data: botEnum.settingsSellTrailingSell + '_' + chain
					// }
				],
				[
					{
						text: '✏️ Sell-Hi',
						callback_data: botEnum.settingsSellHighPrice + '_' + chain
					},
					{
						text: '⌫ Sell-Hi',
						callback_data: botEnum.settingsSellHighPriceRemove + '_' + chain
					}
				],
				[
					{
						text: '✏️ Sell-Lo',
						callback_data: botEnum.settingsSellLowPrice + '_' + chain
					},
					{
						text: '⌫ Sell-Lo',
						callback_data: botEnum.settingsSellLowPriceRemove + '_' + chain
					}
				],
				[
					{
						text: '✏️ Sell-Hi Amount',
						callback_data: botEnum.settingsSellHighAmount + '_' + chain
					},
					{
						text: '⌫ Sell-Hi Amount',
						callback_data: botEnum.settingsSellHighAmountRemove + '_' + chain
					}
				],
				[
					{
						text: '✏️ Sell-Lo Amount',
						callback_data: botEnum.settingsSellLowAmount + '_' + chain
					},
					{
						text: '⌫ Sell-Lo Amount',
						callback_data: botEnum.settingsSellLowAmountRemove + '_' + chain
					}
				],
				[
					{
						text: chain === 'ethereum' ? '✏️ Gas Delta' : '✏️ Gas Price',
						callback_data: botEnum.settingsSellGasPrice + '_' + chain
					},
					{
						text: chain === 'ethereum' ? '⌫ Gas Delta' : '⌫ Gas Price',
						callback_data: botEnum.settingsSellGasPriceRemove + '_' + chain
					}
				]
			]
		}
	} else if (mode === 'approve') {
		return {
			inline_keyboard: [
				[
					{
						text: botEnum.menu.key,
						callback_data: botEnum.menu.value
					}
				],
				[
					{
						text: 'Return',
						callback_data: botEnum.settings.value
					}
				],
				[
					{
						text: ((tSetting?.approveAuto === true) ? '✅ ' : '❌ ') + 'Auto Approve',
						callback_data: botEnum.settingsApproveAuto + '_' + chain
					},
				],
				[
					{
						text: chain === 'ethereum' ? '✏️ Gas Delta' : '✏️ Gas Price',
						callback_data: botEnum.settingsApproveGasPrice + '_' + chain
					},
					{
						text: chain === 'ethereum' ? '⌫ Gas Delta' : '⌫ Gas Price',
						callback_data: botEnum.settingsApproveGasPriceRemove + '_' + chain
					}
				]
			]
		}
	}
}


export async function getTransferMarkup(telegramId: string, chain: string, address?: string) {
	const nativeSymbol = await getNativeCurrencySymbol(chain)
	let transfer_buttons = []
	if (address) {
		transfer_buttons.push(
			{
				text: '📤 ' + nativeSymbol,
				callback_data: `tnc${address ? `_chain?${chain}_Id?${address}` : ""}`
			},
			{
				text: botEnum.transferToken.key,
				callback_data: `tt${address ? `_chain?${chain}_Id?${address}` : ""}`
			})
	} else {
		transfer_buttons.push(
			{
				text: '📤 ' + nativeSymbol,
				callback_data: botEnum.transferNativeCurrency.value + '_' + chain
			},
			{
				text: botEnum.transferToken.key,
				callback_data: botEnum.transferToken.value + '_' + chain
			})
	}

	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: botEnum.changeMainWallet.key,
					callback_data: `${botEnum.changeMainWallet.value}_chain?${chain}_page?1_limit?4`
				}
			],
			[
				{ text: botEnum.prevTransferChain.key, callback_data: botEnum.prevTransferChain.value + '_' + chain },
				{
					text: chain.slice(0, 3).toUpperCase(),
					callback_data: botEnum.refreshTransferChain.value
				},
				{ text: botEnum.nextTransferChain.key, callback_data: botEnum.nextTransferChain.value + '_' + chain }
			],
			transfer_buttons
		]
	}
}

export async function getTradeMarkup(telegramId: string, chain: string) {
	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			[
				{ text: botEnum.prevTradeChain.key, callback_data: botEnum.prevTradeChain.value + '_' + chain },
				{
					text: chain.slice(0, 3).toUpperCase(),
					callback_data: botEnum.refreshTradeChain.value
				},
				{ text: botEnum.nextTradeChain.key, callback_data: botEnum.nextTradeChain.value + '_' + chain }
			],
			[
				{
					text: botEnum.manualBuy.key,
					callback_data: botEnum.manualBuy.value + '_' + chain
				},
				{
					text: botEnum.manualSell.key,
					callback_data: botEnum.manualSell.value + '_' + chain
				}
			]
		]
	}
}


export async function getBotGasPresetsMarkup(telegramId: string, chain: string) {
	const tSetting = await getSettings(telegramId, chain)
	return {
		inline_keyboard: [
			[
				{
					text: botEnum.menu.key,
					callback_data: botEnum.menu.value
				}
			],
			[
				{
					text: botEnum.prevSettingsGasPresetChain.key,
					callback_data: botEnum.prevSettingsGasPresetChain.value + '_' + chain
				},
				{
					text: '🛠 ' + chain.slice(0, 3).toUpperCase(),
					callback_data: botEnum.settingsChainLabel
				},
				{
					text: botEnum.nextSettingsGasPresetChain.key,
					callback_data: botEnum.nextSettingsGasPresetChain.value + '_' + chain
				}
			],
			[
				{
					text: (tSetting.gasPreset === 'slow' ? '✅ ' : '❌ ') + botEnum.settingsGasPresetSlow.key,
					callback_data: botEnum.settingsGasPresetSlow.value + '_' + chain
				},
				{
					text: ((tSetting.gasPreset || 'avg') === 'avg' ? '✅ ' : '❌ ') + botEnum.settingsGasPresetAverage.key,
					callback_data: botEnum.settingsGasPresetAverage.value + '_' + chain
				},
			],
			[
				{
					text: (tSetting.gasPreset === 'fast' ? '✅ ' : '❌ ') + botEnum.settingsGasPresetFast.key,
					callback_data: botEnum.settingsGasPresetFast.value + '_' + chain
				},
				{
					text: (tSetting.gasPreset === 'max' ? '✅ ' : '❌ ') + botEnum.settingsGasPresetMaxSpeed.key,
					callback_data: botEnum.settingsGasPresetMaxSpeed.value + '_' + chain
				},
			],
			[
				{
					text: "⬅️ Return",
					callback_data: botEnum.settings.value
				}
			],
		]
	}
}

// export async function getLotusSettingsMarkup(telegramId: string, chain: string) {
// 	const tSetting = await getLotusSettings(telegramId, chain)
// 	const nativeSymbol = await getNativeCurrencySymbol(chain)

// 	return {
// 		inline_keyboard: [
// 			[
// 				{
// 					text: botEnum.settings.key,
// 					callback_data: botEnum.settings.value
// 				}
// 			],
// 			[
// 				{
// 					text: botEnum.lotusDefaultBuyETHAmount.key + ' ' + nativeSymbol + ` (${tSetting.defaultBuyETHAmount})`,
// 					callback_data: botEnum.lotusDefaultBuyETHAmount.value + '_' + chain,
// 				}
// 			]
// 		]
// 	}
// }