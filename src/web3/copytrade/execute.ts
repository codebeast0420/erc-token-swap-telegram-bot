import { CopyTradeModel } from "../../models/copytrade.model";
import { TokenInfoModel } from "../../models/token.info.model";
import { TransactionHistoryModel } from "../../models/transaction.history.model";
import { getAppUser, userVerboseLog } from "../../service/app.user.service";
import { getSettings } from "../../service/settings.service";
import { getTxCallback } from "../../service/transaction.backup.service";
import { getMultiWallets, getWallet } from "../../service/wallet.service";
import { getBlockExplorer, getNativeCurrencyDecimal, getNativeCurrencyPrice, getNativeCurrencySymbol } from "../chain.parameters";
import { getBN, sendTxn } from "../web3.operation";
import { prefetchTokensOnChain } from "../multicall";
import { getTokenPrice, getTokenTaxInfo } from "../../service/token.service";
import { updateBuyMonitorInfo, updateSellMonitorInfo } from "../../service/monitor.service";
import { approveTokenExt, getTokenSimpleInfo, isTokenApprovedExt } from "../token.interaction";
import Logging from "../../utils/logging";
import { ChainModel } from "../../models/chain.model";
import SmartRouter from '../abi/SmartRouter.json'
import { externalInvokeMonitor } from "../../commands/monitor";
import { updateUserState } from "../../service/stat.service";
import { sendBotMessage } from "../../service/app.service";
import { getPathFromTokenV2, getPathToTokenV2 } from "../dex/v2/v2.path";
import { getAmountsInExtV2, getAmountsOutExtV2 } from "../dex/v2/v2.calculate";
import { getPathFromTokenV3, getPathToTokenV3 } from "../dex/v3/v3.path";
import { getAmountsInExtV3, getAmountsOutExtV3 } from "../dex/v3/v3.calculate";
import { getGasPrice } from "../../service/chain.service";

const Web3 = require('web3')

let smartRouterContractInst
let absWeb3
function getWeb3() {
    if (absWeb3 === undefined) {
        absWeb3 = new Web3('http://localhost')
    }

    return absWeb3
}

function getSmartRouterContract() {
    if (smartRouterContractInst === undefined) {
        const web3 = getWeb3()
        smartRouterContractInst = new web3.eth.Contract(SmartRouter.abi, '0x0000000000000000000000000000000000000000')
    }
    return smartRouterContractInst;
}

export async function executeRouterFunction(fn: any, decoded: any, tx: any, copytradeDB: any) {
    const telegramId = copytradeDB.user.telegramId
    const chain = copytradeDB.chain

    if (fn.name === 'swapExactETHForTokens') {
        /**
         * bsc: 0x8cf6d37d2483ae14d393cd4d85a570ad4955a3c19a3220ecd5ee8e4683514fdf
         * bsc: 0xcb3ee2e3931cd5df1cc9c13170c1c1898668e0c6694c9776a889878a14a6a9aa
         * bsc: 0xbbb04d2dac407d1cd607918c0e06c86a20582bda18d483e97e12f1033ba4e47b
         */
        await copytrade_swapExactETHForTokens(telegramId, chain, tx, decoded, fn, copytradeDB)
    } else if (fn.name === 'swapExactTokensForETH') {
        /**
         * bsc: 0x933c06d51fcae0c17225c4142b5c8bcd5c9b020d80173e57c66c0c6a09fc4cc4
         */
        await copytrade_swapExactTokensForETH(telegramId, chain, tx, decoded, fn, copytradeDB)
    } else if (fn.name === 'swapTokensForExactTokens') {
        /**
         * bsc: 0x37cc047d4666bfb044450348f290f271499e4e2a6ecbf59720234bd6a20c4f14
         */
        await copytrade_swapTokensForExactTokens(telegramId, chain, tx, decoded, fn, copytradeDB)
    } else if (fn.name === 'swapExactTokensForTokens') {
        /**
         * bsc: 0x03b244666227187d9c1bb7b7b20fa6316ab14101226a046f74f376e74a1c1bd6
         * bsc: 0xba0b8280b9748c906ff9d0e01e09df74478aafcece666785c713acc36878d724
         */
        await copytrade_swapExactTokensForTokens(telegramId, chain, tx, decoded, fn, copytradeDB)
    } else if (fn.name === 'swapETHForExactTokens') {
        /**
         * bsc: 0xbdd3ac4a8cc7077dfd29661d00b70852047625c38b63bbb17070db204c9b8862
         * bsc: 0x8518226c46ee1475b6f1062ab7354cf1a2f15409e3620d052f8fecd81db981e1
         */
        await copytrade_swapETHForExactTokens(telegramId, chain, tx, decoded, fn, copytradeDB)
    } else if (fn.name === 'swapExactTokensForETHSupportingFeeOnTransferTokens') {
        /**
         * bsc: 0x9ae20f0b98af52795e3df5dea204b63b94aeae6567ec5a84f3d5bb3df7caefb6
         * bsc: 0xd93ea233947dac207e1befb93201011043584ab4023abe10699f1128341ab8a5
         * bsc: 0xff78091f6f6490c9f7cf1d0eef8e833dd590299dedb0e9e8f29457e381aa285c
         */
        await copytrade_swapExactTokensForETHSupportingFeeOnTransferTokens(telegramId, chain, tx, decoded, fn, copytradeDB)
    } else if (fn.name === 'swapExactTokensForTokensSupportingFeeOnTransferTokens') {
        /**
         * bsc: 0x05dc36655bb6fda72f84f8ece2bccbd2d139349c0f858520fc47c74d38078e9b
         * bsc: 0xd48857b00929e930b249a2398ed6f6add1324462eac24e41a4b28921c4d18b90
         */
        await copytrade_swapExactTokensForTokensSupportingFeeOnTransferTokens(telegramId, chain, tx, decoded, fn, copytradeDB)
    } else if (fn.name === 'swapExactETHForTokensSupportingFeeOnTransferTokens') {
        /**
         * bsc: 0xc036471a326521ab3350f86ea734e4aae8245a59ce8d90f6ca0893b4d084af80
         * bsc: 0x51b08ca3040b83697a5930cfece038d26955cbf3d69d602458a6fb0357a366ce
         */
        await copytrade_swapExactETHForTokensSupportingFeeOnTransferTokens(telegramId, chain, tx, decoded, fn, copytradeDB)
    } else if (fn.name === 'swapTokensForExactETH') {
        /**
         * bsc: 0xe995647ecc02c9f55425536630b480893245041def31ec8a4cc90231be93c000
         * bsc: 0x7fec8d1c1f24823a0a4ec0c2cd9b904777cc30e3cb06d90550d2d40ae4485d2e
         */
        await copytrade_swapTokensForExactETH(telegramId, chain, tx, decoded, fn, copytradeDB)
    } else if (fn.name === 'exactInputSingle') {
        /**
         * bsc: 0xfabb0e6908922c456dcfdb5a7960b8eb3dd037aca2e11891b9b88fa3b528702c
         */
        await copytrade_exactInputSingle(telegramId, chain, tx, decoded, fn, copytradeDB)
    } else if (fn.name === 'exactInput') {
        /**
         * 
         */
        await copytrade_exactInput(telegramId, chain, tx, decoded, fn, copytradeDB)
    } else if (fn.name === 'exactOutputSingle') {
        /**
         * 0x3941cbd294acf6323ed1de7b8ee1b827b0b2a0dbafd2260334375475d234fb03
         */
        await copytrade_exactOutputSingle(telegramId, chain, tx, decoded, fn, copytradeDB)
    } else if (fn.name === 'exactOutput') {
        /**
         * 
         */
        await copytrade_exactOutput(telegramId, chain, tx, decoded, fn, copytradeDB)
    } else if (fn.name === 'multicall') {
        /**
         * 0x1ab704accd59fbfb02308adf66ba9dcd29e5192b6c6593368a0ef830c99f1ec5
         * 0x9aabbc05388ba5a77c465794c4fadbf12277ce0683a58048cc78f3aa3a5eee45
         * 0xbb2cc150ddf2f7f6d95dcf853cfe4089d6b9d1859f9a27bfb6ee47e5ca267a01
         * 0xd1d9538f15529e7d1e06ce32d18bf3d044668685f39aed66e39a81339518eecc
         */
        await copytrade_multicall(telegramId, chain, tx, decoded, fn, copytradeDB)
    } else if (fn.name === 'exactInputStableSwap') {
    } else if (fn.name === 'addLiquidityETH') {
    } else if (fn.name === 'addLiquidity') {
    } else if (fn.name === 'removeLiquidity') {
    } else if (fn.name === 'removeLiquidityETH') {
    } else if (fn.name === 'removeLiquidityWithPermit') {
    } else if (fn.name === 'removeLiquidityETHWithPermit') {
    } else if (fn.name === 'removeLiquidityETHWithPermitSupportingFeeOnTransferTokens') {
    } else if (fn.name === 'removeLiquidityETHSupportingFeeOnTransferTokens') {
    } else if (fn.name === 'renounceOwnership') {
    } else if (fn.name === 'transferOwnership') {
    } else if (fn.name === 'refundETH') {
    }
}

export async function copytrade_swapExactETHForTokens(telegramId: string, chain: string, tx: any, decoded: any, functionABI: any, copytradeDB: any) {
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
    const routerAddress = tx.to.toLowerCase()

    const tokenAddress = decoded.path[decoded.path.length - 1].toLowerCase()
    let targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
    if (targetTokenInfo === null) {
        await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
        targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
    }

    // regulating parameters...
    const wallets = (copytradeDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

    const slippage = copytradeDB.autoBuySlippage ?? setting.slippage ?? 100
    let ethAmount = BN(tx.value)
    if (BN(copytradeDB.autoBuyAmount || '0').gt(BN(0)) && ethAmount.gt(BN(copytradeDB.autoBuyAmount).times(BN(`1e${nativeDecimals}`)))) {
        ethAmount = BN(copytradeDB.autoBuyAmount).times(BN(`1e${nativeDecimals}`))
    }

    let tokenAmount = '0'
    let amountOutMin = '0'
    {
        let v2Path
        let amountOut

        try {
            v2Path = await getPathToTokenV2(chain, tokenAddress)
        } catch (err) {
        }

        const ethAmountDecimal = ethAmount.div(BN(`1e${nativeDecimals}`)).toString()
        let factory
        if (v2Path) {
            amountOut = await getAmountsOutExtV2(chain, ethAmountDecimal, v2Path)
            factory = v2Path.factory
        } else {
            throw new Error(`[copytrade_swapExactETHForTokens:getAmountsOutExtV2] Failed to calculate <b>${targetTokenInfo.symbol}</b> amount to buy by <b>${ethAmountDecimal} ${nativeSymbol}</b>`)
        }

        tokenAmount = BN(amountOut).times(BN(`1e${targetTokenInfo.decimals}`)).integerValue().toString()
        amountOutMin = BN(tokenAmount).times(BN(100 - slippage)).div(100).integerValue().toString()
    }

    const nativeAmount = parseFloat(ethAmount.div(BN(`1e${nativeDecimals}`)).toFixed(4))

    // committing transactions...
    for (const w of wallets) {
        try {
            await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${nativeAmount} ${nativeSymbol} for ${BN(tokenAmount).div(BN(`1e${targetTokenInfo.decimals}`).toString())} ${targetTokenInfo.symbol} : ${tx.hash}`)

            const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${nativeAmount} ${nativeSymbol}</b> to <b>${parseFloat(BN(tokenAmount).div(BN(`1e${targetTokenInfo.decimals}`).toFixed(4)))} ${targetTokenInfo.symbol}</b>`
            const callback = getTxCallback(label)

            const retTx = await sendTxn(
                telegramId,
                chain,
                {
                    abi: [functionABI],
                    functionName: functionABI.name,
                    args: [amountOutMin, decoded.path, w.address, '0xffffffff']
                },
                {
                    to: routerAddress,
                    address: w,
                    value: ethAmount.integerValue().toString(),
                    gasPrice: BN(copytradeDB.autoBuyGasPrice || '0').gt(BN(0)) ? BN(copytradeDB.autoBuyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : BN(setting.buyGasPrice || '0').gt(BN(0)) ? BN(setting.buyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                },
                {
                    callback: callback,
                    exInfo: {
                        telegramId: telegramId,
                        chain: chain,
                        token: tokenAddress,
                        user: w.address,
                        type: 'buy',
                        tokenAmount: tokenAmount,
                        ethAmount: ethAmount.integerValue().toString()
                    }
                }
            );

            if (retTx?.transactionHash) {
                const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                if (txFound !== null) {
                    const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                    itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                    await itemDbUpdate.save()
                }

                const user = await getAppUser(telegramId)
                await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
            }

            await updateUserState(telegramId, chain, 0, 0, undefined, ethAmount.integerValue().toString())
            const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
            await updateBuyMonitorInfo(chain, tokenAddress, w.address, BN(tokenAmount).times(BN(100).minus(BN(taxInfo?.buyTax || '0')).div(100)).integerValue().toString(), ethAmount.integerValue().toString())
        } catch (err) {
            console.error(`==> ${new Date().toLocaleString()}`)
            console.error(err)
            Logging.error(`[copytrade_swapExactETHForTokens] ${chain}, ${tx.hash}, ${err.message}`)
            await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
        }
    }
}

export async function copytrade_swapExactTokensForETH(telegramId: string, chain: string, tx: any, decoded: any, functionABI: any, copytradeDB: any) {
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
    const routerAddress = tx.to.toLowerCase()

    const tokenAddress = decoded.path[0].toLowerCase()
    let targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })

    if (targetTokenInfo === null) {
        await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
        targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
    }

    // regulating parameters...
    const wallets = (copytradeDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

    for (const w of wallets) {
        try {
            let tokenAmount = BN(decoded.amountIn).div(BN(`1e${targetTokenInfo.decimals}`))
            const tInfo = await getTokenSimpleInfo(telegramId, chain, tokenAddress, w.address)
            if (tokenAmount.gt(tInfo.balance)) {
                tokenAmount = BN(tInfo.balance)
            }

            const tokenAmountWithDecimals = tokenAmount.times(BN(`1e${targetTokenInfo.decimals}`)).integerValue().toString()

            let amountOutMin = '0'
            let ethAmount = '0'
            const slippage = setting.slippage ?? 100
            {
                let v2Path
                let amountOut

                try {
                    v2Path = await getPathFromTokenV2(chain, tokenAddress)
                } catch (err) {
                }

                let factory
                if (v2Path) {
                    amountOut = await getAmountsOutExtV2(chain, tokenAmount.toString(), v2Path)
                    factory = v2Path.factory
                } else {
                    throw new Error(`[copytrade_swapExactTokensForETH:getAmountsOutExtV2] Failed to calculate <b>${nativeSymbol}</b> amount to sell <b>${tokenAmount} ${targetTokenInfo.symbol}</b>`)
                }

                ethAmount = BN(amountOut).times(BN(`1e${nativeDecimals}`)).toString()
                amountOutMin = BN(ethAmount).times(BN(100 - slippage)).div(100).integerValue().toString()
            }

            await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${tokenAmount.toString()} ${targetTokenInfo.symbol} : ${tx.hash}`)

            const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${tokenAmount.toString()} ${targetTokenInfo.symbol}</b> to <b>${nativeSymbol}</b>`

            const callback = getTxCallback(label)

            if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddress, tokenAmountWithDecimals, routerAddress, w))) {
                await approveTokenExt(telegramId, chain, tokenAddress, routerAddress, w)
            }

            const retTx = await sendTxn(
                telegramId,
                chain,
                {
                    abi: [functionABI],
                    functionName: functionABI.name,
                    args: [tokenAmountWithDecimals, amountOutMin, decoded.path, w.address, '0xffffffff']
                },
                {
                    to: routerAddress,
                    address: w,
                    value: tx.value,
                    gasPrice: BN(setting.sellGasPrice || '0').gt(BN(0)) ? BN(setting.sellGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                },
                {
                    callback: callback,
                    exInfo: {
                        telegramId: telegramId,
                        chain: chain,
                        token: tokenAddress,
                        user: w.address,
                        type: 'sell',
                        tokenAmount: tokenAmountWithDecimals,
                        ethAmount: ethAmount
                    }
                }
            );

            if (retTx?.transactionHash) {
                const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                if (txFound !== null) {
                    const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                    itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                    await itemDbUpdate.save()
                }

                const user = await getAppUser(telegramId)
                await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
            }

            const tokenPrice = getTokenPrice(telegramId, chain, tokenAddress)
            const nativePrice = await getNativeCurrencyPrice(chain)

            await updateUserState(telegramId, chain, 0, 0, BN(tokenAmount).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString(), undefined)

            const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
            await updateSellMonitorInfo(chain, tokenAddress, w.address, tokenAmountWithDecimals, BN(ethAmount).times(BN(100).minus(BN(taxInfo?.sellTax || '0')).div(100)).integerValue().toString())
        } catch (err) {
            console.error(`==> ${new Date().toLocaleString()}`)
            console.error(err)
            Logging.error(`[copytrade_swapExactTokensForETH] ${chain}, ${tx.hash}, ${err.message}`)
            await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
        }
    }
}

