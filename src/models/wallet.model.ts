import { Schema, model } from 'mongoose';
import { IAddress } from './address.model';
import { IAppUser } from './app.user.model';

export interface IWallet {
    owner: IAppUser;
    generator: string;
    addresses: IAddress[];
}

const walletSchema = new Schema<IWallet>(
    {
        owner: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        generator: { type: String, required: true },
        addresses: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Address'
            }
        ]
    },
    { timestamps: true }
);

export const WalletModel = model<IWallet>('Wallet', walletSchema);
