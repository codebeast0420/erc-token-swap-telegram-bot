import { PairInfoModel } from '../models/pair.info.model';
import { IMethod, IMethodIdPagination, IMethodIdPaginationMetaData, ISnipePagination, ISnipePaginationMetaData, SnipeTokenModel } from '../models/snipe.godmode.token';
import { TokenInfoModel } from '../models/token.info.model';
import { findBestWETHPair } from '../web3/dex/common/bestpair';
import { getAppUser, userVerboseLog } from './app.user.service';
import { chainGasPrice } from './chain.service';

export async function registerSnipeToken(telegramId: string, chain: string, tokenAddress: string) {
	const token = await TokenInfoModel.findOne({ chain: chain, address: tokenAddress });
	if (token === null) {
		throw new Error(`Token not found\n<b>${chain}</b>: <code>${tokenAddress}</code>`);
	}

	const user = await getAppUser(telegramId);

	let retSnipe = await SnipeTokenModel.findOne({ user: user._id, token: token._id, state: 'pending' });

	if (retSnipe === null) {
		const lpArray = await Promise.all(token.lp.map(p => PairInfoModel.findOne({ chain: chain, address: p })))
		const bestWETHPair = await findBestWETHPair(token.address, lpArray)

		const gasPrice = await chainGasPrice(token.chain)

		retSnipe = new SnipeTokenModel({
			user: user._id,
			token: token._id,
			state: 'pending',
			multi: false,
			blockDelay: 0,
			gasDeltaPrice: token.chain === 'ethereum' ? 5 : parseFloat(gasPrice),
			method: '',
			primary: true,
			slippage: 700,
			backupTx: token.chain === 'ethereum' ? true : false,
			maxGas: token.chain === 'ethereum' ? '600000' : '865000',
			wethLP: bestWETHPair?.address
		});

		await retSnipe.save();
		await userVerboseLog(telegramId, 'added a new snipe token ' + token.address);

		retSnipe = await SnipeTokenModel.findOne({ user: user._id, token: token._id, state: 'pending' });
	}

	return retSnipe
}

export async function getSnipeTokenList(telegramId: string) {
	const user = await getAppUser(telegramId);

	const s: any[] = await SnipeTokenModel.find({ user: user._id, state: 'pending' });

	return s;
}

export async function getSnipeToken(telegramId: string, snipeId: string) {
	let snipes = await getSnipeTokenList(telegramId)

	if (snipes.length === 0) return null
	else if (snipes.length === 1) {
		return snipes[0]
	}

	const snipe = snipes.find((t) => t._id.toString() === snipeId)

	return snipe
}

export async function moveTokenSnipe(telegramId: string, snipeId: string, bPrev: boolean) {
	const user = await getAppUser(telegramId);

	let snipes = await SnipeTokenModel.find({ user: user._id, state: 'pending' });
	if (snipes.length === 0) return null
	else if (snipes.length === 1) {
		return snipes[0]
	}

	const snipe = snipes.find((t) => t._id.toString() === snipeId)
	let index
	if (snipe === undefined) {
		index = 0;
	} else {
		const foundIndex = snipes.indexOf(snipe)

		if (bPrev === true) {
			index = (foundIndex + snipes.length - 1) % snipes.length;
		} else {
			index = (foundIndex + 1) % snipes.length;
		}
	}

	return snipes[index]
}

export async function clearTokenSnipes(telegramId: string) {
	const user = await getAppUser(telegramId)

	await SnipeTokenModel.deleteMany({ user: user._id })
}

export async function getActiveSniperPagination(telegramId: string, page?: number, perPage?: number) {
	const user = await getAppUser(telegramId);
	if (perPage != null && perPage > 4) {
		perPage = 4;
	}

	const options = {
		page: (page || 1) - 1,
		limit: perPage || 4
	};


	let snipers: any
	await SnipeTokenModel.aggregate([
		{
			$match: {
				user: user._id,
				state: 'pending'
			}
		},
		{
			$facet: {
				metaData: [
					{
						$count: 'totalAddresses'
					},
					{
						$addFields: {
							pageNumber: options.page,
							totalPages: { $ceil: { $divide: ['$totalAddresses', options.limit] } }
						}
					}
				],
				data: [
					{
						$skip: options.page * options.limit
					},
					{
						$limit: options.limit
					}
				]
			}
		}
	]).then(res => {
		snipers = res
	});

	await SnipeTokenModel.populate(snipers[0].data, { path: 'token' })

	let response: ISnipePagination = snipers[0];

	const metaData: ISnipePaginationMetaData = {
		...response.metaData[0],
		count: response.data.length
	};

	response.metaData[0] = metaData;

	return response;
}

export function getSnipeMethodIdPagination(data: any, page?: number, perPage?: number) {
	if (perPage != null && perPage > 4) {
		perPage = 6;
	}

	const options = {
		page: (page || 1) - 1,
		limit: perPage || 6
	};


	let startIndex = options.page * options.limit
	let selectedMethods = data.slice(startIndex, (startIndex + options.limit))
	let totalPages = Math.ceil(data.length / options.limit)


	const metaData: IMethodIdPaginationMetaData = {
		totalMethods: data.length,
		pageNumber: options.page,
		count: selectedMethods.length,
		totalPages: totalPages
	};


	let response: IMethodIdPagination = {
		metaData: metaData,
		data: selectedMethods
	}

	return response;
}