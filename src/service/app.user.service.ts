import { AppUserModel } from '../models/app.user.model';
import Logging from '../utils/logging';
import { NOT_STARTED, sleep } from '../utils/common';
import { BroadcastModel } from '../models/broadcast.model';
import { botEnum } from '../constants/botEnum';
import { SettingsModel } from '../models/settings.model';
import { ChainModel } from '../models/chain.model';
import { VisitRecordModel } from '../models/visit.record';

// check if app user exist, if not, create new app user
export async function updateChatId(telegramId: string, chatId: number) {
    const appUsers = await AppUserModel.find({
        telegramId: telegramId
    });

    if (appUsers !== null && appUsers.length > 0) {
        await AppUserModel.findByIdAndUpdate(appUsers[0]._id, { chatId: chatId });

        const newVisitRecord = new VisitRecordModel({
            user: appUsers[0]._id,
            localTimeStamp: (new Date()).getTime()
        })
        await newVisitRecord.save()
    }
}

export async function createAppUserIfNotExist(telegramId: string, firstName: string, lastName: string, userName: string, chatId: number) {
    if (telegramId !== null) {
        const appUsers = await AppUserModel.find({
            telegramId: telegramId
        }).limit(1);

        if (appUsers != null && appUsers.length > 0) {
        } else {
            try {
                await saveNewAppUser(telegramId, firstName, lastName, userName, chatId);
            } catch (err: any) {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(err);
            }
        }
        return true;
    }
    return false;
}

// save new app user function
export async function saveNewAppUser(telegramId: string, firstName: string, lastName: string, userName: string, chatId: number) {
    Logging.info('Adding a new app user ' + telegramId);
    const appUser = new AppUserModel({
        telegramId: telegramId,
        firstName: firstName,
        lastName: lastName,
        userName: userName,
        chatId: chatId
    });

    return await appUser.save();
}

export async function isAlreadyStarted(telegramId: string) {
    return 0 < (await AppUserModel.countDocuments({ telegramId: telegramId }));
}

export async function getAppUser(telegramId: string) {
    const user = await AppUserModel.findOne({
        telegramId: telegramId
    });

    if (user === null) {
        throw new Error(NOT_STARTED);
    }
    return user;
}

export async function isAntiMEVOn(telegramId: string, chain: string) {
    const user = await getAppUser(telegramId)
    const info = await ChainModel.findOne({ name: chain })
    const setting = await SettingsModel.findOne({ user: user._id, chain: info._id })
    return setting?.antiMEV === true
}

export async function userVerboseLog(telegramId: string, log: string) {
    const user = await AppUserModel.findOne({ telegramId: telegramId });
    if (user !== null) {
        Logging.log(`${telegramId}:[${user.userName}] - ${log}`);
    } else {
        Logging.log(`${telegramId}:[@undefined] - ${log}`);
    }
}


export async function pollBroadcast(bot: any) {
    Logging.info('polling broadcast...')
    while (true) {
        if (bot?.telegram) {
            const users: any[] = await AppUserModel.find();
            const bm = await BroadcastModel.findOne();
            if (bm !== null) {
                for (const u of users) {
                    if (u.chatId) {
                        try {
                            await bot.telegram.sendMessage(u.chatId, bm.content, { parse_mode: botEnum.PARSE_MODE_V2 });
                        } catch (err) { }
                    }
                }

                Logging.info(`Notified to all users\n${bm.content}`)

                await BroadcastModel.findByIdAndDelete(bm._id);

                if (0 === await BroadcastModel.countDocuments()) {
                    const admin = users.find(u => u.userName === 'cryptoguy1119')
                    if (admin) {
                        await bot.telegram.sendMessage(admin.chatId, '✅ Finished broadcasting', { parse_mode: botEnum.PARSE_MODE_V2 });
                    }
                }
            }
        }

        await sleep(10000);
    }
}
