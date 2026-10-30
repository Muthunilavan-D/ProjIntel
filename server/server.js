const path = require('path');
const dotenv = require('dotenv');
// Load env vars at the very top (checks root .env and local server/.env)
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads folder for uploaded project documents and reviews
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect Database
connectDB();

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'PROJINTEL API is running' });
});

// Authentication Routes (login, register, me, departments)
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Centralized AI Routes
const aiRoutes = require('./routes/aiRoutes');
app.use('/api/ai', aiRoutes);

// Review & Evaluation System Routes
const reviewRoutes = require('./routes/reviewRoutes');
app.use('/api/reviews', reviewRoutes);

// Document Repository & Upload Routes
const documentRoutes = require('./routes/documentRoutes');
app.use('/api/documents', documentRoutes);

// Project Management Routes
const projectRoutes = require('./routes/projectRoutes');
app.use('/api/projects', projectRoutes);

// Milestone Routes
const milestoneRoutes = require('./routes/milestoneRoutes');
app.use('/api/milestones', milestoneRoutes);

// Task Routes
const taskRoutes = require('./routes/taskRoutes');
app.use('/api/tasks', taskRoutes);

// Weekly Progress Routes
const weeklyProgressRoutes = require('./routes/weeklyProgressRoutes');
app.use('/api/weekly-progress', weeklyProgressRoutes);

// User (Student/Faculty) Routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

// Notification Routes
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

// Team Formation & Collaborative Invite Routes
const teamRoutes = require('./routes/teamRoutes');
app.use('/api/teams', teamRoutes);

// Institutional System Academic Settings Routes
const settingRoutes = require('./routes/settingRoutes');
app.use('/api/settings', settingRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
