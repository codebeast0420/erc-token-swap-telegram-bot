/*
 * each chain has multiple cores to synchronize and invoke some actions
 * sync: fetch all of block headers, receipts, pending transactions
 * tx: analyze and pending transactions
 * analyze:
 */
export const core_info = {
    ethereum: {
        sync: 7,
        tx: 8,
        snipe: 9,
        copytrade: 10,
        receipt: [11, 12, 13, 14, 15],
    },
    bsc: {
        sync: 16,
        tx: 17,
        snipe: 18,
        copytrade: 19,
        receipt: [20, 21, 22, 23, 24, 25],
    },
    arbitrum: {
        sync: 26,
        tx: 27,
        snipe: 28,
        copytrade: 29,
        receipt: [30, 31],
    },
}

export function getAllCores(chain: string) {
    return [core_info[chain].sync, core_info[chain].tx, core_info[chain].snipe, core_info[chain].copytrade, ...core_info[chain].receipt]
}