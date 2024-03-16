export async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export const NOT_ENOUGH_BALANCE = '❌ Not enough balance'
export const FLASHBOT_SIMULATION_ERROR = '❌ Flashbot Simulation Error'
export const NOT_STARTED = 'Not started'
export const NOT_CONFIGURED_CHAIN = 'Not configured chain'
export const NOT_CONNECTED_CHAIN = 'Not connected chain'
export const NOT_CONNECTED_WALLET = 'Not connected wallet'
export const TOO_MUCH_REQUESTED = '❌ Too much requested'
export const MAX_WALLET_REACHED_NON_PREMIUM = 'You can only create 9 wallets on free plan'
export const NOT_APPROVED = 'Not approved'
export const MAX_TX_NOT_FOUND = "Can't find max tx volume"
export const APE_MAX_NOT_FOUND = "Can't find ape max volume"
export const INSUFFICIENT_ETH = '❌ Insufficient balance'
export const NO_BRIBING = '❌ No bribing'
export const NOT_ALLOWED_ANTIMEV = '❌ Anti-MEV is not allowed'
export const ROUTER_NOT_FOUND = '❌ Appropriate router not found'
export const TOKEN_NOT_FOUND = '❌ Token not found'
export const LP_NOT_FOUND = '❌ Liquidity not found'
export const ALREADY_EXIST = '⚠️ Already exists'
export const GASPRICE_OVERLOADED = '⚠️ Overloaded gas price'
export const GAS_EXCEEDED = '⚠️ Exceeded gas'
export const TX_ERROR = '❌ Transaction error'
export const ESTIMATE_GAS_ERROR = '❌ Estimate gas error'
export const INVALID_VALUE_SET = '❌ Invalid value set'
export const INVALID_WALLET_ADDRESS = '❌ Invalid wallet address'
export const BRIBING_FAILED = "❌ Bribing failed"
export const INSUFFICIENT_ETH_BRIBE = "❌ Insufficient to bribe"
export const INVALID_OPERATION = '❌ Invalid operation'
export const ADDITIONAL_WALLET_EXISTS = (data: string) => `⚠️ ${data}`

export const MNEMONIC_PLACEHOLDER = 'f867a73290628...'
export const ADDRESS_PLACEHOLDER = '0xd47F916aaA28007f3029b3214F5d0307D77d2AB1'
export const SEND_AMOUNT_PLACEHOLDER = '1000, 10k, 1e+3 or .3%'

export const PINKSALE_LOCK_TITLE = ' Pinksale: PinkLock V2'
export const PINKSALE_CA = '0x407993575c91ce7643a4d4ccacc9a98c36ee1bbe'

export const UNCX_NETWORK_SECURITY = ' UNCX Network Security : LP Lockers'
export const UNCX_CA = '0xc765bddb93b0d1c1a88282ba0fa6b2d00e3e0c83'

export const WALLET_KEY_LISTENER = 'pvkey-mnemonic-listener'
export const TRANSFER_NATIVE_CURRENCY_LISTENER = 'transfer-nativecurrency-to-listener'
export const TRANSFER_TOKEN_TOKEN_LISTENER = 'transfer-token-token-listener'
export const TOKEN_BUY_X_AMOUNT_LISTENER = 'token-buy-x-eth-amount-listener'
export const TOKEN_BUY_X_TOKEN_AMOUNT_LISTENER = 'token-buy-x-token-amount-listener'
export const TOKEN_SELL_X_TOKEN_AMOUNT_LISTENER = 'token-sell-x-token-amount-listener'
export const TOKEN_SELL_X_ETH_AMOUNT_LISTENER = 'token-sell-x-eth-amount-listener'
export const PV_KEY_MNEMONIC_MULTI_WALLET_CONNECT_LISTENER = 'pvkey-mnemonic-multi-wallet-connect-listener'
export const PV_KEY_MNEMONIC_MULTI_WALLET_GENERATE_LISTENER = 'pvkey-mnemonic-multi-wallet-generate-listener'
export const RENAME_MULTI_WALLET_LISTENER = 'rename-multi-wallet-listener'
export const MULTI_WALLET_TRANSFER_NATIVE_CURRENCY_LISTENER = 'multi-wallet-transfer-native-currency-listener'
export const MULTI_WALLET_TRANSFER_TOKEN_LISTENER = 'multi-wallet-transfer-token-listener'
export const AFFILIATE_SETUP_LISTENER = 'affiliate-setup-listener'
export const AFFILIATE_RENAME_LISTENER = 'affiliate-rename-listener'
export const MANUAL_TRADE_LISTENER = 'manual-buy-token-listener'
export const SETTINGS_LISTENER = 'settings-listener'
export const AUTO_BUY_LISTENER = 'auto-buy-listener'
export const AUTO_SELL_LISTENER = 'auto-sell-listener'
export const SNIPE_INPUT_LISTENER = 'snipe-input-listener'
export const COPY_TRADE_LISTENER = 'copytrade-listener'

