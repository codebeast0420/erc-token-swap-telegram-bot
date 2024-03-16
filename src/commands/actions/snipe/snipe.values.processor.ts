import { botEnum } from "../../../constants/botEnum"
import { SnipeTokenModel } from "../../../models/snipe.godmode.token"
import { TokenInfoModel } from "../../../models/token.info.model"
import { updateChatId, userVerboseLog } from "../../../service/app.user.service"
import { chainGasPrice } from "../../../service/chain.service"
import { getSelectedChain } from "../../../service/connected.chain.service"
import { processError } from "../../../service/error"
import { ISceneResponse, SceneStageService } from "../../../service/scene.stage.service"
import { registerSnipeToken } from "../../../service/snipe.token.service"
import { getCurrentToken, startToken } from "../../../service/token.service"
import { getWallet } from "../../../service/wallet.service"
import { INVALID_VALUE_SET, convertValue } from "../../../utils/common"
import Logging from "../../../utils/logging"
import { getNativeCurrencySymbol } from "../../../web3/chain.parameters"
import { getETHBalance } from "../../../web3/nativecurrency/nativecurrency.query"
import { getTokenSimpleInfo } from "../../../web3/token.interaction"
import { getBN } from "../../../web3/web3.operation"
import { invokeSnipeLiquidity } from "../../snipe"

