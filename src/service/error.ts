import { botEnum } from '../constants/botEnum';
import { AppUserModel } from '../models/app.user.model';
import { getErrorMessageResponse } from '../utils/messages';

export async function processError(ctx: any, telegramId: string, err: any) {
    const errMsg = await getErrorMessageResponse(telegramId, err.message);
    if (errMsg !== null) {
        let chatId = ctx.chat?.id
        if (chatId === undefined) {
            const user: any = await AppUserModel.findOne({ telegramId: telegramId });
            chatId = user !== null ? user.chatId : undefined
        }

        if (chatId === undefined) {
            console.log(`${telegramId} ${(new Date()).toLocaleString()} processError-1`)
            console.error(`${telegramId} ${(new Date()).toLocaleString()} processError-1`)
            console.error(err)
        } else {
            await ctx.telegram.sendMessage(chatId, errMsg, {
                parse_mode: botEnum.PARSE_MODE_V2
            });
        }
    } else {
        console.log(`${telegramId} ${(new Date()).toLocaleString()} processError-2`)
        console.error(`${telegramId} ${(new Date()).toLocaleString()} processError-2`)
        console.error(err)
    }
}