export const PERCENTAGE_REGEX = /^(\d{1,2}(\.\d{1,2})?|100(\.0{1,2})?)%$/;
export const NUMBER_REGEX = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;

export const DEFAULT_SCENE_TIMEOUT = 60

export const cautionEmoji = "⚠️";
export const crossEmoji = "❌";

export const DEFAULT_API_SESSION_TIMEOUT = 300;

function getTimeGap(date1: Date, date2: Date) {
    const secs = Math.floor(((new Date(date2)).getTime() - (new Date(date1)).getTime()) / 1000)
    const days = Math.floor(secs / 86400)
    const hours = Math.floor((secs - days * 86400) / 3600)
    const mins = Math.floor((secs - days * 86400 - hours * 3600) / 60)
    const s = (secs - days * 86400 - hours * 3600 - mins * 60)

    return {
        days: days,
        hours: hours,
        mins: mins,
        secs: s
    }
}

export function timeGapString(date1: Date, date2: Date) {
    const info = getTimeGap(date1, date2)

    let ret = ''
    if (info.days > 0) ret += `${info.days} day${info.days > 1 ? 's' : ''} `
    if (info.days > 0 || info.hours > 0) ret += `${info.hours.toString().padStart(2, '0')}:`
    if (info.days > 0 || info.hours > 0 || info.mins > 0) ret += `${info.mins.toString().padStart(2, '0')}:`
    if (info.days > 0 || info.hours > 0 || info.mins > 0 || info.secs > 0) ret += `${info.secs.toString().padStart(2, '0')}`

    if (info.days === 0 && info.hours === 0 && info.mins === 0 && info.secs === 0) ret += '00:00'

    return ret
}

export function timeGapStringDetails(date1: Date, date2: Date) {
    const info = getTimeGap(date1, date2)

    let ret = ''
    if (info.days > 0) ret += `${info.days} day${info.days > 1 ? 's' : ''} `
    if (info.days > 0 || info.hours > 0) ret += `${info.hours.toString()}h `
    if (info.days > 0 || info.hours > 0 || info.mins > 0) ret += `${info.mins.toString()}m `
    if (info.days > 0 || info.hours > 0 || info.mins > 0 || info.secs > 0) ret += `${info.secs.toString()}s`

    if (info.days === 0 && info.hours === 0 && info.mins === 0 && info.secs === 0) ret += '0m 0s'
    return ret
}

export function convertValue(total: string, part: string, BN: any) {
    let text = part
    if (text.indexOf(".") === 0) text = '0' + text
    let val = BN(text)
    let multiplier = BN(1)
    let percentage = false
    if (val.isNaN()) {
        const percentIndex = text.indexOf('%')
        if (percentIndex >= 0) percentage = true

        if (percentage === true) text = text.slice(0, percentIndex)
        const k1 = text.indexOf('k')
        const k2 = text.indexOf('K')
        const m1 = text.indexOf('m')
        const m2 = text.indexOf('M')
        const b1 = text.indexOf('b')
        const b2 = text.indexOf('B')
        const t1 = text.indexOf('t')
        const t2 = text.indexOf('T')
        if (k1 >= 0) {
            text = text.slice(0, k1)
            multiplier = BN("1000")
        } else if (k2 >= 0) {
            text = text.slice(0, k2)
            multiplier = BN("1000")
        } else if (m1 >= 0) {
            text = text.slice(0, m1)
            multiplier = BN("1000000")
        } else if (m2 >= 0) {
            text = text.slice(0, m2)
            multiplier = BN("1000000")
        } else if (b1 >= 0) {
            text = text.slice(0, b1)
            multiplier = BN("1000000000")
        } else if (b2 >= 0) {
            text = text.slice(0, b2)
            multiplier = BN("1000000000")
        } else if (t1 >= 0) {
            text = text.slice(0, t1)
            multiplier = BN("1000000000000")
        } else if (t2 >= 0) {
            text = text.slice(0, t2)
            multiplier = BN("1000000000000")
        }
        val = BN(text).times(multiplier)
    }

    const ret = percentage === true ? BN(total).times(val).div(100).toString() : val.toString()
    if (ret === 'NaN') {
        throw new Error(INVALID_VALUE_SET)
    }

    return ret
}
