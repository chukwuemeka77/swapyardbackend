require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/auth');
const usersRoutes = require('./src/routes/users');
const paymentsRoutes = require('./src/routes/payments');
const makeNotificationsRouter = require('./src/routes/notifications');

const app = express();

// Helmet + logging
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// CORS setup
// You can add multiple origins, comma-separated in .env (e.g., localhost + Netlify)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS not allowed'));
    },
    credentials: true
  })
);

// Health check
app.get('/', (_, res) => res.json({ ok: true, name: 'Swapyard API' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/notifications', makeNotificationsRouter(paymentsRoutes));

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set in environment variables');
    }
    await connectDB(process.env.MONGODB_URI);
    app.listen(PORT, () => console.log(`✅ API listening on port ${PORT}`));
  } catch (e) {
    console.error('Startup error', e);
    process.exit(1);
  }
})();

app.get('/', (_, res) => res.json({ ok: true, name: 'Swapyard API' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/notifications', makeNotificationsRouter(paymentsRoutes));

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await connectDB(process.env.MONGODB_URI);
    app.listen(PORT, () => console.log(`✅ API listening on :${PORT}`));
  } catch (e) {
    console.error('Startup error', e);
    process.exit(1);
  }
})();
