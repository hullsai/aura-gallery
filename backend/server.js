import express from 'express';
import session from 'express-session';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from './db.js';
import authRoutes from './routes/auth.js';
import imageRoutes from './routes/images.js';
import sharingRoutes from './routes/sharing.js';
import importRoutes from './routes/import.js';
import tagRoutes from './routes/tags.js';
import statsRoutes from './routes/stats.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
await initializeDatabase();
console.log('✓ Database initialized');

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173', // Development
    'http://gallery.aura.thehulls.com', // Production
    'https://gallery.aura.thehulls.com' // If you add HTTPS later
  ],
  credentials: true
}));

app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'aura-gallery-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
    domain: '.aura.thehulls.com'
  }
}));

// Rate limiting for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later'
});

app.use('/api/auth/login', loginLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/sharing', sharingRoutes);
app.use('/api/import', importRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/stats', statsRoutes);

// Serve image files
app.use('/images', express.static('/Users/hullsai/Projects/webapps/aura-gallery/user_images'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🎨 Aura Gallery backend running on http://localhost:${PORT}`);
});