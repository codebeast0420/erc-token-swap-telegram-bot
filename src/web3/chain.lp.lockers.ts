import { LpLockerModel } from '../models/lp.lockers.model';
import Logging from '../utils/logging';
import { lpLockersConfig } from './chain.config';

export async function loadLpLockers() {
    Logging.info('loading lp lockers');
    for (const lpLock in lpLockersConfig) {
        const item = lpLockersConfig[lpLock];
        await LpLockerModel.countDocuments({ address: item.address }).then(async (res) => {
            if (res === 0) {
                const newLpLocker = new LpLockerModel({
                    chain: item.chain,
                    name: lpLock,
                    address: item.address,
                    topic: item.topic
                });

                await newLpLocker.save();
                Logging.info(`New lp locker ${lpLock} added`);
            } else {
                await LpLockerModel.findOneAndUpdate(
                    { address: item.address },
                    {
                        chain: item.chain,
                        name: lpLock,
                        address: item.address,
                        topic: item.topic
                    }
                );
                Logging.info(`locker ${lpLock} updated`);
            }
        });
    }
}
