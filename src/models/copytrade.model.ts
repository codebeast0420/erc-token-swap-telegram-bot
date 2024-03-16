import { Schema, model } from 'mongoose';

const copyTradeSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        chain: { type: String },
        name: { type: String },
        address: { type: String },
        state: { type: String },
        lock: { type: Number },
        transactions: [{ type: Schema.Types.ObjectId, ref: 'TransactionHistory' }],
        isFrontRun: { type: Boolean },
        multi: { type: Boolean },
        isAutoBuy: { type: Boolean },
        autoBuySmartSlippage: { type: String },
        autoBuyAmount: { type: String },
        autoBuySlippage: { type: Number },
        autoBuyGasPrice: { type: Number },
        isCopySell: { type: Boolean },
        isAutoSell: { type: Boolean },
        isTrailingSell: { type: Boolean },
        sellHiThreshold: { type: String },
        sellLoThreshold: { type: String },
        sellHiAmount: { type: String },
        sellLoAmount: { type: String },
        sellMaxMarketCap: { type: String },
        sellMinLiquidity: { type: String },
        sellMaxLiquidity: { type: String },
        sellMinMarketCapToLiquidity: { type: String },
        sellMaxMarketCapToLiquidity: { type: String },
        maxBuyTax: { type: String },
        maxSellTax: { type: String }
    },
    { timestamps: true }
);

export const CopyTradeModel = model('CopyTrade', copyTradeSchema);
