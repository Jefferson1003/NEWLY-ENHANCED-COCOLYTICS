import { Router } from 'express';
import {
	acceptClient,
	acceptStaff,
	listClients,
	listPaperUploads,
	reviewPaperUpload,
} from '../controllers/adminController.js';
import { authRequired, requireRole } from '../middlewares/authMiddleware.js';

const adminRouter = Router();

adminRouter.use(authRequired, requireRole(['admin']));
adminRouter.get('/clients', listClients);
adminRouter.patch('/clients/:id/accept-client', acceptClient);
adminRouter.patch('/clients/:id/accept-staff', acceptStaff);
adminRouter.get('/paper-uploads', listPaperUploads);
adminRouter.patch('/paper-uploads/:id/status', reviewPaperUpload);

export default adminRouter;
