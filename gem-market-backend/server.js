require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');

const app = express();

connectDB();

app.use(cors());
// Increased limit to 10mb for Base64 image uploads
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => res.json({ status: 'Gem Market backend running' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));