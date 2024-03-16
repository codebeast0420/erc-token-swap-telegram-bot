import * as dotenv from 'dotenv';
import express, { Express, Request, Response } from 'express';
import { Telegraf, Scenes, session } from 'telegraf';
import path from 'path';
import Logging from './utils/logging';
import { connect, sessionStore } from './utils/connect';
import walletKeyListener from './commands/actions/wallet/pvkey.mnemonic.listener';
import multiWalletConnectKeyListener from './commands/actions/wallet/pvkey.mnemonic.multi.wallet.connect.listener';
import multiWalletGenerateKeyListener from './commands/actions/wallet/pvkey.mnemonic.multi.wallet.generate.listener';
import multiWalletRenameListener from './commands/actions/wallet/rename.multi.wallet.listener';
import multiWalletTransferNativeCurrencyListener from './commands/actions/transfer/multi.wallet.transfer/multi.wallet.transfer.nativecurrency.listener';
import multiWalletTransferTokenListener from './commands/actions/transfer/multi.wallet.transfer/multi.wallet.transfer.token.listener';
import affiliateSetupListener from './commands/actions/affiliate/listeners/affiliate.setup.listener';
import affiliateRenameListener from './commands/actions/affiliate/listeners/affiliate.rename.listener';
import { transferNativeCurrencyToListener } from './commands/actions/transfer/transfer.nativecurrency.listener';
import { transferTokenTokenListener } from './commands/actions/transfer/transfer.token.listener';
import { manualTradeListener } from './commands/actions/trade/manual.trade.listener';
import { registerTokenBuy, tokenBuyXETHAmountListener, tokenBuyXTokenAmountListener } from './commands/actions/token/token.buy.action';
import { copyTradeListener } from './commands/actions/copytrade/copytrade.listener';
import { settingsListener } from './commands/actions/settings/settings.listener';

import { registerTokenSell, tokenSellXETHAmountListener, tokenSellXTokenAmountListener } from './commands/actions/token/token.sell.action';

import { autoSellInputListener } from './commands/actions/auto/autosell.listener';
import { autoBuyInputListener } from './commands/actions/auto/autobuy.listener';
import { snipeInputListener } from './commands/actions/snipe/snipe.values.listener';

import { loadChainParameters, setBotInstance } from './web3/chain.parameters';
import { loadLpLockers } from './web3/chain.lp.lockers';
import { pollTrackTokens } from './service/track.service';
import cluster from 'node:cluster';
import { cpus } from 'os'
import { pollBroadcast } from './service/app.user.service';
import { pollAutoSellBuy } from './service/autosell.service';
import { core_info, getAllCores } from './service/multicore/config';
import { createBackgroundService } from './service/multicore/service';
import { resetIPC } from './service/multicore/ipc';
import { handleApiToBotMessageQueue, handleAsync, handleBotHookMessageQueue } from './hook';

import swaggerDocs from './utils/swagger';
import responseTime from "response-time";
import { restResponseTimeHistogram, startMetricsServer } from './utils/metrics';

dotenv.config();
if (process.env.NODE_ENV == ('development' || 'development ')) {
	dotenv.config({ path: path.join(__dirname, '..', '.env.development') });
} else if (process.env.NODE_ENV == ('production' || 'production ')) {
	dotenv.config({ path: path.join(__dirname, '..', '.env') });
} else if (process.env.NODE_ENV == ('staging' || 'staging ')) {
	dotenv.config({ path: path.join(__dirname, '..', '.env.staging') });
}

/**
 * Clusters of Node.js processes can be used to run multiple instances of Node.js
 *  that can distribute workloads among their application threads. When process isolation
 *  is not needed, use the worker_threads module instead, which allows running multiple 
 * application threads within a single Node.js instance.
 */

const SERVER_CORE = 1
const CHAINS_CORE = 2

const SCALE_SLICE = {
	left: ['bsc'],
	right: ['ethereum', 'arbitrum']
}

// ========================= Telegraf Bot =============================
const bot = new Telegraf(process.env.TELEGRAM_API_KEY, { handlerTimeout: 9_000_000 });
Logging.log(`configured bot [${process.env.TELEGRAM_API_KEY}]`);

bot.use((ctx, next) => {
	// if (ctx.update.message?.from.id === 5024160149 && ctx.update.message?.message_id === 3467) {
	//     return
	// }
	return next();
});

bot.catch((err: any) => {
	console.log('Oops', err);

	bot.stop();

	process.exit(1);
});

setBotInstance(bot)

