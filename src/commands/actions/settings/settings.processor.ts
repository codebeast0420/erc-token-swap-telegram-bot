import { botEnum } from "../../../constants/botEnum"
import { updateChatId } from "../../../service/app.user.service"
import { chainGasPrice } from "../../../service/chain.service"
import { processError } from "../../../service/error"
import { ISceneResponse, SceneStageService } from "../../../service/scene.stage.service"
// import { updateLotusSettingsInfo, updateSettingsInfo } from "../../../service/settings.service"
import { updateSettingsInfo } from "../../../service/settings.service"
import { getWallet } from "../../../service/wallet.service"
import { INVALID_VALUE_SET, convertValue } from "../../../utils/common"
import { getSettingsMarkup } from "../../../utils/inline.markups"
import Logging from "../../../utils/logging"
import { getBotGeneralConfiguration, getLotusSettingText } from "../../../utils/messages"
import { getNativeCurrencySymbol } from "../../../web3/chain.parameters"
import { getETHBalance } from "../../../web3/nativecurrency/nativecurrency.query"
import { getBN } from "../../../web3/web3.operation"

export class SettingsListener {
	public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
		Logging.info(`SettingsListener.class processing scene message [${text}]`)
		await updateChatId(telegramId, ctx.chat.id)

		const context = JSON.parse(sceneContext.scene.text)

		try {
			if (context.inputType === 'max-gas-price') {
				await processMaxGasPrice(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'slippage') {
				await processSlippage(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'max-gas-limit') {
				await processMaxGasLimit(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'buy-max-marketcap') {
				await processBuyMarketCap(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'buy-min-liquidity') {
				await processBuyMinLiquidity(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'buy-max-liquidity') {
				await processBuyMaxLiquidity(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'buy-min-marketcap-liquidity') {
				await processBuyMinMarketCapLiquidity(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'buy-max-buy-tax') {
				await processBuyMaxBuyTax(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'buy-max-sell-tax') {
				await processBuyMaxSellTax(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'buy-gas-price') {
				await processBuyGasPrice(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'sell-high-price') {
				await processSellHighPrice(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'sell-low-price') {
				await processSellLowPrice(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'sell-high-amount') {
				await processSellHighAmount(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'sell-low-amount') {
				await processSellLowAmount(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'sell-gas-price') {
				await processSellGasPrice(telegramId, text, ctx, context)
			}
			else if (context.inputType === 'approve-gas-price') {
				await processApproveGasPrice(telegramId, text, ctx, context)
			} else if (context.inputType === 'lotus-default-buy-eth-amount') {
				// await processLotusDefaultETHAmount(telegramId, text, ctx, context)
			}
		} catch (err) {
			await processError(ctx, telegramId, err)
		}
	}
}

// ################################### BUY SETTINGS ###################################
async function processMaxGasPrice(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const gasPrice = chain === 'ethereum' ? '0' : await chainGasPrice(chain)
	const newMaxGas = parseFloat(text)
	if (isNaN(newMaxGas) || newMaxGas < parseFloat(gasPrice)) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nMinimum gas ${chain === 'ethereum' ? 'delta' : 'price'} is <b>${gasPrice} GWEI</b> now.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { maxGasPrice: newMaxGas })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'general')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ Max gas ${chain === 'ethereum' ? 'delta' : 'price'} set to <b>${newMaxGas} GWEI</b>. <b>By setting your Max Gas ${chain === 'ethereum' ? 'Delta' : 'Price'} to ${newMaxGas} GWEI, the bot will no longer frontrun rugs or copytrade transactions that require more than ${newMaxGas} GWEI ${chain === 'ethereum' ? 'in delta' : ''}.</b>`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})

		await new SceneStageService().deleteScene(telegramId)
	}
}

async function processSlippage(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const slippage = parseFloat(text)
	if (isNaN(slippage) || slippage < 0.1 || slippage > 100) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number <b>between 0.1% and 100%</b> inclusive. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { slippage: slippage })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'general')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ Slippage percentage set to <b>${slippage}%</b>!`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})

		await new SceneStageService().deleteScene(telegramId)
	}
}

async function processMaxGasLimit(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const idxm = text.indexOf('m')
	const idxk = text.indexOf('k')
	let n
	if (idxm > -1) {
		n = Math.floor(parseFloat(text.slice(0, idxm)) * 1000000)
	} else if (idxk > -1) {
		n = Math.floor(parseFloat(text.slice(0, idxk)) * 1000)
	} else {
		n = parseInt(text)
	}

	if (isNaN(n) || n < 100000 || n > 10000000) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number <b>greater than 100k</b> and <b>less than 10m</b>. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { maxGasLimit: n })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'general')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ Max gas limit set to <b>${n}</b>!`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})

		await new SceneStageService().deleteScene(telegramId)
	}
}

async function processBuyMarketCap(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const n = parseFloat(text)
	if (isNaN(n) || n < 1) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must provide a valid number <b>greater than $1</b>. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { buyMaxMC: n.toString() })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'buy')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ Market cap threshold set to <b>$${n}</b>!`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})

		await new SceneStageService().deleteScene(telegramId)
	}
}

async function processBuyMinLiquidity(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const n = parseFloat(text)
	if (isNaN(n)) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { buyMinLiquidity: n.toString() })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'buy')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ Minimum liquidity threshold set to <b>$${n}</b>!`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})
		await new SceneStageService().deleteScene(telegramId)
	}
}

async function processBuyMaxLiquidity(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const n = parseFloat(text)
	if (isNaN(n)) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { buyMaxLiquidity: n.toString() })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'buy')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ Maximum liquidity threshold set to <b>$${n}</b>!`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})
		await new SceneStageService().deleteScene(telegramId)
	}
}

