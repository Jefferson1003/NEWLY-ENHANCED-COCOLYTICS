import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:7904';

app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'backend',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api', (_req, res) => {
  res.status(200).json({
    message: 'Cocolytics backend API is running.',
    docs: '/api/health',
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
  });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
