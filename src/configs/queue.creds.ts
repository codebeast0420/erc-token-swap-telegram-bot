import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();
if (process.env.NODE_ENV == ('development' || 'development ')) {
    dotenv.config({ path: path.join(__dirname, '..', '.env.development') });
} else if (process.env.NODE_ENV == ('production' || 'production ')) {
    dotenv.config({ path: path.join(__dirname, '..', '.env') });
} else if (process.env.NODE_ENV == ('staging' || 'staging ')) {
    dotenv.config({ path: path.join(__dirname, '..', '.env.staging') });
}

export const configObject = {
    region: process.env.REGION,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
    }
}




