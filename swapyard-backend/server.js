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

// Middleware
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
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

// PORT - only declared once
const PORT = process.env.PORT || 3000;

// Start server
(async () => {
  try {
    await connectDB(process.env.MONGODB_URI);
    app.listen(PORT, () => console.log(`✅ API listening on port ${PORT}`));
  } catch (e) {
    console.error('Startup error', e);
    process.exit(1);
  }
})();

