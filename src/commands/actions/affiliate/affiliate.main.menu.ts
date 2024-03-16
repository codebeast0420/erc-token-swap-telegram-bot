import { botEnum } from '../../../constants/botEnum';
import { IAffiliateInfluencer } from '../../../models/affiliate.influencer.model';
import { AffiliateService } from '../../../service/affiliate.service';
import { userVerboseLog } from '../../../service/app.user.service';
import { processError } from '../../../service/error';
import { AFFILIATE_RENAME_LISTENER, AFFILIATE_SETUP_LISTENER } from '../../../utils/common';
import { affiliateEarningsSummaryConfirmDeleteMarkup, affiliateEarningsSummaryMarkup, affiliateNotFound } from '../../../utils/inline.markups';
import Logging from '../../../utils/logging';
import { affiliateEarningsSummary } from '../../../utils/messages';

module.exports = (bot: any) => {
    // main menu
    bot.action([botEnum.affiliate.value, botEnum.affiliateRefresh.value], async (ctx: any) => {
        const telegramId = ctx.from.id;

        try {
            await userVerboseLog(telegramId, 'referral main menu');

            if (ctx.update.callback_query.message.chat.type === 'private') {


                let userAffiliateLink: IAffiliateInfluencer = await new AffiliateService().getUserAffiliateLink(telegramId);
                let subscribersCount: number = await new AffiliateService().getSubscribersCount(telegramId)

                let hasLink = false;

                if (userAffiliateLink != null && (userAffiliateLink.endDate == null || userAffiliateLink.endDate > new Date())) {
                    hasLink = true;
                }

                try {
                    ctx.deleteMessage()
                } catch { }


                if (userAffiliateLink != null && userAffiliateLink.approved != null && userAffiliateLink.approved && (userAffiliateLink.endDate == null || userAffiliateLink.endDate > new Date())) {
                    if (hasLink) {
                        await ctx.telegram.sendMessage(telegramId, await affiliateEarningsSummary(userAffiliateLink, subscribersCount), {
                            parse_mode: botEnum.PARSE_MARKDOWN_V2,
                            reply_markup: await affiliateEarningsSummaryMarkup()
                        });
                    } else {
                        await ctx.telegram.sendMessage(telegramId, "⚠️ you haven't setup an referral program yet", {
                            parse_mode: botEnum.PARSE_MODE_V2,
                            reply_markup: affiliateNotFound()
                        });
                    }
                } else if (
                    userAffiliateLink != null &&
                    userAffiliateLink.approved != null &&
                    !userAffiliateLink.approved &&
                    (userAffiliateLink.endDate == null || userAffiliateLink.endDate > new Date())
                ) {
                    await ctx.telegram.sendMessage(telegramId, `⚠️ Pending approval from Admin`, {
                        parse_mode: botEnum.PARSE_MODE_V2
                    });
                } else {
                    await ctx.telegram.sendMessage(telegramId, "⚠️ you haven't setup an affiliate program yet", {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: affiliateNotFound()
                    });
                }
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Affiliate is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

    // enter setup
    bot.action(botEnum.setupAffiliate.value, async (ctx: any) => {
        const telegramId = ctx.from.id;
        try {
            await userVerboseLog(telegramId, 'setup affiliate');

            if (ctx.chat.type === 'private') {
                await ctx.scene.enter(AFFILIATE_SETUP_LISTENER);
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Setup Affiliate is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

    // enter rename
    bot.action(botEnum.affiliateRename.value, async (ctx: any) => {
        const telegramId = ctx.from.id;
        try {
            await userVerboseLog(telegramId, 'rename affiliate');

            if (ctx.chat.type === 'private') {
                await ctx.scene.enter(AFFILIATE_RENAME_LISTENER);
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Setup Affiliate is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

    // delete
    bot.action(botEnum.affiliateDelete.value, async (ctx: any) => {
        const telegramId = ctx.from.id;
        try {
            await userVerboseLog(telegramId, 'delete affiliate');

            if (ctx.chat.type === 'private') {
                const msgId = ctx.update.callback_query.message.message_id;
                let subscribersCount: number = await new AffiliateService().getSubscribersCount(telegramId)

                const response = await new AffiliateService().getUserAffiliateLink(telegramId);
                await ctx.telegram.editMessageText(telegramId, msgId, 0, await affiliateEarningsSummary(response, subscribersCount), {
                    parse_mode: botEnum.PARSE_MODE_V2,
                    reply_markup: await affiliateEarningsSummaryConfirmDeleteMarkup()
                });
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Setup Affiliate is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });

    // confirm delete
    bot.action(botEnum.affiliateConfirmDelete.value, async (ctx: any) => {
        const telegramId = ctx.from.id;
        try {
            await userVerboseLog(telegramId, 'delete affiliate');

            if (ctx.chat.type === 'private') {
                try {
                    ctx.deleteMessage();
                } catch { }
                const response = await new AffiliateService().deleteAffiliate(telegramId);
                if (response != null && response.acknowledged != null && response.acknowledged === true && response.deletedCount != null && response.deletedCount === 1) {
                    await ctx.telegram.sendMessage(telegramId, "⚠️ you haven't setup an affiliate program yet", {
                        parse_mode: botEnum.PARSE_MODE_V2,
                        reply_markup: affiliateNotFound()
                    });

                    await ctx.telegram.sendMessage(telegramId, 'affiliate setup deleted successfully', {
                        parse_mode: botEnum.PARSE_MODE_V2
                    });
                }
            } else {
                await ctx.telegram.sendMessage(ctx.chat.id, 'Setup Affiliate is only allowed in private chat');
            }
        } catch (err) {
            await processError(ctx, telegramId, err)
        }
    });
};
