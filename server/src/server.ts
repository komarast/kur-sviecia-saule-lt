import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { MeteoService } from './services/meteoService.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const clientDistDir = process.env.CLIENT_DIST || fileURLToPath(new URL('../../client/dist', import.meta.url));
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const service = new MeteoService();

const app = createApp({
  service,
  clientDistDir,
  refreshToken: process.env.REFRESH_TOKEN || undefined,
  corsOrigins,
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : undefined,
  rateLimitPerMinute: process.env.RATE_LIMIT_PER_MINUTE ? Number(process.env.RATE_LIMIT_PER_MINUTE) : undefined,
  requestLogging: process.env.NODE_ENV !== 'test'
});

const server = app.listen(PORT, HOST, () => {
  console.log(`☀️ Kur Šviečia Saulė server running at http://localhost:${PORT}`);
  service.start();
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  service.stop();
  server.close((err) => {
    process.exit(err ? 1 : 0);
  });
  // Force exit if connections refuse to close
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
