import { Scenes } from "telegraf";
import { botEnum } from "../../../../constants/botEnum";
import { message } from "telegraf/filters";
import { sendError } from "../../wallet/pvkey.mnemonic.multi.wallet.generate.listener";
import { AffiliateService } from "../../../../service/affiliate.service";
import { affiliateEarningsSummaryMarkup, affiliateMainMenu } from "../../../../utils/inline.markups";
import { affiliateEarningsSummary, affiliateLinkCreated } from "../../../../utils/messages";
import { AFFILIATE_RENAME_LISTENER } from "../../../../utils/common";
import { ISceneResponse, SceneStageService } from "../../../../service/scene.stage.service";
import Logging from "../../../../utils/logging";
import { processError } from "../../../../service/error";

const listener = new Scenes.BaseScene(AFFILIATE_RENAME_LISTENER)


const renameAffiliateContext = {
    ['0']: {
        initiator: null,
    }
}


listener.enter(async (ctx: any) => {
    const telegramId = ctx.from.id
    try {
        const ret = await ctx.telegram.sendMessage(ctx.chat.id, "what would you like to name this affiliate link? 32 letters max, only numbers and letters", {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: {
                force_reply: true,
                input_field_placeholder: 'ChartAISnipper'
            }
        })


        const context = {
            initiator: JSON.stringify(ctx.update.callback_query),
            message: JSON.stringify(ret),
            msgId: ctx.update.callback_query.message.message_id,
        }

        await new SceneStageService().saveScene(telegramId, AFFILIATE_RENAME_LISTENER, JSON.stringify(context), new Date());
        await ctx.scene.leave();
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});


export class AffiliateRenameListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`AffiliateRenameListener.class processing scene message [${text}]`)
        const context = JSON.parse(sceneContext.scene.text)
        if (text.length > 32) {
            await sendError(ctx, "32 letters max, only numbers and letters. Let's try again.");
            await new SceneStageService().deleteScene(telegramId)
            return;
        }
        if (!(/^[A-Za-z0-9]*$/.test(text))) {
            await sendError(ctx, "name contains special characters, only numbers and letters. Let's try again");
            await new SceneStageService().deleteScene(telegramId)
            return;
        }

        if (!(await new AffiliateService().linkCodeChangeBeChanged(telegramId, text))) {
            await sendError(ctx, "Link code already exists");
            await new SceneStageService().deleteScene(telegramId)
            return;
        }

        else {
            await renameLink(ctx, telegramId, text, context);
        }
    }
}

// listener.on(message("text"), async (ctx: any) => {
//     const telegramId = ctx.from.id;
//     const name = ctx.update.message.text

//     if (name.length > 32) {
//         sendError(ctx, "32 letters max, only numbers and letters. Let's try again.");
//         await ctx.scene.leave();
//         return;
//     }
//     if (!(/^[A-Za-z0-9]*$/.test(name))) {
//         sendError(ctx, "name contains special characters, only numbers and letters. Let's try again");
//         await ctx.scene.leave();
//         return;
//     }
//     else {
//         await renameLink(ctx, telegramId, name);
//     }
// })


async function renameLink(ctx: any, telegramId: string, name: string, context: any) {
    let updatedLink = await new AffiliateService().renameAffiliate(telegramId, name);
    if (updatedLink != null && updatedLink.ref != null) {
        let subscribersCount: number = await new AffiliateService().getSubscribersCount(telegramId)

        await ctx.telegram.editMessageText(telegramId, context.msgId, 0, await affiliateEarningsSummary(updatedLink, subscribersCount), {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: await affiliateEarningsSummaryMarkup()
        })

        ctx.telegram.sendMessage(telegramId, 'link code updated', {
            parse_mode: botEnum.PARSE_MODE_V2,
        })

        await new SceneStageService().deleteScene(telegramId)
    }
}


// reply to all other types of messages
listener.on("message", async (ctx: any) => {
    try {
        await ctx.reply("what would you like to name this affiliate link? 32 letters max, only numbers and letters")
    } catch (err) {
        await processError(ctx, ctx.from.id, err)
    }
});

export default listener