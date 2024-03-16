import { error } from 'console';
import { AffiliateInfluencerModel, IAffiliateInfluencer } from '../models/affiliate.influencer.model';
import Logging from '../utils/logging';
import { getAppUser } from './app.user.service';
import e from 'express';
import { AppUserModel, IAppUser } from '../models/app.user.model';
import { sendError } from '../commands/actions/wallet/pvkey.mnemonic.multi.wallet.generate.listener';
import { affiliateSubscribeMessage } from '../utils/messages';
import { botEnum } from '../constants/botEnum';
import axios from 'axios';

export interface IAffiliateBalance {
	totalSalesCommission: number;
	chainEarnings: IChainBalance[];
}

interface IChainBalance {
	chain: string;
	earning: number;
}

export class AffiliateService {
	public async createUserAffiliateLink(telegramId: string, name: string, payoutAddress: string, twitterLink: string) {
		const user = await getAppUser(telegramId);
		let response: IAffiliateInfluencer = {};

		const affiliateInfluencerModel = new AffiliateInfluencerModel({
			owner: user._id,
			ref: `https://chartai.tech/${name}`,
			startDate: new Date(),
			payoutAddress: payoutAddress,
			twitterLink: twitterLink,
			approved: false
		});

		response = await affiliateInfluencerModel.save();

		return response;
	}

	public async getUserAffiliateLink(telegramId: string): Promise<IAffiliateInfluencer> {
		const user = await getAppUser(telegramId);
		let response: IAffiliateInfluencer = {};
		await AffiliateInfluencerModel.findOne({ owner: user._id, endDate: null })
			.then((doc) => {
				response = doc;
			})
			.catch((err) => {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
				Logging.error(err);
				response = {};
			});
		return response;
	}

	public async isUserAffiliateLinkAlreadySetup(telegramId: string): Promise<boolean> {
		const user = await getAppUser(telegramId);

		let links: IAffiliateInfluencer[];
		let response: boolean = false;

		await AffiliateInfluencerModel.find({ owner: user._id, endDate: null })
			.then((docs) => {
				links = docs;
			})
			.catch((err) => {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
				Logging.error(err);
				links = [];
			});

		if (links != null && links.length > 0) {
			for (let link of links) {
				if (link.endDate == null || link.endDate > new Date()) {
					response = true;
					break;
				}
			}
		}

		return response;
	}

	public async isUserLink(telegramId: string, link: string): Promise<boolean> {
		const user = await getAppUser(telegramId);
		let response: boolean = false;

		await AffiliateInfluencerModel.findOne({ owner: user._id, ref: link })
			.then((doc) => {
				if (doc != null) {
					response = true;
				}
			})
			.catch((err) => {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
				Logging.error(err);
				response = false;
			});

		return response;
	}

	public async isLinkExists(link: string): Promise<boolean> {
		let response: boolean = false;

		await AffiliateInfluencerModel.findOne({ ref: link, approved: true })
			.then((doc) => {
				if (doc != null) {
					if (doc.endDate == null || doc.endDate > new Date()) response = true;
				}
			})
			.catch((err) => {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
				Logging.error(err);
				response = false;
			});

		return response;
	}

	public async isValidLink(telegramId: string, link: string): Promise<boolean> {
		const user = await getAppUser(telegramId);
		let response: boolean = true;

		const code = link.split('/').slice(-1)[0];

		const fullLink = `https://chartai.tech/${code}`;

		await AffiliateInfluencerModel.findOne({ owner: user._id, ref: fullLink })
			.then((doc) => {
				if (doc == null) {
					response = true;
				} else if (doc !== null) {
					response = false;
				}
				else if (doc.endDate == null || doc.endDate > new Date()) {
					response = false;
				}
			})
			.catch((err) => {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
				Logging.error(err);
				response = false;
			});

		return response;
	}

	public async processAffiliateSubscribeLink(telegramId: string, link: string): Promise<IAffiliateInfluencer> {
		const user = await getAppUser(telegramId);
		let response: IAffiliateInfluencer = {};

		const code = link.split('/').slice(-1)[0];
		const fullLink = `https://chartai.tech/${code}`;

		await AffiliateInfluencerModel.findOne({ ref: fullLink }).populate("owner")
			.then((doc) => {
				response = doc;
			})
			.catch((err) => {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
				Logging.error(err);
				response = {};
			});

		if (response != null) {
			user.affiliateInfluencerSub = response;
			await user.save();
		}

		return response;
	}

	public async getUserAffiliateById(id: string): Promise<IAffiliateInfluencer> {
		let response: IAffiliateInfluencer = {};
		await (
			await AffiliateInfluencerModel.findOne({ _id: id })
		)
			.populate(['approver', 'owner'])
			.then((doc) => {
				if (doc != null && (doc.endDate == null || doc.endDate > new Date())) {
					response = doc;
				}
			})
			.catch((err) => {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
				Logging.error(err);
			});

		return response;
	}

	public async updateUserAffiliate(id: string, data: IAffiliateInfluencer) {
		const response = await AffiliateInfluencerModel.findOneAndUpdate(
			{ _id: id },
			{
				owner: data.owner,
				ref: data.ref,
				startDate: data.startDate,
				endDate: data.endDate,
				payoutAddress: data.payoutAddress,
				twitterLink: data.twitterLink,
				approved: data.approved,
				approver: data.approver
			}
		).populate(['approver', 'owner']);

		return response;
	}

	public async renameAffiliate(telegramId: string, code: string): Promise<IAffiliateInfluencer> {
		let response: IAffiliateInfluencer = {};
		const user = await getAppUser(telegramId);
		await AffiliateInfluencerModel.findOne({
			owner: user._id
		})
			.then(async (doc) => {
				doc.ref = `https://chartai.tech/${code}`;
				response = await doc.save();
			})
			.catch((err) => {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
				Logging.error(err);
			});

		return response;
	}

