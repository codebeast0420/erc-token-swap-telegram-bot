import { Schema, model } from 'mongoose';

const userStatSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        chain: { type: String },
        txCount: { type: Number },
        txMaxGas: { type: Number },
        txMinGas: { type: Number },
        txAvgGas: { type: Number },
        txGas: { type: Number },
        txMaxFee: { type: String },
        txMinFee: { type: String },
        txAvgFee: { type: String },
        txFee: { type: String },
        txPaid: { type: String },
        sellVolume: { type: String },
        buyVolume: { type: String },
    },
    { timestamps: true }
);

export const UserStatModel = model('UserStat', userStatSchema);
