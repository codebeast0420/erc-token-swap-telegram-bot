import { message } from 'telegraf/filters';
import { botEnum } from '../../constants/botEnum';
import { getSelectedChain } from '../../service/connected.chain.service';
import { processContractAddress } from '../../service/token.service';
import { postStartAction } from './default.action';
import { userVerboseLog } from '../../service/app.user.service';
import { processError } from '../../service/error';
import { getTokenPasteMarkup } from '../../utils/inline.markups';
import { AffiliateService } from '../../service/affiliate.service';
import { getNativeCurrencySymbol } from '../../web3/chain.parameters';
import { ISceneResponse, SceneStageService } from '../../service/scene.stage.service';
import { DEFAULT_SCENE_TIMEOUT } from '../../utils/common';
import { queryTokenInfoFromPairOnChain } from '../../web3/multicall';
import { TokenInfoModel } from '../../models/token.info.model';

module.exports = (bot: any) => {
	bot.on(message('text'), async (ctx: any) => {
		const telegramId = ctx.from.id

		try {
			await userVerboseLog(telegramId, `processing text message: ${ctx.message.text}`)
			const tickStart = (new Date()).getTime()

			let processedByScene = false;
			const scene: ISceneResponse = await new SceneStageService().getSceneStage(telegramId);
			if (scene != null && scene.appUser != null && scene.scene != null) {
				const sceneStageCreatedDate = scene.scene.date.setSeconds(scene.scene.date.getSeconds() + DEFAULT_SCENE_TIMEOUT) // add 60 secs
				const createdDate = new Date(sceneStageCreatedDate)
				if (createdDate >= new Date()) {
					processedByScene = true;
					await new SceneStageService().processSceneStage(telegramId, ctx.message.text, scene, ctx)
				} else {
					await new SceneStageService().deleteScene(telegramId)
				}
			}

			if (/^https?:\/\/(?:www\.)?chartai\.tech/.test(ctx.message.text) && !processedByScene) {
				await new AffiliateService().processSubscription(ctx, telegramId, ctx.message.text)
			}

			let chain = await getSelectedChain(telegramId)
			if (chain === '') {
				// milk casual oyster clay spice give device salmon luggage elder inspire drink
				postStartAction(ctx)
				return
			}

			let textWith = ctx.message.text.toLowerCase()
			let tokenAddress = textWith
			let newChain

			if (/^https?:\/\/(?:www\.)?dextools\.io/.test(textWith)) {
				tokenAddress = ''
				let splitted = textWith.split('/')
				const idx = splitted?.indexOf('pair-explorer')
				if (idx > 0 && idx < splitted?.length - 1) {
					const chainMap = {
						['ether']: 'ethereum',
						['bnb']: 'bsc',
						['arbitrum']: 'arbitrum',
					}
					newChain = chainMap[splitted[idx - 1]]
					const addr = splitted[idx + 1].split('?')[0]
					tokenAddress = await queryTokenInfoFromPairOnChain(telegramId, newChain, addr.toLowerCase())
				} else {
					throw new Error('Unknown dextools URL')
				}
			} else if (/^https?:\/\/(?:www\.)?dexscreener\.com/.test(textWith)) {
				tokenAddress = ''

				let splitted = textWith.split('/')
				if (splitted.length > 4) {
					const chainMap = {
						['ethereum']: 'ethereum',
						['bsc']: 'bsc',
						['arbitrum']: 'arbitrum',
					}
					newChain = chainMap[splitted[3]] ? chainMap[splitted[3]] : splitted[3]

					const addr = splitted[4].split('?')[0]

					tokenAddress = await queryTokenInfoFromPairOnChain(telegramId, newChain, addr.toLowerCase())
					if (!tokenAddress?.startsWith('0x')) tokenAddress = addr
				}
			} else if (/^https?:\/\/(?:www\.)?poocoin\.app/.test(textWith)) { // https://poocoin.app/tokens/0xd5ffab1841b9137d5528ed09d6ebb66c3088aede
				tokenAddress = ''

				let splitted = textWith.split('/')
				const idx = splitted?.indexOf('tokens')
				if (idx > 0 && idx < splitted?.length - 1) {
					const addr = splitted[idx + 1].split('?')[0]
					tokenAddress = addr.toLowerCase()
				} else {
					throw new Error('Unknown poocoin.app URL')
				}
			}

			if (tokenAddress.startsWith('0x') && !processedByScene) {
				await processContractAddress(ctx, telegramId, chain, tokenAddress, newChain, tickStart)
			}

			else if (/0x[a-fA-F0-9]{40}/g.test(tokenAddress) && !processedByScene) {
				const matches = tokenAddress.match(/0x[a-fA-F0-9]{40}/g);
				for (let ca of matches)
					processContractAddress(ctx, telegramId, chain, ca, newChain, tickStart)
			}

			else {
				// await ctx.telegram.sendMessage(ctx.chat.id, text, {
				//     parse_mode: botEnum.PARSE_MODE_V2
				// })
			}
		} catch (err) {
			await processError(ctx, telegramId, err)
		}
	})

	bot.action(RegExp('^' + botEnum.switch_to_sell.value + '_.+'), async (ctx: any) => {
		const telegramId = ctx.from.id

		try {
			await userVerboseLog(telegramId, 'switching to sell mode')
			const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.switch_to_sell.value.length + 1)

			const tokenDB = await TokenInfoModel.findById(tokenInfoId)
			const chain = tokenDB.chain
			const symbol = await getNativeCurrencySymbol(chain)

			const msg = ctx.update.callback_query.message

			// const regex = /CA: (.*)\n/;
			// const match = msg.text.match(regex);

			await ctx.telegram.editMessageReplyMarkup(
				msg.chat.id, msg.message_id, undefined,
				await getTokenPasteMarkup(telegramId, 'sell', chain, symbol, tokenDB.symbol, tokenDB.address)
			)
		} catch (err) {
			await processError(ctx, telegramId, err)
		}
	})

	bot.action(RegExp('^' + botEnum.switch_to_buy.value + '_.+'), async (ctx: any) => {
		const telegramId = ctx.from.id

		try {
			await userVerboseLog(telegramId, 'switching to buy mode')
			const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.switch_to_buy.value.length + 1)

			const tokenDB = await TokenInfoModel.findById(tokenInfoId)
			const chain = tokenDB.chain
			const symbol = await getNativeCurrencySymbol(chain)

			const msg = ctx.update.callback_query.message

			// const regex = /CA: (.*)\n/;
			// const match = msg.text.match(regex);

			await ctx.telegram.editMessageReplyMarkup(
				msg.chat.id, msg.message_id, undefined,
				await getTokenPasteMarkup(telegramId, 'buy', chain, symbol, tokenDB.symbol, tokenDB.address)
			)
		} catch (err) {
			await processError(ctx, telegramId, err)
		}
	})
}


