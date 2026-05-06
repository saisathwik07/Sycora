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
  message: { message: 'Too many auth requests from this IP, please try again after 15 minutes' }
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

const PORT = process.env.PORT || 3000;

async function start() {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
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
