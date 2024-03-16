import { Schema, model } from 'mongoose';

const settingsSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        chain: { type: Schema.Types.ObjectId, ref: 'Chain' },
        multiWallet: { type: Boolean },
        antiMEV: { type: Boolean },
        antiRug: { type: Boolean },
        smartSlippage: { type: Boolean },
        maxGasPrice: { type: Number },
        slippage: { type: Number },
        maxGasLimit: { type: Number },
        gasPreset: { type: String }, // slow = net gas price, average (default) = net gas price * 1.1, fast = net gas price * 1.2, max speed = net gas price * 1.4

        buyDupeBuy: { type: Boolean },
        buyAutoBuy: { type: Boolean },
        buyMaxMC: { type: String },
        buyMinLiquidity: { type: String },
        buyMaxLiquidity: { type: String },
        buyMinMCLiq: { type: String },
        buyMaxBuyTax: { type: String },
        buyMaxSellTax: { type: String },
        buyGasPrice: { type: String },

        sellConfirmTradeSell: { type: Boolean },
        sellAutoSell: { type: Boolean },
        sellTrailingSell: { type: Boolean },
        sellHighPrice: { type: String },
        sellLowPrice: { type: String },
        sellHighAmount: { type: String },
        sellLowAmount: { type: String },
        sellGasPrice: { type: String },

        approveAuto: { type: Boolean },
        approveGasPrice: { type: String }
    },
    { timestamps: true }
);

export const SettingsModel = model('Settings', settingsSchema);
