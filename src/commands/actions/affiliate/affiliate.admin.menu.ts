import { adminConfig } from '../../../configs/admin.config';
import { botEnum } from '../../../constants/botEnum';
import { IAffiliateInfluencer } from '../../../models/affiliate.influencer.model';
import { IAppUser } from '../../../models/app.user.model';
import { AffiliateBotNotifierService, AffiliateService } from '../../../service/affiliate.service';
import { getAppUser, userVerboseLog } from '../../../service/app.user.service';
import { processError } from '../../../service/error';
import { approveRejectAffiliate, disableAffiliate } from '../../../utils/inline.markups';
import Logging from '../../../utils/logging';
import { affiliateAdminConfirmDelete, affiliateLinkApprovedAdmin, affiliateLinkApprovedMainAdmin, affiliateLinkDisableMainAdmin } from '../../../utils/messages';

module.exports = (bot: any) => {
	// approve affiliate
	const approveAffiliate = /^apa_(.*)$/;
	const approveAffiliateReg = RegExp(approveAffiliate);

	bot.action(approveAffiliateReg, async (ctx: any) => {
		const telegramId = ctx.from.id;
		try {
			await userVerboseLog(telegramId, 'approve affiliate');

			if (ctx.update.callback_query.message.chat.type === 'private') {
				const id: string = ctx.match[1];
				const msgId = ctx.update.callback_query.message.message_id;
				let firstSetup = false;

				let affiliate: IAffiliateInfluencer = await new AffiliateService().getUserAffiliateById(id);

				if (affiliate.approver === undefined) firstSetup = true;

				if (!affiliate.approved) {
					const appUser: IAppUser = await getAppUser(telegramId);

					affiliate.approved = true;
					affiliate.approver = appUser;

					let affiliateUpdated = await new AffiliateService().updateUserAffiliate(id, affiliate);

					await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, affiliateLinkApprovedMainAdmin(affiliateUpdated, appUser), {
						parse_mode: botEnum.PARSE_MODE_V2,
						reply_markup: disableAffiliate(affiliateUpdated)
					});

					if (firstSetup)
						await new AffiliateBotNotifierService().notifiyNewAffiliate(affiliate.owner.userName === undefined ? affiliate.owner.firstName : `@${affiliate.owner.userName}`)

					for (const admin in adminConfig) {
						const info = adminConfig[admin];

						//   if (info.telegramId !== telegramId.toString())
						try {
							await ctx.telegram.sendMessage(info.telegramId, affiliateLinkApprovedAdmin(affiliateUpdated), {
								parse_mode: botEnum.PARSE_MODE_V2,
								reply_markup: disableAffiliate(affiliateUpdated)
							});
						} catch { }
					}
				} else {
					await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, `Already approved by ${affiliate.approver.userName}`, {
						parse_mode: botEnum.PARSE_MODE_V2
					});
				}
			} else {
				await ctx.telegram.sendMessage(ctx.chat.id, 'Approve Affiliate is only allowed in private chat');
			}
		} catch (e) {
			await processError(ctx, telegramId, e)
		}
	});

	// reject
	const rejectAffiliate = /^ara_(.*)$/;
	const rejectAffiliateReg = RegExp(rejectAffiliate);

	bot.action(rejectAffiliateReg, async (ctx: any) => {
		const telegramId = ctx.from.id;
		try {
			await userVerboseLog(telegramId, 'reject affiliate');

			if (ctx.update.callback_query.message.chat.type === 'private') {
				const appUser: IAppUser = await getAppUser(telegramId);
				const id: string = ctx.match[1];
				const msgId = ctx.update.callback_query.message.message_id;
				let affiliate: IAffiliateInfluencer = await new AffiliateService().getUserAffiliateById(id);
				affiliate.approver = appUser;
				if (affiliate._id != null) {
					await new AffiliateService().deleteAffiliate(affiliate.owner.telegramId);
					await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, `${affiliate.owner.userName} affiliate program successfully deleted`, {
						parse_mode: botEnum.PARSE_MODE_V2
					});
					for (const admin in adminConfig) {
						const info = adminConfig[admin];

						//   if (info.telegramId !== telegramId.toString())
						try {
							await ctx.telegram.sendMessage(info.telegramId, affiliateAdminConfirmDelete(affiliate), {
								parse_mode: botEnum.PARSE_MODE_V2
							});
						} catch { }
					}
				} else {
					await ctx.telegram.sendMessage(telegramId, 'affiliate program not found', {
						parse_mode: botEnum.PARSE_MODE_V2
					});
				}
			} else {
				await ctx.telegram.sendMessage(ctx.chat.id, 'Reject Affiliate is only allowed in private chat');
			}
		} catch (err) {
			await processError(ctx, telegramId, err)
		}
	});

	// disable affiliate
	const disableAffiliateExp = /^ada_(.*)$/;
	const disableAffiliateReg = RegExp(disableAffiliateExp);

	bot.action(disableAffiliateReg, async (ctx: any) => {
		const telegramId = ctx.from.id;
		try {
			await userVerboseLog(telegramId, 'disable affiliate');

			if (ctx.update.callback_query.message.chat.type === 'private') {
				const id: string = ctx.match[1];
				const msgId = ctx.update.callback_query.message.message_id;
				let affiliate: IAffiliateInfluencer = await new AffiliateService().getUserAffiliateById(id);

				if (!affiliate.approved) {
					await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, `Already disabled by ${affiliate.approver.userName}`, {
						parse_mode: botEnum.PARSE_MODE_V2
					});
				} else {
					const appUser: IAppUser = await getAppUser(telegramId);

					affiliate.approved = false;
					affiliate.approver = appUser;

					let affiliateUpdated = await new AffiliateService().updateUserAffiliate(id, affiliate);

					await ctx.telegram.editMessageText(ctx.chat.id, msgId, 0, affiliateLinkDisableMainAdmin(affiliateUpdated), {
						parse_mode: botEnum.PARSE_MODE_V2,
						reply_markup: approveRejectAffiliate(affiliateUpdated)
					});
				}
			} else {
				await ctx.telegram.sendMessage(ctx.chat.id, 'Disable Affiliate is only allowed in private chat');
			}
		} catch (err) {
			await processError(ctx, telegramId, err)
		}
	});
};
