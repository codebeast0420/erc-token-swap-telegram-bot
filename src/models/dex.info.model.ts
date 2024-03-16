import { Schema, model } from 'mongoose';

const dexInfoSchema = new Schema(
    {
        chain: { type: String },
        router: { type: String },
        weth: { type: String },
        factory: { type: String },
        factory2: { type: String },
        version: { type: Number },
        routerABI: { type: String },
        factoryABI: { type: String },
        factory2ABI: { type: String },
        pairABI: { type: String },
        poolABI: { type: String }
    },
    { timestamps: true }
);

export const DexInfoModel = model('DexInfo', dexInfoSchema);
