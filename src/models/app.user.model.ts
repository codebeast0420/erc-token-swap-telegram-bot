import { Schema, model } from 'mongoose';
import { IAffiliateInfluencer } from './affiliate.influencer.model';

export interface IAppUser {
    userId: string;
    telegramId: string;
    firstName: string;
    lastName: string;
    userName: string;
    chatId: number;
    affiliateInfluencerSub: IAffiliateInfluencer;
}

const appUserSchema = new Schema<IAppUser>(
    {
        telegramId: { type: String, unique: true },
        firstName: { type: String },
        lastName: { type: String },
        userName: { type: String },
        chatId: { type: Number },
        affiliateInfluencerSub: {
            type: Schema.Types.ObjectId,
            ref: 'AffiliateInfluencer'
        }
    },
    { timestamps: true }
);


export const AppUserModel = model<IAppUser>('AppUser', appUserSchema);
