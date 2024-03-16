import { Schema, model } from 'mongoose';

export interface ILpLockers {
    _id?: string;
    chain?: string;
    name?: string;
    topic?: string;
    address?: string;
}

const premiumSchema = new Schema<ILpLockers>(
    {
        chain: { type: String, required: true },
        name: { type: String, required: true },
        topic: { type: String, required: true },
        address: { type: String, required: true }
    },
    { timestamps: true }
);

export const LpLockerModel = model<ILpLockers>('LpLockers', premiumSchema);
