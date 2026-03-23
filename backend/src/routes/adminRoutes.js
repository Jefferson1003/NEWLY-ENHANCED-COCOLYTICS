import { Router } from 'express';
import { acceptClient, acceptStaff, listClients } from '../controllers/adminController.js';
import { authRequired, requireRole } from '../middlewares/authMiddleware.js';

const adminRouter = Router();

adminRouter.use(authRequired, requireRole(['admin']));
adminRouter.get('/clients', listClients);
adminRouter.patch('/clients/:id/accept-client', acceptClient);
adminRouter.patch('/clients/:id/accept-staff', acceptStaff);

export default adminRouter;
