import { Schema, model } from 'mongoose';

const monitorInfoSchema = new Schema(
    {
        user: { type: String, index: true },
        chain: { type: String, index: true },
        token: { type: String, index: true },
        pair: { type: String, index: true },
        priceImpactSum: { type: String },
        priceImpactCount: { type: Number },
        priceImpactLast: { type: String },
        expectedSellPayoutSum: { type: String },
        expectedSellTokenSum: { type: String },
        expectedSellPayoutUSDSum: { type: String },
        expectedSellPayoutCount: { type: Number },
        expectedSellPayoutLast: { type: String },
        expectedSellPayoutUSDLast: { type: String },
        expectedBuyTokenSum: { type: String },
        expectedBuyPayoutSum: { type: String },
        expectedBuyPayoutUSDSum: { type: String },
        expectedBuyPayoutCount: { type: Number },
        expectedBuyPayoutLast: { type: String },
        expectedBuyPayoutUSDLast: { type: String },
    },
    { timestamps: true }
);

export const MonitorInfoModel = model('MonitorInfo', monitorInfoSchema);
