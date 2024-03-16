import { Scenes } from 'telegraf';
import { botEnum } from '../../../constants/botEnum';
import { updateChatId, userVerboseLog } from '../../../service/app.user.service';
import { processError } from '../../../service/error';
import { getWallet } from '../../../service/wallet.service';
import { getNativeCurrencySymbol } from '../../../web3/chain.parameters';
import { approveTokenExt, getApprovalAddress, getTokenSimpleInfo } from '../../../web3/token.interaction';
import { TOKEN_SELL_X_ETH_AMOUNT_LISTENER, TOKEN_SELL_X_TOKEN_AMOUNT_LISTENER } from '../../../utils/common';
import { SceneStageService } from '../../../service/scene.stage.service';
import { TokenInfoModel } from '../../../models/token.info.model';
import { userSwapTokenForETH, userSwapTokenMaxTxForETH } from '../../../web3/dex.interaction';
import { userETHBalance } from '../../../web3/nativecurrency/nativecurrency.query';
import { getBestPathFromToken } from '../../../web3/dex/common/bestpath';

export const tokenSellXTokenAmountListener = new Scenes.BaseScene(TOKEN_SELL_X_TOKEN_AMOUNT_LISTENER);
export const tokenSellXETHAmountListener = new Scenes.BaseScene(TOKEN_SELL_X_ETH_AMOUNT_LISTENER);