export async function copytrade_swapTokensForExactTokens(telegramId: string, chain: string, tx: any, decoded: any, functionABI: any, copytradeDB: any) {
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
    const routerAddress = tx.to.toLowerCase()

    const tokenAddresses = [decoded.path[0].toLowerCase(), decoded.path[decoded.path.length - 1].toLowerCase()]
    let targetTokenInfo = await Promise.all(tokenAddresses.map(t => TokenInfoModel.findOne({ chain: chain, address: t })))
    if (targetTokenInfo[0] === null || targetTokenInfo[1] === null) {
        await prefetchTokensOnChain(chain, JSON.stringify(tokenAddresses))
        targetTokenInfo = await Promise.all(tokenAddresses.map(t => TokenInfoModel.findOne({ chain: chain, address: t })))
    }

    // regulating parameters...
    const wallets = (copytradeDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

    for (const w of wallets) {
        try {
            let tokenAmount = BN(decoded.amountOut).div(BN(`1e${targetTokenInfo[1].decimals}`))
            const tokenAmountWithDecimals = tokenAmount.times(BN(`1e${targetTokenInfo[1].decimals}`)).integerValue().toString()

            let amountInMax = '0'
            let amountIn = '0'
            const slippage = setting.slippage ?? 100
            {
                let v2Path0
                let v2Path1
                let amn

                try {
                    v2Path0 = await getPathFromTokenV2(chain, tokenAddresses[0])
                    v2Path1 = await getPathToTokenV2(chain, tokenAddresses[1])
                } catch (err) {
                }

                let factory
                if (v2Path0 && v2Path1) {
                    const intmn = await getAmountsInExtV2(chain, tokenAmount.toString(), v2Path1)
                    amn = await getAmountsInExtV2(chain, intmn, v2Path0)
                    factory = v2Path0.factory
                } else {
                    throw new Error(`[copytrade_swapTokensForExactTokens:getAmountsInExtV2] Failed to calculate <b>${targetTokenInfo[0].symbol}</b> amount to sell <b>${tokenAmount} ${targetTokenInfo[1].symbol}</b>`)
                }

                amountIn = BN(amn).times(BN(`1e${targetTokenInfo[0].decimals}`)).toString()
                amountInMax = slippage === 100 ? '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' : BN(amountIn).times(100).div(100 - slippage).integerValue().toString()
            }

            await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} for ${tokenAmount.toString()} ${targetTokenInfo[1].symbol} : ${tx.hash}`)

            const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${targetTokenInfo[0].symbol}</b> to <b>${parseFloat(tokenAmount.toFixed(4))} ${targetTokenInfo[1].symbol}</b>`;

            const tokenPrice = await getTokenPrice(telegramId, chain, tokenAddresses[1])
            const nativePrice = await getNativeCurrencyPrice(chain)

            const taxInfoSell = await getTokenTaxInfo(chain, tokenAddresses[0])

            const ethAmount = BN(tokenAmount).times(BN(100).minus(BN(taxInfoSell?.sellTax || '0')).div(100)).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString()

            const callback = getTxCallback(label)

            if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddresses[0], amountInMax, routerAddress, w))) {
                await approveTokenExt(telegramId, chain, tokenAddresses[0], routerAddress, w)
            }

            const retTx = await sendTxn(
                telegramId,
                chain,
                {
                    abi: [functionABI],
                    functionName: functionABI.name,
                    args: [tokenAmountWithDecimals, amountInMax, decoded.path, w.address, '0xffffffff']
                },
                {
                    to: routerAddress,
                    address: w,
                    value: tx.value,
                    gasPrice: BN(copytradeDB.autoBuyGasPrice || '0').gt(BN(0)) ? BN(copytradeDB.autoBuyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : BN(setting.buyGasPrice || '0').gt(BN(0)) ? BN(setting.buyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                },
                {
                    callback: callback,
                    exInfo: {
                        telegramId: telegramId,
                        chain: chain,
                        token: tokenAddresses[1],
                        user: w.address,
                        type: 'buy',
                        tokenAmount: tokenAmountWithDecimals,
                        ethAmount: ethAmount
                    }
                }
            );

            if (retTx?.transactionHash) {
                const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                if (txFound !== null) {
                    const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                    itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                    await itemDbUpdate.save()
                }

                const user = await getAppUser(telegramId)
                await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddresses[0])
            }

            await updateUserState(telegramId, chain, 0, 0, undefined, ethAmount)

            const taxInfo = await getTokenTaxInfo(chain, tokenAddresses[1])
            await updateBuyMonitorInfo(chain, tokenAddresses[1], w.address, BN(tokenAmountWithDecimals).times(BN(100).minus(BN(taxInfo?.buyTax || '0')).div(100)).integerValue().toString(), BN(ethAmount).times(BN(100).minus(BN(taxInfo?.buyTax || '0')).div(100)).integerValue().toString())
        } catch (err) {
            console.error(`==> ${new Date().toLocaleString()}`)
            console.error(err)
            Logging.error(`[copytrade_swapTokensForExactTokens] ${chain}, ${tx.hash}, ${err.message}`)
            await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
        }
    }
}

export async function copytrade_swapExactTokensForTokens(telegramId: string, chain: string, tx: any, decoded: any, functionABI: any, copytradeDB: any) {
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
    const routerAddress = tx.to.toLowerCase()

    const tokenAddresses = [decoded.path[0].toLowerCase(), decoded.path[decoded.path.length - 1].toLowerCase()]
    let targetTokenInfo = await Promise.all(tokenAddresses.map(t => TokenInfoModel.findOne({ chain: chain, address: t })))
    if (targetTokenInfo[0] === null || targetTokenInfo[1] === null) {
        await prefetchTokensOnChain(chain, JSON.stringify(tokenAddresses))
        targetTokenInfo = await Promise.all(tokenAddresses.map(t => TokenInfoModel.findOne({ chain: chain, address: t })))
    }

    // regulating parameters...
    const wallets = (copytradeDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

    for (const w of wallets) {
        try {
            let tokenAmount = BN(decoded.amountIn).div(BN(`1e${targetTokenInfo[0].decimals}`))
            const tInfo = await getTokenSimpleInfo(telegramId, chain, tokenAddresses[0], w.address)
            if (tokenAmount.gt(tInfo.balance)) {
                tokenAmount = BN(tInfo.balance)
            }

            const tokenAmountWithDecimals = tokenAmount.times(BN(`1e${targetTokenInfo[0].decimals}`)).integerValue().toString()

            let amountOutMin = '0'
            let amountOut = '0'
            const slippage = setting.slippage ?? 100
            {
                let v2Path0
                let v2Path1
                let amn

                try {
                    v2Path0 = await getPathFromTokenV2(chain, tokenAddresses[0])
                    v2Path1 = await getPathToTokenV2(chain, tokenAddresses[1])
                } catch (err) {
                }

                let factory
                if (v2Path0 && v2Path1) {
                    const intmn = await getAmountsOutExtV2(chain, tokenAmount.toString(), v2Path0)
                    amn = await getAmountsOutExtV2(chain, intmn, v2Path1)
                    factory = v2Path0.factory
                } else {
                    throw new Error(`[copytrade_swapExactTokensForTokens:getAmountsOutExtV2] Failed to calculate <b>${targetTokenInfo[1].symbol}</b> amount to sell <b>${tokenAmount} ${targetTokenInfo[0].symbol}</b>`)
                }

                amountOut = BN(amn).times(BN(`1e${targetTokenInfo[1].decimals}`)).toString()
                amountOutMin = BN(amountOut).times(100 - slippage).div(100).integerValue().toString()
            }

            await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${tokenAmount.toString()} ${targetTokenInfo[0].symbol} : ${tx.hash}`)

            const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${tokenAmount.toString()} ${targetTokenInfo[0].symbol}</b> to <b>${targetTokenInfo[1].symbol}</b>`

            const tokenPrice = await getTokenPrice(telegramId, chain, tokenAddresses[0])
            const nativePrice = await getNativeCurrencyPrice(chain)

            const taxInfoSell = await getTokenTaxInfo(chain, tokenAddresses[0])

            const ethAmount = BN(tokenAmount).times(BN(100).minus(BN(taxInfoSell?.sellTax || '0')).div(100)).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString()

            const callback = getTxCallback(label)

            if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddresses[0], tokenAmountWithDecimals, routerAddress, w))) {
                await approveTokenExt(telegramId, chain, tokenAddresses[0], routerAddress, w)
            }

            const retTx = await sendTxn(
                telegramId,
                chain,
                {
                    abi: [functionABI],
                    functionName: functionABI.name,
                    args: [tokenAmountWithDecimals, amountOutMin, decoded.path, w.address, '0xffffffff']
                },
                {
                    to: routerAddress,
                    address: w,
                    value: tx.value,
                    gasPrice: BN(setting.sellGasPrice || '0').gt(BN(0)) ? BN(setting.sellGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                },
                {
                    callback: callback,
                    exInfo: {
                        telegramId: telegramId,
                        chain: chain,
                        token: tokenAddresses[0],
                        user: w.address,
                        type: 'sell',
                        tokenAmount: tokenAmountWithDecimals,
                        ethAmount: ethAmount
                    }
                }
            );

            if (retTx?.transactionHash) {
                const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                if (txFound !== null) {
                    const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                    itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                    await itemDbUpdate.save()
                }
                const user = await getAppUser(telegramId)
                await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddresses[1])
            }

            await updateUserState(telegramId, chain, 0, 0, ethAmount, undefined)
            await updateSellMonitorInfo(chain, tokenAddresses[0], w.address, tokenAmountWithDecimals, ethAmount)
        } catch (err) {
            console.error(`==> ${new Date().toLocaleString()}`)
            console.error(err)
            Logging.error(`[copytrade_swapExactTokensForTokens] ${chain}, ${tx.hash}, ${err.message}`)
            await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
        }
    }
}

