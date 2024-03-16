import { Schema, model } from 'mongoose';
import { IAppUser } from './app.user.model';

export interface IAffiliateInfluencer {
    _id?: string;
    owner?: IAppUser;
    ref?: string;
    startDate?: Date;
    endDate?: Date;
    payoutAddress?: string;
    twitterLink?: string;
    approved?: boolean;
    approver?: IAppUser;
}

const affiliateInfluencerSchema = new Schema<IAffiliateInfluencer>(
    {
        owner: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        ref: { type: String, required: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date },
        payoutAddress: { type: String, required: true },
        twitterLink: { type: String, required: true },
        approved: { type: Boolean, default: false },
        approver: { type: Schema.Types.ObjectId, ref: 'AppUser' }
    },
    { timestamps: true }
);

export const AffiliateInfluencerModel = model<IAffiliateInfluencer>('AffiliateInfluencer', affiliateInfluencerSchema);