	public async linkCodeChangeBeChanged(telegramId: string, code: string): Promise<boolean> {
		let response: boolean = true;


		await AffiliateInfluencerModel.find().then(docs => {
			if (docs !== null && docs.length > 0) {
				const filteredDocs = docs.filter(doc => doc.ref.toLowerCase() === `https://chartai.tech/${code.toLowerCase()}`)
				if (filteredDocs !== null && filteredDocs.length > 0)
					response = false
			}
		}).catch(err => {
			console.error(`==> ${new Date().toLocaleString()}`)
			console.error(err)
			Logging.error(err)
		})

		return response;
	}

	public async deleteAffiliate(telegramId: string) {
		let response: any;
		const user = await getAppUser(telegramId);
		await AffiliateInfluencerModel.deleteOne({
			owner: user._id
		})
			.then((ack) => {
				response = ack;
			})
			.catch((err) => {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
				Logging.error(err);
			});

		return response;
	}

	public async getSubscribersCount(telegramId: string) {
		let response: any;
		let userAffiliateLink: IAffiliateInfluencer = {};
		const user = await getAppUser(telegramId);
		await AffiliateInfluencerModel.findOne({
			owner: user._id
		})
			.then(async (doc) => {

				userAffiliateLink = doc;
			})
			.catch((err) => {
				console.error(`==> ${new Date().toLocaleString()}`)
				console.error(err)
				Logging.error(err);
			});

		if (typeof userAffiliateLink === undefined || userAffiliateLink === undefined || userAffiliateLink == null) {
			response = 0;
			return
		}

		await AppUserModel.countDocuments({ affiliateInfluencerSub: userAffiliateLink._id }).then(doc => {
			response = doc
		}).catch(err => {
			console.error(`==> ${new Date().toLocaleString()}`)
			console.error(err)
			Logging.error(err)
		})

		return response;
	}


	public async processSubscription(ctx: any, telegramId: string, link: string) {
		if (!(await new AffiliateService().isLinkExists(link))) {
			sendError(ctx, "⚠️ invalid link.");
			return;
		}

		// if (await new AffiliateService().isUserLink(telegramId, ctx.message.text)) {
		//     sendError(ctx, "⚠️ you can't subscribe to your own link.");
		//     return;
		// }
		if (!(await new AffiliateService().isValidLink(telegramId, link))) {
			sendError(ctx, `⚠️ You can not subscribe to your own link`);
			return;
		} else {
			const user: IAppUser = await getAppUser(telegramId);
			const oldSubscription = user.affiliateInfluencerSub || undefined

			const subscription: IAffiliateInfluencer = await new AffiliateService().processAffiliateSubscribeLink(telegramId, link);
			const amountOfSubscriber: number = await this.getSubscribersCount(subscription.owner.telegramId)

			const message = affiliateSubscribeMessage(subscription, link);


			await ctx.telegram.sendMessage(ctx.chat.id, message, { parse_mode: botEnum.PARSE_MODE_V2 },
			)

			if (subscription === null) return

			if (oldSubscription === undefined) {
				new AffiliateBotNotifierService().notifiyNewUserJoinWithAffiliate(subscription.ref, subscription.owner.userName === undefined ? subscription.owner.firstName : `@${subscription.owner.userName}`, amountOfSubscriber)
			} else {
				if (oldSubscription._id.toString() !== subscription._id.toString()) {
					new AffiliateBotNotifierService().notifiyNewUserJoinWithAffiliate(subscription.ref, subscription.owner.userName === undefined ? subscription.owner.firstName : `@${subscription.owner.userName}`, amountOfSubscriber)
				}
			}

			return;
		}
	}
}

export class AffiliateBotNotifierService {

	#botToken: string = "6453758349:AAE-bot--DJUrw7qgSTGs5HelPLVf5up70I"
	#chatId: string = "-1001988461621"

	public async notifiyNewUserJoinWithAffiliate(ref: string, username: string, amountUsers: number) {
		let message = `<b>New Affiliate User!</b>👥\n`
		message += `The code {code} by {username} has been applied by another user. \n\n`
		message += `Current Code Users: {amount}`

		if (this.#botToken === undefined || this.#botToken === "") {
			throw new Error("Setup another bot for the affiliate notification")
		}
		if (this.#chatId === undefined || this.#chatId === "") {
			throw new Error("Missing chat id of the main telegram group. Add it here")
		}

		message = message.replace("{code}", ref).replace("{username}", username).replace("{amount}", amountUsers.toString())


		try {
			let response = await axios.get(`https://api.telegram.org/bot${this.#botToken}/sendMessage?chat_id=${this.#chatId}&text=${encodeURIComponent(message)}&parse_mode=html&disable_web_page_preview=true`)
		} catch (error) {

		}
	}

	public async notifiyNewAffiliate(username: string) {
		let message = `<b>New Affiliate Accepted!</b>🎉\n`
		message += `{username} has been accepted as a ChartAI affiliate. \n\n`
		message += `Apply for yours at @Zehereelabot 🤖`

		if (this.#botToken === undefined || this.#botToken === "") {
			throw new Error("Setup another bot for the affiliate notification")
		}
		if (this.#chatId === undefined || this.#chatId === "") {
			throw new Error("Missing chat id of the main telegram group. Add it here")
		}

		message = message.replace("{username}", username)

		try {
			let response = await axios.get(`https://api.telegram.org/bot${this.#botToken}/sendMessage?chat_id=${this.#chatId}&text=${encodeURIComponent(message)}&parse_mode=html&disable_web_page_preview=true`)
		} catch (error) {

		}
	}


}