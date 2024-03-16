import { Router, Request, Response } from 'express';
import { sendProtectedTxn } from '../web3/protect/mev';

const router = Router();

router.post('/', async (request: Request, response: Response) => {
	const query = request.body;

	let res

	try {
		res = await sendProtectedTxn('', query.chain, query.rawTransaction)
	} catch (err) {
		res = err.message
	}

	response.send(res);
});

module.exports = router;
