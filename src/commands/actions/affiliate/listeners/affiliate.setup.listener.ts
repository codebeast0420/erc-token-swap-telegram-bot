import { Scenes } from 'telegraf';
import { botEnum } from '../../../../constants/botEnum';
import { message } from 'telegraf/filters';
import { sendError } from '../../wallet/pvkey.mnemonic.multi.wallet.generate.listener';
import { AffiliateService } from '../../../../service/affiliate.service';
import Logging from '../../../../utils/logging';
import { affiliateEarningsSummaryMarkup, affiliateMainMenu, approveRejectAffiliate } from '../../../../utils/inline.markups';
import { affiliateEarningsSummary, affiliateLinkCreated, affiliateLinkCreatedAdmin } from '../../../../utils/messages';
import { adminConfig } from '../../../../configs/admin.config';
import { AFFILIATE_SETUP_LISTENER } from '../../../../utils/common';
import { ISceneResponse, SceneStageService } from '../../../../service/scene.stage.service';
import { processError } from '../../../../service/error';
import { isValidAddress } from '../../../../web3/web3.operation';

const listener = new Scenes.BaseScene(AFFILIATE_SETUP_LISTENER);


// send a prompt message when user enters scene
listener.enter(async (ctx: any) => {
    const telegramId = ctx.from.id;
    try {
        try {
            await ctx.answerCbQuery();
        } catch (err) { }

        const ret = await ctx.telegram.sendMessage(ctx.chat.id, 'what would you like to name this affiliate link? 32 letters max, only numbers and letters', {
            parse_mode: botEnum.PARSE_MODE_V2,
            reply_markup: {
                force_reply: true,
                input_field_placeholder: 'ChartAISnipper'
            }
        });

        const context = {
            initiator: JSON.stringify(ctx.update.callback_query),
            message: JSON.stringify(ret),
            name: null,
            payoutAddress: null,
            twitterLink: null
        };

        await new SceneStageService().saveScene(telegramId, AFFILIATE_SETUP_LISTENER, JSON.stringify(context), new Date());
        await ctx.scene.leave();
    } catch (err) {
        await processError(ctx, telegramId, err)
    }
});

export class AffiliateSetupListener {
    public async processMessage(telegramId: string, sceneContext: ISceneResponse, text: string, ctx: any) {
        Logging.info(`AffiliateSetupListener.class processing scene message [${text}]`)
        const context = JSON.parse(sceneContext.scene.text)
        if (context.name == null) {
            if (text.length > 32) {
                sendError(ctx, "32 letters max, only numbers and letters. Let's try again.");
                await new SceneStageService().deleteScene(telegramId)
                return;
            }
            if (!/^[A-Za-z0-9]*$/.test(text)) {
                sendError(ctx, "name contains special characters, only numbers and letters. Let's try again");
                await new SceneStageService().deleteScene(telegramId)
                return;
            }

            if (await new AffiliateService().isUserAffiliateLinkAlreadySetup(telegramId)) {
                sendError(ctx, `you already have affiliate program setup`);
                await new SceneStageService().deleteScene(telegramId)
                return;
            }
            else {
                await sendTwitterLinkMessage(ctx, telegramId, text, context);
            }
        } else if (context.twitterLink === null) {
            if (/^https?:\/\/(?:www\.)?twitter\.com\/([A-Za-z0-9_]{1,15})$/.test(text)) {
                await sendPayoutMessage(ctx, telegramId, text, null, context);
            } else
                if (/^@[A-Za-z0-9_]{1,15}$/.test(text)) {
                    await sendPayoutMessage(ctx, telegramId, null, text, context);
                }
                else {
                    sendError(ctx, `invalid twitter link or handle`);
                    await new SceneStageService().deleteScene(telegramId)
                    return;
                }
        } else if (context.payoutAddress == null) {
            if (!isValidAddress(text)) {
                await ctx.telegram.sendMessage(ctx.chat.id, `invalid payoutAddress <b>${text}</b>`, { parse_mode: botEnum.PARSE_MODE_V2 });
                await ctx.scene.leave();
                return;
            } else {
                context.payoutAddress = text;

                await setupAffiliate(ctx, telegramId, context);
                await new SceneStageService().deleteScene(telegramId)
            }
        }
    }
}

// listener.on(message('text'), async (ctx: any) => {
//     const telegramId = ctx.from.id;
//     const namePayoutAddressTwitter = ctx.update.message.text;

