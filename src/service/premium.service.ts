import { IPremium, PremiumModel } from '../models/premium.model';
import Logging from '../utils/logging';
import { getAppUser } from './app.user.service';

export class PremiumService {
    public async getPremium(telegramId: string): Promise<IPremium> {
        const user = await getAppUser(telegramId);
        let response: IPremium = {};
        await PremiumModel.findOne({ owner: user._id })
            .then((premium) => {
                response = premium;
            })
            .catch((err) => {
                console.error(`==> ${new Date().toLocaleString()}`)
                console.error(err)
                Logging.error(err);
                response = {};
            });
        return response;
    }
}
