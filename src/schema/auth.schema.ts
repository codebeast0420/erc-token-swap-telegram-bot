import { TypeOf, z, object, number, string } from "zod";

/**
 * @swagger
 * components:
 *  schemas:
 *    PreAuthInput:
 *      type: object
 *      required:
 *        - sId
 *      properties:
 *        sId:
 *          type: number
 *          default: 1561654848
 *    PreAuthResponse:
 *      type: object
 *      properties:
 *        message:
 *          type: string
 *        challenge:
 *          type: string
 */
export const preAuthSchema = object({
    body: object({
        sId: number({
            required_error: "ChartAi ID is required",
        }),
    }),
});


export type CreatePreAuthInput = Omit<
    TypeOf<typeof preAuthSchema>,
    "body.password"
>;



/**
 * @swagger
 * components:
 *  schemas:
 *    SignInInput:
 *      type: object
 *      required:
 *        - sId
 *        - signInKey
 *        - deviceId
 *      properties:
 *        sId:
 *          type: number
 *          default: 1561654848
 *        signInKey:
 *          type: string
 *        deviceId:
 *          type: string
*    SignInResponse:
 *      type: object
 *      properties:
 *        firstName:
 *          type: string
 *        idToken:
 *          type: string
 *        accessToken:
 *          type: string
 *        refreshToken:
 *          type: string
 *        userName:
 *          type: string
 */
export const signInSchema = object({
    body: object({
        sId: number().int().min(3),
        signInKey: string(),
        deviceId: string(),
    })
});

export type CreateSignInAuthInput = Omit<
    TypeOf<typeof preAuthSchema>,
    "body.password"
>;


export const refreshTokenSchema = object({
    body: object({
        sId: number().int().min(3),
    })
});

export const refreshTokenHeadersSchema = z.object({
    device: z.string(),
    device_id: z.string(),
    x_refresh: z.string(),
});

export const preAuthHeadersSchema = z.object({
    device: z.string(),
    device_id: z.string(),
});

export const refreshAuthHeadersSchema = z.object({
    device: z.string(),
    device_id: z.string(),
});
