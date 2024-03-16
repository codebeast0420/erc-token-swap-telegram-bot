import { botEnum } from '../constants/botEnum';
import { updateChatId, userVerboseLog } from '../service/app.user.service';
import { getAllChains } from '../service/chain.service';
import { getSelectedChain, selectChain } from '../service/connected.chain.service';
import { processError } from '../service/error';
import { TRANSFER_NATIVE_CURRENCY_LISTENER, TRANSFER_TOKEN_TOKEN_LISTENER } from '../utils/common';
import { getTransferMarkup } from '../utils/inline.markups';
import { getChainStatus, getTransferMessage } from '../utils/messages';
import { getNativeCurrencySymbol } from '../web3/chain.parameters';
import { userETHBalance } from '../web3/nativecurrency/nativecurrency.query';
import { getBN } from '../web3/web3.operation';

const invokeTransfer = async (ctx: any) => {
	const telegramId = ctx.from.id;

	try {
		let address

		try {
			address = ctx.match[1];
		} catch (err) { }

		if (address === undefined) {
			await userVerboseLog(telegramId, '/transfer');
		} else {
			await userVerboseLog(telegramId, '/transfer with multiwallet');
		}

		await updateChatId(telegramId, ctx.chat.id);
		const chain = await getSelectedChain(telegramId);

		await ctx.telegram.sendMessage(ctx.chat.id, await getTransferMessage(telegramId, chain, address), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getTransferMarkup(telegramId, chain, address)
		});
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

const refreshTransfer = async (ctx: any, telegramId: string, chain: string) => {
	try {
		await userVerboseLog(telegramId, `/transfer switch to ${chain}`);

		await updateChatId(telegramId, ctx.chat.id);
		await selectChain(telegramId, chain)

		await ctx.telegram.editMessageText(telegramId, ctx.update.callback_query?.message.message_id, 0, await getTransferMessage(telegramId, chain), {
			parse_mode: botEnum.PARSE_MODE_V2,
			reply_markup: await getTransferMarkup(telegramId, chain)
		});
	} catch (err) {
		await processError(ctx, telegramId, err);
	}
};

module.exports = (bot: any) => {
	bot.command(RegExp('^' + botEnum.transfer.value + '_?(.+)?'), invokeTransfer);
	bot.action(RegExp('^' + botEnum.transfer.value + '_?(.+)?'), invokeTransfer);

	bot.action(RegExp('^' + botEnum.prevTransferChain.value + '_.+'), async (ctx: any) => {
		const telegramId = ctx.from.id;
		const chain = ctx.update.callback_query.data.slice(botEnum.prevTransferChain.value.length + 1)
		const chains = getAllChains()

		const idx = chains.indexOf(chain)
		const chainTo = idx < 0 ? chains[0] : chains[(idx + chains.length - 1) % chains.length]

		await refreshTransfer(ctx, telegramId, chainTo)
	});

	bot.action(RegExp('^' + botEnum.nextTransferChain.value + '_.+'), async (ctx: any) => {
		const telegramId = ctx.from.id;
		const chain = ctx.update.callback_query.data.slice(botEnum.nextTransferChain.value.length + 1)
		const chains = getAllChains()

		const idx = chains.indexOf(chain)
		const chainTo = idx < 0 ? chains[0] : chains[(idx + 1) % chains.length]

		await refreshTransfer(ctx, telegramId, chainTo)
	});

	bot.action(RegExp('^' + botEnum.transferNativeCurrency.value + '_.+'), async (ctx: any) => {
		const telegramId = ctx.from.id;
		const chain = ctx.update.callback_query.data.slice(botEnum.transferNativeCurrency.value.length + 1)

		try {
			await userVerboseLog(telegramId, 'transfer native currency');

			const ethBal = await userETHBalance(telegramId, chain);
			const BN = getBN();

			if (BN(ethBal).eq(0)) {
				await ctx.telegram.sendMessage(ctx.chat.id, `❌ You have no ${await getNativeCurrencySymbol(chain)}`);
			} else {
				await ctx.scene.enter(TRANSFER_NATIVE_CURRENCY_LISTENER, { input_type: 'transfer_nativecurrency', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
			}
		} catch (err) {
			await processError(ctx, telegramId, err);
		}
	});

	bot.action(RegExp('^' + botEnum.transferToken.value + '_.+'), async (ctx: any) => {
		const telegramId = ctx.from.id;
		const chain = ctx.update.callback_query.data.slice(botEnum.transferToken.value.length + 1)

		try {
			await userVerboseLog(telegramId, 'transfer token');
			await ctx.scene.enter(TRANSFER_TOKEN_TOKEN_LISTENER, { input_type: 'transfer_token', msgId: ctx.update.callback_query?.message.message_id, chain: chain });
		} catch (err) {
			await processError(ctx, telegramId, err)
		}
	});
};
