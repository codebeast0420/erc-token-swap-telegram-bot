import * as dotenv from 'dotenv';
dotenv.config();
import { AES, enc } from 'crypto-js';

import { AddressModel } from "../../src/models/address.model"
import { connect } from '../../src/utils/connect';
import Logging from '../../src/utils/logging';
import chalk from 'chalk';


async function encryptPrivateKeysAndMnemonic() {
    const success = (args: any) => console.log(chalk.green(`[${new Date().toLocaleString()}] [ERROR]`), typeof args === 'string' ? chalk.green(args) : args);
    await connect()

    let addresses = await AddressModel.find()

    if (addresses != null && addresses.length > 0) {
        Logging.info(`Addresses Count: ${addresses.length}`)
        let encryptedCount = 0;
        let skippedCount = 0;
        for (let address of addresses) {
            try {
                if (address.privateKey.startsWith('0x') && address.privateKey.length < 128) {
                    Logging.info(`Encrypting ${address.address}`)
                    address.privateKey = encrypt(address.privateKey)
                    address.shortPrivateKey = shortenPrivateKey(address.privateKey)
                    if (address.mnemonic !== null && address.mnemonic.length > 0) {
                        address.mnemonic = encrypt(address.mnemonic)
                        address.shortMnemonic = shortenPrivateKey(encrypt(address.mnemonic))
                    }
                    await address.save()
                    encryptedCount += 1
                } else {
                    Logging.warn(`Address: ${address.address} already encrypted ${address.privateKey} ${address.privateKey.length}`)
                    skippedCount += 1
                }
            } catch (err) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(err)
            }
        }
        Logging.info(`encrypted total: ${encryptedCount}`)
        Logging.warn(`skipped count:${skippedCount}`)
    }


    addresses = await AddressModel.find()

    if (addresses != null && addresses.length > 0) {
        Logging.info(`addresses after encryption`)
        for (let address of addresses) {
            success(`shortPvKey:${address.shortPrivateKey} pvKey:${address.privateKey.slice(0, 20)} short mnemonic:${address.shortMnemonic} mnemonic:${address.mnemonic.slice(0, 20)}`)
        }
    }

    process.exit(1)
}


// Encryption function
function encrypt(text: string): string {
    const key = 'w9}<hkuX7,53BW$&k3g[BKN!~SbyZTw*yR6CQNFQYb2WCy+FcLe]Qx<.zKhB';
    const encrypted = AES.encrypt(text, key).toString();
    return encrypted;
}

// shorten privateKey for DB find
function shortenPrivateKey(pvKey: string): string {
    let response = ''
    if (!pvKey) return ''

    const first4 = pvKey.slice(0, 4);
    const last4 = pvKey.slice(pvKey.length - 4, pvKey.length);
    response = `${first4}....ChartAi....${last4}`

    return response
}

encryptPrivateKeysAndMnemonic()