import { Schema, model } from 'mongoose';

const chainSchema = new Schema(
    {
        name: { type: String, required: true },
        chainId: { type: Number, required: true },
        currency: { type: String, required: true },
        decimals: { type: Number, required: true },
        rpcUrls: [{ type: String }],
        wsUrls: [{ type: String }],
        blockExplorer: { type: String },
        blockExplorerApiKey: { type: String },
        blockExplorerApiEndpoint: { type: String },
        router: { type: String },
        factory: { type: String },
        tokens: [{ type: String }],
        symbols: [{ type: String }],
        priceFeeds: [{ type: String }],
        gasPrice: { type: String },
        prices: [{ type: String }],
        lpLocksAddresses: [{ type: String }],
        feeDistributor: { type: String },
        blockScanned: { type: Number },
        blockScanCount: { type: Number },
        blockScanDuration: { type: Number },
        pendingTxnCount: { type: Number },
        pendingTxnDuration: { type: Number }
    },
    { timestamps: true }
);

export const ChainModel = model('Chain', chainSchema);
