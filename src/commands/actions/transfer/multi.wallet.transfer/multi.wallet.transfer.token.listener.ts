import { Scenes } from 'telegraf';
import { botEnum } from '../../../../constants/botEnum';
import { getAddressById } from '../../../../service/wallet.service';
import { getMultiWalletPaginationDetails, IPageAndLimit } from '../../../../utils/global.functions';
import Logging from '../../../../utils/logging';
import { getTokenSimpleInfo, userTransferAdditional } from '../../../../web3/token.interaction';
import { getBN, isValidAddress } from '../../../../web3/web3.operation';
import { MULTI_WALLET_TRANSFER_TOKEN_LISTENER, SEND_AMOUNT_PLACEHOLDER } from '../../../../utils/common';
import { ISceneResponse, SceneStageService } from '../../../../service/scene.stage.service';
import { processError } from '../../../../service/error';

const listener = new Scenes.BaseScene(MULTI_WALLET_TRANSFER_TOKEN_LISTENER);


listener.enter(async (ctx: any) => {
    const telegramId = ctx.update.callback_query.from.id;
    try {
        const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);
        const address = await getAddressById(pageLimit.addressId);

        await ctx.telegram.sendMessage(ctx.chat.id, `which token address is this? Copy paste the contract as a reply`, {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: {
                force_reply: true,
                input_field_placeholder: '0x62B65f42Fa6A...'
            }
        });

        const context = {
            initiator: JSON.stringify(ctx.update.callback_query),
            address: address,
            pageLimit: pageLimit,
            tokenAddress: null,
            tokenInfo: null,
            balance: '',
            amountPercent: null,
            amountNumber: null,
            chain: pageLimit.chain
        };

        await new SceneStageService().saveScene(telegramId, MULTI_WALLET_TRANSFER_TOKEN_LISTENER, JSON.stringify(context), new Date());
        await ctx.scene.leave();
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});

export class MultiWalletTransferTokenListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`MultiWalletTransferTokenListener.class processing scene message [${text}]`)
        const context = JSON.parse(sceneContext.scene.text)

        // process token address
        if (context.tokenAddress == null) {
            await processTokenAddress(ctx, telegramId, text.toLowerCase(), context);
        }

        // process amount to send
        else if (context.amountPercent == null && context.amountNumber == null) {
            await processAmountToSend(ctx, telegramId, text, context);
        }

        // process  transaction
        else if (context.toAddress == null) {
            await processTransaction(ctx, telegramId, text.toLowerCase(), context);
        }
    }
}

async function processTokenAddress(ctx: any, telegramId: string, tokenAddress: string, context: any) {
    try {
        const chain = context.chain
        const tokenInfo = await getTokenSimpleInfo(telegramId, chain, tokenAddress, context.address.address);
        const symbol = tokenInfo.symbol;
        context.tokenInfo = tokenInfo;
        if (tokenInfo.balance == 0) {
            await ctx.telegram.sendMessage(ctx.chat.id, `❌ Insufficient balance to perform this transfer.`, {
                parse_mode: botEnum.PARSE_MODE_V2
            });
            await new SceneStageService().deleteScene(telegramId)
            return;
        } else {
            await ctx.telegram.sendMessage(
                ctx.chat.id,
                `How much ${symbol} do you want to send? You can use % notation or a regular number.\n\n` +
                'If you type 100%, it will transfer the entire balance.\n' +
                `You currently have ${tokenInfo.balance} ${symbol}`,
                {
                    parse_mode: botEnum.PARSE_MODE_V2,
                    reply_markup: {
                        force_reply: true,
                        input_field_placeholder: SEND_AMOUNT_PLACEHOLDER,
                    }
                }
            );
            context.tokenAddress = tokenAddress;
            context.tokenInfo = tokenInfo;

            await new SceneStageService().saveScene(telegramId, MULTI_WALLET_TRANSFER_TOKEN_LISTENER, JSON.stringify(context), new Date());
        }
    } catch (e) {
        Logging.info(e);
        await ctx.telegram.sendMessage(ctx.chat.id, `Please use a valid token address.`, {
            parse_mode: botEnum.PARSE_MODE_V2
        });
        await new SceneStageService().deleteScene(telegramId)
        return true;
    }
}

