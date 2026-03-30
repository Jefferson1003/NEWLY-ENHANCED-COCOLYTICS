import { Router } from 'express';
import { acceptTrader } from '../controllers/clientController.js';
import { clientChatHandlers, uploadMessageImage } from '../controllers/chatController.js';
import { authRequired, requireRole } from '../middlewares/authMiddleware.js';

const clientRouter = Router();

clientRouter.use(authRequired, requireRole(['client']));
clientRouter.post('/accept-trader', acceptTrader);
clientRouter.post('/request-staff', acceptTrader);
clientRouter.get('/messages/contacts', clientChatHandlers.listMessageContacts);
clientRouter.get('/messages/stream', clientChatHandlers.streamMessageEvents);
clientRouter.post('/messages/presence/heartbeat', clientChatHandlers.heartbeatMessagePresence);
clientRouter.get('/messages/:partnerId', clientChatHandlers.listMessagesWithPartner);
clientRouter.post('/messages/:partnerId', (req, res, next) => {
	uploadMessageImage(req, res, (error) => {
		if (error) {
			return res.status(400).json({ error: error.message || 'Invalid upload.' });
		}

		return next();
	});
}, clientChatHandlers.sendMessageToPartner);
clientRouter.post('/messages/:partnerId/call-signal', clientChatHandlers.sendCallSignalToPartner);

export default clientRouter;
