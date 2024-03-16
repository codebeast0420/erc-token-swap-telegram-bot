import { Context } from 'telegraf';
import { botEnum } from '../constants/botEnum';
import { IMethodIdPagination, ISnipePagination, SnipeTokenModel } from '../models/snipe.godmode.token';
import { TokenInfoModel } from '../models/token.info.model';
import { isAlreadyStarted, updateChatId, userVerboseLog } from '../service/app.user.service';
import { processError } from '../service/error';
import {
    getActiveSniperPagination,
    getSnipeMethodIdPagination,
    getSnipeToken,
    getSnipeTokenList,
    moveTokenSnipe,
    registerSnipeToken
} from '../service/snipe.token.service';
import { SNIPE_INPUT_LISTENER } from '../utils/common';
import { getSnipeMainMenuMarkup, getSnipeTokenMarkup, markupActiveSnipesPaginate, markupSnipeChooseMethodId, markupTransferChangeMainWalletPaginate } from '../utils/inline.markups';
import { activeSniperMessage, changeMainWalletMessage, getSnipeTokenInfoText, snipeMethodIdmessage } from '../utils/messages';
import { postStartAction } from './actions/default.action';
import { IPageAndLimit, getMultiWalletPaginationDetails } from '../utils/global.functions';
import { ISceneResponse, SceneStageService } from '../service/scene.stage.service';


export async function invokeSnipeMainMenu(ctx: any, msgId?: number) {
    const telegramId = ctx.from.id;

    try {
        if (ctx.update?.message?.text === undefined) {
            await ctx.deleteMessage();
        }
    } catch { }

    try {
        await userVerboseLog(telegramId, '/sniper');

        await updateChatId(telegramId, ctx.chat.id)
        if (await isAlreadyStarted(telegramId)) {

            const snipes = await getSnipeTokenList(telegramId)
            if (snipes.length === 0) {
                if (msgId) {
                    await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, '⚠️ Please add a token address to snipe', {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: await getSnipeMainMenuMarkup(false)
                    });
                } else {
                    await ctx.telegram.sendMessage(ctx.chat.id, '⚠️ Please add a token address to snipe', {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: await getSnipeMainMenuMarkup(false)
                    });
                }
            } else {
                if (msgId) {
                    await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, 'Manage or add a new token to snipe', {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: await getSnipeMainMenuMarkup(true)
                    });
                } else {
                    await ctx.telegram.sendMessage(ctx.chat.id, 'Manage or add a new token to snipe', {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: await getSnipeMainMenuMarkup(true)
                    });
                }
            }

        } else {
            postStartAction(ctx);
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

export async function invokeActiveSniper(ctx: any, msgId?: number) {
    const telegramId = ctx.from.id;
    try {
        await userVerboseLog(telegramId, 'active sniper');

        if (ctx.update.callback_query.message.chat.type === 'private') {

            let pagination = undefined

            try {
                pagination = ctx.match[0]
            } catch (error) {
                pagination = `${botEnum.activeSnipe.value}_page?${1}_limit?${4}`
            }

            const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);

            const snipes: ISnipePagination = await getActiveSniperPagination(ctx.update.callback_query.from.id, pageLimit.page, pageLimit.limit);

            if (snipes.data != null && snipes.data.length <= 0) {
                try {
                    ctx.answerCbQuery();
                } catch (e) { }

                await ctx.telegram.sendMessage(ctx.chat.id, '⚠️ Please add a token address to snipe', {
                    parse_mode: botEnum.PARSE_MODE_V2,
                    reply_markup: await getSnipeMainMenuMarkup(false)
                });

                return;

            } else {

                try {
                    ctx.answerCbQuery();
                } catch (e) { }
                const message = await activeSniperMessage(snipes.metaData[0].totalAddresses);
                if (msgId) {
                    await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, message, {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: await markupActiveSnipesPaginate(telegramId, snipes)
                    });
                } else {
                    await ctx.telegram.sendMessage(ctx.chat.id, message, {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: await markupActiveSnipesPaginate(telegramId, snipes)
                    });
                }

            }

        } else {
            await ctx.telegram.sendMessage(ctx.chat.id, 'Active sniper panel is only allowed in private chat');
        }
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
}

