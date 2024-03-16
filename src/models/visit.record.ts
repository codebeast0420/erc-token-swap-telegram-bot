import { Schema, model } from 'mongoose';

const visitRecordSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        localTimeStamp: { type: Number, required: true },
    },
    { timestamps: true }
);

export const VisitRecordModel = model('VisitRecord', visitRecordSchema);
