import axios from 'axios';
import { Scenes } from 'telegraf';
import { botEnum } from '../../../constants/botEnum';
import { chainGasPrice } from '../../../service/chain.service';
import { getDedicatedSyncRPC, getNativeCurrencySymbol, getRPC } from '../../../web3/chain.parameters';
import { SEND_AMOUNT_PLACEHOLDER, SNIPE_INPUT_LISTENER } from '../../../utils/common';
import { SceneStageService } from '../../../service/scene.stage.service';
import { SnipeTokenModel } from '../../../models/snipe.godmode.token';
import { getBlockExplorerApiEndpoint } from '../../../web3/chain.parameters';
import { getBlockExplorerApiKey } from '../../../web3/chain.parameters';
import { AddressZero } from '../../../web3/web3.operation';
import { processError } from '../../../service/error';
import { updateChatId } from '../../../service/app.user.service';
import { TokenInfoModel } from '../../../models/token.info.model';
import { getETHBalance } from '../../../web3/nativecurrency/nativecurrency.query';
import { getWallet } from '../../../service/wallet.service';
import { getWeb3 } from '../../../web3/multicall';
import { decodeNotVerifiedAbi } from '../../../web3/abi/decode';
import { markupSnipeChooseMethodId } from '../../../utils/inline.markups';
import { getSnipeMethodIdPagination } from '../../../service/snipe.token.service';
import { snipeMethodIdmessage } from '../../../utils/messages';

const Web3 = require('web3')

export const snipeInputListener = new Scenes.BaseScene(SNIPE_INPUT_LISTENER);

