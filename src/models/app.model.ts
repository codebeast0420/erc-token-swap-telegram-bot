import { Schema, model } from 'mongoose';

const appSchema = new Schema(
    {
        purgeMessages: { type: Boolean },
        dexSyncLog: { type: Boolean },
        pairSyncLog: { type: Boolean },
        tokenSyncLog: { type: Boolean }
    },
    { timestamps: true }
);

export const AppModel = model('App', appSchema);