export async function invokeSnipeLiquidity(ctx: any, snipeToShow?: any, msgId?: number, mode?: string) {
    const telegramId = ctx.from.id;

    try {
        if (ctx.update?.message?.text === undefined) {
            await ctx.deleteMessage();
        }
    } catch { }

    try {
        await userVerboseLog(telegramId, '/sniper');
        const showMode = mode ? mode : 'liquidity'

        await updateChatId(telegramId, ctx.chat.id)
        if (await isAlreadyStarted(telegramId)) {
            if (snipeToShow) {
                if (msgId) {
                    await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, await getSnipeTokenInfoText(telegramId, snipeToShow), {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: await getSnipeTokenMarkup(telegramId, snipeToShow, showMode)
                    });
                } else {
                    await ctx.telegram.sendMessage(ctx.chat.id, await getSnipeTokenInfoText(telegramId, snipeToShow), {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: await getSnipeTokenMarkup(telegramId, snipeToShow, showMode)
                    });
                }
            } else {
                const snipes = await getSnipeTokenList(telegramId)
                if (snipes.length === 0) {
                    if (msgId) {
                        await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, '⚠️ Please add a token address to snipe', {
                            parse_mode: botEnum.PARSE_MODE_V2,
                            reply_markup: await getSnipeTokenMarkup(telegramId, null, showMode)
                        });
                    } else {
                        await ctx.telegram.sendMessage(ctx.chat.id, '⚠️ Please add a token address to snipe', {
                            parse_mode: botEnum.PARSE_MODE_V2,
                            reply_markup: await getSnipeTokenMarkup(telegramId, null, showMode)
                        });
                    }
                } else {
                    if (msgId) {
                        await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, await getSnipeTokenInfoText(telegramId, snipes[0]), {
                            parse_mode: botEnum.PARSE_MODE_V2,
                            reply_markup: await getSnipeTokenMarkup(telegramId, snipes[0], showMode)
                        });
                    } else {
                        await ctx.telegram.sendMessage(ctx.chat.id, await getSnipeTokenInfoText(telegramId, snipes[0]), {
                            parse_mode: botEnum.PARSE_MODE_V2,
                            reply_markup: await getSnipeTokenMarkup(telegramId, snipes[0], showMode)
                        });
                    }
                }
            }
        } else {
            postStartAction(ctx);
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const reloadSnipeLiquidity = async (ctx: any, snipe: any, method: string) => {
    const telegramId = ctx.from.id;

    try {
        await ctx.telegram.editMessageText(ctx.chat.id, ctx.update.callback_query?.message.message_id, 0, await getSnipeTokenInfoText(telegramId, snipe), {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: await getSnipeTokenMarkup(telegramId, snipe, method)
        });
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const registerSnipe = async (ctx: any, tokenInfoId: string) => {
    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, `register a new snipe - [${tokenInfoId}]`);

        await updateChatId(telegramId, ctx.chat.id)

        const tokenInfo = await TokenInfoModel.findById(tokenInfoId)

        if (tokenInfo === null) {
            await ctx.telegram.sendMessage(ctx.chat.id, '❌ Invalid token to snipe', {
                parse_mode: botEnum.PARSE_MODE_V2
            });
        } else {
            let snipeRegistered = await registerSnipeToken(telegramId, tokenInfo.chain, tokenInfo.address)
            await invokeSnipeLiquidity(ctx, snipeRegistered)
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const toggleMulti = async (ctx: any, snipeId: string) => {
    const telegramId = ctx.from.id

    try {
        await userVerboseLog(telegramId, 'toggle multi wallet in primary snipe')

        await updateChatId(telegramId, ctx.chat.id)

        const snipe = await SnipeTokenModel.findById(snipeId)

        if (snipe !== null) {
            await SnipeTokenModel.findByIdAndUpdate(snipeId, { multi: snipe.multi === true ? false : true })
        }

        await reloadSnipeLiquidity(ctx, await SnipeTokenModel.findById(snipeId), 'liquidity')
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const toggleBackupTx = async (ctx: any, snipeId: string) => {
    const telegramId = ctx.from.id

    try {
        await userVerboseLog(telegramId, 'toggle backup tx in primary snipe')

        await updateChatId(telegramId, ctx.chat.id)

        const snipe = await SnipeTokenModel.findById(snipeId)

        if (snipe !== null) {
            await SnipeTokenModel.findByIdAndUpdate(snipeId, { backupTx: snipe.backupTx === true ? false : true })
        }

        await reloadSnipeLiquidity(ctx, await SnipeTokenModel.findById(snipeId), 'liquidity')
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const toggleSnipeLiquidity = async (ctx: any, snipeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, 'toggle snipe liquidity in primary snipe');

        await updateChatId(telegramId, ctx.chat.id);

        const snipe = await SnipeTokenModel.findById(snipeId)
        if (snipe !== null) {
            await SnipeTokenModel.findByIdAndUpdate(snipeId, { method: snipe.method === 'liquidity' ? '' : 'liquidity' })
        }

        await reloadSnipeLiquidity(ctx, await SnipeTokenModel.findById(snipeId), 'liquidity');
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const toggleSnipeAuto = async (ctx: any, snipeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, 'toggle snipe auto in primary snipe');

        await updateChatId(telegramId, ctx.chat.id);

        const snipe = await SnipeTokenModel.findById(snipeId)
        if (snipe !== null) {
            await SnipeTokenModel.findByIdAndUpdate(snipeId, { method: snipe.method === 'auto' ? '' : 'auto' })
        }

        await reloadSnipeLiquidity(ctx, await SnipeTokenModel.findById(snipeId), 'auto');
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const toggleSnipeMethod = async (ctx: any, snipeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, 'toggle snipe method in primary snipe');

        const snipe = await SnipeTokenModel.findById(snipeId)
        if (snipe.method !== 'method-id') {
            await ctx.scene.enter(SNIPE_INPUT_LISTENER, { input_type: 'snipe-select-method-id', msgId: ctx.update.callback_query?.message.message_id, snipeId })
        } else {
            if (snipe !== null) {
                await SnipeTokenModel.findByIdAndUpdate(snipeId, { method: '' })
            }

            await reloadSnipeLiquidity(ctx, await SnipeTokenModel.findById(snipeId), 'method-id')
        }
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};
const handleSnipeMethodIdPage = async (ctx: any) => {
    const telegramId = ctx.from.id;

    try {
        const pageLimit: IPageAndLimit = getMultiWalletPaginationDetails(ctx.match[0]);

        await userVerboseLog(telegramId, 'handle snipe method next page');

        const scene: ISceneResponse = await new SceneStageService().getSceneStage(telegramId);

        if (scene !== null && scene.scene.name === "snipe-input-listener") {
            const parsedContext = JSON.parse(scene.scene.text)
            const methods: IMethodIdPagination = await getSnipeMethodIdPagination(parsedContext.methodIds, pageLimit.page, pageLimit.limit);
            const text = snipeMethodIdmessage(parsedContext.betaFlags);
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                parsedContext.msgId,
                0,
                text,
                {
                    parse_mode: botEnum.PARSE_MODE_V2,
                    reply_markup: markupSnipeChooseMethodId(methods, parsedContext.snipeId)
                }
            );

        } else {
            await new SceneStageService().deleteScene(telegramId)
            await ctx.telegram.sendMessage("❌ Ops something is wrong, try again using /sniper");
        }

    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const handleSnipeSelectMethodId = async (ctx: any, methodId: string) => {
    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, 'handle select snipe method id');

        const scene: ISceneResponse = await new SceneStageService().getSceneStage(telegramId);

        if (scene !== null && scene.scene.name === "snipe-input-listener") {
            const parsedContext = JSON.parse(scene.scene.text)

            const snipe = await SnipeTokenModel.findById(parsedContext.snipeId)
            let formattedMethodId = methodId.slice(2)

            snipe.method = 'method-id'
            snipe.methodID = formattedMethodId
            await snipe.save()

            await ctx.telegram.sendMessage(ctx.chat.id, `✅ Set method id <code>${formattedMethodId}</code> to snipe`, {
                parse_mode: botEnum.PARSE_MODE_V2
            });

            await invokeSnipeLiquidity(ctx, snipe)

            await new SceneStageService().deleteScene(telegramId)

        } else {
            await new SceneStageService().deleteScene(telegramId)
            await ctx.telegram.sendMessage("❌ Ops something is wrong, try again using /sniper");
        }

    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const toggleSnipeAutoMaxTx = async (ctx: any, snipeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, 'toggle snipe auto max tx in primary snipe');

        const snipe = await SnipeTokenModel.findById(snipeId)
        if (snipe !== null) {
            await SnipeTokenModel.findByIdAndUpdate(snipeId, { autoMaxTx: snipe.autoMaxTx === true ? false : true })
        }

        await reloadSnipeLiquidity(ctx, await SnipeTokenModel.findById(snipeId), 'liquidity')
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const removeSnipeSlippage = async (ctx: any, snipeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, 'remove snipe slippage in primary snipe');

        await updateChatId(telegramId, ctx.chat.id)

        await SnipeTokenModel.findByIdAndUpdate(snipeId, { slippage: 100 })

        await ctx.telegram.sendMessage(ctx.chat.id, '✔ Removed snipe slippage', {
            parse_mode: botEnum.PARSE_MODE_V2
        });
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const prevSnipe = async (ctx: any, snipeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, 'go to prev snipe');

        await updateChatId(telegramId, ctx.chat.id);

        const snipe = await moveTokenSnipe(telegramId, snipeId, true)

        await reloadSnipeLiquidity(ctx, snipe, 'liquidity')
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

const nextSnipe = async (ctx: any, snipeId: string) => {
    const telegramId = ctx.from.id

    try {
        await userVerboseLog(telegramId, 'go to prev snipe')

        await updateChatId(telegramId, ctx.chat.id)

        const snipe = await moveTokenSnipe(telegramId, snipeId, false)

        await reloadSnipeLiquidity(ctx, snipe, 'liquidity')
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
};

const deleteSnipe = async (ctx: any, snipeId: string) => {
    const telegramId = ctx.from.id;

    try {
        await userVerboseLog(telegramId, `delete snipe [${snipeId}]`);

        await updateChatId(telegramId, ctx.chat.id)

        const snipes = await getSnipeTokenList(telegramId)
        const snipeFound = snipes.find(s => s._id.toString() === snipeId)
        const foundIndex = snipeFound ? snipes.indexOf(snipeFound) : -1
        const nextId = foundIndex < 0 ? null : foundIndex < snipes.length - 1 ? snipes[foundIndex + 1]._id : snipes.length > 1 ? snipes[0]._id : null

        await SnipeTokenModel.findByIdAndDelete(snipeId)

        await reloadSnipeLiquidity(ctx, nextId === null ? null : await SnipeTokenModel.findById(nextId), 'liquidity')
    } catch (err) {
        await processError(ctx, telegramId, err);
    }
};

module.exports = (bot: any) => {
    bot.command(botEnum.snipe.keys, async (ctx: any) => {
        await invokeSnipeMainMenu(ctx);
    })
    bot.action(botEnum.snipe.value, async (ctx: any) => {
        await invokeSnipeMainMenu(ctx);
    })

    bot.action(RegExp('^' + botEnum.snipeSettings.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeSettings.value.length + 1)
        let snipeToShow = await getSnipeToken(ctx.from.id, snipeId);
        await invokeSnipeLiquidity(ctx, snipeToShow)
    })

    bot.action(RegExp('^' + botEnum.activeSnipe.value + '(.*)$'), async (ctx: any) => {

        await invokeActiveSniper(ctx, ctx.update.callback_query.message.message_id);
    })

    bot.action(RegExp('^' + botEnum.registerSnipe.value + '_.+'), async (ctx: any) => {
        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.registerSnipe.value.length + 1)
        await registerSnipe(ctx, tokenInfoId)
    })

    bot.action(RegExp('^' + botEnum.deleteSnipe.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.deleteSnipe.value.length + 1)
        await deleteSnipe(ctx, snipeId)
    })

    bot.action(RegExp('^' + botEnum.prevSnipe.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.prevSnipe.value.length + 1)
        await prevSnipe(ctx, snipeId)
    })

    bot.action(RegExp('^' + botEnum.nextSnipe.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.nextSnipe.value.length + 1)
        await nextSnipe(ctx, snipeId)
    })

    bot.action(RegExp('^' + botEnum.refreshSnipe.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.refreshSnipe.value.length + 1)
        await reloadSnipeLiquidity(ctx, await SnipeTokenModel.findById(snipeId), 'liquidity')
    })

    bot.action(RegExp('^' + botEnum.snipeMulti.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeMulti.value.length + 1)
        await toggleMulti(ctx, snipeId)
    })

    bot.action(RegExp('^' + botEnum.snipeBackupTx.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeBackupTx.value.length + 1)
        await toggleBackupTx(ctx, snipeId)
    })

    bot.action(RegExp('^' + botEnum.snipeLiquidity.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeLiquidity.value.length + 1)
        await reloadSnipeLiquidity(ctx, await SnipeTokenModel.findById(snipeId), 'liquidity')
    })

    bot.action(RegExp('^' + botEnum.snipeAuto.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeAuto.value.length + 1)
        await reloadSnipeLiquidity(ctx, await SnipeTokenModel.findById(snipeId), 'auto')
    })

    bot.action(RegExp('^' + botEnum.snipeMethod.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeMethod.value.length + 1)
        await reloadSnipeLiquidity(ctx, await SnipeTokenModel.findById(snipeId), 'method-id')
    })

    bot.action(RegExp('^' + botEnum.doSnipeLiquidity.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.doSnipeLiquidity.value.length + 1)
        await toggleSnipeLiquidity(ctx, snipeId)
    })

    bot.action(RegExp('^' + botEnum.doSnipeAuto.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.doSnipeAuto.value.length + 1)
        await toggleSnipeAuto(ctx, snipeId)
    })

    bot.action(RegExp('^' + botEnum.doSnipeMethodId.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.doSnipeMethodId.value.length + 1)
        await toggleSnipeMethod(ctx, snipeId)
    })

    bot.action(RegExp('^' + botEnum.snipeChangeMethodIDPage.value + '(.*)$'), async (ctx: any) => {
        await handleSnipeMethodIdPage(ctx)
    })

    bot.action(RegExp('^' + botEnum.snipeSelectMethodId.value + '_'), async (ctx: any) => {
        const methodId = ctx.update.callback_query.data.slice(botEnum.snipeSelectMethodId.value.length + 1)
        await handleSnipeSelectMethodId(ctx, methodId)
    })

    bot.action(RegExp('^' + botEnum.toggleAutoMaxTx.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.toggleAutoMaxTx.value.length + 1)
        await toggleSnipeAutoMaxTx(ctx, snipeId)
    })

    bot.action(RegExp('^' + botEnum.quickSnipe.value + '_.+'), async (ctx: any) => {
        const tokenInfoId = ctx.update.callback_query.data.slice(botEnum.quickSnipe.value.length + 1)
        await ctx.scene.enter(SNIPE_INPUT_LISTENER, { input_type: 'snipe-auto-configuration', msgId: ctx.update.callback_query?.message.message_id, tokenInfoId })
    })

    bot.action(RegExp('^' + botEnum.snipeGasDelta.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeGasDelta.value.length + 1)
        await ctx.scene.enter(SNIPE_INPUT_LISTENER, { input_type: 'snipe-gas-price-delta', msgId: ctx.update.callback_query?.message.message_id, snipeId })
    })

    bot.action(RegExp('^' + botEnum.snipeBribeAmount.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeBribeAmount.value.length + 1)
        await ctx.scene.enter(SNIPE_INPUT_LISTENER, { input_type: 'snipe-bribe-amount', msgId: ctx.update.callback_query?.message.message_id, snipeId })
    })

    bot.action(RegExp('^' + botEnum.snipeBlockDelay.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeBlockDelay.value.length + 1)
        await ctx.scene.enter(SNIPE_INPUT_LISTENER, { input_type: 'snipe-block-delay', msgId: ctx.update.callback_query?.message.message_id, snipeId });
    })

    bot.action(RegExp('^' + botEnum.snipeETHAmount.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeETHAmount.value.length + 1)
        await ctx.scene.enter(SNIPE_INPUT_LISTENER, { input_type: 'snipe-eth-amount', msgId: ctx.update.callback_query?.message.message_id, snipeId });
    })

    bot.action(RegExp('^' + botEnum.snipeTokenAmount.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeTokenAmount.value.length + 1)
        await ctx.scene.enter(SNIPE_INPUT_LISTENER, { input_type: 'snipe-token-amount', msgId: ctx.update.callback_query?.message.message_id, snipeId });
    })

    bot.action(RegExp('^' + botEnum.snipeSlippage.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeSlippage.value.length + 1)
        await ctx.scene.enter(SNIPE_INPUT_LISTENER, { input_type: 'snipe-slippage-amount', msgId: ctx.update.callback_query?.message.message_id, snipeId })
    })

    bot.action(RegExp('^' + botEnum.snipeRemoveSlippage.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeRemoveSlippage.value.length + 1)
        await removeSnipeSlippage(ctx, snipeId)
    })

    bot.action(botEnum.addSnipe.value, async (ctx: any) => {
        await ctx.scene.enter(SNIPE_INPUT_LISTENER, { input_type: 'add-snipe-token', msgId: ctx.update.callback_query?.message.message_id });
    });

    bot.action(RegExp('^' + botEnum.snipeAutoMaxBuyTax.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeAutoMaxBuyTax.value.length + 1)
        await ctx.scene.enter(SNIPE_INPUT_LISTENER, { input_type: 'snipe-max-buy-tax', msgId: ctx.update.callback_query?.message.message_id, snipeId })
    })

    bot.action(RegExp('^' + botEnum.snipeAutoMaxSellTax.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeAutoMaxSellTax.value.length + 1)
        await ctx.scene.enter(SNIPE_INPUT_LISTENER, { input_type: 'snipe-max-sell-tax', msgId: ctx.update.callback_query?.message.message_id, snipeId })
    })

    bot.action(RegExp('^' + botEnum.snipeMaxGas.value + '_.+'), async (ctx: any) => {
        const snipeId = ctx.update.callback_query.data.slice(botEnum.snipeMaxGas.value.length + 1)
        await ctx.scene.enter(SNIPE_INPUT_LISTENER, { input_type: 'snipe-max-gas-amount', msgId: ctx.update.callback_query?.message.message_id, snipeId })
    })
};

module.exports.invokeSnipeLiquidity = invokeSnipeLiquidity