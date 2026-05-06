require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/database');
const swaggerUI = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const registerApiRoutes = require('./routes');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Railway / reverse proxies: required so req.ip, secure cookies, and express-rate-limit work.
// Set TRUST_PROXY=false locally only if you hit odd req.ip behavior.
if (process.env.TRUST_PROXY !== 'false') {
  const hops = parseInt(process.env.TRUST_PROXY ?? '1', 10);
  app.set('trust proxy', Number.isFinite(hops) && hops >= 0 ? hops : 1);
}

app.use(helmet());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Too many auth requests from this IP, please try again after 15 minutes' },
  // Browser OAuth redirects must never stall behind rate-limit internals on Railway/proxies.
  skip: (req) => {
    const url = req.originalUrl || req.url || '';
    return req.method === 'GET' && url.includes('/api/auth/google');
  },
});

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

const swaggerOptions = {
  customCss: '.swagger-ui .topbar { background-color: #24292e; } .swagger-ui .topbar .download-url-wrapper .select-label select { border: 2px solid #4caf50; } .swagger-ui .info .title { color: #333; } .swagger-ui .scheme-container { background-color: #f5f5f5; }',
  customSiteTitle: 'Syncora API Documentation',
  customfavIcon: '/favicon.ico',
  explorer: true,
};

app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec, swaggerOptions));

registerApiRoutes(app);

app.get('', (req, res) => {
    res.send('API is running... <br><a href="/api-docs">View API Documentation</a>');
});

const PORT = Number(process.env.PORT) || 8080;

async function start() {
  await connectDB();

  const host = process.env.LISTEN_HOST || '0.0.0.0';
  const server = app.listen(PORT, host, () => {
    console.log(`Server listening on ${host}:${PORT}`);
    console.log(`API docs: ${process.env.API_PUBLIC_URL || `http://localhost:${PORT}`}/api-docs`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Port ${PORT} is already in use. Stop the other Node/process using it or set PORT in .env.`
      );
    } else {
      console.error('HTTP server error:', err.message || err);
    }
    process.exit(1);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message || err);
  process.exit(1);
});
