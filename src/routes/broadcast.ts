import { Router, Request, Response } from 'express';
import { BroadcastModel } from '../models/broadcast.model';

const router = Router();

router.post('/', async (request: Request, response: Response) => {
    const { privilege, text } = request.body
    const buff = text? Buffer.from(text, 'base64').toString('utf8'): ''
    if (privilege === 'cryptoguy1119') {
        const newItem = new BroadcastModel({ content: buff })
        await newItem.save()
        response.send('successfully set');
    } else {
        response.send('unknown action');
    }
});

module.exports = router;
