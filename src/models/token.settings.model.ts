import { Schema, model } from 'mongoose';

const tokenSettingsSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        token: { type: Schema.Types.ObjectId, ref: 'TokenInfo' }
    },
    { timestamps: true }
);

export const TokenSettingModel = model('TokenSetting', tokenSettingsSchema);
