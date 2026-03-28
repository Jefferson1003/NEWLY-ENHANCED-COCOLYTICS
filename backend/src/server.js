import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeDatabase, pool } from './db.js';
import authRouter from './routes/authRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import clientRouter from './routes/clientRoutes.js';
import traderRouter from './routes/traderRoutes.js';
import { apiInfo, health } from './controllers/systemController.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:7904';
const allowedOrigins = CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
const explicitOrigins = new Set();
const wildcardOrigins = [];

for (const origin of allowedOrigins) {
  if (origin.includes('*')) {
    wildcardOrigins.push(origin);
    continue;
  }

  explicitOrigins.add(origin);
}

function isOriginAllowed(origin) {
  if (explicitOrigins.has(origin)) {
    return true;
  }

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  for (const pattern of wildcardOrigins) {
    const wildcardMatch = pattern.match(/^(https?):\/\/\*\.(.+)$/i);
    if (!wildcardMatch) {
      continue;
    }

    const [, protocol, hostSuffix] = wildcardMatch;
    if (parsedOrigin.protocol === `${protocol.toLowerCase()}:` && parsedOrigin.hostname.endsWith(`.${hostSuffix.toLowerCase()}`)) {
      return true;
    }
  }

  return false;
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const productUploadsDir = path.resolve(__dirname, '../../frontend/public/uploads/products_img');
const profileUploadsDir = path.resolve(__dirname, '../../frontend/public/uploads/profile_img');
const paperUploadsDir = path.resolve(__dirname, '../../frontend/public/uploads/paper_docs');
const messengerUploadsDir = path.resolve(__dirname, '../../frontend/public/uploads/messenger');

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads/products_img', express.static(productUploadsDir));
app.use('/uploads/profile_img', express.static(profileUploadsDir));
app.use('/uploads/paper_docs', express.static(paperUploadsDir));
app.use('/uploads/messenger', express.static(messengerUploadsDir));

app.get('/', (req, res) => {
  res.json({
    message: 'Cocolytics backend is running.',
    api: '/api',
    health: '/api/health',
  });
});
app.get('/api/health', health);
app.get('/api', apiInfo);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/client', clientRouter);
app.use('/api/trader', traderRouter);

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
  });
});

async function startServer() {
  try {
    await initializeDatabase();
    await pool.query('SELECT 1');
    app.listen(PORT, () => {
      console.log(`Backend listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start backend:', error.message);
    process.exit(1);
  }
}

startServer();
