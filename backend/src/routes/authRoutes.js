import { Router } from 'express';
import { login, me, register } from '../controllers/authController.js';
import { authRequired } from '../middlewares/authMiddleware.js';

const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.get('/me', authRequired, me);

export default authRouter;