export async function copytrade_swapETHForExactTokens(telegramId: string, chain: string, tx: any, decoded: any, functionABI: any, copytradeDB: any) {
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
    const routerAddress = tx.to.toLowerCase()

    const tokenAddress = decoded.path[decoded.path.length - 1].toLowerCase()
    let targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
    if (targetTokenInfo === null) {
        await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
        targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
    }

    // regulating parameters...
    const wallets = (copytradeDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

    for (const w of wallets) {
        try {
            let tokenAmount = BN(decoded.amountOut).div(BN(`1e${targetTokenInfo.decimals}`))
            const tokenAmountWithDecimals = tokenAmount.times(BN(`1e${targetTokenInfo.decimals}`)).integerValue().toString()

            let amountInMin = '0'
            let amountIn = '0'
            const slippage = copytradeDB.autoBuySlippage ?? setting.slippage ?? 100
            {
                let v2Path
                let amn

                try {
                    v2Path = await getPathToTokenV2(chain, tokenAddress)
                } catch (err) {
                }

                let factory
                if (v2Path) {
                    amn = await getAmountsInExtV2(chain, tokenAmount, v2Path)
                    factory = v2Path.factory
                } else {
                    throw new Error(`[copytrade_swapETHForExactTokens:getAmountsInExtV2] Failed to calculate <b>${nativeSymbol}</b> amount to buy <b>${tokenAmount} ${targetTokenInfo.symbol}</b>`)
                }

                amountIn = BN(amn).times(BN(`1e${nativeDecimals}`)).toString()
                amountInMin = slippage === 100 ? '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' : BN(amountIn).times(100).div(100 - slippage).integerValue().toString()
            }

            const ethAmount = BN(amountIn)

            await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} for ${tokenAmount.toString()} ${targetTokenInfo.symbol} : ${tx.hash}`)

            const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${BN(amountIn).div(BN(`1e${nativeDecimals}`)).toString()} ${nativeSymbol}</b> to <b>${tokenAmount.toString()} ${targetTokenInfo.symbol}</b>`

            const callback = getTxCallback(label)

            const retTx = await sendTxn(
                telegramId,
                chain,
                {
                    abi: [functionABI],
                    functionName: functionABI.name,
                    args: [decoded.amountOut, decoded.path, w.address, '0xffffffff']
                },
                {
                    to: routerAddress,
                    address: w,
                    value: tx.value,
                    gasPrice: BN(copytradeDB.autoBuyGasPrice || '0').gt(BN(0)) ? BN(copytradeDB.autoBuyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : BN(setting.buyGasPrice || '0').gt(BN(0)) ? BN(setting.buyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                },
                {
                    callback: callback,
                    exInfo: {
                        telegramId: telegramId,
                        chain: chain,
                        token: tokenAddress,
                        user: w.address,
                        type: 'buy',
                        tokenAmount: tokenAmount,
                        ethAmount: ethAmount.integerValue().toString()
                    }
                }
            )

            if (retTx?.transactionHash) {
                const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                if (txFound !== null) {
                    const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                    itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                    await itemDbUpdate.save()
                }
                const user = await getAppUser(telegramId)
                await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
            }

            await updateUserState(telegramId, chain, 0, 0, undefined, amountIn)
            const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
            await updateBuyMonitorInfo(chain, tokenAddress, w.address, BN(tokenAmount).times(BN(100).minus(BN(taxInfo?.buyTax || '0')).div(100)).integerValue().toString(), ethAmount.integerValue().toString())
        } catch (err) {
            console.error(`==> ${new Date().toLocaleString()}`)
            console.error(err)
            Logging.error(`[copytrade_swapETHForExactTokens] ${chain}, ${tx.hash}, ${err.message}`)
            await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
        }
    }
}

export async function copytrade_swapExactTokensForETHSupportingFeeOnTransferTokens(telegramId: string, chain: string, tx: any, decoded: any, functionABI: any, copytradeDB: any) {
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
    const routerAddress = tx.to.toLowerCase()

    const tokenAddress = decoded.path[0].toLowerCase()
    let targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
    if (targetTokenInfo === null) {
        await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
        targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
    }

    // regulating parameters...
    const wallets = (copytradeDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

    for (const w of wallets) {
        try {
            let tokenAmount = BN(decoded.amountIn).div(BN(`1e${targetTokenInfo.decimals}`))
            const tInfo = await getTokenSimpleInfo(telegramId, chain, tokenAddress, w.address)
            if (tokenAmount.gt(tInfo.balance)) {
                tokenAmount = BN(tInfo.balance)
            }

            const tokenAmountWithDecimals = tokenAmount.times(BN(`1e${targetTokenInfo.decimals}`)).integerValue().toString()

            let amountOutMin = '0'
            let ethAmount = '0'
            const slippage = setting.slippage ?? 100
            {
                let v2Path
                let amountOut

                try {
                    v2Path = await getPathFromTokenV2(chain, tokenAddress)
                } catch (err) {
                }

                let factory
                if (v2Path) {
                    amountOut = await getAmountsOutExtV2(chain, tokenAmount.toString(), v2Path)
                    factory = v2Path.factory
                } else {
                    throw new Error(`[copytrade_swapExactTokensForETHSupportingFeeOnTransferTokens:getAmountsOutExtV2] Failed to calculate <b>${nativeSymbol}</b> amount to sell <b>${tokenAmount} ${targetTokenInfo.symbol}</b>`)
                }

                ethAmount = BN(amountOut).times(BN(`1e${nativeDecimals}`)).toString()
                amountOutMin = BN(ethAmount).times(BN(100 - slippage)).div(100).integerValue().toString()
            }

            await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${tokenAmount.toString()} ${targetTokenInfo.symbol} : ${tx.hash}`)

            const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${parseFloat(tokenAmount.toFixed(4))} ${targetTokenInfo.symbol}</b> to <b>${nativeSymbol}</b>`

            const callback = getTxCallback(label)

            if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddress, tokenAmountWithDecimals, routerAddress, w))) {
                await approveTokenExt(telegramId, chain, tokenAddress, routerAddress, w)
            }

            const retTx = await sendTxn(
                telegramId,
                chain,
                {
                    abi: [functionABI],
                    functionName: functionABI.name,
                    args: [tokenAmountWithDecimals, amountOutMin, decoded.path, w.address, '0xffffffff']
                },
                {
                    to: routerAddress,
                    address: w,
                    value: tx.value,
                    gasPrice: BN(setting.sellGasPrice || '0').gt(BN(0)) ? BN(setting.sellGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                },
                {
                    callback: callback,
                    exInfo: {
                        telegramId: telegramId,
                        chain: chain,
                        token: tokenAddress,
                        user: w.address,
                        type: 'sell',
                        tokenAmount: tokenAmountWithDecimals,
                        ethAmount: ethAmount
                    }
                }
            );

            if (retTx?.transactionHash) {
                const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                if (txFound !== null) {
                    const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                    itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                    await itemDbUpdate.save()
                }
                const user = await getAppUser(telegramId)
                await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
            }

            const tokenPrice = getTokenPrice(telegramId, chain, tokenAddress)
            const nativePrice = await getNativeCurrencyPrice(chain)

            await updateUserState(telegramId, chain, 0, 0, BN(tokenAmount).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString(), undefined)

            const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
            await updateSellMonitorInfo(chain, tokenAddress, w.address, tokenAmountWithDecimals, BN(ethAmount).times(BN(100).minus(BN(taxInfo?.sellTax || '0')).div(100)).integerValue().toString())
        } catch (err) {
            console.error(`==> ${new Date().toLocaleString()}`)
            console.error(err)
            Logging.error(`[copytrade_swapExactTokensForETHSupportingFeeOnTransferTokens] ${chain}, ${tx.hash}, ${err.message}`)
            await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
        }
    }
}

export async function copytrade_swapExactTokensForTokensSupportingFeeOnTransferTokens(telegramId: string, chain: string, tx: any, decoded: any, functionABI: any, copytradeDB: any) {
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
    const routerAddress = tx.to.toLowerCase()

    const tokenAddresses = [decoded.path[0].toLowerCase(), decoded.path[decoded.path.length - 1].toLowerCase()]
    let targetTokenInfo = await Promise.all(tokenAddresses.map(t => TokenInfoModel.findOne({ chain: chain, address: t })))
    if (targetTokenInfo[0] === null || targetTokenInfo[1] === null) {
        await prefetchTokensOnChain(chain, JSON.stringify(tokenAddresses))
        targetTokenInfo = await Promise.all(tokenAddresses.map(t => TokenInfoModel.findOne({ chain: chain, address: t })))
    }

    // regulating parameters...
    const wallets = (copytradeDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

    for (const w of wallets) {
        try {
            let tokenAmount = BN(decoded.amountIn).div(BN(`1e${targetTokenInfo[0].decimals}`))
            const tInfo = await getTokenSimpleInfo(telegramId, chain, tokenAddresses[0], w.address)
            if (tokenAmount.gt(tInfo.balance)) {
                tokenAmount = BN(tInfo.balance)
            }

            const tokenAmountWithDecimals = tokenAmount.times(BN(`1e${targetTokenInfo[0].decimals}`)).integerValue().toString()

            let amountOutMin = '0'
            let amountOut = '0'
            const slippage = setting.slippage ?? 100
            {
                let v2Path0
                let v2Path1
                let amn

                try {
                    v2Path0 = await getPathFromTokenV2(chain, tokenAddresses[0])
                    v2Path1 = await getPathToTokenV2(chain, tokenAddresses[1])
                } catch (err) {
                }

                let factory
                if (v2Path0 && v2Path1) {
                    const intmn = await getAmountsOutExtV2(chain, tokenAmount.toString(), v2Path0)
                    amn = await getAmountsOutExtV2(chain, intmn, v2Path1)
                    factory = v2Path0.factory
                } else {
                    throw new Error(`[copytrade_swapExactTokensForTokensSupportingFeeOnTransferTokens:getAmountsOutExtV2] Failed to calculate <b>${targetTokenInfo[1].symbol}</b> amount to sell <b>${tokenAmount} ${targetTokenInfo[0].symbol}</b>`)
                }

                amountOut = BN(amn).times(BN(`1e${targetTokenInfo[1].decimals}`)).toString()
                amountOutMin = BN(amountOut).times(100 - slippage).div(100).integerValue().toString()
            }

            await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${tokenAmount.toString()} ${targetTokenInfo[0].symbol} : ${tx.hash}`)

            const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${parseFloat(tokenAmount.toFixed(4))} ${targetTokenInfo[0].symbol}</b> to <b>${targetTokenInfo[1].symbol}</b>`

            const tokenPrice = await getTokenPrice(telegramId, chain, tokenAddresses[0])
            const nativePrice = await getNativeCurrencyPrice(chain)

            const taxInfoSell = await getTokenTaxInfo(chain, tokenAddresses[0])

            const ethAmount = BN(tokenAmount).times(BN(100).minus(BN(taxInfoSell?.sellTax || '0')).div(100)).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString()

            const callback = getTxCallback(label)

            if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddresses[0], tokenAmountWithDecimals, routerAddress, w))) {
                await approveTokenExt(telegramId, chain, tokenAddresses[0], routerAddress, w)
            }

            const retTx = await sendTxn(
                telegramId,
                chain,
                {
                    abi: [functionABI],
                    functionName: functionABI.name,
                    args: [tokenAmountWithDecimals, amountOutMin, decoded.path, w.address, '0xffffffff']
                },
                {
                    to: routerAddress,
                    address: w,
                    value: tx.value,
                    gasPrice: BN(setting.sellGasPrice || '0').gt(BN(0)) ? BN(setting.sellGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                },
                {
                    callback: callback,
                    exInfo: {
                        telegramId: telegramId,
                        chain: chain,
                        token: tokenAddresses[0],
                        user: w.address,
                        type: 'sell',
                        tokenAmount: tokenAmountWithDecimals,
                        ethAmount: ethAmount
                    }
                }
            );

            if (retTx?.transactionHash) {
                const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                if (txFound !== null) {
                    const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                    itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                    await itemDbUpdate.save()
                }
                const user = await getAppUser(telegramId)
                await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddresses[1])
            }

            await updateUserState(telegramId, chain, 0, 0, ethAmount, undefined)
            await updateSellMonitorInfo(chain, tokenAddresses[0], w.address, tokenAmountWithDecimals, ethAmount)
        } catch (err) {
            console.error(`==> ${new Date().toLocaleString()}`)
            console.error(err)
            Logging.error(`[copytrade_swapExactTokensForTokensSupportingFeeOnTransferTokens] ${chain}, ${tx.hash}, ${err.message}`)
            await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
        }
    }
}

