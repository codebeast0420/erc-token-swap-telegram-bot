import { Request, Response } from "express";
import { CreatePreAuthInput, CreateSignInAuthInput } from "../schema/auth.schema";
import Logging from "../utils/logging";
import { AuthService } from "../service/auth.service";

export async function preAuthHandler(
    req: Request<{}, {}, CreatePreAuthInput>,
    res: Response
) {

    const device = "";
    const deviceId = "";
    const ip = "";
    try {
        await new AuthService().createPreAuth(
            req.body, ip, device, deviceId, res);
    } catch (e: any) {
        Logging.error(e);
        return res.status(500).send("Internal server error");
    }
}


export async function signInHandler(
    req: Request<{}, {}, CreateSignInAuthInput>,
    res: Response
) {

    const device = "";
    const deviceId = "";
    const ip = "";

    try {
        await new AuthService().signIn(
            req.body, ip, device, deviceId, res);
    }
    catch (e: any) {
        Logging.error(e);
        return res.status(500).send("Internal server error");
    }
}


export async function refreshTokenHandler(
    req: Request<{}, {}, CreateSignInAuthInput>,
    res: Response
) {

}
