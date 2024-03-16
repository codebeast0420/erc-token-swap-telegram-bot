import { Router, Request, Response } from 'express';
import { ChainModel } from '../models/chain.model';

const router = Router();

router.get('/chains', async (request: Request, response: Response) => {
    if (request.query.privilege === 'cryptoguy1119') {
        const chains = await ChainModel.find()
        response.send(chains);
    } else {
        response.send('unknown action');
    }
});

module.exports = router;
