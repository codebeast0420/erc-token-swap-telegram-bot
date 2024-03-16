import { Schema, model } from 'mongoose';

const broadcastSchema = new Schema(
    {
        content: { type: String }
    },
    { timestamps: true }
);

export const BroadcastModel = model('Broadcast', broadcastSchema);
