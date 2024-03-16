import { Schema, model } from 'mongoose';

const transactionBackupSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        chain: { type: String },
        to: { type: String },
        data: { type: String },
        address: { type: String },
        value: { type: String },
        gasPrice: { type: Number },
        msgId: { type: Number },
        label: { type: String },
        transaction: { type: Schema.Types.ObjectId, ref: 'TransactionHistory' },
        error: { type: String },
        exInfo: { type: String }
    },
    { timestamps: true }
);

export const TransactionBackupModel = model('TransactionBackup', transactionBackupSchema);
