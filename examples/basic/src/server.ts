import { Hono } from 'hono';
import { registerRoutes } from './routes.generated.js';

export const app = new Hono();

// Register Ahead-of-Time static routes
registerRoutes(app);

// Simple health probe
app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
