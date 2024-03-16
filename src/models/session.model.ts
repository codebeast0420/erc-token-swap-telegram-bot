import { Schema, model } from 'mongoose';

export interface ISession {
    _id?: string;
    deviceName?: string;
    deviceId?: string;
    valid?: boolean;
}


const sessionSchema = new Schema<ISession>(
    {
        deviceName: { type: String },
        deviceId: { type: String },
        valid: { type: Boolean },
    },
    { timestamps: true }
);


export const SessionModel = model<ISession>('Session', sessionSchema);
