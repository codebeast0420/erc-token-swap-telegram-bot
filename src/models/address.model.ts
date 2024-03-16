import { Schema, model } from 'mongoose';
import { IWallet } from './wallet.model';

export interface IAddressPagination {
    metaData?: IAddressPaginationMetaData[];
    data?: IAddress[];
}

export interface IAddressPaginationMetaData {
    totalAddresses?: number;
    pageNumber?: number;
    totalPages?: number;
    count?: number;
}

export interface IAddress {
    [x: string]: any;
    _id: string;
    walletPk: IWallet;
    address: string;
    privateKey: string;
    shortPrivateKey: string;
    shortMnemonic: string;
    mnemonic: string;
    connected: boolean;
    selected: boolean;
    name?: string;
    additional: boolean;
    balance?: any;
}

const addressSchema = new Schema<IAddress>(
    {
        walletPk: { type: Schema.Types.ObjectId, ref: 'Wallet' },
        address: { type: String, required: true },
        privateKey: { type: String, required: true },
        shortPrivateKey: { type: String, required: true },
        mnemonic: { type: String, required: false },
        shortMnemonic: { type: String, required: false },
        connected: { type: Boolean, required: true },
        selected: { type: Boolean, required: true, default: false },
        name: { type: String },
        additional: { type: Boolean, default: false }
    },
    { timestamps: true }
);

export const AddressModel = model<IAddress>('Address', addressSchema);
