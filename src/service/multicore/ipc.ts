import { chainConfig } from "../../web3/chain.config"
import fs from 'fs'

export const MAX_ICORE_COUNT = 64

export function getCoreIPCPath(chain: string, serveId: number) {
    return `/tmp/${chain}-${serveId}.sock`
}

export function resetIPC() {
    const allChains = Object.keys(chainConfig)

    allChains.forEach(ch => {
        for (let serveId = 0; serveId < MAX_ICORE_COUNT; serveId++) {
            const socketPath = getCoreIPCPath(ch, serveId)

            if (fs.existsSync(socketPath)) {
                fs.unlinkSync(socketPath)
            }
        }
    })
}