//     if (setupAffiliateContext[telegramId].name == null) {
//         if (namePayoutAddressTwitter.length > 32) {
//             sendError(ctx, "32 letters max, only numbers and letters. Let's try again.");
//             await ctx.scene.leave();
//             return;
//         }
//         if (!/^[A-Za-z0-9]*$/.test(namePayoutAddressTwitter)) {
//             sendError(ctx, "name contains special characters, only numbers and letters. Let's try again");
//             await ctx.scene.leave();
//             return;
//         }

//         if (await new AffiliateService().isUserAffiliateLinkAlreadySetup(telegramId)) {
//             sendError(ctx, `you already have affiliate program setup`);
//             await ctx.scene.leave();
//             return;
//         } else {
//             await sendTwitterLinkMessage(ctx, telegramId, namePayoutAddressTwitter);
//         }
//     } else if (setupAffiliateContext[telegramId].twitterLink == null) {
//         if (/^https?:\/\/(?:www\.)?twitter\.com\/([A-Za-z0-9_]{1,15})$/.test(namePayoutAddressTwitter)) {
//             await sendPayoutMessage(ctx, telegramId, namePayoutAddressTwitter);
//         }

//         if (/^@[A-Za-z0-9_]{1,15}$/.test(namePayoutAddressTwitter)) {
//             await sendPayoutMessage(ctx, telegramId, null, namePayoutAddressTwitter);
//         } else {
//             sendError(ctx, `invalid twitter link or handle`);
//             await ctx.scene.leave();
//             return;
//         }
//     } else if (setupAffiliateContext[telegramId].payoutAddress == null) {
//         if (!isValidAddress(namePayoutAddressTwitter)) {
//             await ctx.telegram.sendMessage(ctx.chat.id, `invalid payoutAddress <b>${namePayoutAddressTwitter}</b>`, { parse_mode: botEnum.PARSE_MODE_V2 });
//             await ctx.scene.leave();
//             return;
//         } else {
//             setupAffiliateContext[telegramId].payoutAddress = namePayoutAddressTwitter;

//             await setupAffiliate(ctx, telegramId);
//             await ctx.scene.leave();
//         }
//     }
// });

async function sendPayoutMessage(ctx: any, telegramId: string, twitterLink?: string, twitterHandle?: string, context?: any) {
    await ctx.telegram.sendMessage(ctx.from.id, 'which address should we send your earnings.', {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: {
            force_reply: true,
            input_field_placeholder: '0xC237Ba132Ad57fa4e859c1556d453EE2d5645297'
        }
    });

    let twitterFullLink = '';

    if (twitterLink != null) {
        twitterFullLink = twitterLink;
    } else if (twitterHandle != null) {
        const temp = twitterHandle.split('@').splice(-1)[0];
        twitterFullLink = `https://twitter.com/${temp}`;
    }

    context.twitterLink = twitterFullLink;
    await new SceneStageService().saveScene(telegramId, AFFILIATE_SETUP_LISTENER, JSON.stringify(context), new Date());
}

async function sendTwitterLinkMessage(ctx: any, telegramId: string, name: string, context: any) {
    await ctx.telegram.sendMessage(ctx.from.id, 'what is your twitter link or handle.', {
        parse_mode: botEnum.PARSE_MODE_V2,
        reply_markup: {
            force_reply: true,
            input_field_placeholder: 'https://twitter.com/ChartAi or @ChartAi'
        }
    });
    context.name = name;
    await new SceneStageService().saveScene(telegramId, AFFILIATE_SETUP_LISTENER, JSON.stringify(context), new Date());
}

async function setupAffiliate(ctx: any, telegramId: string, context: any) {
    try {
        const response = await new AffiliateService().createUserAffiliateLink(
            telegramId,
            context.name,
            context.payoutAddress,
            context.twitterLink
        );

        await ctx.telegram.sendMessage(telegramId, affiliateLinkCreated(response), {
            parse_mode: botEnum.PARSE_MODE_V2
        });

        await ctx.scene.leave();

        // alert admins
        for (const admin in adminConfig) {
            const info = adminConfig[admin];

            try {
                await ctx.telegram.sendMessage(info.telegramId, affiliateLinkCreatedAdmin(response), {
                    parse_mode: botEnum.PARSE_MODE_V2,
                    reply_markup: approveRejectAffiliate(response)
                });
            } catch { }
        }
    } catch (err) {
        console.error(`==> ${new Date().toLocaleString()}`)
        console.error(err)
        Logging.error(err);
    }
}

// reply to all other types of messages
listener.on('message', async (ctx: any) => {
    try {
        await ctx.reply('what would you like to name this affiliate link? 32 letters max, only numbers and letters')
    } catch (err) {
        await processError(ctx, ctx.from.id, err)
    }
});

export default listener;
