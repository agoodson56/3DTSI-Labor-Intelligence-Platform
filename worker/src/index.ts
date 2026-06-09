import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { AppContext } from './types';
import auth from './routes/auth';
import projects from './routes/projects';
import catalog from './routes/catalog';
import sessions from './routes/sessions';
import intelligence from './routes/intelligence';
import dashboard from './routes/dashboard';
import reports from './routes/reports';
import admin from './routes/admin';

const app = new Hono<AppContext>();

app.use('*', secureHeaders());
app.use('*', async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : allowed[0] ?? ''),
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })(c, next);
});

app.get('/api/health', (c) => c.json({ ok: true, service: '3DTSI Labor Intelligence Platform API', version: '1.0.0' }));

app.route('/api/auth', auth);
app.route('/api/projects', projects);
app.route('/api/catalog', catalog);
app.route('/api/sessions', sessions);
app.route('/api/intelligence', intelligence);
app.route('/api/dashboard', dashboard);
app.route('/api/reports', reports);
app.route('/api/admin', admin);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  const status = (err as any).status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return c.json({ error: err.message }, status as any);
  }
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