async function processBuyMinMarketCapLiquidity(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const n = parseFloat(text)
	if (isNaN(n) || n <= 0) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must provide a valid number <b>greater than 0</b>. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { buyMinMCLiq: n.toString() })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'buy')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ Market cap/liquidity ratio threshold set to <b>${n}</b>!`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})
		await new SceneStageService().deleteScene(telegramId)
	}
}


async function processBuyMaxBuyTax(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const n = parseFloat(text)
	if (isNaN(n) || n < 0 || n > 99) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must provide a valid number <b>between 0% and 99%</b>. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { buyMaxBuyTax: n.toString() })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'buy')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ Buy tax threshold set to <b>${n}</b>%!`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})
		await new SceneStageService().deleteScene(telegramId)
	}
}

async function processBuyMaxSellTax(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const n = parseFloat(text)
	if (isNaN(n) || n < 0 || n > 99) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must provide a valid number <b>between 0% and 99%</b>. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { buyMaxSellTax: n.toString() })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'buy')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ Sell tax threshold set to <b>${n}</b>%!`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})
		await new SceneStageService().deleteScene(telegramId)
	}
}

async function processBuyGasPrice(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const gasPrice = chain === 'ethereum' ? '0' : await chainGasPrice(chain)
	const n = parseFloat(text)
	if (isNaN(n) || n < parseFloat(gasPrice)) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number <b>greater than or equal to ${gasPrice}</b>. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { buyGasPrice: n.toString() })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'buy')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ <b>Buy</b> gas ${chain === 'ethereum' ? 'delta' : 'price'} set to <b>${n}</b>`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})
		await new SceneStageService().deleteScene(telegramId)
	}
}

// ################################### SELL SETTINGS ###################################

async function processSellHighPrice(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const n = parseFloat(text)
	if (isNaN(n) || n < 0) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number <b>greater than 0</b>. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { sellHighPrice: n.toString() })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'sell')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ Sell (high) threshold set to <b>+${n}</b>% ~(${(n + 100) / 100}x)!`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})

		await new SceneStageService().deleteScene(telegramId)
	}
}

async function processSellLowPrice(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const n = parseFloat(text)
	if (isNaN(n) || n > 0 || n < -100) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number <b>less than 0 and greater than -100</b>. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { sellLowPrice: n.toString() })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'sell')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ Sell (low) threshold set to <b>${n}</b>% ~(${(n + 100) / 100}x)!`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})

		await new SceneStageService().deleteScene(telegramId)
	}
}

