import * as dotenv from 'dotenv';
import Logging from './logging';
import path from 'path';
import * as mongoose from 'mongoose';
import { Mongo } from "@telegraf/session/mongodb";
import { session } from 'telegraf';


dotenv.config();
if (process.env.NODE_ENV == ('development' || 'development ')) {
    dotenv.config({ path: path.join(__dirname, '..', '.env.development') });
} else if (process.env.NODE_ENV == ('production' || 'production ')) {
    dotenv.config({ path: path.join(__dirname, '..', '.env') });
} else if (process.env.NODE_ENV == ('staging' || 'staging ')) {
    Logging.info(`environment [${process.env.NODE_ENV}]`);
    dotenv.config({ path: path.join(__dirname, '..', '.env.staging') });
}

export async function connect() {
    const dbUri = process.env.DB_URI;

    try {
        mongoose.set('strictQuery', false);
        await mongoose.connect(dbUri, {
            retryWrites: true, w: 'majority'
        });
        Logging.info('Connected To Db');
    } catch (err) {
        console.error(`==> ${new Date().toLocaleString()}`)
        console.error(err)
        Logging.error(err);
        Logging.error('Could not connect to db');
        process.exit(1);
    }
}


export function sessionStore(bot: any) {
    const dbUri = process.env.DB_URI;
    try {

        const store: any = Mongo({
            url: dbUri,
            database: "telegraf-session",
        });
        bot.use(session({ store }));

        Logging.info('Connected To Session DB');

    } catch (err) {
        console.error(`==> ${new Date().toLocaleString()}`)
        console.error(err)
        Logging.error(err);
        Logging.error('Could not connect to session store db');
        process.exit(1);
    }
}
