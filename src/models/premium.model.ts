import { Schema, model } from 'mongoose';
import { IAppUser } from './app.user.model';

export interface IPremium {
    _id?: string;
    owner?: IAppUser;
    startDate?: Date;
    endDate?: Date;
}

const premiumSchema = new Schema<IPremium>(
    {
        owner: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        startDate: { type: Date, required: true },
        endDate: { type: Date }
    },
    { timestamps: true }
);

export const PremiumModel = model<IPremium>('Premium', premiumSchema);