export async function copytrade_swapExactETHForTokensSupportingFeeOnTransferTokens(telegramId: string, chain: string, tx: any, decoded: any, functionABI: any, copytradeDB: any) {
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
    const routerAddress = tx.to.toLowerCase()

    const tokenAddress = decoded.path[decoded.path.length - 1].toLowerCase()
    let targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
    if (targetTokenInfo === null) {
        await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
        targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
    }

    // regulating parameters...
    const wallets = (copytradeDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

    const slippage = copytradeDB.autoBuySlippage ?? setting.slippage ?? 100
    let ethAmount = BN(tx.value)
    if (BN(copytradeDB.autoBuyAmount || '0').gt(BN(0)) && ethAmount.gt(BN(copytradeDB.autoBuyAmount).times(BN(`1e${nativeDecimals}`)))) {
        ethAmount = BN(copytradeDB.autoBuyAmount).times(BN(`1e${nativeDecimals}`))
    }

    let tokenAmount = '0'
    let amountOutMin = '0'
    {
        let v2Path
        let amountOut

        try {
            v2Path = await getPathToTokenV2(chain, tokenAddress)
        } catch (err) {
        }

        const ethAmountDecimal = ethAmount.div(BN(`1e${nativeDecimals}`)).toString()
        let factory
        if (v2Path) {
            amountOut = await getAmountsOutExtV2(chain, ethAmountDecimal, v2Path)
            factory = v2Path.factory
        } else {
            throw new Error(`[copytrade_swapExactETHForTokensSupportingFeeOnTransferTokens:getAmountsOutExtV2] Failed to calculate <b>${targetTokenInfo.symbol}</b> amount to buy by <b>${ethAmountDecimal} ${nativeSymbol}</b>`)
        }

        tokenAmount = BN(amountOut).times(BN(`1e${targetTokenInfo.decimals}`)).toString()
        amountOutMin = BN(tokenAmount).times(BN(100 - slippage)).div(100).integerValue().toString()
    }

    const nativeAmount = parseFloat(ethAmount.div(BN(`1e${nativeDecimals}`)).toFixed(4))

    for (const w of wallets) {
        try {
            await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${nativeAmount} ${nativeSymbol} : ${tx.hash}`)

            const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${nativeAmount} ${nativeSymbol}</b> to <b>${targetTokenInfo.symbol}</b>`

            const callback = getTxCallback(label);

            const retTx = await sendTxn(
                telegramId,
                chain,
                {
                    abi: [functionABI],
                    functionName: functionABI.name,
                    args: [amountOutMin, decoded.path, w.address, '0xffffffff']
                },
                {
                    to: routerAddress,
                    address: w,
                    value: ethAmount.integerValue().toString(),
                    gasPrice: BN(copytradeDB.autoBuyGasPrice || '0').gt(BN(0)) ? BN(copytradeDB.autoBuyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : BN(setting.buyGasPrice || '0').gt(BN(0)) ? BN(setting.buyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                },
                {
                    callback: callback,
                    exInfo: {
                        telegramId: telegramId,
                        chain: chain,
                        token: tokenAddress,
                        user: w.address,
                        type: 'buy',
                        tokenAmount: tokenAmount,
                        ethAmount: ethAmount.integerValue().toString()
                    }
                }
            );

            if (retTx?.transactionHash) {
                const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                if (txFound !== null) {
                    const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                    itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                    await itemDbUpdate.save()
                }
                const user = await getAppUser(telegramId)
                await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
            }

            await updateUserState(telegramId, chain, 0, 0, undefined, ethAmount.integerValue().toString())
            const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
            await updateBuyMonitorInfo(chain, tokenAddress, w.address, BN(tokenAmount).times(BN(100).minus(BN(taxInfo?.buyTax || '0')).div(100)).integerValue().toString(), ethAmount.integerValue().toString())
        } catch (err) {
            console.error(`==> ${new Date().toLocaleString()}`)
            console.error(err)
            Logging.error(`[copytrade_swapExactETHForTokensSupportingFeeOnTransferTokens] ${chain}, ${tx.hash}, ${err.message}`)
            await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
        }
    }
}

export async function copytrade_swapTokensForExactETH(telegramId: string, chain: string, tx: any, decoded: any, functionABI: any, copytradeDB: any) {
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
    const routerAddress = tx.to.toLowerCase()

    const tokenAddress = decoded.path[0].toLowerCase()
    let targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
    if (targetTokenInfo === null) {
        await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
        targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
    }

    // regulating parameters...
    const wallets = (copytradeDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

    const ethAmount = decoded.amountOut

    for (const w of wallets) {
        try {
            let amountInMax = '0'
            let amountIn = '0'
            const slippage = setting.slippage ?? 100
            {
                let v2Path
                let amn

                try {
                    v2Path = await getPathFromTokenV2(chain, tokenAddress)
                } catch (err) {
                }

                const ethAmountDecimal = BN(ethAmount).div(BN(`1e${nativeDecimals}`)).toString()
                let factory
                if (v2Path) {
                    amn = await getAmountsInExtV2(chain, ethAmountDecimal, v2Path)
                    factory = v2Path.factory
                } else {
                    throw new Error(`[copytrade_swapTokensForExactETH:getAmountsInExtV2] Failed to calculate <b>${targetTokenInfo.symbol}</b> amount to buy <b>${ethAmountDecimal} ${nativeSymbol}</b>`)
                }

                amountIn = BN(amn).times(BN(`1e${targetTokenInfo.decimals}`)).toString()
                amountInMax = slippage === 100 ? '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' : BN(amountIn).times(100).div(100 - slippage).integerValue().toString()
            }

            const tokenAmountWithDecimals = amountIn
            const tokenAmount = BN(tokenAmountWithDecimals).div(BN(`1e${targetTokenInfo.decimals}`)).toString()

            await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} ${targetTokenInfo.symbol} for ${BN(ethAmount).div(BN(`1e${nativeDecimals}`)).toString()} ${nativeSymbol} : ${tx.hash}`)

            const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${targetTokenInfo.symbol}</b> to <b>${BN(ethAmount).div(BN(`1e${nativeDecimals}`)).toString()} ${nativeSymbol}</b>`;

            const callback = getTxCallback(label)

            if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddress, amountInMax, routerAddress, w))) {
                await approveTokenExt(telegramId, chain, tokenAddress, routerAddress, w)
            }

            const retTx = await sendTxn(
                telegramId,
                chain,
                {
                    abi: [functionABI],
                    functionName: functionABI.name,
                    args: [ethAmount, amountInMax, decoded.path, w.address, '0xffffffff']
                },
                {
                    to: routerAddress,
                    address: w,
                    value: tx.value,
                    gasPrice: BN(setting.sellGasPrice || '0').gt(BN(0)) ? BN(setting.sellGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                },
                {
                    callback: callback,
                    exInfo: {
                        telegramId: telegramId,
                        chain: chain,
                        token: tokenAddress,
                        user: w.address,
                        type: 'sell',
                        tokenAmount: tokenAmountWithDecimals,
                        ethAmount: ethAmount
                    }
                }
            );

            if (retTx?.transactionHash) {
                const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                if (txFound !== null) {
                    const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                    itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                    await itemDbUpdate.save()
                }
                const user = await getAppUser(telegramId)
                await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
            }

            const tokenPrice = getTokenPrice(telegramId, chain, tokenAddress)
            const nativePrice = await getNativeCurrencyPrice(chain)

            await updateUserState(telegramId, chain, 0, 0, BN(tokenAmount).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString(), undefined)

            const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
            await updateSellMonitorInfo(chain, tokenAddress, w.address, tokenAmountWithDecimals, BN(ethAmount).times(BN(100).minus(BN(taxInfo?.sellTax || '0')).div(100)).integerValue().toString())
        } catch (err) {
            console.error(`==> ${new Date().toLocaleString()}`)
            console.error(err)
            Logging.error(`[copytrade_swapTokensForExactETH] ${chain}, ${tx.hash}, ${err.message}`)
            await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
        }
    }
}

export async function copytrade_exactInputSingle(telegramId: string, chain: string, tx: any, decoded: any, functionABI: any, copytradeDB: any) {
    const tres = await Promise.all([
        getAppUser(telegramId),
        getMultiWallets(telegramId),
        getWallet(telegramId),
        getSettings(telegramId, chain),
        getNativeCurrencyDecimal(chain),
        getNativeCurrencySymbol(chain),
        getBlockExplorer(chain),
        getGasPrice(chain),
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
    const routerAddress = tx.to.toLowerCase()

    // regulating parameters...
    const wallets = (copytradeDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

    const dr = functionABI.inputs[0].components.map((t, idx) => {
        return {
            [t.name]: t.type === 'address' ? decoded.params[idx].toLowerCase() : decoded.params[idx]
        }
    }).reduce((prev, cur) => {
        return {
            ...prev,
            ...cur
        }
    }, {})

    // const dr = {
    //     tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //     tokenOut: '0x955d5c14c8d4944da1ea7836bd44d54a8ec35ba1',
    //     fee: '3000',
    //     recipient: '0xd4b0705e9cc3c6a3517b334c609e3d60e0d5da78',
    //     amountIn: '566000000000000000',
    //     amountOutMinimum: '16699042667472435745340505',
    //     sqrtPriceLimitX96: '0'
    // }

    const chainInfo = await ChainModel.findOne({ name: chain })

    if (dr.tokenIn === chainInfo.tokens[0]) { // buy
        const tokenAddress = dr.tokenOut
        let targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        if (targetTokenInfo === null) {
            await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
            targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        }

        const slippage = copytradeDB.autoBuySlippage ?? setting.slippage ?? 100
        let ethAmount = BN(dr.amountIn)
        if (BN(copytradeDB.autoBuyAmount || '0').gt(BN(0)) && ethAmount.gt(BN(copytradeDB.autoBuyAmount).times(BN(`1e${nativeDecimals}`)))) {
            ethAmount = BN(copytradeDB.autoBuyAmount).times(BN(`1e${nativeDecimals}`)).integerValue()
        }

        let tokenAmount = '0'
        let amountOutMin = '0'
        let ethAmountDecimal = ethAmount.div(BN(`1e${nativeDecimals}`)).toString()
        {
            let v3Path
            let amountOut

            try {
                v3Path = await getPathToTokenV3(chain, tokenAddress)
            } catch (err) { }

            let factory
            if (v3Path) {
                amountOut = await getAmountsOutExtV3(chain, ethAmountDecimal, v3Path)
                factory = v3Path.factory
            } else {
                throw new Error(`Failed to calculate <b>${targetTokenInfo.symbol}</b> amount to buy by <b>${ethAmountDecimal} ${nativeSymbol}</b>`)
            }

            tokenAmount = BN(amountOut).times(BN(`1e${targetTokenInfo.decimals}`)).integerValue().toString()
            amountOutMin = BN(tokenAmount).times(BN(100 - slippage)).div(100).integerValue().toString()
        }

        const nativeAmount = parseFloat(ethAmount.div(BN(`1e${nativeDecimals}`)).toFixed(4))

        for (const w of wallets) {
            try {
                await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${nativeAmount} ${nativeSymbol} : ${tx.hash}`)

                const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${nativeAmount} ${nativeSymbol}</b> to <b>${targetTokenInfo.symbol}</b>`

                const callback = getTxCallback(label)

                const retTx = await sendTxn(
                    telegramId,
                    chain,
                    {
                        abi: [functionABI],
                        functionName: functionABI.name,
                        args: [[dr.tokenIn, dr.tokenOut, dr.fee, w.address, ethAmount.toString(), amountOutMin, dr.sqrtPriceLimitX96]]
                    },
                    {
                        to: routerAddress,
                        address: w,
                        value: ethAmount.toString(),
                        gasPrice: BN(copytradeDB.autoBuyGasPrice || '0').gt(BN(0)) ? BN(copytradeDB.autoBuyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : BN(setting.buyGasPrice || '0').gt(BN(0)) ? BN(setting.buyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                    },
                    {
                        callback: callback,
                        exInfo: {
                            telegramId: telegramId,
                            chain: chain,
                            token: tokenAddress,
                            user: w.address,
                            type: 'buy',
                            tokenAmount: tokenAmount,
                            ethAmount: ethAmount.toString()
                        }
                    }
                );

                if (retTx?.transactionHash) {
                    const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                    if (txFound !== null) {
                        const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                        itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                        await itemDbUpdate.save()
                    }
                    const user = await getAppUser(telegramId)
                    await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
                }

                await updateUserState(telegramId, chain, 0, 0, undefined, ethAmount.toString())
                const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
                await updateBuyMonitorInfo(chain, tokenAddress, w.address, BN(tokenAmount).times(BN(100).minus(BN(taxInfo?.buyTax || '0')).div(100)).integerValue().toString(), ethAmount.toString())
            } catch (err) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(`[copytrade_exactInputSingle] ${chain}, ${tx.hash}, ${err.message}`)
                await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
            }
        }
    } else if (dr.tokenOut === chainInfo.tokens[0]) { // sell
        const tokenAddress = dr.tokenIn
        let targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        if (targetTokenInfo === null) {
            await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
            targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        }

        for (const w of wallets) {
            try {
                let tokenAmount = BN(dr.amountIn).div(BN(`1e${targetTokenInfo.decimals}`))
                const tInfo = await getTokenSimpleInfo(telegramId, chain, tokenAddress, w.address)
                if (tokenAmount.gt(tInfo.balance)) {
                    tokenAmount = BN(tInfo.balance)
                }

                const tokenAmountWithDecimals = tokenAmount.times(BN(`1e${targetTokenInfo.decimals}`)).integerValue().toString()

                let amountOutMin = '0'
                let ethAmount = '0'
                const slippage = setting.slippage ?? 100
                {
                    let v3Path
                    let amountOut

                    try {
                        v3Path = await getPathToTokenV3(chain, tokenAddress)
                    } catch (err) { }

                    let factory
                    if (v3Path) {
                        amountOut = await getAmountsOutExtV3(chain, tokenAmount.toString(), v3Path)
                        factory = v3Path.factory
                    } else {
                        throw new Error(`Failed to calculate <b>${nativeSymbol}</b> amount to buy by <b>${tokenAmount.toString()} ${targetTokenInfo.symbol}</b>`)
                    }

                    ethAmount = BN(amountOut).times(BN(`1e${nativeDecimals}`)).integerValue().toString()
                    amountOutMin = BN(ethAmount).times(BN(100 - slippage)).div(100).integerValue().toString()
                }

                await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${tokenAmount.toString()} ${targetTokenInfo.symbol} : ${tx.hash}`)

                const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${tokenAmount.toString()} ${targetTokenInfo.symbol}</b> to <b>${nativeSymbol}</b>`

                const callback = getTxCallback(label)

                if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddress, tokenAmountWithDecimals, routerAddress, w))) {
                    await approveTokenExt(telegramId, chain, tokenAddress, routerAddress, w)
                }

                const retTx = await sendTxn(
                    telegramId,
                    chain,
                    {
                        abi: [functionABI],
                        functionName: functionABI.name,
                        args: [[dr.tokenIn, dr.tokenOut, dr.fee, w.address, tokenAmountWithDecimals, amountOutMin, dr.sqrtPriceLimitX96]]
                    },
                    {
                        to: routerAddress,
                        address: w,
                        value: tx.value,
                        gasPrice: BN(setting.sellGasPrice || '0').gt(BN(0)) ? BN(setting.sellGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                    },
                    {
                        callback: callback,
                        exInfo: {
                            telegramId: telegramId,
                            chain: chain,
                            token: tokenAddress,
                            user: w.address,
                            type: 'sell',
                            tokenAmount: tokenAmountWithDecimals,
                            ethAmount: ethAmount
                        }
                    }
                );

                if (retTx?.transactionHash) {
                    const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                    if (txFound !== null) {
                        const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                        itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                        await itemDbUpdate.save()
                    }
                    const user = await getAppUser(telegramId)
                    await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
                }

                const tokenPrice = getTokenPrice(telegramId, chain, tokenAddress)
                const nativePrice = await getNativeCurrencyPrice(chain)

                await updateUserState(telegramId, chain, 0, 0, BN(tokenAmount).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString(), undefined)

                const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
                await updateSellMonitorInfo(chain, tokenAddress, w.address, tokenAmountWithDecimals, BN(ethAmount).times(BN(100).minus(BN(taxInfo?.sellTax || '0')).div(100)).integerValue().toString())
            } catch (err) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(`[copytrade_exactInputSingle] ${chain}, ${tx.hash}, ${err.message}`)
                await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
            }
        }
    } else {
        const tokenAddresses = [dr.tokenIn, dr.tokenOut]
        let targetTokenInfo = await Promise.all(tokenAddresses.map(t => TokenInfoModel.findOne({ chain: chain, address: t })))
        if (targetTokenInfo[0] === null || targetTokenInfo[1] === null) {
            await prefetchTokensOnChain(chain, JSON.stringify(tokenAddresses))
            targetTokenInfo = await Promise.all(tokenAddresses.map(t => TokenInfoModel.findOne({ chain: chain, address: t })))
        }

        // regulating parameters...
        for (const w of wallets) {
            try {
                let tokenAmount = BN(dr.amountIn).div(BN(`1e${targetTokenInfo[0].decimals}`))
                const tInfo = await getTokenSimpleInfo(telegramId, chain, tokenAddresses[0], w.address)
                if (tokenAmount.gt(tInfo.balance)) {
                    tokenAmount = BN(tInfo.balance)
                }

                const tokenAmountWithDecimals = tokenAmount.times(BN(`1e${targetTokenInfo[0].decimals}`)).integerValue().toString()

                let amountOutMin = '0'
                let amountOut = '0'
                const slippage = setting.slippage ?? 100
                {
                    let v3Path0
                    let v3Path1
                    let tmpAmount

                    try {
                        v3Path0 = await getPathFromTokenV3(chain, dr.tokenIn)
                        v3Path1 = await getPathToTokenV3(chain, dr.tokenOut)
                    } catch (err) { }

                    let factory
                    if (v3Path0 && v3Path1) {
                        const amn = await getAmountsOutExtV3(chain, tokenAmount.toString(), v3Path0)
                        tmpAmount = await getAmountsOutExtV3(chain, amn, v3Path1)
                        factory = v3Path1.factory
                    } else {
                        throw new Error(`Failed to calculate <b>${targetTokenInfo[1].symbol}</b> amount to buy by <b>${tokenAmount.toString()} ${targetTokenInfo[0].symbol}</b>`)
                    }

                    amountOut = BN(tmpAmount).times(BN(`1e${targetTokenInfo[1].decimals}`)).integerValue().toString()
                    amountOutMin = BN(amountOut).times(BN(100 - slippage)).div(100).integerValue().toString()
                }

                await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${tokenAmount.toString()} ${targetTokenInfo[0].symbol} : ${tx.hash}`)

                const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${tokenAmount.toString()} ${targetTokenInfo[0].symbol}</b> to <b>${targetTokenInfo[1].symbol}</b>`

                const tokenPrice = await getTokenPrice(telegramId, chain, tokenAddresses[0])
                const nativePrice = await getNativeCurrencyPrice(chain)

                const taxInfoSell = await getTokenTaxInfo(chain, tokenAddresses[0])

                const ethAmount = BN(tokenAmount).times(BN(100).minus(BN(taxInfoSell?.sellTax || '0')).div(100)).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString()

                const callback = getTxCallback(label)

                if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddresses[0], tokenAmountWithDecimals, routerAddress, w))) {
                    await approveTokenExt(telegramId, chain, tokenAddresses[0], routerAddress, w)
                }

                const retTx = await sendTxn(
                    telegramId,
                    chain,
                    {
                        abi: [functionABI],
                        functionName: functionABI.name,
                        args: [[dr.tokenIn, dr.tokenOut, dr.fee, w.address, tokenAmountWithDecimals, amountOutMin, dr.sqrtPriceLimitX96]]
                    },
                    {
                        to: routerAddress,
                        address: w,
                        value: tx.value,
                        gasPrice: BN(setting.sellGasPrice || '0').gt(BN(0)) ? BN(setting.sellGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                    },
                    {
                        callback: callback,
                        exInfo: {
                            telegramId: telegramId,
                            chain: chain,
                            token: tokenAddresses[0],
                            user: w.address,
                            type: 'sell',
                            tokenAmount: tokenAmountWithDecimals,
                            ethAmount: ethAmount
                        }
                    }
                );

                if (retTx?.transactionHash) {
                    const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                    if (txFound !== null) {
                        const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                        itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                        await itemDbUpdate.save()
                    }
                    const user = await getAppUser(telegramId)
                    await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddresses[1])
                }

                await updateUserState(telegramId, chain, 0, 0, ethAmount, undefined)
                await updateSellMonitorInfo(chain, tokenAddresses[0], w.address, tokenAmountWithDecimals, ethAmount)
            } catch (err) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(`[copytrade_exactInputSingle] ${chain}, ${tx.hash}, ${err.message}`)
                await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
            }
        }
    }
}

