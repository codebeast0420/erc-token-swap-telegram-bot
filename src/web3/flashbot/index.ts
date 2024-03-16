import { BRIBING_FAILED, FLASHBOT_SIMULATION_ERROR, INVALID_OPERATION } from "../../utils/common";
import Logging from "../../utils/logging";
import { chainConfig } from "../chain.config";

const ethers = require('ethers');
const Web3 = require('web3');
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle')

const FLASHBOTS_ENDPOINT = 'https://relay.flashbots.net';
const authSigner = new ethers.Wallet.createRandom();

export const flashBotSendMultiple = async (telegramId: string, chain: string, signedTxArray: string[], ex?: any) => {
	const provider = new ethers.providers.JsonRpcProvider(chainConfig[chain].rpcUrls[0]);
	const flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner, FLASHBOTS_ENDPOINT);
	const signedBundleToPubilsh = await flashbotsProvider.signBundle(
		signedTxArray.map(s => {
			return {
				signedTransaction: s
			}
		})
	);

	const signedBundle = ex.targetTx ? [ex.targetTx, ...signedBundleToPubilsh] : signedBundleToPubilsh

	const blockNumber = await provider.getBlockNumber();
	const bundleSimulate = await flashbotsProvider.simulate(
		signedBundle,
		blockNumber + 1
	);

	if ("error" in bundleSimulate || bundleSimulate.firstRevert !== undefined) {
		console.error(`flashBotSendMultiple ==> ${new Date().toLocaleString()}`)
		console.log(bundleSimulate)
		throw new Error(FLASHBOT_SIMULATION_ERROR + `\n${bundleSimulate.error?.message || bundleSimulate.firstRevert.error}`);
	}

	if (ex?.simulate === true) {
		return bundleSimulate
	}

	const bundleReceipt = await flashbotsProvider.sendRawBundle(signedBundle, blockNumber + 1);
	let i
	for (i = 0; i < bundleReceipt.bundleTransactions.length; i++) {
		Logging.info(`${telegramId}: Flashbot Submitted ${bundleReceipt.bundleTransactions[i].hash}`);
	}

	await bundleReceipt.wait();
	const receipts = await bundleReceipt.receipts();

	for (i = 0; i < receipts.length; i++) {
		if (receipts[i] == null) {
			Logging.error(`${telegramId}: Flashbot not approved ${bundleReceipt.bundleTransactions[i].hash}`);
			continue
		}
		Logging.info(`${telegramId}: Flashbot success ${receipts[i].transactionHash}`);
	}

	if (receipts === undefined || receipts.length === 0 || receipts[0] === null) {
		throw new Error(BRIBING_FAILED)
	}

	return receipts[0]
}

export const flashBotSend = async (telegramId: string, chain: string, signedTx: string, ex?: any) => {
	return await flashBotSendMultiple(telegramId, chain, [signedTx], ex)
}

export const flashBotPrivateTxn = async (telegramId: string, chain: string, signedTx: string, ex?: any) => {
	const provider = new ethers.providers.JsonRpcProvider(chainConfig[chain].rpcUrls[0]);
	const flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner, FLASHBOTS_ENDPOINT);

	const blockNumber = await provider.getBlockNumber();

	const txContext = await flashbotsProvider.sendPrivateTransaction({ signedTransaction: signedTx }, { maxBlockNumber: blockNumber + 5 })
	await txContext.wait()

	const receipts = await txContext.receipts();

	let i
	for (i = 0; i < receipts.length; i++) {
		if (receipts[i] == null) {
			Logging.error(`${telegramId}: Flashbot not approved ${txContext.transaction.hash}`);
			continue
		}
		Logging.info(`${telegramId}: Flashbot success ${receipts[i].transactionHash}`);
	}

	if (receipts === undefined || receipts.length === 0 || receipts[0] === null) {
		throw new Error(INVALID_OPERATION)
	}

	return receipts[0]
}

// ex: https://etherscan.io/tx/0x5e9cf131ab203e5c8c7997ca4caf452c896a7128590cd4e18a1efed44302476a
