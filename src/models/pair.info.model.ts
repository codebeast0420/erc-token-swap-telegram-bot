import { Schema, model } from 'mongoose';

const pairInfoSchema = new Schema(
    {
        chain: { type: String, index: true },
        address: { type: String, index: true },
        name: { type: String, index: true },
        symbol: { type: String, index: true },
        decimals: { type: Number, index: true },
        token0: { type: String, index: true },
        token1: { type: String, index: true },
        decimal0: { type: Number, index: true },
        decimal1: { type: Number, index: true },
        reserve0: { type: String, index: true },
        reserve1: { type: String, index: true },
        version: { type: Number, index: true },
        totalSupply: { type: String, index: true },
        locked: { type: String, index: true },
        factory: { type: String, index: true },
        fee: { type: Number, index: true },
        sqrtPriceX96: { type: String, index: true },
        liquidity: { type: String, index: true },
    },
    { timestamps: true }
);

export const PairInfoModel = model('PairInfo', pairInfoSchema);