export async function copytrade_exactInput(telegramId: string, chain: string, tx: any, decoded: any, functionABI: any, copytradeDB: any) {
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
    const routerAddress = tx.to.toLowerCase()

    // regulating parameters...
    const wallets = (copytradeDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

    const dr = functionABI.inputs[0].components.map((t, idx) => {
        return {
            [t.name]: t.type === 'address' || t.type === 'bytes' ? decoded.params[idx].toLowerCase() : decoded.params[idx]
        }
    }).reduce((prev, cur) => {
        return {
            ...prev,
            ...cur
        }
    }, {})

    for (let i = 2; i < dr.path.length; i += 46) {
        const token = dr.path.slice(i, i + 40)
        const fee = dr.path.slice(i + 40, i + 46)

        if (token) {
            if (dr.tokens === undefined) dr.tokens = []
            dr.tokens.push('0x' + token)
        }

        if (fee) {
            if (dr.fees === undefined) dr.fees = []
            dr.fees.push('0x' + fee)
        }
    }

    // const dr = {
    //     path: '0x9bf1d7d63dd7a4ce167cf4866388226eeefa702e000bb8c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000bb83007083eaa95497cd6b2b809fb97b6a30bdf53d3',
    //     recipient: '0x8b13a9cce369445725fd52ed4a1c4d6d9ca0e6cd',
    //     amountIn: '321429136823391300000000000',
    //     amountOutMinimum: '21832523828772676049708'
    // }

    const chainInfo = await ChainModel.findOne({ name: chain })

    if (dr.tokens[0] === chainInfo.tokens[0]) { // buy
        const tokenAddress = dr.tokens[dr.tokens.length - 1]
        let targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        if (targetTokenInfo === null) {
            await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
            targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        }

        const slippage = copytradeDB.autoBuySlippage ?? setting.slippage ?? 100
        let ethAmount = BN(dr.amountIn)
        if (BN(copytradeDB.autoBuyAmount || '0').gt(BN(0)) && ethAmount.gt(BN(copytradeDB.autoBuyAmount).times(BN(`1e${nativeDecimals}`)))) {
            ethAmount = BN(copytradeDB.autoBuyAmount).times(BN(`1e${nativeDecimals}`)).integerValue()
        }
        const ethAmountWithDecimals = ethAmount.div(BN(`1e${nativeDecimals}`)).toString()

        let tokenAmount = '0'
        let amountOutMin = '0'
        {
            let v3Path = {
                factory: '',
                path: JSON.parse(JSON.stringify(dr.tokens)),
                fee: JSON.parse(JSON.stringify(dr.fees)),
                version: 3
            }
            let amountOut

            if (v3Path) {
                amountOut = await getAmountsOutExtV3(chain, ethAmountWithDecimals, v3Path)
            } else {
                throw new Error(`Failed to calculate <b>${targetTokenInfo.symbol}</b> amount to buy by <b>${ethAmountWithDecimals} ${nativeSymbol}</b>`)
            }

            tokenAmount = BN(amountOut).times(BN(`1e${targetTokenInfo.decimals}`)).integerValue().toString()
            amountOutMin = BN(tokenAmount).times(BN(100 - slippage)).div(100).integerValue().toString()
        }

        const nativeAmount = parseFloat(ethAmount.div(BN(`1e${nativeDecimals}`)).toFixed(4))

        for (const w of wallets) {
            try {
                await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${nativeAmount} ${nativeSymbol} : ${tx.hash}`)

                const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${nativeAmount} ${nativeSymbol}</b> to <b>${targetTokenInfo.symbol}</b>`

                const callback = getTxCallback(label)

                const retTx = await sendTxn(
                    telegramId,
                    chain,
                    {
                        abi: [functionABI],
                        functionName: functionABI.name,
                        args: [[dr.path, w.address, ethAmount.toString(), amountOutMin]]
                    },
                    {
                        to: routerAddress,
                        address: w,
                        value: ethAmount.toString(),
                        gasPrice: BN(copytradeDB.autoBuyGasPrice || '0').gt(BN(0)) ? BN(copytradeDB.autoBuyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : BN(setting.buyGasPrice || '0').gt(BN(0)) ? BN(setting.buyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                    },
                    {
                        callback: callback,
                        exInfo: {
                            telegramId: telegramId,
                            chain: chain,
                            token: tokenAddress,
                            user: w.address,
                            type: 'buy',
                            tokenAmount: tokenAmount,
                            ethAmount: ethAmount.toString()
                        }
                    }
                );

                if (retTx?.transactionHash) {
                    const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                    if (txFound !== null) {
                        const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                        itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                        await itemDbUpdate.save()
                    }
                    const user = await getAppUser(telegramId)
                    await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
                }

                await updateUserState(telegramId, chain, 0, 0, undefined, ethAmount.toString())
                const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
                await updateBuyMonitorInfo(chain, tokenAddress, w.address, BN(tokenAmount).times(BN(100).minus(BN(taxInfo?.buyTax || '0')).div(100)).integerValue().toString(), ethAmount.toString())
            } catch (err) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(`[copytrade_exactInput] ${chain}, ${tx.hash}, ${err.message}`)
                await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
            }
        }
    } else if (dr.tokens[dr.tokens.length - 1] === chainInfo.tokens[0]) { // sell
        const tokenAddress = dr.tokens[0]
        let targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        if (targetTokenInfo === null) {
            await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
            targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        }

        for (const w of wallets) {
            try {
                let tokenAmount = BN(dr.amountIn).div(BN(`1e${targetTokenInfo.decimals}`))
                const tInfo = await getTokenSimpleInfo(telegramId, chain, tokenAddress, w.address)
                if (tokenAmount.gt(tInfo.balance)) {
                    tokenAmount = BN(tInfo.balance)
                }

                const tokenAmountWithDecimals = tokenAmount.times(BN(`1e${targetTokenInfo.decimals}`)).integerValue().toString()

                let amountOutMin = '0'
                let ethAmount = '0'
                const slippage = setting.slippage ?? 100
                {
                    let v3Path = {
                        factory: '',
                        path: JSON.parse(JSON.stringify(dr.tokens)),
                        fee: JSON.parse(JSON.stringify(dr.fees)),
                        version: 3
                    }
                    let amountOut

                    if (v3Path) {
                        amountOut = await getAmountsOutExtV3(chain, tokenAmount.toString(), v3Path)
                    } else {
                        throw new Error(`Failed to calculate <b>${nativeSymbol}</b> amount to buy by <b>${tokenAmount.toString()} ${targetTokenInfo.symbol}</b>`)
                    }

                    ethAmount = BN(amountOut).times(BN(`1e${nativeDecimals}`)).integerValue().toString()
                    amountOutMin = BN(ethAmount).times(BN(100 - slippage)).div(100).integerValue().toString()
                }

                await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${tokenAmount.toString()} ${targetTokenInfo.symbol} : ${tx.hash}`)

                const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${tokenAmount.toString()} ${targetTokenInfo.symbol}</b> to <b>${nativeSymbol}</b>`

                const callback = getTxCallback(label)

                if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddress, tokenAmountWithDecimals, routerAddress, w))) {
                    await approveTokenExt(telegramId, chain, tokenAddress, routerAddress, w)
                }

                const retTx = await sendTxn(
                    telegramId,
                    chain,
                    {
                        abi: [functionABI],
                        functionName: functionABI.name,
                        args: [[dr.path, w.address, tokenAmountWithDecimals, amountOutMin]]
                    },
                    {
                        to: routerAddress,
                        address: w,
                        value: tx.value,
                        gasPrice: BN(setting.sellGasPrice || '0').gt(BN(0)) ? BN(setting.sellGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                    },
                    {
                        callback: callback,
                        exInfo: {
                            telegramId: telegramId,
                            chain: chain,
                            token: tokenAddress,
                            user: w.address,
                            type: 'sell',
                            tokenAmount: tokenAmountWithDecimals,
                            ethAmount: ethAmount
                        }
                    }
                );

                if (retTx?.transactionHash) {
                    const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                    if (txFound !== null) {
                        const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                        itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                        await itemDbUpdate.save()
                    }
                    const user = await getAppUser(telegramId)
                    await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
                }

                const tokenPrice = getTokenPrice(telegramId, chain, tokenAddress)
                const nativePrice = await getNativeCurrencyPrice(chain)

                await updateUserState(telegramId, chain, 0, 0, BN(tokenAmount).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString(), undefined)

                const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
                await updateSellMonitorInfo(chain, tokenAddress, w.address, tokenAmountWithDecimals, BN(ethAmount).times(BN(100).minus(BN(taxInfo?.sellTax || '0')).div(100)).integerValue().toString())
            } catch (err) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(`[copytrade_exactInput] ${chain}, ${tx.hash}, ${err.message}`)
                await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
            }
        }
    } else {
        const tokenAddresses = [dr.tokens[0], dr.tokens[dr.tokens.length - 1]]
        let targetTokenInfo = await Promise.all(tokenAddresses.map(t => TokenInfoModel.findOne({ chain: chain, address: t })))
        if (targetTokenInfo[0] === null || targetTokenInfo[1] === null) {
            await prefetchTokensOnChain(chain, JSON.stringify(tokenAddresses))
            targetTokenInfo = await Promise.all(tokenAddresses.map(t => TokenInfoModel.findOne({ chain: chain, address: t })))
        }

        // regulating parameters...
        for (const w of wallets) {
            try {
                let tokenAmount = BN(dr.amountIn).div(BN(`1e${targetTokenInfo[0].decimals}`))
                const tInfo = await getTokenSimpleInfo(telegramId, chain, tokenAddresses[0], w.address)
                if (tokenAmount.gt(tInfo.balance)) {
                    tokenAmount = BN(tInfo.balance)
                }

                const tokenAmountWithDecimals = tokenAmount.times(BN(`1e${targetTokenInfo[0].decimals}`)).integerValue().toString()

                let amountOutMin = '0'
                let amountOut = '0'
                const slippage = setting.slippage ?? 100
                {
                    let v3Path = {
                        factory: '',
                        path: JSON.parse(JSON.stringify(dr.tokens)),
                        fee: JSON.parse(JSON.stringify(dr.fees)),
                        version: 3
                    }
                    let tmpAmount

                    if (v3Path) {
                        tmpAmount = await getAmountsOutExtV3(chain, tokenAmount.toString(), v3Path)
                    } else {
                        throw new Error(`Failed to calculate <b>${targetTokenInfo[1].symbol}</b> amount to buy by <b>${tokenAmount.toString()} ${targetTokenInfo[0].symbol}</b>`)
                    }

                    amountOut = BN(tmpAmount).times(BN(`1e${targetTokenInfo[1].decimals}`)).integerValue().toString()
                    amountOutMin = BN(amountOut).times(BN(100 - slippage)).div(100).integerValue().toString()
                }

                await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${tokenAmount.toString()} ${targetTokenInfo[0].symbol} : ${tx.hash}`)

                const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${tokenAmount.toString()} ${targetTokenInfo[0].symbol}</b> to <b>${targetTokenInfo[1].symbol}</b>`

                const tokenPrice = await getTokenPrice(telegramId, chain, tokenAddresses[0])
                const nativePrice = await getNativeCurrencyPrice(chain)

                const taxInfoSell = await getTokenTaxInfo(chain, tokenAddresses[0])

                const ethAmount = BN(tokenAmount).times(BN(100).minus(BN(taxInfoSell?.sellTax || '0')).div(100)).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString()

                const callback = getTxCallback(label)

                if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddresses[0], tokenAmountWithDecimals, routerAddress, w))) {
                    await approveTokenExt(telegramId, chain, tokenAddresses[0], routerAddress, w)
                }

                const retTx = await sendTxn(
                    telegramId,
                    chain,
                    {
                        abi: [functionABI],
                        functionName: functionABI.name,
                        args: [[dr.path, w.address, tokenAmountWithDecimals, amountOutMin]]
                    },
                    {
                        to: routerAddress,
                        address: w,
                        value: tx.value,
                        gasPrice: BN(setting.sellGasPrice || '0').gt(BN(0)) ? BN(setting.sellGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                    },
                    {
                        callback: callback,
                        exInfo: {
                            telegramId: telegramId,
                            chain: chain,
                            token: tokenAddresses[0],
                            user: w.address,
                            type: 'sell',
                            tokenAmount: tokenAmountWithDecimals,
                            ethAmount: ethAmount
                        }
                    }
                );

                if (retTx?.transactionHash) {
                    const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                    if (txFound !== null) {
                        const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                        itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                        await itemDbUpdate.save()
                    }
                    const user = await getAppUser(telegramId)
                    await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddresses[1])
                }

                await updateUserState(telegramId, chain, 0, 0, ethAmount, undefined)
                await updateSellMonitorInfo(chain, tokenAddresses[0], w.address, tokenAmountWithDecimals, ethAmount)
            } catch (err) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(`[copytrade_exactInput] ${chain}, ${tx.hash}, ${err.message}`)
                await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
            }
        }
    }
}

export async function copytrade_exactOutputSingle(telegramId: string, chain: string, tx: any, decoded: any, functionABI: any, copytradeDB: any) {
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
    const routerAddress = tx.to.toLowerCase()

    // regulating parameters...
    const wallets = (copytradeDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

    const dr = functionABI.inputs[0].components.map((t, idx) => {
        return {
            [t.name]: t.type === 'address' ? decoded.params[idx].toLowerCase() : decoded.params[idx]
        }
    }).reduce((prev, cur) => {
        return {
            ...prev,
            ...cur
        }
    }, {})

    // const dr = {
    //     tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //     tokenOut: '0x955d5c14c8d4944da1ea7836bd44d54a8ec35ba1',
    //     fee: '3000',
    //     recipient: '0xd4b0705e9cc3c6a3517b334c609e3d60e0d5da78',
    //     amountOut: '566000000000000000',
    //     amountInMaximum: '16699042667472435745340505',
    //     sqrtPriceLimitX96: '0'
    // }

    const chainInfo = await ChainModel.findOne({ name: chain })

    if (dr.tokenIn === chainInfo.tokens[0]) { // buy
        const tokenAddress = dr.tokenOut
        let targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        if (targetTokenInfo === null) {
            await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
            targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        }

        const slippage = copytradeDB.autoBuySlippage ?? setting.slippage ?? 100
        let tokenAmount = BN(dr.amountOut)
        let tokenAmountWithDecimals = tokenAmount.div(BN(`1e${targetTokenInfo.decimals}`)).toString()

        let ethAmount = '0'
        let amountInMax = '0'
        {
            let v3Path
            let amn

            try {
                v3Path = await getPathToTokenV3(chain, tokenAddress)
            } catch (err) { }

            let factory
            if (v3Path) {
                amn = await getAmountsInExtV3(chain, tokenAmountWithDecimals, v3Path)
                factory = v3Path.factory
            } else {
                throw new Error(`Failed to calculate <b>${nativeSymbol}</b> amount to buy <b>${tokenAmountWithDecimals} ${targetTokenInfo.symbol}</b>`)
            }

            ethAmount = BN(amn).times(BN(`1e${targetTokenInfo.decimals}`)).integerValue().toString()
            amountInMax = slippage === 100 ? '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' : BN(ethAmount).times(BN(100)).div(100 - slippage).integerValue().toString()
        }

        const nativeAmount = parseFloat(BN(ethAmount).div(BN(`1e${nativeDecimals}`)).toFixed(4))

        for (const w of wallets) {
            try {
                await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} for ${BN(tokenAmount).div(BN(`1e${targetTokenInfo.decimals}`))} ${targetTokenInfo.symbol} : ${tx.hash}`)

                const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${nativeAmount} ${nativeSymbol}</b> to <b>${BN(tokenAmount).div(BN(`1e${targetTokenInfo.decimals}`))} ${targetTokenInfo.symbol}</b>`

                const callback = getTxCallback(label)

                const retTx = await sendTxn(
                    telegramId,
                    chain,
                    {
                        abi: [functionABI],
                        functionName: functionABI.name,
                        args: [[dr.tokenIn, dr.tokenOut, dr.fee, w.address, tokenAmount.toString(), amountInMax, dr.sqrtPriceLimitX96]]
                    },
                    {
                        to: routerAddress,
                        address: w,
                        value: ethAmount.toString(),
                        gasPrice: BN(copytradeDB.autoBuyGasPrice || '0').gt(BN(0)) ? BN(copytradeDB.autoBuyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : BN(setting.buyGasPrice || '0').gt(BN(0)) ? BN(setting.buyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                    },
                    {
                        callback: callback,
                        exInfo: {
                            telegramId: telegramId,
                            chain: chain,
                            token: tokenAddress,
                            user: w.address,
                            type: 'buy',
                            tokenAmount: tokenAmount,
                            ethAmount: ethAmount.toString()
                        }
                    }
                );

                if (retTx?.transactionHash) {
                    const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                    if (txFound !== null) {
                        const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                        itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                        await itemDbUpdate.save()
                    }
                    const user = await getAppUser(telegramId)
                    await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
                }

                await updateUserState(telegramId, chain, 0, 0, undefined, ethAmount.toString())
                const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
                await updateBuyMonitorInfo(chain, tokenAddress, w.address, BN(tokenAmount).times(BN(100).minus(BN(taxInfo?.buyTax || '0')).div(100)).integerValue().toString(), ethAmount.toString())
            } catch (err) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(`[copytrade_exactOutputSingle] ${chain}, ${tx.hash}, ${err.message}`)
                await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
            }
        }
    } else if (dr.tokenOut === chainInfo.tokens[0]) { // sell
        const tokenAddress = dr.tokenIn
        let targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        if (targetTokenInfo === null) {
            await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
            targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        }

        const ethAmount = dr.amountOut
        const ethAmountWithDecimals = BN(ethAmount).div(BN(`1e${nativeDecimals}`)).toString()

        for (const w of wallets) {
            try {
                let amountInMax = '0'
                let tokenAmountWithDecimals = '0'
                const slippage = setting.slippage ?? 100
                {
                    let v3Path
                    let amn

                    try {
                        v3Path = await getPathFromTokenV3(chain, tokenAddress)
                    } catch (err) { }

                    let factory
                    if (v3Path) {
                        amn = await getAmountsInExtV3(chain, ethAmountWithDecimals, v3Path)
                        factory = v3Path.factory
                    } else {
                        throw new Error(`Failed to calculate <b>${targetTokenInfo.symbol}</b> amount to get <b>${ethAmountWithDecimals} ${nativeDecimals}</b>`)
                    }

                    tokenAmountWithDecimals = BN(amn).times(BN(`1e${targetTokenInfo.decimals}`)).integerValue().toString()
                    amountInMax = slippage === 100 ? '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' : BN(tokenAmountWithDecimals).times(BN(100)).div(100 - slippage).integerValue().toString()
                }

                const tokenAmount = BN(tokenAmountWithDecimals).div(BN(`1e${targetTokenInfo.decimals}`)).toString()

                await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${tokenAmount.toString()} ${targetTokenInfo.symbol} : ${tx.hash}`)

                const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${tokenAmount.toString()} ${targetTokenInfo.symbol}</b> to <b>${nativeSymbol}</b>`

                const callback = getTxCallback(label)

                if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddress, tokenAmountWithDecimals, routerAddress, w))) {
                    await approveTokenExt(telegramId, chain, tokenAddress, routerAddress, w)
                }

                const retTx = await sendTxn(
                    telegramId,
                    chain,
                    {
                        abi: [functionABI],
                        functionName: functionABI.name,
                        args: [[dr.tokenIn, dr.tokenOut, dr.fee, w.address, ethAmount, amountInMax, dr.sqrtPriceLimitX96]]
                    },
                    {
                        to: routerAddress,
                        address: w,
                        value: tx.value,
                        gasPrice: BN(setting.sellGasPrice || '0').gt(BN(0)) ? BN(setting.sellGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                    },
                    {
                        callback: callback,
                        exInfo: {
                            telegramId: telegramId,
                            chain: chain,
                            token: tokenAddress,
                            user: w.address,
                            type: 'sell',
                            tokenAmount: tokenAmountWithDecimals,
                            ethAmount: ethAmount
                        }
                    }
                );

                if (retTx?.transactionHash) {
                    const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                    if (txFound !== null) {
                        const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                        itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                        await itemDbUpdate.save()
                    }
                    const user = await getAppUser(telegramId)
                    await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
                }

                const tokenPrice = getTokenPrice(telegramId, chain, tokenAddress)
                const nativePrice = await getNativeCurrencyPrice(chain)

                await updateUserState(telegramId, chain, 0, 0, BN(tokenAmount).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString(), undefined)

                const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
                await updateSellMonitorInfo(chain, tokenAddress, w.address, tokenAmountWithDecimals, BN(ethAmount).times(BN(100).minus(BN(taxInfo?.sellTax || '0')).div(100)).integerValue().toString())
            } catch (err) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(`[copytrade_exactOutputSingle] ${chain}, ${tx.hash}, ${err.message}`)
                await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
            }
        }
    } else {
        const tokenAddresses = [dr.tokenIn, dr.tokenOut]
        let targetTokenInfo = await Promise.all(tokenAddresses.map(t => TokenInfoModel.findOne({ chain: chain, address: t })))
        if (targetTokenInfo[0] === null || targetTokenInfo[1] === null) {
            await prefetchTokensOnChain(chain, JSON.stringify(tokenAddresses))
            targetTokenInfo = await Promise.all(tokenAddresses.map(t => TokenInfoModel.findOne({ chain: chain, address: t })))
        }

        const tokenAmount = BN(dr.amountOut).div(BN(`1e${targetTokenInfo[1].decimals}`))
        const tokenAmountWithDecimals = tokenAmount.times(BN(`1e${targetTokenInfo[1].decimals}`)).integerValue().toString()
        // regulating parameters...
        for (const w of wallets) {
            try {
                let amountInMax = '0'
                let amountIn = '0'
                const slippage = setting.slippage ?? 100
                {
                    let v3Path0
                    let v3Path1
                    let amn

                    try {
                        v3Path0 = await getPathFromTokenV3(chain, tokenAddresses[0])
                        v3Path1 = await getPathToTokenV3(chain, tokenAddresses[1])
                    } catch (err) { }

                    let factory
                    if (v3Path0 && v3Path1) {
                        const a1 = await getAmountsInExtV3(chain, tokenAmount.toString(), v3Path1)
                        amn = await getAmountsInExtV3(chain, a1, v3Path0)
                        factory = v3Path0.factory
                    } else {
                        throw new Error(`Failed to calculate <b>${targetTokenInfo[0].symbol}</b> amount to get <b>${tokenAmount.toString()} ${targetTokenInfo[1].symbol}</b>`)
                    }

                    amountIn = BN(amn).times(BN(`1e${targetTokenInfo[0].decimals}`)).integerValue().toString()
                    amountInMax = slippage === 100 ? '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' : BN(amountIn).times(BN(100)).div(100 - slippage).integerValue().toString()
                }

                await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} for ${tokenAmount.toString()} ${targetTokenInfo[1].symbol} : ${tx.hash}`)

                const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${targetTokenInfo[0].symbol}</b> to <b>${tokenAmount.toString()} ${targetTokenInfo[1].symbol}</b>`

                const tokenPrice = await getTokenPrice(telegramId, chain, tokenAddresses[1])
                const nativePrice = await getNativeCurrencyPrice(chain)

                const taxInfoBuy = await getTokenTaxInfo(chain, tokenAddresses[1])

                const ethAmount = BN(tokenAmount).times(BN(100).minus(BN(taxInfoBuy?.buyTax || '0')).div(100)).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString()

                const callback = getTxCallback(label)

                if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddresses[0], amountInMax, routerAddress, w))) {
                    await approveTokenExt(telegramId, chain, tokenAddresses[0], routerAddress, w)
                }

                const retTx = await sendTxn(
                    telegramId,
                    chain,
                    {
                        abi: [functionABI],
                        functionName: functionABI.name,
                        args: [[dr.tokenIn, dr.tokenOut, dr.fee, w.address, tokenAmountWithDecimals, amountInMax, dr.sqrtPriceLimitX96]]
                    },
                    {
                        to: routerAddress,
                        address: w,
                        value: tx.value,
                        gasPrice: BN(copytradeDB.autoBuyGasPrice || '0').gt(BN(0)) ? BN(copytradeDB.autoBuyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : BN(setting.buyGasPrice || '0').gt(BN(0)) ? BN(setting.buyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                    },
                    {
                        callback: callback,
                        exInfo: {
                            telegramId: telegramId,
                            chain: chain,
                            token: tokenAddresses[1],
                            user: w.address,
                            type: 'buy',
                            tokenAmount: tokenAmountWithDecimals,
                            ethAmount: ethAmount.toString()
                        }
                    }
                );

                if (retTx?.transactionHash) {
                    const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                    if (txFound !== null) {
                        const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                        itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                        await itemDbUpdate.save()
                    }
                    const user = await getAppUser(telegramId)
                    await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddresses[0])
                }

                await updateUserState(telegramId, chain, 0, 0, undefined, ethAmount.toString())
                const taxInfo = await getTokenTaxInfo(chain, tokenAddresses[1])
                await updateBuyMonitorInfo(chain, tokenAddresses[1], w.address, BN(tokenAmountWithDecimals).times(BN(100).minus(BN(taxInfo?.buyTax || '0')).div(100)).integerValue().toString(), ethAmount.toString())
            } catch (err) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(`[copytrade_exactOutputSingle] ${chain}, ${tx.hash}, ${err.message}`)
                await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
            }
        }
    }
}

