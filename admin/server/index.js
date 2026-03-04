/**
 * Admin API — mounts all admin routes at /api/admin
 */
import express from 'express';
import { requireAuth, requireAdmin } from './middleware.js';
import authRouter from './routes/auth.js';
import statsRouter from './routes/stats.js';
import usersRouter from './routes/users.js';
import adminsRouter from './routes/admins.js';
import transactionsRouter from './routes/transactions.js';
import analysesRouter from './routes/analyses.js';
import activityRouter from './routes/activity.js';
import visitsRouter from './routes/visits.js';
import revenueRouter from './routes/revenue.js';
import configRouter from './routes/config.js';
import healthRouter from './routes/health.js';
import userMessagesRouter from './routes/userMessages.js';

const router = express.Router();

// Verify — requires auth only, returns { ok, isSuperAdmin }
router.use('/', authRouter);

// All other routes require admin
router.use(requireAuth, requireAdmin);
router.use('/stats', statsRouter);
router.use('/users', usersRouter);
router.use('/admins', adminsRouter);
router.use('/transactions', transactionsRouter);
router.use('/analyses', analysesRouter);
router.use('/activity', activityRouter);
router.use('/visits', visitsRouter);
router.use('/revenue', revenueRouter);
router.use('/config', configRouter);
router.use('/health', healthRouter);
router.use('/user-messages', userMessagesRouter);

export default router;
