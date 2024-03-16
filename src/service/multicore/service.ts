const ipc = require('node-ipc').default;
import Logging from "../../utils/logging";
import { createWeb3Service, processAllDataFromChain, processBotWeb3Data, processChainData, scanAndProcessFromChain, scanFromChain, scanPendingTransactions } from "../../web3/event.log";
import { core_info, getAllCores } from "./config";
import { MAX_ICORE_COUNT, getCoreIPCPath } from "./ipc";

export const IPC_MESSAGE_DISC = 'ipc-message-discriminator'
export const SOCKET_DISC = 'core-socket'

function createIPCMessageReceiver(coreId: number, chain: string) {
    const socketPath = getCoreIPCPath(chain, coreId)

    ipc.serve(
        socketPath,
        function () {
            ipc.server.on(
                IPC_MESSAGE_DISC,
                function (data, socket) {
                    const obj = JSON.parse(data)

                    processIPCMessage(coreId, {
                        chain: chain,
                        ...obj
                    })

                    // fs.appendFileSync(`./debug/${chain}-${serveId}.json`, data + ',')

                    // const logMsg = `core-handler: ${chain}-${serveId}-${obj.blocks.length} blocks, ${obj.transactions.length} transactions, ${obj.receipts.length} receipts`
                    // console.log(logMsg)
                    // sendBotMessage('2068377064', logMsg)
                }
            );
        }
    )

    ipc.server.start()
    ipc.server.log = () => { }
    console.log(`pid ${process.pid} listening on ${socketPath}`);
}

export const sendIPCMessage = (coreId: number, chain: string, data: string) => {
    const ipcHandler = ipc.of[SOCKET_DISC + `-${coreId}-${chain}`]
    ipcHandler.emit(IPC_MESSAGE_DISC, data)
}

export const sendSnipeMessage = (chain: string, data: string) => {
    const coreId = core_info[chain].snipe
    sendIPCMessage(coreId, chain, data)
}

export const sendCopytradeMessage = (chain: string, data: string) => {
    const coreId = core_info[chain].copytrade
    sendIPCMessage(coreId, chain, data)
}

async function processIPCMessage(coreId: number, data: any) {
    if (data.discriminator === 'sync-data') {
        await processAllDataFromChain(coreId, data)
    } else if (data.discriminator === 'bot-action-data') {
        await processBotWeb3Data(coreId, data)
    } else {
        console.log('>>> unknown data found', coreId, data)
    }
}

export async function createBackgroundService(coreId: number, chain: string) {
    await createWeb3Service(chain)
    createIPCMessageReceiver(coreId, chain)
    processChainData(coreId, chain)

    const serveIdArray = getAllCores(chain)

    serveIdArray.forEach(id => {
        ipc.connectTo(
            SOCKET_DISC + `-${id}-${chain}`,
            getCoreIPCPath(chain, id),
            connecting
        );
    })

    function connecting(socket) {
        let allConnected = true
        serveIdArray.forEach(id => {
            const client = socket.of[SOCKET_DISC + `-${id}-${chain}`]
            if (client === undefined) {
                allConnected = false
            } else {
                client.log = () => { }
            }
        })

        if (allConnected === true) {
            if (coreId === core_info[chain].sync) {
                scanFromChain(chain)
                scanPendingTransactions(chain)
            }
        }
    }
}