export async function copytrade_exactOutput(telegramId: string, chain: string, tx: any, decoded: any, functionABI: any, copytradeDB: any) {
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
    const routerAddress = tx.to.toLowerCase()

    // regulating parameters...
    const wallets = (copytradeDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

    const dr = functionABI.inputs[0].components.map((t, idx) => {
        return {
            [t.name]: t.type === 'address' || t.type === 'bytes' ? decoded.params[idx].toLowerCase() : decoded.params[idx]
        }
    }).reduce((prev, cur) => {
        return {
            ...prev,
            ...cur
        }
    }, {})

    for (let i = 2; i < dr.path.length; i += 46) {
        const token = dr.path.slice(i, i + 40)
        const fee = dr.path.slice(i + 40, i + 46)

        if (token) {
            if (dr.tokens === undefined) dr.tokens = []
            dr.tokens.push('0x' + token)
        }

        if (fee) {
            if (dr.fees === undefined) dr.fees = []
            dr.fees.push('0x' + fee)
        }
    }

    // const dr = {
    //     path: '0x9bf1d7d63dd7a4ce167cf4866388226eeefa702e000bb8c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000bb83007083eaa95497cd6b2b809fb97b6a30bdf53d3',
    //     recipient: '0x8b13a9cce369445725fd52ed4a1c4d6d9ca0e6cd',
    //     amountOut: '321429136823391300000000000',
    //     amountInmax: '21832523828772676049708'
    // }

    const chainInfo = await ChainModel.findOne({ name: chain })
    const pathRev = JSON.parse(JSON.stringify(dr.tokens))
    pathRev.reverse()

    if (dr.tokens[dr.tokens.length - 1] === chainInfo.tokens[0]) { // buy
        const tokenAddress = dr.tokens[0]
        let targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        if (targetTokenInfo === null) {
            await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
            targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        }

        const slippage = copytradeDB.autoBuySlippage ?? setting.slippage ?? 100
        let tokenAmount = BN(dr.amountOut)
        let tokenAmountWithDecimals = tokenAmount.div(BN(`1e${nativeDecimals}`)).toString()

        let ethAmount = '0'
        let amountInMax = '0'
        {
            let v3Path = {
                factory: '',
                path: JSON.parse(JSON.stringify(dr.tokens)),
                fee: JSON.parse(JSON.stringify(dr.fees)),
                version: 3
            }
            let amn

            if (v3Path) {
                v3Path.path.reverse()
                v3Path.fee.reverse()

                amn = await getAmountsInExtV3(chain, tokenAmountWithDecimals, v3Path)
            } else {
                throw new Error(`Failed to calculate <b>${nativeSymbol}</b> amount to buy by <b>${tokenAmountWithDecimals} ${targetTokenInfo.symbol}</b>`)
            }

            ethAmount = BN(amn).times(BN(`1e${nativeDecimals}`)).integerValue().toString()
            amountInMax = slippage === 100 ? '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' : BN(ethAmount).times(BN(100)).div(100 - slippage).integerValue().toString()
        }

        const nativeAmount = parseFloat(BN(ethAmount).div(BN(`1e${nativeDecimals}`)).toFixed(4))

        for (const w of wallets) {
            try {
                await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} for ${BN(tokenAmount).div(BN(`1e${targetTokenInfo.decimals}`))} ${targetTokenInfo.symbol} : ${tx.hash}`)

                const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${nativeAmount} ${nativeSymbol}</b> to <b>${BN(tokenAmount).div(BN(`1e${targetTokenInfo.decimals}`))} ${targetTokenInfo.symbol}</b>`

                const callback = getTxCallback(label)

                const retTx = await sendTxn(
                    telegramId,
                    chain,
                    {
                        abi: [functionABI],
                        functionName: functionABI.name,
                        args: [[dr.path, w.address, tokenAmount.toString(), amountInMax]]
                    },
                    {
                        to: routerAddress,
                        address: w,
                        value: ethAmount.toString(),
                        gasPrice: BN(copytradeDB.autoBuyGasPrice || '0').gt(BN(0)) ? BN(copytradeDB.autoBuyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : BN(setting.buyGasPrice || '0').gt(BN(0)) ? BN(setting.buyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                    },
                    {
                        callback: callback,
                        exInfo: {
                            telegramId: telegramId,
                            chain: chain,
                            token: tokenAddress,
                            user: w.address,
                            type: 'buy',
                            tokenAmount: tokenAmount,
                            ethAmount: ethAmount.toString()
                        }
                    }
                );

                if (retTx?.transactionHash) {
                    const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                    if (txFound !== null) {
                        const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                        itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                        await itemDbUpdate.save()
                    }
                    const user = await getAppUser(telegramId)
                    await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
                }

                await updateUserState(telegramId, chain, 0, 0, undefined, ethAmount.toString())
                const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
                await updateBuyMonitorInfo(chain, tokenAddress, w.address, BN(tokenAmount).times(BN(100).minus(BN(taxInfo?.buyTax || '0')).div(100)).integerValue().toString(), ethAmount.toString())
            } catch (err) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(`[copytrade_exactOutput] ${chain}, ${tx.hash}, ${err.message}`)
                await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
            }
        }
    } else if (dr.tokens[0] === chainInfo.tokens[0]) { // sell
        const tokenAddress = dr.tokens[dr.tokens.length - 1]
        let targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        if (targetTokenInfo === null) {
            await prefetchTokensOnChain(chain, JSON.stringify([tokenAddress]))
            targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })
        }

        const ethAmount = dr.amountOut
        const ethAmountWithDecimals = BN(ethAmount).div(BN(`1e${nativeDecimals}`)).toString()

        for (const w of wallets) {
            try {
                let amountInMax = '0'
                let tokenAmountWithDecimals = '0'
                const slippage = setting.slippage ?? 100
                {
                    let v3Path = {
                        factory: '',
                        path: JSON.parse(JSON.stringify(dr.tokens)),
                        fee: JSON.parse(JSON.stringify(dr.fees)),
                        version: 3
                    }
                    let amn

                    if (v3Path) {
                        v3Path.path.reverse()
                        v3Path.fee.reverse()

                        amn = await getAmountsInExtV3(chain, ethAmountWithDecimals, v3Path)
                    } else {
                        throw new Error(`Failed to calculate <b>${targetTokenInfo.symbol}</b> amount to buy by <b>${ethAmountWithDecimals} ${nativeSymbol}</b>`)
                    }

                    tokenAmountWithDecimals = BN(amn).times(BN(`1e${targetTokenInfo.decimals}`)).integerValue().toString()
                    amountInMax = slippage === 100 ? '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' : BN(tokenAmountWithDecimals).times(BN(100)).div(100 - slippage).integerValue().toString()
                }

                const tokenAmount = BN(tokenAmountWithDecimals).div(BN(`1e${targetTokenInfo.decimals}`))

                await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${tokenAmount.toString()} ${targetTokenInfo.symbol} : ${tx.hash}`)

                const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${parseFloat(tokenAmount.toFixed(4))} ${targetTokenInfo.symbol}</b> to <b>${nativeSymbol}</b>`

                const callback = getTxCallback(label)

                if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddress, tokenAmountWithDecimals, routerAddress, w))) {
                    await approveTokenExt(telegramId, chain, tokenAddress, routerAddress, w)
                }

                const retTx = await sendTxn(
                    telegramId,
                    chain,
                    {
                        abi: [functionABI],
                        functionName: functionABI.name,
                        args: [[dr.path, w.address, ethAmount, amountInMax]]
                    },
                    {
                        to: routerAddress,
                        address: w,
                        value: tx.value,
                        gasPrice: BN(setting.sellGasPrice || '0').gt(BN(0)) ? BN(setting.sellGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                    },
                    {
                        callback: callback,
                        exInfo: {
                            telegramId: telegramId,
                            chain: chain,
                            token: tokenAddress,
                            user: w.address,
                            type: 'sell',
                            tokenAmount: tokenAmountWithDecimals,
                            ethAmount: ethAmount
                        }
                    }
                );

                if (retTx?.transactionHash) {
                    const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                    if (txFound !== null) {
                        const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                        itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                        await itemDbUpdate.save()
                    }
                    const user = await getAppUser(telegramId)
                    await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
                }

                const tokenPrice = getTokenPrice(telegramId, chain, tokenAddress)
                const nativePrice = await getNativeCurrencyPrice(chain)

                await updateUserState(telegramId, chain, 0, 0, BN(tokenAmount).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString(), undefined)

                const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
                await updateSellMonitorInfo(chain, tokenAddress, w.address, tokenAmountWithDecimals, BN(ethAmount).times(BN(100).minus(BN(taxInfo?.sellTax || '0')).div(100)).integerValue().toString())
            } catch (err) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(`[copytrade_exactOutput] ${chain}, ${tx.hash}, ${err.message}`)
                await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
            }
        }
    } else {
        const tokenAddresses = [dr.tokens[dr.tokens.length - 1], dr.tokens[0]]
        let targetTokenInfo = await Promise.all(tokenAddresses.map(t => TokenInfoModel.findOne({ chain: chain, address: t })))
        if (targetTokenInfo[0] === null || targetTokenInfo[1] === null) {
            await prefetchTokensOnChain(chain, JSON.stringify(tokenAddresses))
            targetTokenInfo = await Promise.all(tokenAddresses.map(t => TokenInfoModel.findOne({ chain: chain, address: t })))
        }

        const tokenAmount = BN(dr.amountOut).div(BN(`1e${targetTokenInfo[1].decimals}`))
        const tokenAmountWithDecimals = tokenAmount.times(BN(`1e${targetTokenInfo[1].decimals}`)).integerValue().toString()
        // regulating parameters...
        for (const w of wallets) {
            try {
                let amountInMax = '0'
                let amountIn = '0'
                const slippage = setting.slippage ?? 100
                {
                    let v3Path = {
                        factory: '',
                        path: JSON.parse(JSON.stringify(dr.tokens)),
                        fee: JSON.parse(JSON.stringify(dr.fees)),
                        version: 3
                    }
                    let amn

                    if (v3Path) {
                        v3Path.path.reverse()
                        v3Path.fee.reverse()

                        amn = await getAmountsInExtV3(chain, tokenAmount.toString(), v3Path)
                    } else {
                        throw new Error(`Failed to calculate <b>${targetTokenInfo[0].symbol}</b> amount to buy by <b>${tokenAmount.toString()} ${targetTokenInfo[1].symbol}</b>`)
                    }

                    amountIn = BN(amn).times(BN(`1e${targetTokenInfo[0].decimals}`)).integerValue().toString()
                    amountInMax = slippage === 100 ? '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' : BN(amountIn).times(BN(100)).div(100 - slippage).integerValue().toString()
                }

                await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} for ${tokenAmount.toString()} ${targetTokenInfo[1].symbol} : ${tx.hash}`)

                const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${targetTokenInfo[0].symbol}</b> to <b>${parseFloat(tokenAmount.toFixed(4))} ${targetTokenInfo[1].symbol}</b>`

                const tokenPrice = await getTokenPrice(telegramId, chain, tokenAddresses[1])
                const nativePrice = await getNativeCurrencyPrice(chain)

                const taxInfoBuy = await getTokenTaxInfo(chain, tokenAddresses[1])

                const ethAmount = BN(tokenAmount).times(BN(100).minus(BN(taxInfoBuy?.buyTax || '0')).div(100)).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString()

                const callback = getTxCallback(label)

                if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddresses[0], amountInMax, routerAddress, w))) {
                    await approveTokenExt(telegramId, chain, tokenAddresses[0], routerAddress, w)
                }

                const retTx = await sendTxn(
                    telegramId,
                    chain,
                    {
                        abi: [functionABI],
                        functionName: functionABI.name,
                        args: [[dr.path, w.address, tokenAmountWithDecimals, amountInMax]]
                    },
                    {
                        to: routerAddress,
                        address: w,
                        value: tx.value,
                        gasPrice: BN(copytradeDB.autoBuyGasPrice || '0').gt(BN(0)) ? BN(copytradeDB.autoBuyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : BN(setting.buyGasPrice || '0').gt(BN(0)) ? BN(setting.buyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                    },
                    {
                        callback: callback,
                        exInfo: {
                            telegramId: telegramId,
                            chain: chain,
                            token: tokenAddresses[1],
                            user: w.address,
                            type: 'buy',
                            tokenAmount: tokenAmountWithDecimals,
                            ethAmount: ethAmount.toString()
                        }
                    }
                );

                if (retTx?.transactionHash) {
                    const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                    if (txFound !== null) {
                        const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                        itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                        await itemDbUpdate.save()
                    }
                    const user = await getAppUser(telegramId)
                    await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddresses[0])
                }

                await updateUserState(telegramId, chain, 0, 0, undefined, ethAmount.toString())
                const taxInfo = await getTokenTaxInfo(chain, tokenAddresses[1])
                await updateBuyMonitorInfo(chain, tokenAddresses[1], w.address, BN(tokenAmountWithDecimals).times(BN(100).minus(BN(taxInfo?.buyTax || '0')).div(100)).integerValue().toString(), ethAmount.toString())
            } catch (err) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(`[copytrade_exactOutput] ${chain}, ${tx.hash}, ${err.message}`)
                await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
            }
        }
    }
}