// send a prompt message when user enters scene
tokenSellXTokenAmountListener.enter(async (ctx: any) => {
    const telegramId = ctx.from.id;
    try {
        await updateChatId(telegramId, ctx.chat.id)

        const tInfo = await TokenInfoModel.findById(ctx.scene.state.tokenInfoId)
        const chain = tInfo.chain
        const token = tInfo.address
        const w = await getWallet(telegramId);
        const tokenInfo = await getTokenSimpleInfo(telegramId, chain, token, w.address);

        const ret = await ctx.telegram.sendMessage(
            ctx.chat.id,
            `How much ${tokenInfo.symbol} do you want to sell? You can use % notation or a regular number.\n\n` +
            'If you type 100%, it will transfer the entire balance.\n' +
            `You currently have <b>${tokenInfo.balance} ${tokenInfo.symbol}</b>`,
            {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            }
        );

        const context = {
            msgBackupAmount: JSON.stringify(ret),
            amount: null,
            tokenInfoId: ctx.scene.state.tokenInfoId
        };

        await new SceneStageService().saveScene(telegramId, TOKEN_SELL_X_TOKEN_AMOUNT_LISTENER, JSON.stringify(context), new Date());
        await ctx.scene.leave();
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});

// listen for document messages once user is in the scene

// document.on(message("document"), ctx => {
// 	// ctx.update.message.document;
// });

async function sellTokenForETH(telegramId: string, ctx: any, token: any, amount: string) {
    let tx;
    try {
        tx = await userSwapTokenForETH(telegramId, token.chain, token.address, amount);
    } catch (err) {
        await processError(ctx, telegramId, err);
        return
    }
    const w = await getWallet(telegramId);
    const tokenInfo = await getTokenSimpleInfo(telegramId, token.chain, token.address, w.address);
    if (tx?.transactionHash) {
    } else {
        await ctx.reply(`You have <b>${tokenInfo.balance} 💦${tokenInfo.symbol}</b>`, {
            parse_mode: botEnum.PARSE_MODE_V2
        });
    }
}

// send a prompt message when user enters scene
tokenSellXETHAmountListener.enter(async (ctx: any) => {
    const telegramId = ctx.from.id;

    try {
        const tokenInfo = await TokenInfoModel.findById(ctx.scene.state.tokenInfoId)
        const chain = tokenInfo.chain
        const label = await getNativeCurrencySymbol(chain);
        const myETHBal = await userETHBalance(telegramId, chain);

        const ret = await ctx.telegram.sendMessage(ctx.chat.id, `How much ${label} do you want to get?\n` + `You currently have <b>${myETHBal} ${label}</b>`, {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: {
                force_reply: true
            }
        });

        const context = {
            amount: null,
            tokenInfoId: ctx.scene.state.tokenInfoId
        };

        await new SceneStageService().saveScene(telegramId, TOKEN_SELL_X_ETH_AMOUNT_LISTENER, JSON.stringify(context), new Date());
        await ctx.scene.leave();
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});

function tokenSellForXETHAction(bot: any) {
    bot.action(RegExp('^' + botEnum.sellTokenForXETH.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.sellTokenForXETH.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token sell for X ETH [${tokenInfoId}]`);

        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await ctx.scene.enter(TOKEN_SELL_X_ETH_AMOUNT_LISTENER, { tokenInfoId });
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

function tokenSellXTokenAction(bot: any) {
    bot.action(RegExp('^' + botEnum.sellTokenX.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.sellTokenX.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token sell X Token [${tokenInfoId}]`);

        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await ctx.scene.enter(TOKEN_SELL_X_TOKEN_AMOUNT_LISTENER, { tokenInfoId });
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

function tokenSell25Action(bot: any) {
    bot.action(RegExp('^' + botEnum.sellToken25Percent.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.sellToken25Percent.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token sell 25% Token [${tokenInfoId}]`);
        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await sellTokenForETH(telegramId, ctx, token, '25%');
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

function tokenSell50Action(bot: any) {
    bot.action(RegExp('^' + botEnum.sellToken50Percent.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.sellToken50Percent.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token sell 50% Token [${tokenInfoId}]`);

        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await sellTokenForETH(telegramId, ctx, token, '50%');
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

function tokenSell75Action(bot: any) {
    bot.action(RegExp('^' + botEnum.sellToken75Percent.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.sellToken75Percent.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token sell 75% Token [${tokenInfoId}]`);

        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await sellTokenForETH(telegramId, ctx, token, '75%');
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

function tokenSell100Action(bot: any) {
    bot.action(RegExp('^' + botEnum.sellToken100Percent.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.sellToken100Percent.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token sell 100% Token [${tokenInfoId}]`);

        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await sellTokenForETH(telegramId, ctx, token, '100%');
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

async function sellTokenMaxTxForETH(telegramId: string, ctx: any, tInfo: any) {
    const chain = tInfo.chain
    const token = tInfo.address
    const w = await getWallet(telegramId)

    let tx;
    try {
        tx = await userSwapTokenMaxTxForETH(telegramId, chain, token);
        // const amount = await amountSwapTokenMaxTxForETH(telegramId, chain, token, w)
        // await ctx.reply(`Max tx volume <b>${amount?.integerValue().toString() || '0'}</b>`, {
        //     parse_mode: botEnum.PARSE_MODE_V2
        // })
    } catch (err) {
        await processError(ctx, telegramId, err);
        return;
    }

    const tokenInfo = await getTokenSimpleInfo(telegramId, chain, token, w.address);
    if (tx?.transactionHash) {
    } else {
        await ctx.reply(`You have <b>${tokenInfo.balance} 💦${tokenInfo.symbol}</b>`, {
            parse_mode: botEnum.PARSE_MODE_V2
        });
    }
}

function tokenSellMaxTxAction(bot: any) {
    bot.action(RegExp('^' + botEnum.sellTokenMaxTX.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.sellTokenMaxTX.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token sell max tx [${tokenInfoId}]`);

        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await sellTokenMaxTxForETH(telegramId, ctx, token);
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

async function sellTokenApprove(telegramId: string, ctx: any, tokenInfo: any) {
    const chain = tokenInfo.chain
    const token = tokenInfo.address

    let tx;
    try {
        let factory
        try {
            const path = await getBestPathFromToken(chain, token)
            factory = path.factory
        } catch (err) {
        }

        if (factory) {
            const approvalAddress = await getApprovalAddress(telegramId, chain, token, factory)

            tx = await approveTokenExt(telegramId, chain, token, approvalAddress);
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
        return;
    }

    if (tx?.transactionHash) {
    } else {
    }

    return tx
}

function tokenSellApproveTxAction(bot: any) {
    bot.action(RegExp('^' + botEnum.sellApprove.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.sellApprove.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token sell approve [${tokenInfoId}]`)

        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await sellTokenApprove(telegramId, ctx, token)
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

export function registerTokenSell(bot: any) {
    tokenSellForXETHAction(bot);
    tokenSellXTokenAction(bot);
    tokenSell25Action(bot);
    tokenSell50Action(bot);
    tokenSell75Action(bot);
    tokenSell100Action(bot);
    tokenSellMaxTxAction(bot);
    tokenSellApproveTxAction(bot);
}

module.exports = { registerTokenSell, tokenSellXETHAmountListener, tokenSellXTokenAmountListener };
