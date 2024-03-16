import { sendBotMessage } from "../../service/app.service"
import { getAppUser, userVerboseLog } from "../../service/app.user.service"
import { getGasPrice } from "../../service/chain.service"
import { processError } from "../../service/error"
import { getSettings } from "../../service/settings.service"
import { getTokenInfo } from "../../service/token.service"
import { getMultiWallets, getWallet } from "../../service/wallet.service"
import Logging from "../../utils/logging"
import { getBlockExplorer, getBotInstance, getNativeCurrencyDecimal, getNativeCurrencySymbol } from "../chain.parameters"
import { swapETHForToken, swapTokenForETH } from "../dex.interaction"
import { getAmountsInExtV2 } from "../dex/v2/v2.calculate"
import { getPathFromTokenV2, getPathToTokenV2 } from "../dex/v2/v2.path"
import { getAmountsInExtV3 } from "../dex/v3/v3.calculate"
import { getPathFromTokenV3, getPathToTokenV3 } from "../dex/v3/v3.path"
import { getTokenSimpleInfo } from "../token.interaction"
import { getBN } from "../web3.operation"

export async function executeCopyTradeEvent(ctDB: any, log: any, event: any) {
    const txLog = log.log
    const receipt = log.receipt
    const transaction = log.receipt.transaction
    const chain = ctDB.chain
    const telegramId = ctDB.user.telegramId

    try {
        const token = event.token
        if (event.target !== event.from && event.target !== event.to) {
            throw new Error(`Invalid copytrade\n\nChain: <code>${chain}</code>\nTransaction: <code>${transaction.hash}</code>\nLogIndex: <b>${txLog.logIndex}</b>`)
        }
        const type = event.from === event.target ? 'sell' : 'buy'

        const tres = await Promise.all([
            getAppUser(telegramId),
            getMultiWallets(telegramId),
            getWallet(telegramId),
            getSettings(telegramId, chain),
            getNativeCurrencyDecimal(chain),
            getNativeCurrencySymbol(chain),
            getBlockExplorer(chain),
            getGasPrice(chain)
        ])

        const BN = getBN()
        const user = tres[0]
        const multiWallets = tres[1]
        const mainWallet = tres[2]
        const setting = tres[3]
        const nativeDecimals = tres[4]
        const nativeSymbol = tres[5]
        const explorerURL = tres[6]
        const netGasPrice = tres[7].toString()

        const wallets = (ctDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

        for (const w of wallets) {
            try {
                const tInfo = await getTokenSimpleInfo(telegramId, chain, event.token, w.address)
                await userVerboseLog(telegramId, `copy trade of ${event.target} on [${chain}] - ${w.address}:${tInfo.symbol} ${type} - tx: ${transaction.hash}, log: #${txLog.logIndex}`)

                if (type === 'buy') {
                    let tokenAmount = BN(event.value).div(BN(`1e${tInfo.decimals}`))

                    let amountIn = '0'
                    {
                        let v2Path
                        let v3Path
                        let amn

                        try {
                            v2Path = await getPathToTokenV2(chain, token)
                        } catch (err) {
                            try {
                                v3Path = await getPathToTokenV3(chain, token)
                            } catch (err) { }
                        }

                        let factory
                        if (v2Path) {
                            amn = await getAmountsInExtV2(chain, tokenAmount, v2Path)
                            factory = v2Path.factory
                        } else if (v3Path) {
                            amn = await getAmountsInExtV3(chain, tokenAmount, v3Path)
                            factory = v3Path.factory
                        } else {
                            throw new Error(`[executeCopyTradeEvent:getAmountsInExt] Failed to calculate <b>${nativeSymbol}</b> amount to buy <b>${parseFloat(BN(tokenAmount).toFixed(4))} ${tInfo.symbol}</b>`)
                        }

                        amountIn = BN(amn).times(BN(`1e${nativeDecimals}`)).toString()
                    }

                    let ethAmount = BN(amountIn)
                    if (BN(ctDB.autoBuyAmount || '0').gt(BN(0)) && ethAmount.gt(BN(ctDB.autoBuyAmount).times(BN(`1e${nativeDecimals}`)))) {
                        ethAmount = BN(ctDB.autoBuyAmount).times(BN(`1e${nativeDecimals}`))
                    }

                    const label = `<b>Buy</b> 🔗 <b>${chain}</b>\n<code>${w.address}</code>\n\nCopy trade of <code>${event.target}</code>\nSwapping <b>${parseFloat(ethAmount.div(BN(`1e${nativeDecimals}`)).toFixed(4))} ${nativeSymbol}</b> to <b>${parseFloat(BN(tokenAmount).toFixed(4))} ${tInfo.symbol}</b>\nTransaction: <code>${transaction.hash}</code>\nLog: <b>#${txLog.logIndex}</b>`

                    // test label
                    await sendBotMessage(telegramId, label)

                    await swapETHForToken(telegramId, chain, {
                        token: token,
                        recipient: w.address
                    }, {
                        address: w,
                        value: ethAmount.integerValue().toString(),
                        gasPrice: ctDB.autoBuyGasPrice ? BN(ctDB.autoBuyGasPrice).times('1e9').integerValue().toString() : undefined
                    }, label)
                } else if (type === 'sell') {
                    let tokenAmount = BN(event.value).div(BN(`1e${tInfo.decimals}`))

                    if (tokenAmount.gt(tInfo.balance)) {
                        tokenAmount = BN(tInfo.balance)
                    }

                    const label = `<b>Sell</b> 🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy trade of <code>${event.target}</code>\nSwapping <b>${parseFloat(tokenAmount.toFixed(4))} ${tInfo.symbol}</b> for <b>${nativeSymbol}</b>\nTransaction: <code>${transaction.hash}</code>\nLog: <b>#${txLog.logIndex}</b>`

                    // test label
                    await sendBotMessage(telegramId, label)

                    await swapTokenForETH(telegramId, chain, {
                        token: token,
                        recipient: w.address,
                        amount: tokenAmount.times(BN(`1e${tInfo.decimals}`)).integerValue().toString()
                    }, {
                        address: w
                    }, label)
                }
            } catch (err) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(`[executeCopyTradeEvent] ${chain}, ${transaction.hash}#${txLog.logIndex}, ${err.message}`)
                await sendBotMessage(telegramId, `❌ Error copying trade of <code>${event.target}</code>\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${transaction.hash}, log #${txLog.logIndex}\n\n${err.message}`)
            }
        }
    } catch (err) {
        await processError(getBotInstance(), telegramId, err)
    }
}
