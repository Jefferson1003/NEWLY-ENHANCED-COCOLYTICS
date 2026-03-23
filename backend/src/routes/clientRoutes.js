import { Router } from 'express';
import { acceptTrader } from '../controllers/clientController.js';
import { authRequired, requireRole } from '../middlewares/authMiddleware.js';

const clientRouter = Router();

clientRouter.use(authRequired, requireRole(['client']));
clientRouter.post('/accept-trader', acceptTrader);
clientRouter.post('/request-staff', acceptTrader);

export default clientRouter;
