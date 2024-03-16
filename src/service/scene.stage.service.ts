import { AffiliateRenameListener } from "../commands/actions/affiliate/listeners/affiliate.rename.listener";
import { AffiliateSetupListener } from "../commands/actions/affiliate/listeners/affiliate.setup.listener";
import { AutoBuyListener } from "../commands/actions/auto/autobuy.processor";
import { AutoSellListener } from "../commands/actions/auto/autosell.processor";
import { CopyTradeListener } from "../commands/actions/copytrade/copytrade.processor";
import { ManualTradeListener } from "../commands/actions/trade/manual.trade.processor";
import { SettingsListener } from "../commands/actions/settings/settings.processor";
import { SnipeValuesListener } from "../commands/actions/snipe/snipe.values.processor";
import { TokenBuyXETHAmountListener, TokenBuyXTokenAmountListener } from "../commands/actions/token/token.buy.processor";
import { TokenSellXEthAmountListener, TokenSellXTokenAmountListener } from "../commands/actions/token/token.sell.processor";
import { MultiWalletTransferNativeCurrencyListener } from "../commands/actions/transfer/multi.wallet.transfer/multi.wallet.transfer.nativecurrency.listener";
import { MultiWalletTransferTokenListener } from "../commands/actions/transfer/multi.wallet.transfer/multi.wallet.transfer.token.listener";
import { TransferNativeCurrencyToListener } from "../commands/actions/transfer/transfer.nativecurrency.listener";
import { TransferTokenTokenListener } from "../commands/actions/transfer/transfer.token.listener";
import { PvKeyMnemonicListener } from "../commands/actions/wallet/pvkey.mnemonic.listener";
import { PvKeyMnemonicMultiWalletConnectListener } from "../commands/actions/wallet/pvkey.mnemonic.multi.wallet.connect.listener";
import { PvKeyMnemonicMultiWalletGenerateListener } from "../commands/actions/wallet/pvkey.mnemonic.multi.wallet.generate.listener";
import { RenameMultiWalletListener } from "../commands/actions/wallet/rename.multi.wallet.listener";
import { IAppUser } from "../models/app.user.model";
import { ISceneStage, SceneStageModel } from "../models/scene.stage.model";
import { AFFILIATE_RENAME_LISTENER, AFFILIATE_SETUP_LISTENER, AUTO_BUY_LISTENER, AUTO_SELL_LISTENER, COPY_TRADE_LISTENER, MANUAL_TRADE_LISTENER, MULTI_WALLET_TRANSFER_NATIVE_CURRENCY_LISTENER, MULTI_WALLET_TRANSFER_TOKEN_LISTENER, PV_KEY_MNEMONIC_MULTI_WALLET_CONNECT_LISTENER, PV_KEY_MNEMONIC_MULTI_WALLET_GENERATE_LISTENER, RENAME_MULTI_WALLET_LISTENER, SETTINGS_LISTENER, SNIPE_INPUT_LISTENER, TOKEN_BUY_X_AMOUNT_LISTENER, TOKEN_BUY_X_TOKEN_AMOUNT_LISTENER, TOKEN_SELL_X_ETH_AMOUNT_LISTENER, TOKEN_SELL_X_TOKEN_AMOUNT_LISTENER, TRANSFER_NATIVE_CURRENCY_LISTENER, TRANSFER_TOKEN_TOKEN_LISTENER, WALLET_KEY_LISTENER } from "../utils/common";
import Logging from "../utils/logging";
import { getAppUser } from "./app.user.service";


export interface ISceneResponse {
    appUser?: IAppUser;
    scene?: ISceneStage
}

export class SceneStageService {
    public async getSceneStage(telegramId: string) {
        const user = await getAppUser(telegramId);
        let response: ISceneResponse = {};
        response.appUser = user
        await SceneStageModel.findOne({ owner: user._id.toString() }).then(res => {
            response.scene = res
        }).catch((err) => {
            console.error(`==> ${new Date().toLocaleString()}`)
            console.error(err)
            Logging.error(`[getSceneStage] ${err.message}`);
        });
        return response
    }


    public async saveScene(telegramId: string, name: string, text: string, updateDate: Date) {
        const user = await getAppUser(telegramId);
        if (0 === (await SceneStageModel.countDocuments({ owner: user._id }))) {
            const wallet = new SceneStageModel({
                owner: user._id,
                name: name,
                text: text,
                date: new Date(),
            });

            await wallet.save();
        } else {
            await SceneStageModel.findOneAndUpdate({ owner: user._id }, {
                name: name,
                text: text,
                date: updateDate,
            })
        }
    }

    public async deleteScene(telegramId: string) {
        const user = await getAppUser(telegramId);
        await SceneStageModel.deleteOne({ owner: user._id }).then(res => {
            return res;
        }).catch((err) => {
            console.error(`==> ${new Date().toLocaleString()}`)
            console.error(err)
            Logging.error(`[deleteScene] ${err.message}`);
        });
    }


    public async processSceneStage(telegramId: string, text: string, scene: ISceneResponse, ctx: any) {
        if (scene != null) {
            if (scene.scene.name === WALLET_KEY_LISTENER) {
                await new PvKeyMnemonicListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name === TRANSFER_NATIVE_CURRENCY_LISTENER) {
                await new TransferNativeCurrencyToListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name === TRANSFER_TOKEN_TOKEN_LISTENER) {
                await new TransferTokenTokenListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name === TOKEN_BUY_X_AMOUNT_LISTENER) {
                await new TokenBuyXETHAmountListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name === TOKEN_BUY_X_TOKEN_AMOUNT_LISTENER) {
                await new TokenBuyXTokenAmountListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name === TOKEN_SELL_X_ETH_AMOUNT_LISTENER) {
                await new TokenSellXEthAmountListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name === TOKEN_SELL_X_TOKEN_AMOUNT_LISTENER) {
                await new TokenSellXTokenAmountListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name === PV_KEY_MNEMONIC_MULTI_WALLET_CONNECT_LISTENER) {
                await new PvKeyMnemonicMultiWalletConnectListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name === PV_KEY_MNEMONIC_MULTI_WALLET_GENERATE_LISTENER) {
                await new PvKeyMnemonicMultiWalletGenerateListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name === RENAME_MULTI_WALLET_LISTENER) {
                await new RenameMultiWalletListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name === MULTI_WALLET_TRANSFER_NATIVE_CURRENCY_LISTENER) {
                await new MultiWalletTransferNativeCurrencyListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name === MULTI_WALLET_TRANSFER_TOKEN_LISTENER) {
                await new MultiWalletTransferTokenListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name === AFFILIATE_SETUP_LISTENER) {
                await new AffiliateSetupListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name === AFFILIATE_RENAME_LISTENER) {
                await new AffiliateRenameListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name === MANUAL_TRADE_LISTENER) {
                await new ManualTradeListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name == SETTINGS_LISTENER) {
                await new SettingsListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name == AUTO_BUY_LISTENER) {
                await new AutoBuyListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name == AUTO_SELL_LISTENER) {
                await new AutoSellListener().processMessage(telegramId, scene, text, ctx)
            }
            else if (scene.scene.name == SNIPE_INPUT_LISTENER) {
                await new SnipeValuesListener().processMessage(telegramId, scene, text, ctx)
            } else if (scene.scene.name === COPY_TRADE_LISTENER) {
                await new CopyTradeListener().processMessage(telegramId, scene, text, ctx)
            }
        }
    }
}