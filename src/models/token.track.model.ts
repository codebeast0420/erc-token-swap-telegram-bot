import { Schema, model } from 'mongoose';

const tokenTrackSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        chain: { type: String },
        address: { type: String },
        state: { type: String },
        msgId: { type: Number }
    },
    { timestamps: true }
);

export const TokenTrackModel = model('TokenTrack', tokenTrackSchema);