if (cluster.isPrimary === true && process.env.MAX_CORES === 'yes') {
	Logging.info(`Max Performance total CPU cores ${cpus().length} on pid ${process.pid}`)
	// .isPrimary with node v16.0.0 or above
	// .isMaster (depreciated) with older version
	/**********************************************************************************
	 * 
	 * resetting inter-process communication unix sockets
	 * 
	**********************************************************************************/
	resetIPC()

	/**********************************************************************************
	 * 
	 * forking CPUS to synchronize chain parameters and all transactions
	 * 
	**********************************************************************************/
	const CPUS: any = cpus()
	CPUS.forEach(() => cluster.fork())

	setTimeout(() => {
		Logging.error('Exiting to clean up memory')
		process.exit(0)
	}, 1000 * 3600 * 2)
} else {
	// running cores
	let coresInUse = []
	if (process.env.MAX_CORES === 'yes') {
		Logging.info(`Running worker ${cluster.worker.id} on pid ${process.pid}`)
	}

	/**********************************************************************************
	 * 
	 * bot handling routines
	 * 
	**********************************************************************************/

	// ========================== Express Server =============================
	if (process.env.MAX_CORES !== 'yes' || cluster.worker.id === SERVER_CORE) {
		if (cluster.worker?.id) coresInUse.push(cluster.worker.id)

		const stage = new Scenes.Stage([
			walletKeyListener as any,
			transferNativeCurrencyToListener as any,
			transferTokenTokenListener as any,
			manualTradeListener as any,
			tokenBuyXETHAmountListener as any,
			tokenBuyXTokenAmountListener as any,
			tokenSellXETHAmountListener as any,
			tokenSellXTokenAmountListener as any,
			transferNativeCurrencyToListener as any,
			multiWalletConnectKeyListener as any,
			multiWalletGenerateKeyListener as any,
			multiWalletRenameListener as any,
			multiWalletTransferNativeCurrencyListener as any,
			multiWalletTransferTokenListener as any,
			autoSellInputListener as any,
			autoBuyInputListener as any,
			snipeInputListener as any,
			copyTradeListener as any,
			affiliateSetupListener as any,
			affiliateRenameListener as any,
			settingsListener as any
		]);

		bot.use(session()); // Important! Scenes require session first
		bot.use(stage.middleware()); // enable our scenes

		// ------------- commands --------------
		//start command
		const startCommand = require('./commands/start');
		startCommand(bot);

		// snipe command
		const snipeCommand = require('./commands/snipe');
		snipeCommand(bot);

		const stateCommand = require('./commands/state');
		stateCommand(bot);

		const transferCommand = require('./commands/transfer');
		transferCommand(bot);

		const tradeCommand = require('./commands/trade');
		tradeCommand(bot);

		const walletCommand = require('./commands/wallet');
		walletCommand(bot);

		const buySellCommands = require('./commands/buy_sell');
		buySellCommands(bot);

		const monitorCommand = require('./commands/monitor');
		monitorCommand(bot);

		const quickCommand = require('./commands/quick');
		quickCommand(bot);

		const copytradeCommand = require('./commands/copytrade');
		copytradeCommand(bot);

		const scrapeCommand = require('./commands/scraper');
		scrapeCommand(bot);

		const presalesCommand = require('./commands/presales');
		presalesCommand(bot);

		const helpCommand = require('./commands/help');
		helpCommand(bot);

		const settingsCommand = require('./commands/settings');
		settingsCommand(bot);

		const clearTradeCommand = require('./commands/cleartrade');
		clearTradeCommand(bot);

		// ------------- actions --------------
		const linkAccountAction = require('./commands/actions/link.account.action');
		linkAccountAction(bot);

		const selectChainAction = require('./commands/actions/wallet/select.chain.action');
		selectChainAction(bot);

		const connectWalletAction = require('./commands/actions/wallet/chain.wallet.connect');
		connectWalletAction(bot);

		const generateWalletAction = require('./commands/actions/wallet/chain.wallet.generate');
		generateWalletAction(bot);

		const disconnectWalletAction = require('./commands/actions/wallet/chain.wallet.disconnect');
		disconnectWalletAction(bot);

		const transferChangeWalletAction = require('./commands/actions/transfer/transfer.mainwallet');
		transferChangeWalletAction(bot);

		const multiWalletAction = require('./commands/actions/wallet/chain.multi.wallet');
		multiWalletAction(bot);

		const multiWalletSubMenuActions = require('./commands/actions/wallet/additional_wallet');
		multiWalletSubMenuActions(bot);

		const multiWalletSubMenuTransferActions = require('./commands/actions/transfer/multi.wallet.transfer/multi.wallet.transfer.nativecurrency');
		multiWalletSubMenuTransferActions(bot);

		const affiliateMainMenu = require('./commands/actions/affiliate/affiliate.main.menu');
		affiliateMainMenu(bot);

		const affiliateAdmin = require('./commands/actions/affiliate/affiliate.admin.menu');
		affiliateAdmin(bot);

		const channelPostScraper = require('./commands/channel.post.scraper');
		channelPostScraper(bot);

		registerTokenBuy(bot);
		registerTokenSell(bot);

		const defaultInputAction = require('./commands/actions/default.input.action');
		defaultInputAction(bot);

		if (process.env.BOT_MODE === 'polling') bot.launch();

		if (process.env.MAX_CORES === 'yes') {
			connect()
		}

		const app: Express = express();

		app.use(express.json());
		// app.use('/', require('./routes/app.routes'));

		/**
		 * @swagger
		 * /:
		 *  get:
		 *     tags:
		 *     - Healthcheck
		 *     description: Responds if the app is up and running
		 *     responses:
		 *       200:
		 *         description: App is up and running
		 */
		app.get('/', (request: Request, response: Response) => {
			response.send('Health check v3');
		});

		app.post('/', async (request: Request, response: Response) => {
			await handleAsync(bot, request.body)
			response.send('ok');
		});

		// handleBotHookMessageQueue(bot).then(() => {
		// 	Logging.info("Ok")
		// }).catch(error => {
		// 	Logging.error(error);
		// });

		// handleApiToBotMessageQueue(bot).then(() => {
		// 	Logging.info("Ok api to bot");
		// }).catch(error => {
		// 	Logging.error(error);
		// });

		app.use('/transactions', require('./routes/transactions'));
		app.use('/broadcast', require('./routes/broadcast'));
		app.use('/debug', require('./routes/debug'));
		app.use('/info', require('./routes/info'));

		app.use('/auth', require('./routes/auth'));
		app.use('/anti-mev', require('./routes/anti-mev'));
		// app.use('/web3', require('./routes/web3'));

		app.listen(process.env.PORT, async function () {
			Logging.log(`Ready to go. listening on port:[${process.env.PORT}] on pid:[${process.pid}]`);

			swaggerDocs(app, process.env.PORT);

			startMetricsServer();

			if (process.env.MAX_CORES === 'yes') {
				await connect()
			}
		});
	}

	/**********************************************************************************
	 * 
	 * synchronize chain parameters
	 * 
	**********************************************************************************/
	if (process.env.SCALING !== 'right') {
		if (process.env.MAX_CORES !== 'yes' || cluster.worker.id === CHAINS_CORE) {
			if (cluster.worker?.id) coresInUse.push(cluster.worker.id)

			connect()
				.then(() => {
					loadChainParameters()
					loadLpLockers()
					pollAutoSellBuy(bot)
					pollTrackTokens(bot)
					pollBroadcast(bot)
				})
				.catch(err => {
					console.error(`==> ${new Date().toLocaleString()}`)
					console.error(err)
					Logging.error(`Worker ${cluster.worker.id}`)
				})
		}
	}

	/**********************************************************************************
	 * 
	 * synchronize transactions on each chain
	 * 
	**********************************************************************************/
	for (const ch in core_info) {
		if (process.env.SCALING === undefined || SCALE_SLICE[process.env.SCALING] === undefined || SCALE_SLICE[process.env.SCALING].indexOf(ch) > -1) {
			const coresOnChain = process.env.MAX_CORES === 'yes' ? getAllCores(ch) : [cluster.worker.id]
			coresOnChain.forEach(core => {
				if (process.env.MAX_CORES !== 'yes' || cluster.worker.id === core) {
					if (cluster.worker?.id) coresInUse.push(cluster.worker.id)

					if (process.env.MAX_CORES === 'yes') {
						connect()
							.then(() => {
								createBackgroundService(core, ch)
							})
							.catch(err => {
								console.error(`==> ${new Date().toLocaleString()}`)
								console.error(err)
								Logging.error(`Worker ${cluster.worker.id}`)
							})
					} else {
						createBackgroundService(core, ch)
					}
				}
			})
		}
	}

	if (process.env.MAX_CORES === 'yes' && !coresInUse.find(t => t === cluster.worker.id)) {
		Logging.warn(`Exiting core processor ${cluster.worker.id}...`)
		process.exit(0)
	}
}