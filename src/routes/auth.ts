import { Router } from 'express';
import validateResource from '../middleware/validate.resource';
import { preAuthSchema, refreshTokenSchema, signInSchema } from '../schema/auth.schema';
import { preAuthHandler, refreshTokenHandler, signInHandler } from '../controller/auth.controller';

const router = Router();

/**
 * @swagger
 * /auth/pre-auth:
 *  post:
 *     tags:
 *       - Authentication
 *     summary: Pre Authentication
 *     requestBody: 
 *       required: true
 *       content: 
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PreAuthInput'
 *     responses:
 *       200:
 *         description: Success
 *         content: 
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PreAuthResponse'
 *       409:
 *         description: Conflict
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal server error
 */
router.post('/pre-auth', validateResource(preAuthSchema), preAuthHandler);


/**
 * @swagger
 * /auth/sign-in:
 *  post:
 *     tags:
 *       - Authentication
 *     summary: Sign In
 *     requestBody: 
 *       required: true
 *       content: 
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignInInput'
 *     responses:
 *       200:
 *         description: Success
 *         content: 
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SignInResponse'
 *       409:
 *         description: Conflict
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal server error
 */
router.post("/sign-in", validateResource(signInSchema), signInHandler);

/**
 * @swagger
 * /auth/sign-in:
 *  post:
 *     tags:
 *       - Authentication
 *     summary: Refresh Token
 *     requestBody: 
 *       required: true
 *       content: 
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignInInput'
 *     responses:
 *       200:
 *         description: Success
 *         content: 
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SignInResponse'
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Conflict
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal server error
 */
router.post("/refresh", validateResource(refreshTokenSchema), refreshTokenHandler);

module.exports = router;