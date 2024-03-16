import { Schema, model } from 'mongoose';
import { IAppUser } from './app.user.model';
import { ITransactionHistory } from './transaction.history.model';
import { IToken } from './token.info.model';

export interface ISnipePagination {
    metaData?: ISnipePaginationMetaData[];
    data?: ISnipe[];
}

export interface ISnipePaginationMetaData {
    totalAddresses?: number;
    pageNumber?: number;
    totalPages?: number;
    count?: number;
}

export interface IMethodIdPagination {
    metaData?: IMethodIdPaginationMetaData;
    data?: IMethod[];
}

export interface IMethodIdPaginationMetaData {
    totalMethods?: number;
    pageNumber?: number;
    totalPages?: number;
    count?: number;
}

export interface ISnipe {
    _id: string;
    user: IAppUser,
    token: IToken,
    state: string,
    transaction: ITransactionHistory,
    multi: boolean,
    gasDeltaPrice: number,
    bribeAmount: string,
    method: string,
    methodID: string,
    nativeCurrencyAmount: string,
    tokenAmount: string,
    backupTx: boolean,
    autoMaxTx: boolean,
    slippage: number,
    wethLP: string,
    maxGas: number,
    blockDelay: number,
    maxBuyTax: string,
    maxSellTax: string,
}

export interface IMethod {
    name: string,
    method: string
}

const snipeTokenSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        token: { type: Schema.Types.ObjectId, ref: 'TokenInfo' },
        state: { type: String },
        transaction: { type: Schema.Types.ObjectId, ref: 'TransactionHistory' },
        multi: { type: Boolean },
        gasDeltaPrice: { type: Number },
        bribeAmount: { type: String },
        method: { type: String },
        methodID: { type: String },
        nativeCurrencyAmount: { type: String },
        tokenAmount: { type: String },
        backupTx: { type: Boolean },
        autoMaxTx: { type: Boolean },
        slippage: { type: Number },
        wethLP: { type: String },
        maxGas: { type: Number },
        // method id "liquidity", "method-id"
        blockDelay: { type: Number },
        // method id "auto"
        maxBuyTax: { type: String },
        maxSellTax: { type: String },
    },
    { timestamps: true }
);

export const SnipeTokenModel = model('SnipeToken', snipeTokenSchema);
