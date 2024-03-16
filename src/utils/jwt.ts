import jwt from "jsonwebtoken";
import { Request } from "express";
import Logging from "./logging";

export class Jwt {
    public signJwt(
        object: any,
        keyName:
            | "accessTokenPrivateKey"
            | "refreshTokenPrivateKey"
            | "idTokenPrivateKey",
        options?: jwt.SignOptions | undefined
    ) {
        let key = "";

        if (keyName == "accessTokenPrivateKey") {
            key = process.env.ACCESS_TOKEN_PRIVATE_KEY ?? "";
        } else if (keyName == "refreshTokenPrivateKey") {
            key = process.env.REFRESH_TOKEN_PRIVATE_KEY ?? "";
        } else if (keyName == "idTokenPrivateKey") {
            key = process.env.ID_TOKEN_PRIVATE_KEY ?? "";
        }

        const signingKey = Buffer.from(key, "base64").toString("ascii");

        return jwt.sign(object, signingKey, {
            ...(options && options),
            algorithm: "RS256",
        });
    }

    public verifyJwt<T>(
        token: string,
        keyName:
            | "accessTokenPublicKey"
            | "refreshTokenPublicKey"
            | "idTokenPublicKey"
    ): T | null {
        let key = "";

        if (keyName == "accessTokenPublicKey") {
            key = process.env.ACCESS_TOKEN_PUBLIC_KEY ?? "";
        } else if (keyName == "refreshTokenPublicKey") {
            key = process.env.REFRESH_TOKEN_PUBLIC_KEY ?? "";
        } else if (keyName == "idTokenPublicKey") {
            key = process.env.ID_TOKEN_PUBLIC_KEY ?? "";
        }

        const publicKey = Buffer.from(key, "base64").toString("ascii");

        const decoded = jwt.verify(token, publicKey) as T;
        Logging.info(decoded);
        return decoded;
    }

    public extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers["authorization"]?.split(" ") ?? [];
        return type === "Bearer" ? token : undefined;
    }

    public verifyJwtV2(
        token: string,
        keyName: "accessTokenPublicKey" | "refreshTokenPublicKey" | "idTokenPublicKey"
    ) {

        let key = "";

        if (keyName == "accessTokenPublicKey") {
            key = process.env.ACCESS_TOKEN_PUBLIC_KEY ?? "";
        } else if (keyName == "refreshTokenPublicKey") {
            key = process.env.REFRESH_TOKEN_PUBLIC_KEY ?? "";
        } else if (keyName == "idTokenPublicKey") {
            key = process.env.ID_TOKEN_PUBLIC_KEY ?? "";
        }

        const publicKey = Buffer.from(key, "base64").toString(
            "ascii"
        );

        try {
            const decoded = jwt.verify(token, publicKey);
            return {
                valid: true,
                expired: false,
                decoded,
            };
        } catch (e: any) {
            console.error(e);
            return {
                valid: false,
                expired: e.message === "jwt expired",
                decoded: null,
            };
        }
    }
}
