
import Logging from "../utils/logging";
import { Response } from "express";
import { getAppUser } from "./app.user.service";
import { AuthModel } from "../models/auth.model";
import { generateSlug } from "random-word-slugs";
import argon2 from "argon2";
import { BotMessage } from "./api.bot.message";
import { ApiBotPush, IApiSendMessage } from "./api.bot.push";
import { DEFAULT_API_SESSION_TIMEOUT, cautionEmoji, crossEmoji } from "../utils/common";
import { Jwt } from "../utils/jwt";
import IdAccessTokenInterface from "../interface/id.access.token.interface";
import { SessionModel } from "../models/session.model";
import RefreshTokenInterface from "../interface/refresh.token.interface";
import IdAccessRefreshTokenResponse from "../interface/id.access.refresh.token.response";


export class AuthService {


    async createPreAuth(
        input: any,
        ip: string,
        device: string,
        deviceId: string,
        res: Response,
    ): Promise<void> {
        Logging.info("Enter AuthService.class -> createPreAuth()");
        if (input.sId == null) {
            res.status(409).send("ChartAi Id Required");
            return;
        }

        const userExists = await getAppUser(`${input.sId}`);

        if (!userExists) {
            res.status(409).send("User not found");
            return;
        }

        const authExists = await this.getAuthByOwnerId(
            userExists._id?.toString()
        );

        const signInKey = this.generateSignInKey();

        await this.createUpdateAuthRequest(
            userExists,
            signInKey,
            authExists
        );



        const signInKeyShuffled = signInKey?.split(" ");

        signInKeyShuffled?.sort(() => (Math.random() > 0.5 ? 1 : -1));

        await this.sendOTP(userExists, signInKey, ip, device);


        res.status(201).send({
            message: "Pre-Auth request sent to bot",
            challenge: signInKeyShuffled.join(" "),
        })
    }

    async getAuthByOwnerId(owner?: string): Promise<any> {
        return await AuthModel.findOne({ owner: owner }).exec();
    }

    private generateSignInKey(): string {
        let duplicated = true;
        let key = "";

        while (duplicated) {
            const temp = this.generateKey().split(" ");
            Logging.info(`Generated Sign in key:${temp}`);

            const findDuplicates = (arr: any) =>
                arr.filter((item: any, index: any) => arr.indexOf(item) !== index);

            const duplicates = findDuplicates(temp);

            if (duplicates.length == 0) {
                duplicated = false;
                key = temp.join(" ");
            }
        }

        return key;
    }

    private generateKey() {
        return generateSlug(9, { format: "title" });
    }

    private async createUpdateAuthRequest(
        user: any,
        signInKey: string,
        auth?: any
    ): Promise<any> {
        const authCode = Math.floor(100000 + Math.random() * 900000);
        const verificationCode = Math.floor(100000 + Math.random() * 900000);

        if (auth == null) {
            auth = await this.createAuth(
                user._id?.toString(),
                signInKey,
                authCode,
                verificationCode
            );
        } else {
            auth.signInKey = signInKey;
            auth.authCode = authCode;
            auth.verificationCode = verificationCode;
            auth.createdDate = new Date();
            await this.updateAuthSignInKey(auth);
        }

        return auth;
    }


    async createAuth(
        owner: string,
        signInKey: string,
        authCode?: number,
        verificationCode?: number
    ): Promise<any> {
        signInKey = await argon2.hash(signInKey);
        return await AuthModel.create({
            owner: owner,
            signInKey: signInKey,
            authCode: authCode,
            verificationCode: verificationCode,
            sessions: null,
            createdDate: Date.now(),
            verified: null,
        });
    }


    async updateAuthSignInKey(auth: any) {
        auth.signInKey = await argon2.hash(auth.signInKey);
        return await AuthModel
            .updateOne({ _id: auth._id?.toString() }, new AuthModel(auth), {
                new: true,
            })
            .exec();
    }


