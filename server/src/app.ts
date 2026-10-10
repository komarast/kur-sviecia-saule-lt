import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import type { MeteoService } from './services/meteoService.js';

export type WeatherService = Pick<
  MeteoService,
  'getSunnySummary' | 'getStationsData' | 'findNearestSunny' | 'searchPlaces' | 'getPlaceForecast' | 'refreshAllData'
>;

export interface AppOptions {
  service: WeatherService;
  /** Directory with the built client (index.html). When present it is served with SPA fallback. */
  clientDistDir?: string;
  /** Required for POST /api/refresh. If unset the endpoint is disabled. */
  refreshToken?: string;
  /** Allowed cross-origin origins. Empty/undefined = same-origin only (no CORS headers). */
  corsOrigins?: string[];
  /** Number of reverse proxies in front of the app (for correct client IPs in rate limiting). */
  trustProxy?: number;
  /** Requests per minute per IP for /api. */
  rateLimitPerMinute?: number;
  /** Log one line per request. */
  requestLogging?: boolean;
}

const PLACE_CODE_RE = /^[a-z0-9-]{1,60}$/i;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createApp(options: AppOptions): Express {
  const { service } = options;
  const app = express();

  app.disable('x-powered-by');
  if (options.trustProxy) app.set('trust proxy', options.trustProxy);

  app.use(
    helmet({
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
      },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'https://tile.openstreetmap.org',
            'https://*.tile.openstreetmap.org',
            'https://*.tile.openstreetmap.fr',
            'https://*.basemaps.cartocdn.com',
            'https://basemaps.cartocdn.com'
          ],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"]
        }
      }
    })
  );
  app.use(compression());

  if (options.requestLogging) {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on('finish', () => {
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`);
      });
      next();
    });
  }

  if (options.corsOrigins && options.corsOrigins.length > 0) {
    app.use('/api', cors({ origin: options.corsOrigins }));
  }
  app.use(express.json({ limit: '10kb' }));

  const apiLimiter = rateLimit({
    windowMs: 60_000,
    limit: options.rateLimitPerMinute ?? 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' }
  });
  app.use('/api', apiLimiter);

  // Short browser/CDN caching: data only changes every few minutes anyway
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' && req.path !== '/health') res.set('Cache-Control', 'public, max-age=60');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'kur-sviecia-saule-lt' });
  });

  app.get('/api/sunny-summary', async (_req, res, next) => {
    try {
      const summary = await service.getSunnySummary();
      if (summary.totalStations === 0) {
        res.set('Cache-Control', 'no-store');
        return res.status(503).json({ error: 'Weather data is temporarily unavailable' });
      }
      res.json(summary);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/stations/live', async (_req, res, next) => {
    try {
      const stations = await service.getStationsData();
      if (stations.length === 0) {
        res.set('Cache-Control', 'no-store');
        return res.status(503).json({ error: 'Weather data is temporarily unavailable' });
      }
      res.json({ stations, count: stations.length });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/nearest-sun', async (req, res, next) => {
    try {
      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);
      if (
        req.query.lat === undefined ||
        req.query.lon === undefined ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        Math.abs(lat) > 90 ||
        Math.abs(lon) > 180
      ) {
        return res.status(400).json({ error: 'Valid lat (-90..90) and lon (-180..180) query parameters are required' });
      }
      const result = await service.findNearestSunny({ latitude: lat, longitude: lon });
      if (!result.nearestSunnyStation) {
        res.set('Cache-Control', 'no-store');
        return res.status(503).json({ error: 'Weather data is temporarily unavailable' });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/search', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 60) : '';
    res.json(service.searchPlaces(q));
  });

  app.get('/api/places/forecast/:code', async (req, res, next) => {
    try {
      const code = req.params.code;
      if (!PLACE_CODE_RE.test(code)) {
        return res.status(400).json({ error: 'Invalid place code' });
      }
      const place = await service.getPlaceForecast(code);
      if (!place) return res.status(404).json({ error: 'Place forecast not found' });
      res.json(place);
    } catch (err) {
      next(err);
    }
  });

  const refreshLimiter = rateLimit({
    windowMs: 60_000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many refresh requests' }
  });
  app.post('/api/refresh', refreshLimiter, (req, res) => {
    if (!options.refreshToken) {
      return res.status(404).json({ error: 'Not found' });
    }
    const provided = req.get('x-refresh-token') ?? '';
    if (!safeEqual(provided, options.refreshToken)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    void service.refreshAllData();
    res.status(202).json({ message: 'Refresh triggered' });
  });

  // Unknown API routes -> JSON 404 (never fall through to the SPA)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Built client with SPA fallback
  const indexHtml = options.clientDistDir ? path.join(options.clientDistDir, 'index.html') : null;
  if (options.clientDistDir && indexHtml && fs.existsSync(indexHtml)) {
    app.use(
      '/assets',
      express.static(path.join(options.clientDistDir, 'assets'), { immutable: true, maxAge: '1y' })
    );
    app.use(express.static(options.clientDistDir, { maxAge: '1h', index: false }));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  // Central error handler: log details, never leak internals
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
