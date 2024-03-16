import { Scenes } from 'telegraf';
import { message } from 'telegraf/filters';
import { botEnum } from '../../../constants/botEnum';
import { chainGasPrice } from '../../../service/chain.service';
import { processError } from '../../../service/error';
import { getSettingsMarkup } from '../../../utils/inline.markups';
import Logging from '../../../utils/logging';
import { getBotGeneralConfiguration } from '../../../utils/messages';
import { updateSettingsInfo } from '../../../service/settings.service';
import { SEND_AMOUNT_PLACEHOLDER, SETTINGS_LISTENER } from '../../../utils/common';
import { SceneStageService } from '../../../service/scene.stage.service';
import { updateChatId } from '../../../service/app.user.service';
import { getWallet } from '../../../service/wallet.service';
import { getETHBalance } from '../../../web3/nativecurrency/nativecurrency.query';
import { getNativeCurrencySymbol } from '../../../web3/chain.parameters';
import { getBN } from '../../../web3/web3.operation';

export const settingsListener = new Scenes.BaseScene(SETTINGS_LISTENER);

// send a prompt message when user enters scene
settingsListener.enter(async (ctx: any) => {
	const telegramId = ctx.from.id;

	let ret

	try {
		const chain = ctx.scene.state.chain
		const msgBckId = ctx.scene.state.msgId

		const context = {
			inputType: ctx.scene.state.input_type,
			msgId: msgBckId,
			chain: chain,
		}

		await updateChatId(telegramId, ctx.chat.id)

		if (ctx.scene.state.input_type === 'max-gas-price') {
			const gasPrice = await chainGasPrice(ctx.scene.state.chain)
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired maximum gas ${ctx.scene.state.chain === 'ethereum' ? 'delta' : 'price'} (in GWEI). 1 GWEI = 10 ^ 9 wei. Minimum is ${ctx.scene.state.chain === 'ethereum' ? '0' : gasPrice} GWEI!`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});
			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();

		} else if (ctx.scene.state.input_type === 'max-gas-price-remove') {
			await updateSettingsInfo(telegramId, chain, { maxGasPrice: 0 })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ Max gas ${ctx.scene.state.chain === 'ethereum' ? 'delta' : 'price'} has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'general')
			})

		} else if (ctx.scene.state.input_type === 'slippage') {
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired slippage percentage. <b>Minimum</b> is <b>0.1</b>%. <b>Max</b> is <b>100</b>%!`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});
			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();

		} else if (ctx.scene.state.input_type === 'slippage-remove') {
			await updateSettingsInfo(telegramId, chain, { slippage: 100 })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ Custom slippage has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'general')
			})
		} else if (ctx.scene.state.input_type === 'max-gas-limit') {
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired maximum gas limit.\n<b>Minimum</b> is <b>1m</b>, <b>Maximum</b> is <b>10m</b>!`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});
			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();

		} else if (ctx.scene.state.input_type === 'max-gas-limit-remove') {
			await updateSettingsInfo(telegramId, chain, { maxGasLimit: 0 })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ Custom gas limit has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'general')
			})
		} else if (ctx.scene.state.input_type === 'buy-max-marketcap') {
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired market cap threshold in USD. <b>Minimum</b> is <b>$1</b>!\n\n⚠️ <i>If the token's market cap is higher than your set amount, auto buy will not be triggered.</i>`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});

			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();


		} else if (ctx.scene.state.input_type === 'buy-max-marketcap-remove') {
			await updateSettingsInfo(telegramId, chain, { buyMaxMC: '' })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ MC threshold has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'buy')
			})
		} else if (ctx.scene.state.input_type === 'buy-min-liquidity') {
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired minimum liquidity threshold in USD. Make sure this is lower than your max threshold!\n\n⚠️ If the token's liquidity is lower than your set amount, auto buy will not be triggered.`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});

			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();

		} else if (ctx.scene.state.input_type === 'buy-min-liquidity-remove') {
			await updateSettingsInfo(telegramId, chain, { buyMinLiquidity: '' })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ Minimum liquidity threshold has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'buy')
			})
		} else if (ctx.scene.state.input_type === 'buy-max-liquidity') {
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired maximum liquidity threshold in USD. Make sure this is higher than your min threshold!\n\n⚠️ <i>If the token's liquidity is higher than your set amount, auto buy will not be triggered.</i>`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});

			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();

		} else if (ctx.scene.state.input_type === 'buy-max-liquidity-remove') {
			await updateSettingsInfo(telegramId, chain, { buyMaxLiquidity: '' })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ Maximum liquidity threshold has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'buy')
			})
		} else if (ctx.scene.state.input_type === 'buy-min-marketcap-liquidity') {
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired market cap/liquidity ratio threshold. Greater than 0!\n\n⚠️ <i>If the token's MC/Liq ratio is lower than your set amount, auto buy will not be triggered.</i>`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});

			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();

		} else if (ctx.scene.state.input_type === 'buy-min-marketcap-liquidity-remove') {
			await updateSettingsInfo(telegramId, chain, { buyMinMCLiq: '' })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ MC/Liq ratio threshold has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'buy')
			})
		} else if (ctx.scene.state.input_type === 'buy-max-buy-tax') {
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired buy tax threshold!\n\n⚠️ <i>If the token's buy tax is higher than your set amount, auto buy will not be triggered.</i>`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});

			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();

		} else if (ctx.scene.state.input_type === 'buy-max-buy-tax-remove') {
			await updateSettingsInfo(telegramId, chain, { buyMaxBuyTax: '' })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ Max buy tax threshold has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'buy')
			})
		} else if (ctx.scene.state.input_type === 'buy-max-sell-tax') {
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired sell tax threshold!\n\n⚠️ <i>If the token's sell tax is higher than your set amount, auto buy will not be triggered.</i>`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});

			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();


		} else if (ctx.scene.state.input_type === 'buy-max-sell-tax-remove') {
			await updateSettingsInfo(telegramId, chain, { buyMaxSellTax: '' })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ Max sell tax threshold has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'buy')
			})
		} else if (ctx.scene.state.input_type === 'buy-gas-price') {
			const gasPrice = await chainGasPrice(ctx.scene.state.chain)
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired buy gas ${ctx.scene.state.chain === 'ethereum' ? 'delta' : 'price'} (in GWEI). 1 GWEI = 10 ^ 9 wei. <b>Minimum</b> is <b>${ctx.scene.state.chain === 'ethereum' ? '0' : gasPrice}</b>!`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});

			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();

		} else if (ctx.scene.state.input_type === 'buy-gas-price-remove') {
			await updateSettingsInfo(telegramId, chain, { buyGasPrice: '' })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ Custom buy gas ${ctx.scene.state.chain === 'ethereum' ? 'delta' : 'price'} has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'buy')
			})
		} else if (ctx.scene.state.input_type === 'sell-high-price') {
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired sell percentage. This is the <b>HIGH threshold</b> at which you'll auto sell for profits.\n\nExample: 2x would be 100.`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});

			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();

		} else if (ctx.scene.state.input_type === 'sell-high-price-remove') {
			await updateSettingsInfo(telegramId, chain, { sellHighPrice: '' })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ Auto sell (high) % has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'sell')
			})
		} else if (ctx.scene.state.input_type === 'sell-low-price') {
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired sell percentage. This is the <b>LOW threshold</b> at which you'll auto sell to prevent further losses (stop-loss). Example: 0.5x would be -50.`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});

			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();


		} else if (ctx.scene.state.input_type === 'sell-low-price-remove') {
			await updateSettingsInfo(telegramId, chain, { sellLowPrice: '' })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ Auto sell (low) % has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'sell')
			})
		} else if (ctx.scene.state.input_type === 'sell-high-amount') {
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired sell amount %. This represents how much of your holdings you want to sell when sell-high is triggered.\n\nExample: If you want to sell half of your bag, type 50.`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});

			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();


		} else if (ctx.scene.state.input_type === 'sell-high-amount-remove') {
			await updateSettingsInfo(telegramId, chain, { sellHighAmount: '' })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ Auto sell (high-amount) % has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'sell')
			})
		} else if (ctx.scene.state.input_type === 'sell-low-amount') {
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired sell amount %. This represents how much of your holdings you want to sell when sell-low is triggered.\n\nExample: If you want to sell half of your bag, type 50.`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});

			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();


		} else if (ctx.scene.state.input_type === 'sell-low-amount-remove') {
			await updateSettingsInfo(telegramId, chain, { sellLowAmount: '' })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ Auto sell (low-amount) % has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'sell')
			})
		} else if (ctx.scene.state.input_type === 'sell-gas-price') {
			const gasPrice = await chainGasPrice(chain)
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired sell gas ${chain === 'ethereum' ? 'delta' : 'price'} (in GWEI). 1 GWEI = 10 ^ 9 wei. Minimum is ${chain === 'ethereum' ? '0' : gasPrice}!`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});

			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();


		} else if (ctx.scene.state.input_type === 'sell-gas-price-remove') {
			await updateSettingsInfo(telegramId, chain, { sellGasPrice: '' })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ Custom sell gas ${chain === 'ethereum' ? 'delta' : 'price'} has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			});

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'sell')
			})
		} else if (ctx.scene.state.input_type === 'approve-gas-price') {
			const gasPrice = await chainGasPrice(chain)
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired <b>approve</b> gas ${chain === 'ethereum' ? 'delta' : 'price'} (in GWEI). 1 GWEI = 10 ^ 9 wei. <b>Minimum</b> is <b>${chain === 'ethereum' ? '0' : gasPrice}</b>!`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true
				}
			});

			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();

		} else if (ctx.scene.state.input_type === 'approve-gas-price-remove') {
			await updateSettingsInfo(telegramId, chain, { approveGasPrice: '' })

			await ctx.telegram.sendMessage(ctx.chat.id, `❌ Custom approve gas ${chain === 'ethereum' ? 'delta' : 'price'} has been deleted!`, {
				parse_mode: botEnum.PARSE_MODE_V2
			})

			await ctx.scene.leave()

			await ctx.telegram.editMessageText(ctx.chat.id, msgBckId, 0, await getBotGeneralConfiguration(telegramId, chain), {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: await getSettingsMarkup(telegramId, chain, 'approve')
			})
		} else if (ctx.scene.state.input_type === 'lotus-default-buy-eth-amount') {
			const w = await getWallet(telegramId)
			const bal = await getETHBalance(telegramId, chain, w.address)
			const nativeSymbol = await getNativeCurrencySymbol(chain)
			const BN = getBN()
			ret = await ctx.telegram.sendMessage(ctx.chat.id, `You have <code>${parseFloat(BN(bal).toFixed(4))}</code> <b>${nativeSymbol}</b>\nPlease input <b>${nativeSymbol} amount</b> to buy <b>by default</b> in <b>Lotus</b>`, {
				parse_mode: botEnum.PARSE_MODE_V2,
				reply_markup: {
					force_reply: true,
					input_field_placeholder: SEND_AMOUNT_PLACEHOLDER
				}
			});

			await new SceneStageService().saveScene(telegramId, SETTINGS_LISTENER, JSON.stringify(context), new Date());
			await ctx.scene.leave();

		}
	} catch (err) {
		await processError(ctx, telegramId, err)
		await ctx.scene.leave()
	}

	// if (ret) {
	//     settingsInputContext[telegramId] = {
	//         ...settingsInputContext[telegramId],
	//         [ctx.scene.state.input_type]: {
	//             msgBackup: JSON.stringify(ret)
	//         }
	//     };
	// }
});