    private async sendOTP(
        user: any,
        signInKey: string,
        ip: string,
        device: string
    ) {

        const message: IApiSendMessage = {
            type: 1000,
            telegramId: user.telegramId,
            body: new BotMessage().preAuthMessage(signInKey, ip, device),
            parseMode: "HTML",
        }

        return await new ApiBotPush().sendMessage(message);
    }

    async signIn(
        input: any,
        ip: string,
        device: string,
        deviceId: string,
        res: Response,
    ) {

        if (input.signInKey.split(" ").length < 9) {
            res.status(409).send(`${cautionEmoji} Invalid Sign in key`);
            return;

        }

        const user = await getAppUser(`${input.sId}`);

        if (!user) {
            res.status(409).send(`${cautionEmoji} User not found: ${input.sId}`);
            return;
        }

        const authDb = await this.getAuthByOwnerId(user._id.toString());

        if (authDb == null) {
            res.status(500).send(
                `${crossEmoji} Oops something went wrong`
            );

            return;
        }


        const authDbCreatedDate = authDb.createdDate.setSeconds(
            authDb.createdDate.getSeconds() + DEFAULT_API_SESSION_TIMEOUT
        ); // add 120 secs
        const createdDate = new Date(authDbCreatedDate);


        if (createdDate <= new Date()) {
            res.status(409).send(`${crossEmoji} Request timeout`);
            return;
        }

        const isValidSignInKey = await argon2.verify(
            authDb.signInKey,
            input.signInKey
        );


        if (!isValidSignInKey) {
            res.status(409).send(`${crossEmoji} Invalid Sign In key`);
            return;
        }

        //id token
        const idToken = this.signIdToken(user);

        // sign access token
        const accessToken = this.signAccessToken(user);

        // create session
        const session = await this.createSession(deviceId, device);

        if (authDb.sessions == null) {
            authDb.sessions = [];
            authDb.sessions.push(session);
            await authDb.save();
        } else {
            authDb.sessions.push(session);
            await authDb.save();
        }


        // sign refresh token
        const refreshToken = this.signRefreshToken(user, session._id.toString());


        if (!idToken || !accessToken || !refreshToken) {
            res.status(409).send(
                `${crossEmoji} Oops something went wrong generating keys`
            );

            return;
        }


        const response: IdAccessRefreshTokenResponse = {
            firstName: user.firstName,
            lastName: user.lastName,
            idToken: idToken,
            accessToken: accessToken,
            refreshToken: refreshToken,
            userName: user.userName,
        };


        res.status(200).send(response);
    }

    private signIdToken(user: any) {
        return new Jwt().signJwt(
            this.generateIdAccessTokenPayload(user, "Id"),
            "idTokenPrivateKey",
            { expiresIn: process.env.ID_TOKEN_EXPIRES_IN }
        );
    }

    private signAccessToken(user: any) {
        return new Jwt().signJwt(
            this.generateIdAccessTokenPayload(user, "Access"),
            "accessTokenPrivateKey",
            { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN }
        );
    }


    private generateIdAccessTokenPayload(user: any, type: "Id" | "Access") {
        const payload: IdAccessTokenInterface = {
            sub: user._id.toString(),
            aud: "ChartAI Snipper",
            tokenUse: type,
            iss: "https://chartai.tech",
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.userName,
        };

        return payload;
    }

    async createSession(deviceId: string, deviceName: string): Promise<any> {
        return await SessionModel.create({
            deviceId: deviceId,
            deviceName: deviceName,
            valid: true,
        });
    }


    private signRefreshToken(user: any, sessionId: string) {
        return new Jwt().signJwt(
            this.generateRefreshTokenPayload(user, sessionId),
            "refreshTokenPrivateKey",
            { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN }
        );
    }


    private generateRefreshTokenPayload(user: any, sessionId: string) {
        const payload: RefreshTokenInterface = {
            sub: user._id.toString(),
            aud: "ChartAI Snipper",
            iss: "https://chartai.tech",
            session: sessionId,
        };

        return payload;
    }
}