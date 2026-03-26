import { Router } from 'express';
import {
	acceptAllStaff,
	acceptClient,
	archiveClient,
	acceptStaff,
	getClientDetails,
	listClients,
	listPaperUploads,
	restoreClient,
	reviewPaperUpload,
} from '../controllers/adminController.js';
import { authRequired, requireRole } from '../middlewares/authMiddleware.js';

const adminRouter = Router();

adminRouter.use(authRequired, requireRole(['admin']));
adminRouter.get('/clients', listClients);
adminRouter.get('/clients/:id/details', getClientDetails);
adminRouter.patch('/clients/:id/accept-client', acceptClient);
adminRouter.patch('/clients/:id/accept-staff', acceptStaff);
adminRouter.patch('/clients/:id/archive', archiveClient);
adminRouter.patch('/clients/:id/restore', restoreClient);
adminRouter.patch('/clients/accept-staff-all', acceptAllStaff);
adminRouter.get('/paper-uploads', listPaperUploads);
adminRouter.patch('/paper-uploads/:id/status', reviewPaperUpload);

export default adminRouter;
