import Logging from "../../utils/logging";
import { chainConfig } from "../chain.config";

const Web3 = require('web3');

export const sendProtectedTxn = async (telegramId: string, chain: string, signedTx: string, ex?: any) => {
	const web3 = new Web3(chainConfig[chain].antimevRPC)
	Logging.info(`Transaction by MEV protected RPC ${chainConfig[chain].antimevRPC}`)
	return await web3.eth.sendSignedTransaction(signedTx)
}

// ex: https://etherscan.io/tx/0x5e9cf131ab203e5c8c7997ca4caf452c896a7128590cd4e18a1efed44302476a
