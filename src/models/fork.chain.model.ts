import { Schema, model } from 'mongoose';

export interface IForkChainModel {
    _id: string;
    chain: string;
    localRpc: string;
    serverRpc: string;
    usingLocalRpc: boolean;
    ethContract: string;
    privateKeys: string[];
}


const forkChainSchema = new Schema<IForkChainModel>(
    {
        chain: { type: String, required: true, unique: true },
        localRpc: { type: String, required: true },
        serverRpc: { type: String, required: true },
        usingLocalRpc: { type: Boolean, default: true },
        ethContract: { type: String, required: true },
        privateKeys: [{ type: String }]
    },
    { timestamps: true }
);

export const ForkChainModel = model<IForkChainModel>('ForkChain', forkChainSchema);