async function processSellHighAmount(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const n = parseFloat(text)
	if (isNaN(n) || n <= 0 || n > 100) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number <b>greater than 0 and less or equal to 100</b>. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { sellHighAmount: n.toString() })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'sell')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ Sell (high) amount set to <b>${n}</b>%!`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})

		await new SceneStageService().deleteScene(telegramId)
	}
}

async function processSellLowAmount(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain

	const n = parseFloat(text)
	if (isNaN(n) || n <= 0 || n > 100) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number <b>greater than 0 and less or equal to 100</b>. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { sellLowAmount: n.toString() })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'sell')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ Sell (low) amount set to <b>${n}</b>%!`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})

		await new SceneStageService().deleteScene(telegramId)
	}
}

async function processSellGasPrice(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const gasPrice = chain === 'ethereum' ? '0' : await chainGasPrice(chain)
	const n = parseFloat(text)
	if (isNaN(n) || n < parseFloat(gasPrice)) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number <b>greater than or equal to ${gasPrice}</b>. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { sellGasPrice: n.toString() })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'sell')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ <b>Sell</b> gas ${chain === 'ethereum' ? 'delta' : 'price'} set to <b>${n}</b>`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})

		await new SceneStageService().deleteScene(telegramId)
	}
}

async function processApproveGasPrice(telegramId: string, text: string, ctx: any, context: any) {
	const chain = context.chain
	const gasPrice = chain === 'ethereum' ? '0' : await chainGasPrice(chain)
	const n = parseFloat(text)
	if (isNaN(n) || n < parseFloat(gasPrice)) {
		await new SceneStageService().deleteScene(telegramId)
		throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number <b>greater than or equal to ${gasPrice}</b>. Please try again.`)
	} else {
		await updateSettingsInfo(telegramId, chain, { approveGasPrice: n.toString() })

		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getBotGeneralConfiguration(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getSettingsMarkup(telegramId, chain, 'approve')
		})

		await ctx.telegram.sendMessage(ctx.chat.id, `✅ <b>Approve</b> gas ${chain === 'ethereum' ? 'delta' : 'price'} set to <b>${n}</b>`, {
			parse_mode: botEnum.PARSE_MODE_V2
		})

		await new SceneStageService().deleteScene(telegramId)
	}
}

// async function processLotusDefaultETHAmount(telegramId: string, text: string, ctx: any, context: any) {
// 	const chain = context.chain

// 	const w = await getWallet(telegramId)
// 	const bal = await getETHBalance(telegramId, chain, w.address)
// 	const nativeSymbol = await getNativeCurrencySymbol(chain)
// 	const BN = getBN()

// 	const val = convertValue(bal, text, BN)

// 	if (BN(val).isNaN() || 0 >= parseFloat(val) || BN(val).gt(BN(bal))) {
// 		await new SceneStageService().deleteScene(telegramId)
// 		throw new Error(INVALID_VALUE_SET + `\nPlease input valid <b>${nativeSymbol}</b> amount.`)
// 	} else {
// 		await updateLotusSettingsInfo(telegramId, chain, { defaultBuyETHAmount: text })

// 		await ctx.telegram.editMessageText(ctx.chat.id, context.msgId, 0, await getLotusSettingText(telegramId, chain), {
// 			parse_mode: botEnum.PARSE_MODE_V2,
// 			reply_markup: await getLotusSettingsMarkup(telegramId, chain)
// 		})

// 		await ctx.telegram.sendMessage(ctx.chat.id, `✅ Default Buy <b>${nativeSymbol}</b> Amount <code>${text}</code>`, {
// 			parse_mode: botEnum.PARSE_MODE_V2
// 		})

// 		await new SceneStageService().deleteScene(telegramId)
// 	}
// }
