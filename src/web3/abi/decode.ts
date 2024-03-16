import ERC20 from './ERC20.json'
import Router from './IPancakeRouter02.json'
import Pair from './IPancakePair.json'
import PairV3 from './IPancakePairV3.json'
import SmartRouter from './SmartRouter.json'
import { selectorsFromBytecode } from '@shazow/whatsabi';



const Web3 = require('web3')

let routerContractInst
let smartRouterContractInst
let erc20Contract
let dexPairContract
let dexPairV3Contract

export function getERC20Events(web3: any) {
    if (erc20Contract === undefined) {
        erc20Contract = new web3.eth.Contract(ERC20.abi, '0x0000000000000000000000000000000000000000');
    }

    return erc20Contract._jsonInterface.filter((o: any) => o.type === 'event');
}

export function getDexPairEvents(web3: any) {
    if (dexPairContract === undefined) {
        dexPairContract = new web3.eth.Contract(Pair.abi, '0x0000000000000000000000000000000000000000');
    }

    return dexPairContract._jsonInterface.filter((o: any) => o.type === 'event');
}

export function getDexPairV3Events(web3: any) {
    if (dexPairV3Contract === undefined) {
        dexPairV3Contract = new web3.eth.Contract(PairV3.abi, '0x0000000000000000000000000000000000000000');
    }

    return dexPairV3Contract._jsonInterface.filter((o: any) => o.type === 'event');
}

export function getRouterContract() {
    if (routerContractInst === undefined) {
        const web3 = new Web3('http://localhost');
        routerContractInst = new web3.eth.Contract(Router.abi, '0x0000000000000000000000000000000000000000');
    }
    return routerContractInst;
}

export function getSmartRouterContract() {
    if (smartRouterContractInst === undefined) {
        const web3 = new Web3('http://localhost');
        smartRouterContractInst = new web3.eth.Contract(SmartRouter.abi, '0x0000000000000000000000000000000000000000');
    }
    return smartRouterContractInst;
}

export function analyzeLog(web3: any, events: any[], log: any) {
    for (const ev of events) {
        if (log.topics[0] === ev.signature) {
            try {
                const r = web3.eth.abi.decodeLog(ev.inputs, log.data, log.topics.slice(1));
                return { ...r, name: ev.name };
            } catch (err) {
                return { name: ev.name };
            }
        }
    }
}

export function decodeTxLogs(web3: any, abi: any[], logs: any[]) {
    const contract = new web3.eth.Contract(abi, '0x0000000000000000000000000000000000000000');

    const events = contract._jsonInterface.filter((o: any) => o.type === 'event');

    let ret = [];
    for (const ev of events) {
        const lg = logs.find((g: any) => g.topics[0] === ev.signature);
        if (lg) {
            const r = web3.eth.abi.decodeLog(ev.inputs, lg.data, lg.topics.slice(1));
            ret = [...ret, { ...r, name: ev.name }];
        }
    }

    return ret;
}

export function decodeTxInput(web3: any, abi: any[], input: string) {
    const contract = new web3.eth.Contract(abi, '0x0000000000000000000000000000000000000000');
    const fns = contract._jsonInterface.filter((o: any) => o.type === 'function');
    if (input.slice(0, 2) === '0x') input = input.slice(2)

    let decoded
    let fnTx
    for (const fn of fns) {
        if (fn.signature.toLowerCase() === '0x' + input.slice(0, 8).toLowerCase()) {
            try {
                decoded = web3.eth.abi.decodeParameters(fn.inputs, '0x' + input.slice(8));
                fnTx = fn;
                break
            } catch (err) {
            }
        }
    }

    if (decoded) {
        return {
            decoded,
            abi: fnTx
        }
    }
}


export async function decodeNotVerifiedAbi(web3: any, address: string) {

    const code = await new web3.eth.getCode(address)
    const selectors = selectorsFromBytecode(code);
    const signatures = await fetchSignaturesSamczsun(selectors);

    return signatures;
}

async function fetchSignaturesSamczsun(hexes: string[]) {
    const params = new URLSearchParams();
    for (let hex of hexes) {
        params.append("function", hex);
    }

    try {
        const response = await fetch(`https://sig.eth.samczsun.com/api/v1/signatures?${params}`);
        const data = await response.json();
        if (!data.ok) {
            console.log(` ${(new Date()).toLocaleString()} processError-2`)
            console.error(`Failed to fetch signatures: ${JSON.stringify(data)}`);
            return []
        }

        return hexes.map((hex, id) =>
            (data.result.function[hex] || []).map((record: any) => ({
                id,
                name: record.name,
                signature: hex,
            }))
        );
    } catch (error) {
        console.log(` ${(new Date()).toLocaleString()} processError-2`)
        console.error(`Failed to fetch signatures`);
    }
}

