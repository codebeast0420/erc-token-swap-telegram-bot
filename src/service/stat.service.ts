import { ChainModel } from "../models/chain.model";
import { TransactionHistoryModel } from "../models/transaction.history.model";
import { UserStatModel } from "../models/user.stat.model";
import Logging from "../utils/logging";
import { getBlockExplorer, getNativeCurrencyDecimal } from "../web3/chain.parameters";
import { getBN, payFee } from "../web3/web3.operation";
import { AffiliateService } from "./affiliate.service";
import { getAppUser, userVerboseLog } from "./app.user.service";
import { getWallet } from "./wallet.service";


export async function updateUserState(telegramId: string, chain: string, gasUsed: number, gasPrice: number, sellVol?: string, buyVol?: string) {
    const BN = getBN()

    try {
        const user = await getAppUser(telegramId);
        const decimals = await getNativeCurrencyDecimal(chain);
        const fee = BN(gasUsed)
            .times(BN(gasPrice))
            .div(BN(`1e${decimals}`));

        if (0 === (await UserStatModel.countDocuments({ user: user._id, chain: chain }))) {
            const newStat = new UserStatModel({
                user: user._id,
                chain: chain,
                txCount: 0,
                txMaxGas: gasUsed,
                txMinGas: gasUsed,
                txAvgGas: gasUsed,
                txGas: gasUsed,
                txMaxFee: fee.toString(),
                txMinFee: fee.toString(),
                txAvgFee: fee.toString(),
                txFee: '0',
                txPaid: '0',
                sellVolume: '0',
                buyVolume: '0'
            });

            await newStat.save();
        }

        const stat = await UserStatModel.findOne({ user: user._id, chain: chain });

        let txPaid = stat.txPaid

        stat.txFee = fee.plus(BN(stat.txFee)).toString();
        stat.txGas = stat.txGas + gasUsed
        stat.sellVolume = BN(stat.sellVolume || '0').plus(BN(sellVol || '0').div(BN(`1e${decimals}`))).toString()
        stat.buyVolume = BN(stat.buyVolume || '0').plus(BN(buyVol || '0').div(BN(`1e${decimals}`))).toString()

        stat.txCount = stat.txCount + 1
        stat.txMaxGas = gasUsed > stat.txMaxGas ? gasUsed : stat.txMaxGas
        stat.txMinGas = gasUsed < stat.txMinGas ? gasUsed : stat.txMinGas
        stat.txAvgGas = stat.txGas / stat.txCount

        stat.txMaxFee = fee.gt(stat.txMaxFee) ? fee.toString() : stat.txMaxFee
        stat.txMinFee = fee.lt(stat.txMinFee) ? fee.toString() : stat.txMinFee
        stat.txAvgFee = BN(stat.txFee).div(stat.txCount).toString()

        await stat.save()

        const feeThreshold = BN('1.0')
        const feePercentage = BN('0.01')

        const totalExpense = BN(stat.txFee).plus(BN(stat.sellVolume)).plus(BN(stat.buyVolume)).minus(BN(txPaid))

        if (
            totalExpense.gte(feeThreshold) // deduct after 1 ETH tx fee
            // totalExpense.gte(BN(txPaid)) // deduct before 1 ETH tx fee
        ) {
            // pay fee percentage 1% to feeRx
            const count = Math.floor(parseFloat(totalExpense.div(feeThreshold).toString()))
            const payAmount = feeThreshold.times(BN(count))
            const valueToSend = payAmount.times(feePercentage).times(BN(`1e${decimals}`)).integerValue().toString()

            await payFee(telegramId, chain, valueToSend)
            txPaid = BN(txPaid).plus(payAmount).toString()
        }

        stat.txPaid = txPaid

        await stat.save()
    } catch (err) {
        console.error(`==> ${new Date().toLocaleString()}`)
        console.error(err)
        Logging.error('[updateUserState] - Error updating user stat');
    }
}

export async function addTxRecord(telegramId: string, transaction: any, chain: string, wallet: any) {
    const explorer = await getBlockExplorer(chain);
    const user = await getAppUser(telegramId);
    const newTransactionHistory = new TransactionHistoryModel({
        user: user._id,
        chain: chain,
        from: wallet.address,
        explorer: explorer,
        blockHash: transaction.blockHash,
        blockNumber: transaction.blockNumber,
        contractAddress: transaction.contractAddress,
        effectiveGasPrice: transaction.effectiveGasPrice,
        gasUsed: transaction.gasUsed,
        to: transaction.to,
        transactionHash: transaction.transactionHash,
        transactionIndex: transaction.transactionIndex,
        raw: JSON.stringify(transaction)
    });

    await newTransactionHistory.save();
    await userVerboseLog(telegramId, `${transaction.transactionHash} recorded on ${chain}`);
}

export async function addAffiliateEarnings(telegramId: string, chain: string, gasUsed: number, gasPrice: number, txHash: string) {
    Logging.info('enter add affiliate earnings');
    const user = await getAppUser(telegramId);

    if (user.affiliateInfluencerSub != null) {
        const stat = await UserStatModel.findOne({ user: user._id, chain: chain });
        // Logging.info(stat);
        const affiliateSub = await new AffiliateService().getUserAffiliateById(user.affiliateInfluencerSub._id.toString());
    }
}