async function processAmountToSend(ctx: any, telegramId: string, amount: string, context: any) {
    const percentExpression = /^\d+(\.\d+)?\%$/;
    const numberExpression = /^\d+(\.\d+)?$/;
    const spaceExpression = /^\s+|\s+$/gm;

    const BN = getBN();

    if (percentExpression.test(amount.replace(spaceExpression, ''))) {
        const percent = parseFloat(amount.replace('%', ''));
        if (percent < 0.001 || percent > 100) {
            await ctx.telegram.sendMessage(ctx.chat.id, 'you must use a valid number <b>between 0.001 and 100</b> inclusive. Please try again', { parse_mode: botEnum.PARSE_MODE_V2 });
            await new SceneStageService().deleteScene(telegramId)
            return;
        }

        try {
            await ctx.deleteMessage();
        } catch { }

        const amountToSend = BN(amount.replace('%', '')).div(BN(100)).times(BN(context.tokenInfo.balance)).toString();
        await ctx.telegram.sendMessage(ctx.chat.id, `To whom do you want to send ${amountToSend} ${context.tokenInfo.symbol}`, {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: {
                force_reply: true,
                input_field_placeholder: '0x62B65f42Fa6Adfd18169E17A50aDd303bb3A644A'
            }
        });

        context.amountPercent = amount;
        await new SceneStageService().saveScene(telegramId, MULTI_WALLET_TRANSFER_TOKEN_LISTENER, JSON.stringify(context), new Date());
    } else if (numberExpression.test(amount)) {
        const amountNumber = parseFloat(amount);
        if (amountNumber < 0.001) {
            await ctx.telegram.sendMessage(ctx.chat.id, 'you must use a valid number <b>greater than 0.001 </b>and inclusive. Please try again', { parse_mode: botEnum.PARSE_MODE_V2 });
            await new SceneStageService().deleteScene(telegramId)

            return;
        } else if (BN(amount) > BN(context.tokenInfo.balance)) {
            await ctx.telegram.sendMessage(ctx.chat.id, '❌ Insufficient balance to perform this transfer. Make sure your wallet owns exactly the amount you want to transfer.', {
                parse_mode: botEnum.PARSE_MODE_V2
            });
            await new SceneStageService().deleteScene(telegramId)
        }

        try {
            await ctx.deleteMessage();
        } catch { }

        await ctx.telegram.sendMessage(ctx.chat.id, `To whom do you want to send ${amount} ${context.tokenInfo.symbol}`, {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: {
                force_reply: true,
                input_field_placeholder: '0x62B65f42Fa6Adfd18169E17A50aDd303bb3A644A'
            }
        });
        context.amountNumber = amount;
        await new SceneStageService().saveScene(telegramId, MULTI_WALLET_TRANSFER_TOKEN_LISTENER, JSON.stringify(context), new Date());
    }
}

async function processTransaction(ctx: any, telegramId: string, address: string, context: any) {

    const BN = getBN();

    try {
        if (isValidAddress(address)) {
            let amount;
            if (context.amountNumber != null) {
                amount = context.amountNumber;
            } else {
                amount = BN(context.amountPercent.replace('%', '')).div(BN(100)).times(BN(context.tokenInfo.balance)).toString();
            }

            const chain = context.chain
            const tx = await userTransferAdditional(
                telegramId,
                chain,
                context.tokenAddress,
                address,
                amount.toString(),
                context.address,
                context.tokenInfo
            );
        }
    } catch (e) {
        Logging.info(e);
        await ctx.telegram.sendMessage(ctx.chat.id, `Please use a valid receiver address.`, {
            parse_mode: botEnum.PARSE_MODE_V2
        });
        await new SceneStageService().deleteScene(telegramId)
        return true;
    }
}

export default listener;
