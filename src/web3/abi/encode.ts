import { AddressZero } from "../web3.operation";

const Web3 = require('web3')

export function encodeFunctionCall(web3: any | undefined, abi: any[], functionName: string, args: any[]) {
    if (web3 === undefined) {
        web3 = new Web3('http://localhost')
    }

    const funcABI = abi.find(a => a.name === functionName && a.inputs.length === args.length)
    return web3.eth.abi.encodeFunctionCall(funcABI, args);
}

export function encodeParameters(web3: any | undefined, types: string[], params: any[]) {
    if (web3 === undefined) {
        web3 = new Web3('http://localhost')
    }

    return web3.eth.abi.encodeParameters(types, params)
}