import { Router, Request, Response, NextFunction } from 'express';
import { resolve } from 'path';
import { AppUserModel } from '../models/app.user.model';
import { TransactionHistoryModel } from '../models/transaction.history.model';
import { getAppUser } from '../service/app.user.service';
import Logging from '../utils/logging';

const router = Router();


router.get('/', async (request: Request, response: Response) => {
    const query = request.query;

    let transactions = [];

    if (query.telegramId) {
        const user = await AppUserModel.findOne({ telegramId: query.telegramId });
        if (user !== null) {
            if (query.chain) {
                transactions = await TransactionHistoryModel.find({ user: user._id, chain: query.chain });
            } else {
                transactions = await TransactionHistoryModel.find({ user: user._id });
            }
        }
    } else if (query.userName) {
        let userName: any = query.userName;
        if (userName.startsWith('@')) {
            userName = userName.slice(1);
        }
        const user = await AppUserModel.findOne({ userName: userName });
        if (user !== null) {
            if (query.chain) {
                transactions = await TransactionHistoryModel.find({ user: user._id, chain: query.chain });
            } else {
                transactions = await TransactionHistoryModel.find({ user: user._id });
            }
        }
    } else if (query.all) {
        transactions = await TransactionHistoryModel.find();
    }

    const res = await Promise.all(
        transactions.map((t) => {
            return new Promise((resolve, reject) => {
                AppUserModel.findById(t.user).then((user) =>
                    resolve({
                        telegramId: user.telegramId,
                        telegramUsername: user.userName,
                        chain: t.chain,
                        explorer: t.explorer + '/tx/' + t.transactionHash,
                        blockHash: t.blockHash,
                        blockNumber: t.blockNumber,
                        gasPrice: t.effectiveGasPrice,
                        gasUsed: t.gasUsed,
                        to: t.to,
                        transactionHash: t.transactionHash
                    })
                );
            });
        })
    );

    response.send(res);
});

module.exports = router;
