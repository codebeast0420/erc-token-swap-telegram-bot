import { encodeFunctionCall, encodeParameters } from "../abi/encode";
import { AddressZero, fastQuery, getBN } from "../web3.operation";
import AntiMEV from '../abi/AntiMEVSwap.json'
import { chainConfig } from "../chain.config";

const Web3 = require('web3')

const assembleBuyTokenData = (web3: any, router: string, amount: string, swapCall: any) => {
	return [
		encodeParameters(web3, ["address", "bytes", "uint256", 'bytes[]'],
			[
				router, swapCall.data, amount,
				(swapCall.updateParams || []).map((u: any) => encodeParameters(web3, ['uint32', 'uint32', 'address', 'bytes'], [u.startIdx, u.endIdx, u.ca, u.data]))
			]
		)
	]
}

const assembleSellTokenData = (web3: any, antiMEVABI: any[], router: string, token: string, amount: string, swapCall: any) => {
	const approveCall = encodeFunctionCall(web3, antiMEVABI, 'approveMax', [token, router])
	const approveCall1 = encodeFunctionCall(web3, antiMEVABI, 'approveFinite', [token, router, "0"])
	const approveCall2 = encodeFunctionCall(web3, antiMEVABI, 'approveFinite', [token, router, amount])
	const depositCall = encodeFunctionCall(web3, antiMEVABI, 'depositToken', [token, amount])

	return [
		// encodeParameters(web3, ["address", "bytes", "uint256", 'bytes[]'], [AddressZero, approveCall, 0, []]),
		encodeParameters(web3, ["address", "bytes", "uint256", 'bytes[]'], [AddressZero, approveCall1, 0, []]),
		encodeParameters(web3, ["address", "bytes", "uint256", 'bytes[]'], [AddressZero, approveCall2, 0, []]),
		encodeParameters(web3, ["address", "bytes", "uint256", 'bytes[]'], [AddressZero, depositCall, 0, []]),
		encodeParameters(web3, ["address", "bytes", "uint256", 'bytes[]'],
			[
				router, swapCall.data, 0,
				(swapCall.updateParams || []).map((u: any) => encodeParameters(web3, ['uint32', 'uint32', 'address', 'bytes'], [u.startIdx, u.endIdx, u.ca, u.data]))
			]),
	]
}

const randomBytes = (count: number) => {
	const result = Array(count);

	const BN = getBN();
	let initSum = BN(0);

	for (let i = 0; i < count; ++i) {
		result[i] = Math.floor(256 * Math.random());
		initSum = initSum.plus(BN(result[i]).times(BN(2).pow(i * 8)));
	}
	return initSum.toString(16);
};

export const antiMEVSwapCallbackParams = (router: string, token: string, amount: string, swapCall: any, type: string, fee: string, bribeFee?: string, bribe?: string) => {
	const BN = getBN();
	const web3 = new Web3('http://localhost')

	const b1 =
		type === "buy"
			? assembleBuyTokenData(web3, router, amount, swapCall)
			: type === "sell"
				? assembleSellTokenData(web3, AntiMEV.abi, router, token, amount, swapCall)
				: [];

	const tb = encodeParameters(web3, ['uint256', 'bytes[]'], [bribe || '0', b1]).slice(2);

	// const mask = randomBytes(32);
	const mask = generateFakeAmount()

	let bAgain = "";
	for (let i = 0; i < tb.length; i++) {
		const idx = i % mask.length;
		const a = parseInt(tb.slice(i, i + 1), 16);
		const b = parseInt(mask.slice(idx, idx + 1), 16);
		const c = a ^ b;
		const d = c.toString(16);

		bAgain += d;
	}

	const passData = encodeParameters(web3, ["bytes32", "bytes"], ["0x" + mask, "0x" + bAgain])

	const ethAmount =
		"0x" +
		BN(type === "buy" ? amount : "0")
			.plus(BN(fee)).plus(BN(bribeFee || '0')).plus(BN(bribe || '0')).integerValue()
			.toString(16);

	return {
		to: chainConfig['ethereum'].antimevSwapper,
		data: passData,
		value: ethAmount
	}
}

let fakeSeq = 0
export const generateFakeAmount = (seedText: string = '') => {
	fakeSeq++
	const web3 = new Web3('http://localhost')
	let ret = web3.utils.soliditySha3(seedText + fakeSeq.toString())
	if (ret.slice(0, 2) === '0x') ret = ret.slice(2)
	return ret.slice(0, 64).padStart(64, '0')
}

export const generateSwapCall = (swapData: string, updateList: any[]) => {
	return {
		data: swapData,
		updateParams: updateList.map((u: any) => {
			const startIdx = (swapData.toLowerCase().indexOf(u.fakeAmount.toLowerCase()) - 2) / 2 // bar leading "0x", and 2 characters express one byte
			const endIdx = startIdx + (u.fakeAmount.length / 2)

			return {
				startIdx,
				endIdx,
				ca: u.ca,
				data: u.data
			}
		})
	}
}