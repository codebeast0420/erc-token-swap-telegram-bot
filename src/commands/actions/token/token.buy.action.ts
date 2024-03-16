import { Scenes } from 'telegraf';
import { botEnum } from '../../../constants/botEnum';
import { updateChatId, userVerboseLog } from '../../../service/app.user.service';
import { processError } from '../../../service/error';
import { getWallet } from '../../../service/wallet.service';
import { getNativeCurrencySymbol } from '../../../web3/chain.parameters';
import { getTokenSimpleInfo } from '../../../web3/token.interaction';
import { getBN } from '../../../web3/web3.operation';
import { SEND_AMOUNT_PLACEHOLDER, TOKEN_BUY_X_AMOUNT_LISTENER, TOKEN_BUY_X_TOKEN_AMOUNT_LISTENER } from '../../../utils/common';
import { SceneStageService } from '../../../service/scene.stage.service';
import { TokenInfoModel } from '../../../models/token.info.model';
import { userETHBalance } from '../../../web3/nativecurrency/nativecurrency.query';
import { userSwapETHForTokens, userSwapETHForTokensApeMax } from '../../../web3/dex.interaction';

export const tokenBuyXETHAmountListener = new Scenes.BaseScene(TOKEN_BUY_X_AMOUNT_LISTENER);
export const tokenBuyXTokenAmountListener = new Scenes.BaseScene(TOKEN_BUY_X_TOKEN_AMOUNT_LISTENER);

// send a prompt message when user enters scene
tokenBuyXETHAmountListener.enter(async (ctx: any) => {
    const telegramId = ctx.from.id

    try {
        await updateChatId(telegramId, ctx.chat.id)

        const tokenInfo = await TokenInfoModel.findById(ctx.scene.state.tokenInfoId)
        if (tokenInfo === null) {
            await ctx.telegram.sendMessage(
                ctx.chat.id,
                `❌ Not valid token`,
                {
                    parse_mode: botEnum.PARSE_MODE_V2
                }
            )
            await ctx.scene.leave()
            return
        }

        const label = await getNativeCurrencySymbol(tokenInfo.chain)
        const myETHBal = await userETHBalance(telegramId, tokenInfo.chain)

        const ret = await ctx.telegram.sendMessage(
            ctx.chat.id,
            `How much ${label} do you want to buy by? You can use % notation or a regular number.\n\n` +
            'If you type 100%, it will transfer the entire balance.\n' +
            `You currently have <b>${myETHBal} ${label}</b>`,
            {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true,
                    input_field_placeholder: SEND_AMOUNT_PLACEHOLDER,
                }
            }
        );

        const context = {
            msgBackupAmount: JSON.stringify(ret),
            amount: null,
            tokenInfoId: ctx.scene.state.tokenInfoId
        };

        await new SceneStageService().saveScene(telegramId, TOKEN_BUY_X_AMOUNT_LISTENER, JSON.stringify(context), new Date())
        await ctx.scene.leave()
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});

async function buyTokenByETH(telegramId: string, ctx: any, tokenInfo: any, amount: string) {
    let tx;
    try {
        tx = await userSwapETHForTokens(telegramId, tokenInfo.chain, tokenInfo.address, amount);
    } catch (err) {
        await processError(ctx, telegramId, err);
        return;
    }
    const w = await getWallet(telegramId);
    const tInfo = await getTokenSimpleInfo(telegramId, tokenInfo.chain, tokenInfo.address, w.address);
    if (tx?.transactionHash) {
    } else {
        await ctx.reply(`You have <b>${tInfo.balance} ${tInfo.symbol}</b>`, {
            parse_mode: botEnum.PARSE_MODE_V2
        });
    }
}

