import { ChainModel } from '../models/chain.model';
import { ConnectedChainModel } from '../models/connect.chain.model';
import { NOT_CONFIGURED_CHAIN, NOT_CONNECTED_CHAIN } from '../utils/common';
import Logging from '../utils/logging';
import { getAppUser, userVerboseLog } from './app.user.service';
import { getAllChains } from './chain.service';

// check if app user exist, if not, create new app user
export async function selectChain(telegramId: string, chain: string) {
    const user = await getAppUser(telegramId);
    const chains = await ConnectedChainModel.countDocuments({
        user: user._id,
        chain: chain
    });

    const chFound = await ChainModel.findOne({ name: chain })
    if (chFound === null) {
        throw new Error(`Unrecognized chain [${chain}]`)
    }

    const res = await ConnectedChainModel.updateMany({ user: user._id }, { selected: false });

    if (chains > 0) {
        const updateRes = await ConnectedChainModel.updateOne({ user: user._id, chain: chain }, { selected: true });
        await userVerboseLog(telegramId, '[' + chain + '] is selected');
    } else {
        await userVerboseLog(telegramId, `not found chain ${chain}`);
        try {
            await saveNewChain(telegramId, chain);
        } catch (err: any) {
            console.error(`==> ${new Date().toLocaleString()}`)
            console.error(err)
            Logging.error(err);
        }
    }
    return true;
}

// save new app user function
async function saveNewChain(telegramId: string, chain: string) {
    const user = await getAppUser(telegramId);
    const newChain = new ConnectedChainModel({
        user: user._id,
        selected: true,
        chain: chain
    });

    return await newChain.save();
}

export async function getSelectedChain(telegramId: string) {
    const user = await getAppUser(telegramId);
    const chain = await ConnectedChainModel.findOne({ user: user._id, selected: true });
    if (chain === null) {
        throw new Error(NOT_CONNECTED_CHAIN);
    }

    return chain.chain;
}

export async function getConfiguredChain(chain: string) {
    const ch = await ChainModel.findOne({ name: chain });
    if (ch === null) {
        throw new Error(NOT_CONFIGURED_CHAIN + ` ${chain}`);
    }
    return ch;
}

export async function selectOtherChain(chain: string, bPrev: boolean) {
    let chainList = getAllChains();

    const foundIndex = chainList.indexOf(chain);
    let indexTo;
    if (foundIndex < 0) {
        indexTo = 0;
    } else {
        if (bPrev === true) {
            indexTo = (foundIndex + chainList.length - 1) % chainList.length;
        } else {
            indexTo = (foundIndex + 1) % chainList.length;
        }
    }

    return chainList[indexTo]
}
