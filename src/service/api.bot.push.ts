import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { configObject } from "../configs/queue.creds";

export interface IApiSendMessage {
    type: number;
    telegramId: any;
    parseMode: string;
    body: any
}


export class ApiBotPush {
    private sqsClient = new SQSClient(configObject);


    async sendMessage(message: IApiSendMessage) {

        const command = new SendMessageCommand({
            MessageBody: JSON.stringify(message),
            QueueUrl: process.env.API_PUSH_QUEUE,
            MessageGroupId: `${message.telegramId}-${message.type}`,
            MessageDeduplicationId: `${message.telegramId}-${message.type}`,
        });

        return await this.sqsClient.send(command);

    }
}