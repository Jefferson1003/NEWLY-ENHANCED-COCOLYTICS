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
import { adminChatHandlers, uploadMessageImage } from '../controllers/chatController.js';
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
adminRouter.get('/messages/contacts', adminChatHandlers.listMessageContacts);
adminRouter.get('/messages/stream', adminChatHandlers.streamMessageEvents);
adminRouter.post('/messages/presence/heartbeat', adminChatHandlers.heartbeatMessagePresence);
adminRouter.get('/messages/:partnerId', adminChatHandlers.listMessagesWithPartner);
adminRouter.post('/messages/:partnerId', (req, res, next) => {
	uploadMessageImage(req, res, (error) => {
		if (error) {
			return res.status(400).json({ error: error.message || 'Invalid upload.' });
		}

		return next();
	});
}, adminChatHandlers.sendMessageToPartner);
adminRouter.post('/messages/:partnerId/call-signal', adminChatHandlers.sendCallSignalToPartner);

export default adminRouter;
