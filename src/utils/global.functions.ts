import Logging from './logging';

export interface IPageAndLimit {
    chain?: string;
    page?: number;
    limit?: number;
    addressId?: string;
}

export function getMultiWalletPaginationDetails(match: string) {
    Logging.info(match);
    const array = match.split('_');
    let page = 1;
    let limit = 4;
    let addressId = '';
    let chain
    if (array != null && array.length > 0) {
        for (let string of array) {
            if (string.includes('page?')) {
                page = parseInt(string.split('?').slice(-1)[0]);
            } else if (string.includes('chain?')) {
                chain = string.split('?').slice(-1)[0]
            } else if (string.includes('limit?')) {
                limit = parseInt(string.split('?').slice(-1)[0]);
            } else if (string.includes('Id?')) {
                addressId = string.split('?').slice(-1)[0];
            }
        }
    }

    let response: IPageAndLimit = {
        page: page,
        limit: limit,
        addressId: addressId,
        chain: chain
    };

    return response;
}

export function currencyFormat() {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 20
    });
}

export function numberFormat() {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 20
    });
}