export async function copytrade_multicall(telegramId: string, chain: string, tx: any, decoded: any, functionABI: any, copytradeDB: any) {
    const tres = await Promise.all([
        getAppUser(telegramId),
        getMultiWallets(telegramId),
        getWallet(telegramId),
        getSettings(telegramId, chain),
        getNativeCurrencyDecimal(chain),
        getNativeCurrencySymbol(chain),
        getNativeCurrencyPrice(chain),
        ChainModel.findOne({ name: chain }),
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
    const nativePrice = tres[6]
    const chainInfo = tres[7]
    const explorerURL = tres[8]
    const netGasPrice = tres[9].toString()
    const routerAddress = tx.to.toLowerCase()

    // regulating parameters...
    const wallets = (copytradeDB.multi === true && setting.multiWallet === true) ? [mainWallet, ...multiWallets] : [mainWallet]

    const web3 = getWeb3()
    const smartRouterInst = getSmartRouterContract()
    const srns = smartRouterInst._jsonInterface.filter((f) => f.type === 'function')

    let label = `🔗<b>${chain}</b>\nCopy Trade of <b>${tx.from}</b>\n`

    let decodedContext = []

    for (const d of decoded.data) {
        let dr
        let fnr
        for (const fn of srns) {
            if (fn.signature.toLowerCase() === d.slice(0, 10).toLowerCase()) {
                try {
                    dr = web3.eth.abi.decodeParameters(fn.inputs, '0x' + d.slice(10));
                    fnr = fn;
                } catch (err) {
                }
            }
        }

        if (dr) {
            decodedContext = [...decodedContext, {
                abi: fnr,
                msg: dr
            }]
        } else {
            decodedContext = [...decodedContext, {
                abi: undefined,
                data: d
            }]
        }
    }

    const failedData = decodedContext.find(d => d.abi === undefined)
    if (failedData) {
        return
    }

    // if (decodedContext.find(d => d.abi.name === 'swapTokensForExactTokens') === undefined) return

    // console.log('>>>', chain, tx.hash)
    // decodedContext.forEach(d => {
    //     console.log(d.abi, d.msg)
    // })

    // return

    for (const w of wallets) {
        try {
            const ret: any = await getV3MulticallParams(decodedContext)
            let msgReas
            let ethAmount
            let tokenAmount
            let tokenAddress
            let targetTokenInfo
            let type = 'sell'
            let sendETH

            if (ret.amountIn) {
                let amnIn = BN(ret.amountIn).eq(0) ? BN(tx.value).toString() : BN(ret.amountIn).toString()
                let amnInDecimals

                sendETH = tx.value
                if (ret.path[0] === chainInfo.tokens[0]) {
                    type = 'buy'
                    if (BN(copytradeDB.autoBuyAmount || '0').gt(BN(0)) && BN(amnIn).gt(BN(copytradeDB.autoBuyAmount).times(BN(`1e${nativeDecimals}`)))) {
                        amnIn = BN(copytradeDB.autoBuyAmount).times(BN(`1e${nativeDecimals}`)).integerValue().toString()
                    }
                    sendETH = amnIn
                    amnInDecimals = BN(amnIn).div(BN(`1e${nativeDecimals}`)).toString()
                } else {
                    const tInfo = await getTokenSimpleInfo(telegramId, chain, ret.path[0], w.address)
                    if (BN(amnIn).gt(tInfo.balance)) {
                        amnIn = BN(tInfo.balance).times(BN(`1e${tInfo.decimals}`)).integerValue().toString()
                    }
                    amnInDecimals = BN(amnIn).div(BN(`1e${tInfo.decimals}`)).toString()
                }

                ret.amountIn = amnIn
                let amountOut
                {
                    let v2Path
                    let v3Path
                    let amn

                    if (ret.fee) {
                        v3Path = {
                            factory: '',
                            path: JSON.parse(JSON.stringify(ret.path)),
                            fee: JSON.parse(JSON.stringify(ret.fee)),
                            version: 3
                        }
                        amn = await getAmountsOutExtV3(chain, amnInDecimals, v3Path)
                    } else {
                        v2Path = {
                            factory: '',
                            path: JSON.parse(JSON.stringify(ret.path)),
                            version: 2
                        }
                        amn = await getAmountsOutExtV2(chain, amnInDecimals, v2Path)
                    }

                    if (ret.path[ret.path.length - 1] === chainInfo.tokens[0]) {
                        amountOut = BN(amn).times(BN(`1e${nativeDecimals}`)).integerValue().toString()
                    } else {
                        const ti = await getTokenSimpleInfo(telegramId, chain, ret.path[ret.path.length - 1], w.address)
                        amountOut = BN(amn).times(BN(`1e${ti.decimals}`)).integerValue().toString()
                    }
                }
                const slippage = type === 'buy' ? (copytradeDB.autoBuySlippage ?? setting.slippage ?? 100) : (setting.slippage ?? 100)
                ret.amountOutMin = BN(amountOut).times(BN(100 - slippage)).div(100).integerValue().toString()
                ret.recipient = w.address

                ethAmount = type === 'buy' ? amnIn : amountOut
                tokenAmount = type === 'buy' ? amountOut : amnIn
                tokenAddress = type === 'buy' ? ret.path[ret.path.length - 1] : ret.path[0]
                targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })

                msgReas = await getV3MulticallReassemble(decodedContext, ret)
            } else if (ret.amountOut) {
                let amnOut = BN(ret.amountOut).toString()
                let amnOutDecimals

                sendETH = tx.value
                if (ret.path[ret.path.length - 1] === chainInfo.tokens[0]) {
                    type = 'buy'
                    amnOutDecimals = BN(amnOut).div(BN(`1e${nativeDecimals}`)).toString()
                } else {
                    const ti = await getTokenSimpleInfo(telegramId, chain, ret.path[ret.path.length - 1], w.address)
                    amnOutDecimals = BN(amnOut).div(BN(`1e${ti.decimals}`)).toString()
                }

                let amountIn
                {
                    let v2Path
                    let v3Path
                    let amn

                    if (ret.fee) {
                        v3Path = {
                            factory: '',
                            path: JSON.parse(JSON.stringify(ret.path)),
                            fee: JSON.parse(JSON.stringify(ret.fee)),
                            version: 3
                        }
                        amn = await getAmountsInExtV3(chain, amnOutDecimals, v3Path)
                    } else {
                        v2Path = {
                            factory: '',
                            path: JSON.parse(JSON.stringify(ret.path)),
                            version: 2
                        }
                        amn = await getAmountsInExtV2(chain, amnOutDecimals, v2Path)
                    }

                    if (ret.path[0] === chainInfo.tokens[0]) {
                        amountIn = BN(amn).times(BN(`1e${nativeDecimals}`)).integerValue().toString()
                    } else {
                        const ti = await getTokenSimpleInfo(telegramId, chain, ret.path[0], w.address)
                        amountIn = BN(amn).times(BN(`1e${ti.decimals}`)).integerValue().toString()
                    }
                }
                const slippage = setting.slippage ?? 100
                const amountInMax = slippage >= 100 ? '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' : BN(amountIn).times(BN(100)).div(100 - slippage).integerValue().toString()
                if (BN(amountInMax).lt(ret.amountInMax)) {
                    ret.amountInMax = amountInMax
                }

                ret.recipient = w.address

                ethAmount = type === 'buy' ? amountIn : amnOut
                tokenAmount = type === 'buy' ? amnOut : amountIn
                tokenAddress = type === 'buy' ? ret.path[0] : ret.path[ret.path.length - 1]
                targetTokenInfo = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress })

                msgReas = await getV3MulticallReassemble(decodedContext, ret)
            }

            if (msgReas) {
                if (type === 'buy') {
                    await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} for ${BN(tokenAmount).div(BN(`1e${targetTokenInfo.decimals}`)).toString()} ${targetTokenInfo.symbol} : ${tx.hash}`)

                    const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${parseFloat(BN(ethAmount).div(BN(`1e${nativeSymbol}`)).toFixed(4))} ${nativeSymbol}</b> to <b>${parseFloat(BN(tokenAmount).div(BN(`1e${targetTokenInfo.decimals}`)).toFixed(4))} ${targetTokenInfo.symbol}</b>`

                    const callback = getTxCallback(label)

                    const retTx = await sendTxn(
                        telegramId,
                        chain,
                        {
                            abi: [functionABI],
                            functionName: functionABI.name,
                            args: assembleMulticallMsg(decoded, msgReas)
                        },
                        {
                            to: routerAddress,
                            address: w,
                            value: sendETH,
                            gasPrice: BN(copytradeDB.autoBuyGasPrice || '0').gt(BN(0)) ? BN(copytradeDB.autoBuyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : BN(setting.buyGasPrice || '0').gt(BN(0)) ? BN(setting.buyGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                        },
                        {
                            callback: callback,
                            exInfo: {
                                telegramId: telegramId,
                                chain: chain,
                                token: tokenAddress,
                                user: w.address,
                                type: 'buy',
                                tokenAmount: tokenAmount,
                                ethAmount: ethAmount.toString()
                            }
                        }
                    );

                    if (retTx?.transactionHash) {
                        const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                        if (txFound !== null) {
                            const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                            itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                            await itemDbUpdate.save()
                        }
                        const user = await getAppUser(telegramId)
                        await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
                    }

                    await updateUserState(telegramId, chain, 0, 0, undefined, ethAmount.toString())
                    const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
                    await updateBuyMonitorInfo(chain, tokenAddress, w.address, BN(tokenAmount).times(BN(100).minus(BN(taxInfo?.buyTax || '0')).div(100)).integerValue().toString(), ethAmount.toString())
                } else if (type === 'sell') {
                    await userVerboseLog(telegramId, `copy trade of ${tx.from.toLowerCase()} on [${copytradeDB.chain}] - ${w.address}:${functionABI.name} of ${routerAddress} with ${BN(tokenAmount).div(BN(`1e${targetTokenInfo.decimals}`)).toString()} ${targetTokenInfo.symbol} : ${tx.hash}`)

                    const label = `🔗<b>${chain}</b>\n<code>${w.address}</code>\n\nCopy Trade of <b>${tx.from.toLowerCase()}</b>\nSwapping <b>${parseFloat(BN(tokenAmount).toFixed(4))} ${targetTokenInfo.symbol}</b> to <b>${nativeSymbol}</b>`

                    const callback = getTxCallback(label)

                    if (true !== (await isTokenApprovedExt(telegramId, chain, tokenAddress, tokenAmount, routerAddress, w))) {
                        await approveTokenExt(telegramId, chain, tokenAddress, routerAddress, w)
                    }

                    const retTx = await sendTxn(
                        telegramId,
                        chain,
                        {
                            abi: [functionABI],
                            functionName: functionABI.name,
                            args: assembleMulticallMsg(decoded, msgReas)
                        },
                        {
                            to: routerAddress,
                            address: w,
                            value: sendETH,
                            gasPrice: BN(setting.sellGasPrice || '0').gt(BN(0)) ? BN(setting.sellGasPrice).times('1e9').plus(chain === 'ethereum' ? netGasPrice : '0').integerValue().toString() : undefined
                        },
                        {
                            callback: callback,
                            exInfo: {
                                telegramId: telegramId,
                                chain: chain,
                                token: tokenAddress,
                                user: w.address,
                                type: 'sell',
                                tokenAmount: tokenAmount,
                                ethAmount: ethAmount
                            }
                        }
                    );

                    if (retTx?.transactionHash) {
                        const txFound = await TransactionHistoryModel.findOne({ chain: chain, transactionHash: retTx.transactionHash });
                        if (txFound !== null) {
                            const itemDbUpdate = await CopyTradeModel.findById(copytradeDB._id)
                            itemDbUpdate.transactions = [...itemDbUpdate.transactions, txFound._id]

                            await itemDbUpdate.save()
                        }
                        const user = await getAppUser(telegramId)
                        await externalInvokeMonitor(telegramId, user.chatId, chain, tokenAddress)
                    }

                    const tokenPrice = getTokenPrice(telegramId, chain, tokenAddress)
                    const nativePrice = await getNativeCurrencyPrice(chain)

                    await updateUserState(telegramId, chain, 0, 0, BN(tokenAmount).times(BN(tokenPrice || '0')).div(BN(nativePrice)).times(BN(`1e${nativeDecimals}`)).integerValue().toString(), undefined)

                    const taxInfo = await getTokenTaxInfo(chain, tokenAddress)
                    await updateSellMonitorInfo(chain, tokenAddress, w.address, tokenAmount, BN(ethAmount).times(BN(100).minus(BN(taxInfo?.sellTax || '0')).div(100)).integerValue().toString())
                }
            }
        } catch (err) {
            console.error(`==> ${new Date().toLocaleString()}`)
            console.error(err)
            Logging.error(`[copytrade_multicall] ${chain}, ${tx.hash}, ${err.message}`)
            await sendBotMessage(user.telegramId, `Error copying the following trade\n<b>Your wallet</b>: <code>${w.address}</code>\n\n${explorerURL}/tx/${tx.hash}\n\n${err.message}`)
        }
    }
}