export class SnipeValuesListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`SnipeValuesListener.class processing scene message [${text}]`)
        await updateChatId(telegramId, ctx.chat.id)

        const context = JSON.parse(sceneContext.scene.text)

        try {
            if (context.inputType === 'snipe-gas-price-delta') {
                await processSnipeGasPriceDelta(telegramId, text, ctx, context)
            } else if (context.inputType === 'snipe-auto-configuration') {
                await processSnipeAutoConfiguration(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'snipe-bribe-amount') {
                await processSnipeBribeAmount(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'snipe-block-delay') {
                await processSnipeBlockDelay(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'snipe-eth-amount') {
                await processSnipeEthAmount(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'snipe-token-amount') {
                await processSnipeTokenAmount(telegramId, text, ctx, context)
            } else if (context.inputType === 'snipe-slippage-amount') {
                await processSnipeSlippageAmount(telegramId, text, ctx, context)
            }
            else if (context.inputType === 'add-snipe-token') {
                await processAddSnipeToken(telegramId, text.toLowerCase(), ctx, context)
            }
            else if (context.inputType === 'snipe-select-method-id') {
                await processSnipeSelectMethodId(telegramId, text, ctx, context)
            } else if (context.inputType === 'snipe-max-buy-tax') {
                await processSnipeMaxBuyTax(telegramId, text, ctx, context)
            } else if (context.inputType === 'snipe-max-sell-tax') {
                await processSnipeMaxSellTax(telegramId, text, ctx, context)
            } else if (context.inputType === 'snipe-max-gas-amount') {
                await processSnipeMaxGas(telegramId, text, ctx, context)
            }
        }
        catch (err) {
            await processError(ctx, telegramId, err)
        }
    }
}


async function processSnipeGasPriceDelta(telegramId: string, text: string, ctx: any, context: any) {
    const gasPrice = parseFloat(text)
    const s = await SnipeTokenModel.findById(context.snipeId)
    const snipe: any = await s.populate('token')
    const chainGas = parseFloat((snipe.token.chain === 'ethereum') ? '0' : await chainGasPrice(snipe.token.chain))

    if (isNaN(gasPrice) || gasPrice < chainGas) {
        await new SceneStageService().deleteScene(telegramId)
        throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number greater than ${chainGas}. Please try again.`);
    }

    snipe.gasDeltaPrice = gasPrice
    await snipe.save()

    await userVerboseLog(telegramId, `${snipe.token.address} snipe gas ${snipe.token.chain === 'ethereum' ? 'delta' : 'price'} set to ${gasPrice}`);

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Gas ${snipe.token.chain === 'ethereum' ? 'delta' : 'price'} set to ${gasPrice}`, {
        parse_mode: botEnum.PARSE_MODE_V2
    });

    await invokeSnipeLiquidity(ctx, await SnipeTokenModel.findById(context.snipeId), context.msgId)

    await new SceneStageService().deleteScene(telegramId)
}

async function processSnipeAutoConfiguration(telegramId: string, text: string, ctx: any, context: any) {
    try {
        const BN = getBN()
        await userVerboseLog(telegramId, `auto configure a new snipe - [${context.tokenInfoId}]`);

        const tokenInfo = await TokenInfoModel.findById(context.tokenInfoId)

        await updateChatId(telegramId, ctx.chat.id)

        if (tokenInfo === null) {
            await ctx.telegram.sendMessage(ctx.chat.id, '❌ Invalid token to snipe', {
                parse_mode: botEnum.PARSE_MODE_V2
            });
        } else {
            const nativeSymbol = await getNativeCurrencySymbol(tokenInfo.chain)
            const w = await getWallet(telegramId)
            const bal = await getETHBalance(telegramId, tokenInfo.chain, w.address)
            const nativeAmount = convertValue(bal, text, BN)

            if (BN(nativeAmount).lte(0)) {
                await ctx.telegram.sendMessage(ctx.chat.id, INVALID_VALUE_SET, {
                    parse_mode: botEnum.PARSE_MODE_V2
                });
            } else {
                let snipeRegistered = await registerSnipeToken(telegramId, tokenInfo.chain, tokenInfo.address)
                snipeRegistered.nativeCurrencyAmount = text
                if (tokenInfo.chain === 'ethereum') {
                    snipeRegistered.bribeAmount = '0.001'
                }
                snipeRegistered.autoMaxTx = true
                snipeRegistered.method = 'auto'
                await snipeRegistered.save()

                snipeRegistered = await SnipeTokenModel.findById(snipeRegistered._id)
                await invokeSnipeLiquidity(ctx, snipeRegistered, undefined, 'auto')
            }
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

async function processSnipeBribeAmount(telegramId: string, text: string, ctx: any, context: any) {
    const snipe = await SnipeTokenModel.findById(context.snipeId)
    const s: any = await snipe.populate('token')

    let targetValue;

    const BN = getBN()
    const ethAmount = parseFloat(text);
    const w = await getWallet(telegramId);
    const nativeSymbol = await getNativeCurrencySymbol(s.token.chain)

    const ethBal = await getETHBalance(telegramId, s.token.chain, w.address);
    const myETHBal = parseFloat(ethBal);

    if (BN(ethBal).eq(BN(0))) {
        throw new Error(`You don't have any ${nativeSymbol}`);
    }

    if (isNaN(ethAmount) || ethAmount < 0 || ethAmount > myETHBal) {
        await new SceneStageService().deleteScene(telegramId)
        throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number <b>between 0 and ${myETHBal}</b>. Please try again.`);
    }

    snipe.bribeAmount = ethAmount.toString()
    await snipe.save()

    targetValue = ethAmount.toString();

    await userVerboseLog(telegramId, `${s.token.address} snipe bribe amount set to ${targetValue}`);
    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Successfully set bribe amount <b>${ethAmount} ${nativeSymbol}</b>`, {
        parse_mode: botEnum.PARSE_MODE_V2
    })

    await invokeSnipeLiquidity(ctx, await SnipeTokenModel.findById(context.snipeId), context.msgId)

    await new SceneStageService().deleteScene(telegramId)
}

async function processSnipeBlockDelay(telegramId: string, text: string, ctx: any, context: any) {
    const delayBlocks = parseInt(text);
    if (isNaN(delayBlocks) || delayBlocks < 0 || delayBlocks > 100) {
        await new SceneStageService().deleteScene(telegramId)
        throw new Error(INVALID_VALUE_SET + '\nYou must use a valid number <b>between 0 and 100</b> inclusive. Please try again.')
    }

    const snipe = await SnipeTokenModel.findById(context.snipeId)
    snipe.blockDelay = delayBlocks
    await snipe.save()

    const s: any = await snipe.populate('token');

    await userVerboseLog(telegramId, `${s.token.address} snipe block delay set to ${delayBlocks}`);
    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Successfully set block delay <b>${delayBlocks}</b>`, {
        parse_mode: botEnum.PARSE_MODE_V2
    })

    await invokeSnipeLiquidity(ctx, await SnipeTokenModel.findById(context.snipeId), context.msgId)

    await new SceneStageService().deleteScene(telegramId)
}

async function processSnipeEthAmount(telegramId: string, text: string, ctx: any, context: any) {
    const snipe = await SnipeTokenModel.findById(context.snipeId)
    const s: any = await snipe.populate('token')
    const nativeSymbol = await getNativeCurrencySymbol(s.token.chain)

    let targetValue;
    // const percentageFlag = text.indexOf('%');
    // if (percentageFlag < 0) {
    const BN = getBN()
    const w = await getWallet(telegramId);

    const ethBal = await getETHBalance(telegramId, s.token.chain, w.address);
    const myETHBal = parseFloat(ethBal);

    if (BN(ethBal).eq(BN(0))) {
        throw new Error(`You don't have any ${nativeSymbol}`);
    }

    const ethAmount = convertValue(ethBal, text, BN)

    if (isNaN(ethAmount) || ethAmount < 0 || ethAmount > myETHBal) {
        await new SceneStageService().deleteScene(telegramId)
        throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number <b>between 0 and ${myETHBal}</b>. Please try again.`);
    }

    snipe.nativeCurrencyAmount = ethAmount.toString()
    await snipe.save()

    targetValue = ethAmount.toString();
    // } else {
    //     const percentage = parseFloat(text.slice(0, percentageFlag));
    //     if (isNaN(percentage) || percentage < 0 || percentage > 100) {
    //         await new SceneStageService().deleteScene(telegramId)
    //         throw new Error(INVALID_VALUE_SET + `\nYou must use a valid percentage <b>between 0 and 100</b>. Please try again.`);
    //     }

    //     snipe.nativeCurrencyAmount = percentage.toString() + '%'
    //     await snipe.save()

    //     targetValue = percentage.toString() + '%';
    // }

    await userVerboseLog(telegramId, `${s.token.address} snipe native currency amount set to ${targetValue}`);
    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Successfully set ${nativeSymbol} <b>${targetValue}</b>`, {
        parse_mode: botEnum.PARSE_MODE_V2
    })

    await invokeSnipeLiquidity(ctx, await SnipeTokenModel.findById(context.snipeId), context.msgId)

    await new SceneStageService().deleteScene(telegramId)
}

async function processSnipeTokenAmount(telegramId: string, text: string, ctx: any, context: any) {
    const BN = getBN()
    const snipe = await SnipeTokenModel.findById(context.snipeId)
    const s: any = await snipe.populate('token')
    // const percentageFlag = text.indexOf('%')
    // if (percentageFlag < 0) {
    const tokenAmount = parseFloat(text);
    const w = await getWallet(telegramId);

    const myToken = await getTokenSimpleInfo(telegramId, s.token.chain, s.token.address, w.address);
    const val = convertValue(myToken.totalSupply, text, BN)
    // const myTokenBal = parseFloat(myToken.balance)

    // if (isNaN(tokenAmount) || tokenAmount < 0 || tokenAmount > myTokenBal) {
    //     await new SceneStageService().deleteScene(telegramId)
    //     throw new Error(INVALID_VALUE_SET + `\nYou must use a valid number <b>between 0 and ${myTokenBal}</b>. Please try again.`);
    // }

    snipe.tokenAmount = val
    await snipe.save()

    await userVerboseLog(telegramId, `${s.token.address} snipe token amount set to ${val.toString()}`);
    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Successfully set <b>${myToken.symbol}</b> <b>${val}</b>`, {
        parse_mode: botEnum.PARSE_MODE_V2
    })

    await invokeSnipeLiquidity(ctx, await SnipeTokenModel.findById(context.snipeId), context.msgId)

    await new SceneStageService().deleteScene(telegramId)
}

async function processSnipeSlippageAmount(telegramId: string, text: string, ctx: any, context: any) {
    const snipe = await SnipeTokenModel.findById(context.snipeId)
    const s: any = await snipe.populate('token');

    let targetValue;
    const percentageFlag = text.indexOf('%');
    if (percentageFlag < 0) {
        throw new Error(INVALID_VALUE_SET + '\nNot %');
    } else {
        const percentage = parseFloat(text.slice(0, percentageFlag));
        if (isNaN(percentage) || percentage < 0) {
            await new SceneStageService().deleteScene(telegramId)
            throw new Error(INVALID_VALUE_SET + `\nYou must use a valid percentage <b>greater than or equal to 0</b>. Please try again.`);
        }

        snipe.slippage = percentage
        await snipe.save()

        targetValue = percentage.toString();
    }

    await invokeSnipeLiquidity(ctx, await SnipeTokenModel.findById(context.snipeId), context.msgId)

    await userVerboseLog(telegramId, `${s.token.address} snipe slippage percentage set to ${targetValue}%`);

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set slippage to <b>${targetValue}%</b>`, {
        parse_mode: botEnum.PARSE_MODE_V2
    });

    await new SceneStageService().deleteScene(telegramId)
}

async function processAddSnipeToken(telegramId: string, text: string, ctx: any, context: any) {
    if (text.startsWith('0x')) {
        const chain = await getSelectedChain(telegramId);
        if (true === (await startToken(telegramId, chain, text.toLowerCase()))) {
            const newChain = await getSelectedChain(telegramId)
            const newToken = await getCurrentToken(telegramId, newChain)
            const newChain2 = await getSelectedChain(telegramId)

            const snipe = await registerSnipeToken(telegramId, newChain2, newToken);
            await ctx.telegram.sendMessage(ctx.chat.id, `✅ Successfully added a new snipe`, {
                parse_mode: botEnum.PARSE_MODE_V2
            })

            await invokeSnipeLiquidity(ctx, snipe, context.msgId)

            await new SceneStageService().deleteScene(telegramId)
        }
    }
}

async function processSnipeSelectMethodId(telegramId: string, text: string, ctx: any, context: any) {
    if (text.startsWith('0x') && text.length === 10) {
        const snipe = await SnipeTokenModel.findById(context.snipeId)
        snipe.method = 'method-id'
        snipe.methodID = text.slice(2)
        await snipe.save()

        await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set method id <code>${text.slice(2)}</code> to snipe`, {
            parse_mode: botEnum.PARSE_MODE_V2
        });

        await invokeSnipeLiquidity(ctx, await SnipeTokenModel.findById(context.snipeId), context.msgId)

        await new SceneStageService().deleteScene(telegramId)
    }
}

async function processSnipeMaxBuyTax(telegramId: string, text: string, ctx: any, context: any) {
    const snipe = await SnipeTokenModel.findById(context.snipeId)
    const s: any = await snipe.populate('token');

    let targetValue;
    const percentageFlag = text.indexOf('%');
    if (percentageFlag < 0) {
        throw new Error(INVALID_VALUE_SET + '\nNot %');
    } else {
        const percentage = parseFloat(text.slice(0, percentageFlag));
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
            await new SceneStageService().deleteScene(telegramId)
            throw new Error(INVALID_VALUE_SET + `\nYou must use a valid percentage <b>between 0 and 100</b>. Please try again.`);
        }

        snipe.maxBuyTax = percentage.toString()
        await snipe.save()

        targetValue = percentage.toString();

        await invokeSnipeLiquidity(ctx, await SnipeTokenModel.findById(context.snipeId), context.msgId)
    }

    await userVerboseLog(telegramId, `${s.token.address} snipe max buy tax percentage set to ${targetValue}%`);

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set max buy tax to <b>${targetValue}%</b>`, {
        parse_mode: botEnum.PARSE_MODE_V2
    });

    await new SceneStageService().deleteScene(telegramId)
}

async function processSnipeMaxSellTax(telegramId: string, text: string, ctx: any, context: any) {
    const snipe = await SnipeTokenModel.findById(context.snipeId)
    const s: any = await snipe.populate('token');

    let targetValue;
    const percentageFlag = text.indexOf('%');
    if (percentageFlag < 0) {
        throw new Error(INVALID_VALUE_SET + '\nNot %');
    } else {
        const percentage = parseFloat(text.slice(0, percentageFlag));
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
            await new SceneStageService().deleteScene(telegramId)
            throw new Error(INVALID_VALUE_SET + `\nYou must use a valid percentage <b>between 0 and 100</b>. Please try again.`);
        }

        snipe.maxSellTax = percentage.toString()
        await snipe.save()

        targetValue = percentage.toString();

        await invokeSnipeLiquidity(ctx, await SnipeTokenModel.findById(context.snipeId), context.msgId)
    }

    await userVerboseLog(telegramId, `${s.token.address} snipe max sell tax percentage set to ${targetValue}%`);

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set max sell tax to <b>${targetValue}%</b>`, {
        parse_mode: botEnum.PARSE_MODE_V2
    });

    await new SceneStageService().deleteScene(telegramId)
}

async function processSnipeMaxGas(telegramId: string, text: string, ctx: any, context: any) {
    const snipe = await SnipeTokenModel.findById(context.snipeId)
    const s: any = await snipe.populate('token');

    const gasAmount = parseInt(text);
    if (isNaN(gasAmount) || gasAmount <= 0) {
        await new SceneStageService().deleteScene(telegramId)
        throw new Error(INVALID_VALUE_SET + `\nYou must use a valid gas amount <b>greater than 0</b>. Please try again.`);
    }

    snipe.maxGas = gasAmount
    await snipe.save()

    await invokeSnipeLiquidity(ctx, await SnipeTokenModel.findById(context.snipeId), context.msgId)

    await userVerboseLog(telegramId, `${s.token.address} snipe max gas set to ${gasAmount}`);

    await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set max gas to <b>${gasAmount}</b>`, {
        parse_mode: botEnum.PARSE_MODE_V2
    });

    await new SceneStageService().deleteScene(telegramId)
}
