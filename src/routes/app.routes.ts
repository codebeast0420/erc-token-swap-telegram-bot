import { Express, Router, Request, Response, NextFunction } from 'express';
import Logging from '../utils/logging';

const router = Router();


/** check inbound and outbound requests */
router.use((request: Request, response: Response, next: NextFunction) => {
    const sym = Object.getOwnPropertySymbols(request).find((s) => s.description === 'kHeaders');
    // console.log(sym, request[sym]['x-real-ip'])
    Logging.info(`Inbound -> Method: [${request.method}] - Url: [${request.url}] - IP: [${request.socket.remoteAddress}], ${request[sym]['x-real-ip']}`);

    Logging.info(request.body);

    response.on('finish', () => {
        Logging.info(`OutBound -> Method: [${request.method}] - Url: [${request.url}] - IP: [${request.socket.remoteAddress}] - Status: [${response.statusCode}]`);
    });

    next();
});

/** Rules of our API */
router.use((request: Request, response: Response, next: NextFunction) => {
    response.header('Access-Control-Allow-Origin', '*');
    response.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (request.method == 'OPTIONS') {
        response.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
        return response.status(200).json({});
    }

    next();
});

function routes(app: Express) {

}

module.exports = router;
