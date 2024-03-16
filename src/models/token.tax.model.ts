import { Schema, model } from 'mongoose';

const tokenTaxSchema = new Schema(
    {
        chain: { type: String, index: true },
        address: { type: String, index: true },
        buyTax: { type: String },
        sellTax: { type: String },
        v2: { type: Boolean },
        v3: { type: Boolean }
    },
    { timestamps: true }
);

export const TokenTaxModel = model('TokenTax', tokenTaxSchema);