// send a prompt message when user enters scene
snipeInputListener.enter(async (ctx: any) => {
    const telegramId = ctx.from.id;

    try {
        const context = {
            inputType: ctx.scene.state.input_type,
            msgId: ctx.scene.state.msgId,
            snipeId: ctx.scene.state.snipeId,
            tokenInfoId: ctx.scene.state.tokenInfoId,
            methodIds: [],
            betaFlags: false
        }

        let ret;

        await updateChatId(telegramId, ctx.chat.id)

        if (ctx.scene.state.input_type === 'snipe-gas-price-delta') {
            const s1: any = await SnipeTokenModel.findById(context.snipeId)
            const s = await s1.populate('token');

            const gasPrice = await chainGasPrice(s.token.chain);
            if (s.token.chain === 'ethereum') {
                ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired gas price (in GWEI). 1 GWEI = 10 ^ 9 wei. Current gas price is <b>${gasPrice}</b>!`, {
                    parse_mode: botEnum.PARSE_MODE_V2,
                    reply_markup: {
                        force_reply: true
                    }
                });
            } else {
                ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired gas price (in GWEI). 1 GWEI = 10 ^ 9 wei. Please input <b>${gasPrice}</b> at minimum!`, {
                    parse_mode: botEnum.PARSE_MODE_V2,
                    reply_markup: {
                        force_reply: true
                    }
                });
            }

            await new SceneStageService().saveScene(telegramId, SNIPE_INPUT_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        } else if (ctx.scene.state.input_type === 'snipe-auto-configuration') {
            const tokenInfo = await TokenInfoModel.findById(context.tokenInfoId)
            const nativeSymbol = await getNativeCurrencySymbol(tokenInfo.chain)
            const w = await getWallet(telegramId)
            const bal = await getETHBalance(telegramId, tokenInfo.chain, w.address)

            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Please input <b>${nativeSymbol}</b> amount or percentage to snipe <b>${tokenInfo.symbol}</b> by liquidity\nYou currently have <b>${bal} ${nativeSymbol}</b>`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true,
                    input_field_placeholder: SEND_AMOUNT_PLACEHOLDER,
                }
            });

            await new SceneStageService().saveScene(telegramId, SNIPE_INPUT_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        } else if (ctx.scene.state.input_type === 'snipe-bribe-amount') {
            const s1: any = await SnipeTokenModel.findById(context.snipeId)
            const s = await s1.populate('token');

            const nativeSymbol = await getNativeCurrencySymbol(s.token.chain)
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired <b>bribe amount</b> in <b>${nativeSymbol}</b>.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, SNIPE_INPUT_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();

        } else if (ctx.scene.state.input_type === 'snipe-block-delay') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired block delay.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, SNIPE_INPUT_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();

        } else if (ctx.scene.state.input_type === 'snipe-eth-amount') {
            const s1: any = await SnipeTokenModel.findById(context.snipeId)
            const s = await s1.populate('token');
            const nativeSymbol = await getNativeCurrencySymbol(s.token.chain);

            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired buy amount (in ${nativeSymbol}) or percentage when liquidity is added.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, SNIPE_INPUT_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();


        } else if (ctx.scene.state.input_type === 'snipe-token-amount') {
            const s1: any = await SnipeTokenModel.findById(context.snipeId)
            const s = await s1.populate('token');

            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired buy amount (in ${s.token.symbol}) when liquidity is added.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, SNIPE_INPUT_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();


        } else if (ctx.scene.state.input_type === 'snipe-slippage-amount') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired slippage percentage.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, SNIPE_INPUT_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();


        } else if (ctx.scene.state.input_type === 'add-snipe-token') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `What's the token address to snipe?`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, SNIPE_INPUT_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();


        } else if (ctx.scene.state.input_type === 'snipe-select-method-id') {
            const s1: any = await SnipeTokenModel.findById(context.snipeId)
            await s1.populate('token')

            const apiURL = await getBlockExplorerApiEndpoint(s1.token.chain)
            const apiKey = await getBlockExplorerApiKey(s1.token.chain)
            const fullURL = apiURL + `/api?module=contract&action=getabi&apikey=${apiKey}&address=${s1.token.address}`
            const response = await axios.get(fullURL)

            let abis = [
                {
                    name: "Add Liquidity",
                    method: '0xe8e33700'
                },
                {
                    name: "Add Liquidity ETH",
                    method: '0xf305d719'
                },
            ]
            if (response.data.status === '1') {
                const abi = JSON.parse(response.data.result)
                const web3 = new Web3('http://localhost')
                const contract = new web3.eth.Contract(abi, AddressZero)
                abis = contract._jsonInterface.filter(j => j.type === 'function' && j.stateMutability !== 'view' && j.stateMutability !== 'pure').map(j => {
                    return {
                        name: j.name,
                        method: j.signature
                    }
                })
            }

            // Contract is not verified on etherscan
            if (response.data.status === '0') {
                const chain = s1.token.chain
                const rpcUrl = await getRPC("", chain)
                const web3 = await getWeb3(chain, rpcUrl);
                const responseNotVerified = await decodeNotVerifiedAbi(web3, s1.token.address)

                if (responseNotVerified.length > 0) {
                    abis = responseNotVerified.filter(hex => hex.length).map(j => {
                        return {
                            name: j[0].name,
                            method: j[0].signature
                        }
                    })
                    context.betaFlags = true;
                }

            }



            if (abis.length > 0) {
                context.methodIds = abis

                const methodsPagination = getSnipeMethodIdPagination(abis)
                const text = snipeMethodIdmessage(context.betaFlags);

                ret = await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    context.msgId,
                    0,
                    text,
                    {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: markupSnipeChooseMethodId(methodsPagination, context.snipeId)
                    }
                );
            } else {
                await ctx.telegram.sendMessage("❌ Ops something is wrong, try again using /sniper");
            }

            await new SceneStageService().saveScene(telegramId, SNIPE_INPUT_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        } else if (ctx.scene.state.input_type === 'snipe-max-buy-tax') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired <b>maximum buy tax</b> in percentage.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, SNIPE_INPUT_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        } else if (ctx.scene.state.input_type === 'snipe-max-sell-tax') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired <b>maximum sell tax</b> in percentage.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, SNIPE_INPUT_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();
        } else if (ctx.scene.state.input_type === 'snipe-max-gas-amount') {
            ret = await ctx.telegram.sendMessage(ctx.chat.id, `Reply to this message with your desired max gas to snipe.`, {
                parse_mode: botEnum.PARSE_MODE_V2,
                reply_markup: {
                    force_reply: true
                }
            });

            await new SceneStageService().saveScene(telegramId, SNIPE_INPUT_LISTENER, JSON.stringify(context), new Date());
            await ctx.scene.leave();


        }
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});