export async function getV3MulticallParams(decodedArray: any[]) {
    let pathRet = []
    const pushTokenArray = (paths) => {
        if (pathRet.length > 0 && pathRet[pathRet.length - 1] !== paths[0]) {
            throw new Error('Invalid path chain')
        }
        pathRet = [...pathRet, ...(pathRet.length > 0 ? paths.slice(1) : paths)]
    }

    let feeRet = []
    const pushFeeArray = (fees) => {
        feeRet = [...feeRet, fees]
    }

    let params: any = {}

    for (const [idx, d] of decodedArray.entries()) {
        if (d.abi.name === 'exactInput') {
            const dr = d.abi.inputs[0].components.map((t, idx) => {
                return {
                    [t.name]: t.type === 'address' || t.type === 'bytes' ? d.msg.params[idx].toLowerCase() : d.msg.params[idx]
                }
            }).reduce((prev, cur) => {
                return {
                    ...prev,
                    ...cur
                }
            }, {})

            for (let i = 2; i < dr.path.length; i += 46) {
                const token = dr.path.slice(i, i + 40)
                const fee = dr.path.slice(i + 40, i + 46)

                if (token) {
                    if (dr.tokens === undefined) dr.tokens = []
                    dr.tokens.push('0x' + token)
                }

                if (fee) {
                    if (dr.fees === undefined) dr.fees = []
                    dr.fees.push('0x' + fee)
                }
            }

            if (params.firstIdx === undefined) {
                params = {
                    ...params,
                    firstIdx: idx,
                    amountIn: dr.amountIn
                }
            }

            params = {
                ...params,
                lastIdx: idx,
                amountOutMin: dr.amountOutMin
            }

            pushTokenArray(dr.tokens)
            pushFeeArray(dr.fees)
        } else if (d.abi.name === 'exactInputSingle') {
            const dr = d.abi.inputs[0].components.map((t, idx) => {
                return {
                    [t.name]: t.type === 'address' || t.type === 'bytes' ? d.msg.params[idx].toLowerCase() : d.msg.params[idx]
                }
            }).reduce((prev, cur) => {
                return {
                    ...prev,
                    ...cur
                }
            }, {})

            if (params.firstIdx === undefined) {
                params = {
                    ...params,
                    firstIdx: idx,
                    amountIn: dr.amountIn
                }
            }
            params = {
                ...params,
                lastIdx: idx,
                amountOutMin: dr.amountOutMin
            }
            pushTokenArray([dr.tokenIn, dr.tokenOut])
            pushFeeArray([dr.fee])
        } else if (d.abi.name === 'exactInputStableSwap') {
            if (params.firstIdx === undefined) {
                params = {
                    ...params,
                    firstIdx: idx,
                    amountIn: d.msg.amountIn
                }
            }
            params = {
                ...params,
                lastIdx: idx,
                amountOutMin: d.msg.amountOutMin
            }
            pushTokenArray(d.msg.path.map(t => t.toLowerCase()))
            pushFeeArray(d.msg.path.map(t => 500).slice(0, d.msg.path.length - 1))
        } else if (d.abi.name === 'exactOutput') {
            const dr = d.abi.inputs[0].components.map((t, idx) => {
                return {
                    [t.name]: t.type === 'address' || t.type === 'bytes' ? d.msg.params[idx].toLowerCase() : d.msg.params[idx]
                }
            }).reduce((prev, cur) => {
                return {
                    ...prev,
                    ...cur
                }
            }, {})

            for (let i = 2; i < dr.path.length; i += 46) {
                const token = dr.path.slice(i, i + 40)
                const fee = dr.path.slice(i + 40, i + 46)

                if (token) {
                    if (dr.tokens === undefined) dr.tokens = []
                    dr.tokens.push('0x' + token)
                }

                if (fee) {
                    if (dr.fees === undefined) dr.fees = []
                    dr.fees.push('0x' + fee)
                }
            }
            if (params.firstIdx === undefined) {
                params = {
                    ...params,
                    firstIdx: idx,
                    amountInMax: dr.amountInMaximum
                }
            }
            params = {
                ...params,
                lastIdx: idx,
                amountOut: dr.amountOut
            }
            pushTokenArray(JSON.parse(JSON.stringify(dr.tokens)).reverse())
            pushFeeArray(JSON.parse(JSON.stringify(dr.fees)).reverse())
        } else if (d.abi.name === 'exactOutputSingle') {
            const dr = d.abi.inputs[0].components.map((t, idx) => {
                return {
                    [t.name]: t.type === 'address' || t.type === 'bytes' ? d.msg.params[idx].toLowerCase() : d.msg.params[idx]
                }
            }).reduce((prev, cur) => {
                return {
                    ...prev,
                    ...cur
                }
            }, {})

            if (params.firstIdx === undefined) {
                params = {
                    ...params,
                    firstIdx: idx,
                    amountInMax: dr.amountInMaximum
                }
            }
            params = {
                ...params,
                lastIdx: idx,
                amountOut: dr.amountOut
            }
            pushTokenArray([dr.tokenIn, dr.tokenOut])
            pushFeeArray([dr.fee])
        } else if (d.abi.name === 'exactOutputStableSwap') {
            if (params.firstIdx === undefined) {
                params = {
                    ...params,
                    firstIdx: idx,
                    amountInMax: d.msg.amountInMax
                }
            }
            params = {
                ...params,
                lastIdx: idx,
                amountOut: d.msg.amountOut
            }
            pushTokenArray(JSON.parse(JSON.stringify(d.msg.path.map(t => t.toLowerCase()))).reverse())
            pushFeeArray(d.msg.path.map(t => 500).slice(0, d.msg.path.length - 1))
        } else if (d.abi.name === 'swapExactTokensForTokens') {
            if (params.firstIdx === undefined) {
                params = {
                    ...params,
                    firstIdx: idx,
                    amountIn: d.msg.amountIn
                }
            }
            params = {
                ...params,
                lastIdx: idx,
                amountOutMin: d.msg.amountOutMin
            }
            pushTokenArray(d.msg.path.map(t => t.toLowerCase()))
        } else if (d.abi.name === 'swapTokensForExactTokens') {
            if (params.firstIdx === undefined) {
                params = {
                    ...params,
                    firstIdx: idx,
                    amountInMax: d.msg.amountInMax
                }
            }
            params = {
                ...params,
                lastIdx: idx,
                amountOut: d.msg.amountOut
            }
            pushTokenArray(d.msg.path.map(t => t.toLowerCase()))
        } else if (d.abi.name === 'approveMax') {
        } else if (d.abi.name === 'approveMaxMinusOne') {
        } else if (d.abi.name === 'approveZeroThenMax') {
        } else if (d.abi.name === 'approveZeroThenMaxMinusOne') {
        } else if (d.abi.name === 'callPositionManager') {
        } else if (d.abi.name === 'checkOracleSlippage') {
        } else if (d.abi.name === 'increaseLiquidity') {
        } else if (d.abi.name === 'mint') {
        } else if (d.abi.name === 'multicall') {
        } else if (d.abi.name === 'pancakeV3SwapCallback') {
        } else if (d.abi.name === 'pull') {
        } else if (d.abi.name === 'refundETH') {
        } else if (d.abi.name === 'renounceOwnership') {
        } else if (d.abi.name === 'selfPermit') {
        } else if (d.abi.name === 'selfPermitAllowed') {
        } else if (d.abi.name === 'selfPermitAllowedIfNecessary') {
        } else if (d.abi.name === 'selfPermitIfNecessary') {
        } else if (d.abi.name === 'setStableSwap') {
        } else if (d.abi.name === 'sweepToken') {
            params = {
                ...params,
                lastIdx: idx,
                amountOutMin: d.msg.amountMinimum
            }
        } else if (d.abi.name === 'sweepTokenWithFee') {
            params = {
                ...params,
                lastIdx: idx,
                amountOutMin: d.msg.amountMinimum
            }
        } else if (d.abi.name === 'transferOwnership') {
        } else if (d.abi.name === 'unwrapWETH9') {
            params = {
                ...params,
                lastIdx: idx,
                amountOutMin: d.msg.amountMinimum
            }
        } else if (d.abi.name === 'unwrapWETH9WithFee') {
            params = {
                ...params,
                lastIdx: idx,
                amountOutMin: d.msg.amountMinimum
            }
        } else if (d.abi.name === 'wrapETH') {
            if (params.firstIdx === undefined) {
                params = {
                    ...params,
                    firstIdx: idx,
                    amountIn: d.msg.value
                }
            }
        }
    }

    return {
        ...params,
        path: pathRet,
        fee: feeRet.length > 0 ? feeRet : undefined
    }
}

export async function getV3MulticallReassemble(decodedArray: any[], info: any) {
    const web3 = getWeb3()

    let multicall = []

    for (const [idx, d] of decodedArray.entries()) {
        if (d.abi.name === 'exactInput') {
            const dr = d.abi.inputs[0].components.map((t, idx) => {
                return {
                    [t.name]: t.type === 'address' || t.type === 'bytes' ? d.msg.params[idx].toLowerCase() : d.msg.params[idx]
                }
            }).reduce((prev, cur) => {
                return {
                    ...prev,
                    ...cur
                }
            }, {})

            let amountIn = dr.amountIn
            let amountOutMinimum = dr.amountOutMinimum
            let recipient = dr.recipient

            if (idx === info.firstIdx) {
                amountIn = info.amountIn
            }

            if (idx === info.lastIdx) {
                amountOutMinimum = info.amountOutMin
                recipient = info.recipient
            }

            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [[dr.path, recipient, amountIn, amountOutMinimum]])
            ]
        } else if (d.abi.name === 'exactInputSingle') {
            const dr = d.abi.inputs[0].components.map((t, idx) => {
                return {
                    [t.name]: t.type === 'address' || t.type === 'bytes' ? d.msg.params[idx].toLowerCase() : d.msg.params[idx]
                }
            }).reduce((prev, cur) => {
                return {
                    ...prev,
                    ...cur
                }
            }, {})

            let amountIn = dr.amountIn
            let amountOutMinimum = dr.amountOutMinimum
            let recipient = dr.recipient

            if (idx === info.firstIdx) {
                amountIn = info.amountIn
            }
            if (idx === info.lastIdx) {
                amountOutMinimum = info.amountOutMin
                recipient = info.recipient
            }

            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [[dr.tokenIn, dr.tokenOut, dr.fee, recipient, amountIn, amountOutMinimum, dr.sqrtPriceLimitX96]])
            ]
        } else if (d.abi.name === 'exactInputStableSwap') {
            let amountIn = d.msg.amountIn
            let to = d.msg.to
            let amountOutMin = d.msg.amountOutMin

            if (idx === info.firstIdx) {
                amountIn = info.amountIn
            }
            if (idx === info.lastIdx) {
                to = info.recipient
                amountOutMin = info.amountOutMin
            }

            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [d.msg.path, d.msg.flag, amountIn, amountOutMin, to])
            ]
        } else if (d.abi.name === 'exactOutput') {
            const dr = d.abi.inputs[0].components.map((t, idx) => {
                return {
                    [t.name]: t.type === 'address' || t.type === 'bytes' ? d.msg.params[idx].toLowerCase() : d.msg.params[idx]
                }
            }).reduce((prev, cur) => {
                return {
                    ...prev,
                    ...cur
                }
            }, {})

            let amountOut = dr.amountOut
            let amountInMax = dr.amountInMaximum
            let recipient = dr.recipient

            if (idx === info.firstIdx) {
                amountInMax = info.amountInMax
            }

            if (idx === info.lastIdx) {
                amountOut = info.amountOut
                recipient = info.recipient
            }

            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [[JSON.parse(JSON.stringify(dr.path)).reverse(), recipient, amountOut, amountInMax]])
            ]
        } else if (d.abi.name === 'exactOutputSingle') {
            const dr = d.abi.inputs[0].components.map((t, idx) => {
                return {
                    [t.name]: t.type === 'address' || t.type === 'bytes' ? d.msg.params[idx].toLowerCase() : d.msg.params[idx]
                }
            }).reduce((prev, cur) => {
                return {
                    ...prev,
                    ...cur
                }
            }, {})

            let amountOut = dr.amountOut
            let amountInMax = dr.amountInMaximum
            let recipient = dr.recipient

            if (idx === info.firstIdx) {
                amountInMax = info.amountInMax
            }

            if (idx === info.lastIdx) {
                amountOut = info.amountOut
                recipient = info.recipient
            }

            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [[dr.tokenIn, dr.tokenOut, dr.fee, recipient, amountOut, amountInMax, dr.sqrtPriceLimitX96]])
            ]
        } else if (d.abi.name === 'exactOutputStableSwap') {
            let amountOut = d.msg.amountOut
            let amountInMax = d.msg.amountInMax
            let recipient = d.msg.to

            if (idx === info.firstIdx) {
                amountInMax = info.amountInMax
            }

            if (idx === info.lastIdx) {
                amountOut = info.amountOut
                recipient = info.recipient
            }

            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [JSON.parse(JSON.stringify(d.msg.path)).reverse(), d.msg.flag, amountOut, amountInMax, recipient])
            ]
        } else if (d.abi.name === 'swapExactTokensForTokens') {
            let amountIn = d.msg.amountIn
            let amountOutMin = d.msg.amountOutMin
            let recipient = d.msg.to

            if (idx === info.firstIdx) {
                amountIn = info.amountIn
            }

            if (idx === info.lastIdx) {
                amountOutMin = info.amountOutMin
                recipient = info.recipient
            }

            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [amountIn, amountOutMin, d.msg.path, recipient])
            ]
        } else if (d.abi.name === 'swapTokensForExactTokens') {
            let amountOut = d.msg.amountOut
            let amountInMax = d.msg.amountInMax
            let recipient = d.msg.to

            if (idx === info.firstIdx) {
                amountInMax = info.amountInMax
            }

            if (idx === info.lastIdx) {
                amountOut = info.amountOut
                recipient = info.recipient
            }

            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [amountOut, amountInMax, d.msg.path, recipient])
            ]
        } else if (d.abi.name === 'approveMax') {
            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [d.msg.token])
            ]
        } else if (d.abi.name === 'approveMaxMinusOne') {
            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [d.msg.token])
            ]
        } else if (d.abi.name === 'approveZeroThenMax') {
            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [d.msg.token])
            ]
        } else if (d.abi.name === 'approveZeroThenMaxMinusOne') {
            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [d.msg.token])
            ]
        } else if (d.abi.name === 'callPositionManager') {
            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [d.msg.data])
            ]
        } else if (d.abi.name === 'checkOracleSlippage') {
            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [d.msg.paths, d.msg.amounts, d.msg.maximumTickDivergence, d.msg.secondsAgo])
            ]
        } else if (d.abi.name === 'increaseLiquidity') {
            const dr = d.abi.inputs[0].components.map((t, idx) => {
                return {
                    [t.name]: t.type === 'address' || t.type === 'bytes' ? d.msg.params[idx].toLowerCase() : d.msg.params[idx]
                }
            }).reduce((prev, cur) => {
                return {
                    ...prev,
                    ...cur
                }
            }, {})

            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [[dr.token0, dr.token1, dr.tokenId, dr.amount0Min, dr.amount1Min]])
            ]
        } else if (d.abi.name === 'mint') {
        } else if (d.abi.name === 'multicall') {
        } else if (d.abi.name === 'pancakeV3SwapCallback') {
        } else if (d.abi.name === 'pull') {
        } else if (d.abi.name === 'refundETH') {
            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [])
            ]
        } else if (d.abi.name === 'renounceOwnership') {
        } else if (d.abi.name === 'selfPermit') {
        } else if (d.abi.name === 'selfPermitAllowed') {
        } else if (d.abi.name === 'selfPermitAllowedIfNecessary') {
        } else if (d.abi.name === 'selfPermitIfNecessary') {
        } else if (d.abi.name === 'setStableSwap') {
        } else if (d.abi.name === 'sweepToken') {
            let amountOutMin = d.msg.amountMinimum
            let recipient = d.msg.recipient

            if (idx === info.lastIdx) {
                amountOutMin = info.amountOutMin
                recipient = info.recipient
            }

            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [d.msg.token, amountOutMin, recipient])
            ]
        } else if (d.abi.name === 'sweepTokenWithFee') {
            let amountOutMin = d.msg.amountMinimum
            let recipient = d.msg.recipient

            if (idx === info.lastIdx) {
                amountOutMin = info.amountOutMin
                recipient = info.recipient
            }

            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [d.msg.token, amountOutMin, d.msg.feeBips, recipient])
            ]
        } else if (d.abi.name === 'transferOwnership') {
        } else if (d.abi.name === 'unwrapWETH9') {
            let amountOutMin = d.msg.amountMinimum
            let recipient = d.msg.recipient

            if (idx === info.lastIdx) {
                amountOutMin = info.amountOutMin
                recipient = info.recipient
            }

            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [amountOutMin, recipient])
            ]
        } else if (d.abi.name === 'unwrapWETH9WithFee') {
            let amountOutMin = d.msg.amountMinimum
            let recipient = d.msg.recipient

            if (idx === info.lastIdx) {
                amountOutMin = info.amountOutMin
                recipient = info.recipient
            }

            if (d.msg.recipient) {
                multicall = [
                    ...multicall,
                    web3.eth.abi.encodeFunctionCall(d.abi, [amountOutMin, recipient, d.msg.feeBips, recipient])
                ]
            } else {
                multicall = [
                    ...multicall,
                    web3.eth.abi.encodeFunctionCall(d.abi, [amountOutMin, d.msg.feeBips, recipient])
                ]
            }
        } else if (d.abi.name === 'wrapETH') {
            let amountIn = d.msg.value

            if (idx === info.firstIdx) {
                amountIn = info.amountIn
            }

            multicall = [
                ...multicall,
                web3.eth.abi.encodeFunctionCall(d.abi, [amountIn])
            ]
        }
    }

    return multicall
}

export function assembleMulticallMsg(decoded: any, msgArray: string[]) {
    if (decoded.previousBlockhash) {
        return [decoded.previousBlockhash, msgArray]
    } else if (decoded.deadline) {
        return ['0xffffffff', msgArray]
    } else {
        return [msgArray]
    }
}