// send a prompt message when user enters scene
tokenBuyXTokenAmountListener.enter(async (ctx: any) => {
    const telegramId = ctx.from.id;
    try {
        const tokenInfo = await TokenInfoModel.findById(ctx.scene.state.tokenInfoId)

        if (tokenInfo === null) {
            await ctx.telegram.sendMessage(
                ctx.chat.id,
                '❌ Not valid token',
                {
                    parse_mode: botEnum.PARSE_MODE_V2
                }
            );
            await ctx.scene.leave()
            return
        }

        const w = await getWallet(telegramId);
        const tInfo = await getTokenSimpleInfo(telegramId, tokenInfo.chain, tokenInfo.address, w.address);

        const ret = await ctx.telegram.sendMessage(
            ctx.chat.id,
            `How much ${tInfo.symbol} do you want to buy? You can use % notation or a regular number.\n\n` +
            'If you type 100%, it will transfer the entire balance.\n' +
            `You currently have <b>${tInfo.balance} ${tInfo.symbol}</b>`,
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

        await new SceneStageService().saveScene(telegramId, TOKEN_BUY_X_TOKEN_AMOUNT_LISTENER, JSON.stringify(context), new Date());
        await ctx.scene.leave();
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});

async function tokenBuyXETHAction(bot: any) {
    bot.action(RegExp('^' + botEnum.buyXETH.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.buyXETH.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token buy by X ETH [${tokenInfoId}]`);

        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await ctx.scene.enter(TOKEN_BUY_X_AMOUNT_LISTENER, { tokenInfoId: tokenInfoId })
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

function tokenBuyXTokenAction(bot: any) {
    bot.action(RegExp('^' + botEnum.buyXToken.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.buyXToken.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token buy X Token [${tokenInfoId}]`);

        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await ctx.scene.enter(TOKEN_BUY_X_TOKEN_AMOUNT_LISTENER, { tokenInfoId: tokenInfoId })
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

function tokenBuy001ETHAction(bot: any) {
    bot.action(RegExp('^' + botEnum.buy001ETH.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.buy001ETH.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token buy by 0.01 ETH [${tokenInfoId}]`);
        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await buyTokenByETH(telegramId, ctx, token, '0.01');
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

function tokenBuy005ETHAction(bot: any) {
    bot.action(RegExp('^' + botEnum.buy005ETH.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.buy005ETH.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token buy by 0.05 ETH [${tokenInfoId}]`);

        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await buyTokenByETH(telegramId, ctx, token, '0.05');
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

function tokenBuy010ETHAction(bot: any) {
    bot.action(RegExp('^' + botEnum.buy010ETH.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.buy010ETH.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token buy by 0.1 ETH [${tokenInfoId}]`);

        const token = await TokenInfoModel.findById(tokenInfoId)

        if (token !== null) {
            await buyTokenByETH(telegramId, ctx, token, '0.10');
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

function tokenBuy020ETHAction(bot: any) {
    bot.action(RegExp('^' + botEnum.buy020ETH.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.buy020ETH.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token buy by 0.2 ETH [${tokenInfoId}]`);

        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await buyTokenByETH(telegramId, ctx, token, '0.20');
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

function tokenBuy050ETHAction(bot: any) {
    bot.action(RegExp('^' + botEnum.buy050ETH.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }

        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.buy050ETH.value.length + 1)

        const telegramId = ctx.from.id
        await userVerboseLog(telegramId, `token buy by 0.5 ETH [${tokenInfoId}]`)

        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await buyTokenByETH(telegramId, ctx, token, '0.50');
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

function tokenBuy100ETHAction(bot: any) {
    bot.action(RegExp('^' + botEnum.buy100ETH.value + '_.+'), async (ctx: any) => {
        try {
            await ctx.answerCbQuery()
        } catch (err) { }
        
        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.buy100ETH.value.length + 1)

        const telegramId = ctx.from.id;
        await userVerboseLog(telegramId, `token buy by 1 ETH [${tokenInfoId}]`);

        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await buyTokenByETH(telegramId, ctx, token, '1.00');
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

async function buyTokenApeMax(telegramId: string, ctx: any, tokenInfo: any) {
    const BN = getBN();

    let tx;
    try {
        // const w = await getWallet(telegramId)
        // const decimals = await getNativeCurrencyDecimal(chain)
        // const ethBal = await getETHBalance(telegramId, chain, w.address)
        // const amn = await amountSwapETHForTokenApeMax(telegramId, chain, token, w, undefined, undefined)
        // await ctx.reply(`ape max ETH value is ${amn.div(BN(`1e${decimals}`))}, my ETH ${ethBal.toString()}`)
        // return
        tx = await userSwapETHForTokensApeMax(telegramId, tokenInfo.chain, tokenInfo.address)
    } catch (err) {
        await processError(ctx, telegramId, err);
        return;
    }
    const w = await getWallet(telegramId);
    const tInfo = await getTokenSimpleInfo(telegramId, tokenInfo.chain, tokenInfo.address, w.address);
    if (tx?.transactionHash) {
    } else {
        await ctx.reply(`You have <b>${tInfo.balance} ${tInfo.symbol}</b>`, {
            parse_mode: botEnum.PARSE_MODE_V2
        });
    }
}

function tokenBuyApeMaxETHAction(bot: any) {
    bot.action(RegExp('^' + botEnum.buyApeMax.value + '_.+'), async (ctx: any) => {
        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.buyApeMax.value.length + 1)

        const telegramId = ctx.from.id
        await userVerboseLog(telegramId, `token buy ape max [${tokenInfoId}]`)

        const token = await TokenInfoModel.findById(tokenInfoId)
        if (token !== null) {
            await buyTokenApeMax(telegramId, ctx, token);
        } else {
            await ctx.reply(`❌ Not valid token`);
        }
    });
}

export function registerTokenBuy(bot: any) {
    tokenBuyXETHAction(bot);
    tokenBuyXTokenAction(bot);
    tokenBuy001ETHAction(bot);
    tokenBuy005ETHAction(bot);
    tokenBuy010ETHAction(bot);
    tokenBuy020ETHAction(bot);
    tokenBuy050ETHAction(bot);
    tokenBuy100ETHAction(bot);
    tokenBuyApeMaxETHAction(bot);
}

module.exports = { registerTokenBuy, tokenBuyXETHAmountListener, tokenBuyXTokenAmountListener };
