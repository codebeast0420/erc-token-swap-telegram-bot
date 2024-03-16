import { configObject } from "./configs/queue.creds";
import { isPurgingMessages } from "./service/app.service";
import Logging from "./utils/logging";
import { SQSClient } from '@aws-sdk/client-sqs';
import { Consumer } from 'sqs-consumer';
const sqsClient = new SQSClient(configObject);


export const handleAsync = async (bot: any, request: any) => {
	try {
		const isPurging = await isPurgingMessages()
		if (isPurging) {
			Logging.info(`Purged ${JSON.stringify(request)}`)
		} else {
			await bot.handleUpdate(request)
		}
	} catch (err) {
		console.error(`==> ${new Date().toLocaleString()}`)
		console.error(err)
		Logging.error(`oh no ${err.message}`)
	}
}

const sendMessageToTGBot = async (bot: any, request: any) => {
	try {

		bot.telegram.sendMessage(request.telegramId, request.body, { parse_mode: request.parseMode ?? "HTML" });

	} catch (err) {
		console.error(`==> ${new Date().toLocaleString()}`)
		console.error(err)
		Logging.error(`oh no api to bot ${err.message}`)
	}
}

export async function handleApiToBotHookMessage(bot: any, message: any) {
	sendMessageToTGBot(bot, message);
}

export async function handleBotHookMessageQueue(bot: any) {
	try {
		const consumer = Consumer.create({
			queueUrl: process.env.INBOUND_QUEUE,
			sqs: sqsClient,
			waitTimeSeconds: 20,
			pollingWaitTimeMs: 1,
			visibilityTimeout: 75,
			attributeNames: ['All'],
			batchSize: 1,
			handleMessage: async (message) => {
				Logging.info(`received new message ${message.MessageId}`)

				// convert to json
				const decodedRequestBodyString = Buffer.from(message.Body, 'base64');
				const requestBodyObject = JSON.parse(decodedRequestBodyString.toString());


				// catch errors
				bot.catch(err => {
					Logging.error(`Uncaught Error processed By Index: ${err}`)
				})

				handleAsync(bot, requestBodyObject);
			}
		})

		consumer.on('error', (err) => {
			Logging.error(`consumer handleMessage error ${err}`)
		})

		consumer.on('processing_error', (err) => {
			Logging.error(`consumer handleMessage processing_error ${err}`)
		})

		consumer.on('timeout_error', (err) => {
			Logging.error(`consumer handleMessage timeout_error ${err}`)
		})
		consumer.start();
	} catch (error) {
		Logging.error(error);
	}
}


export async function handleApiToBotMessageQueue(bot: any) {
	try {
		const consumer = Consumer.create({
			queueUrl: process.env.API_PUSH_QUEUE,
			sqs: sqsClient,
			waitTimeSeconds: 20,
			pollingWaitTimeMs: 1,
			visibilityTimeout: 75,
			attributeNames: ['All'],
			batchSize: 1,
			handleMessage: async (message) => {
				Logging.info(`received new message ${message.MessageId}`)

				// convert to json
				const requestBodyObject = JSON.parse(message.Body);


				// catch errors
				bot.catch(err => {
					Logging.error(`Uncaught Error processed By Index: ${err}`)
				})

				handleApiToBotHookMessage(bot, requestBodyObject);
			}
		})

		consumer.on('error', (err) => {
			Logging.error(`consumer handleMessage error ${err}`)
		})

		consumer.on('processing_error', (err) => {
			Logging.error(`consumer handleMessage processing_error ${err}`)
		})

		consumer.on('timeout_error', (err) => {
			Logging.error(`consumer handleMessage timeout_error ${err}`)
		})
		consumer.start();
	} catch (error) {
		Logging.error(error);
	}
}