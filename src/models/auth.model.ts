import { Schema, model } from 'mongoose';
import { IAppUser } from './app.user.model';
import { ISession } from './session.model';

export interface IAuth {
    _id?: string;
    owner?: IAppUser;
    createdDate?: Date;
    verificationCode?: number;
    signInKey?: string;
    authCode?: number;
    verified?: boolean;
    sessions?: ISession[]
}

const authSchema = new Schema<IAuth>(
    {
        owner: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        createdDate: { type: Date },
        verificationCode: { type: Number },
        signInKey: { type: String },
        authCode: { type: Number },
        verified: { type: Boolean, default: false },
        sessions: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Session'
            }
        ]
    },
    { timestamps: true }
);


export const AuthModel = model<IAuth>('Auth', authSchema);



