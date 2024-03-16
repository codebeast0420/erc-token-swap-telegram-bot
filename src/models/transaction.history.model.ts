import { Schema, model } from 'mongoose';
import { IAppUser } from './app.user.model';

export interface ITransactionHistory {
    user: IAppUser;
    chain: string;
    from: String;
    explorer: string;
    blockHash: string;
    blockNumber: number;
    contractAddress: string;
    effectiveGasPrice: string;
    gasUsed: number;
    to: string;
    transactionHash: string;
    transactionIndex: number;
    raw: string;
}

const transactionHistorySchema = new Schema<ITransactionHistory>(
    {
        user: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        chain: { type: String, default: '' },
        from: {type: String, required: true},
        explorer: { type: String },
        blockHash: { type: String },
        blockNumber: { type: Number },
        contractAddress: { type: String },
        effectiveGasPrice: { type: String },
        gasUsed: { type: Number },
        to: { type: String },
        transactionHash: { type: String },
        transactionIndex: { type: Number },
        raw: { type: String }
    },
    { timestamps: true }
);

export const TransactionHistoryModel = model<ITransactionHistory>('TransactionHistory', transactionHistorySchema);
