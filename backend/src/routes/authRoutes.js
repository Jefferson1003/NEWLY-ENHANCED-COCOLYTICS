import { Router } from 'express';
import {
	forgotPasswordRequestOtp,
	forgotPasswordReset,
	forgotPasswordVerifyOtp,
	login,
	me,
	register,
	resendVerifyOtp,
	verifyEmailOtp,
} from '../controllers/authController.js';
import { authRequired } from '../middlewares/authMiddleware.js';

const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/verify-email/resend', resendVerifyOtp);
authRouter.post('/verify-email/confirm', verifyEmailOtp);
authRouter.post('/forgot-password/request-otp', forgotPasswordRequestOtp);
authRouter.post('/forgot-password/verify-otp', forgotPasswordVerifyOtp);
authRouter.post('/forgot-password/reset', forgotPasswordReset);
authRouter.get('/me', authRequired, me);

export default authRouter;
