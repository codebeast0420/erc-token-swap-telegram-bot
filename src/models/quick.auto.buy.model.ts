import { Schema, model } from 'mongoose';

const quickAutoBuySchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        chain: { type: String },
        enabled: { type: Boolean },
        amount: { type: String },
        multi: { type: Boolean },
        smartSlippage: { type: Boolean },
        slippage: { type: Number },
        gasPrice: { type: Number }
    },
    { timestamps: true }
);

export const QuickAutoBuyModel = model('QuickAutoBuy', quickAutoBuySchema);
