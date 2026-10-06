// server.js
// Minimal Express server for the Floramagg Drinks Shop API layer
// Stage 1: bare server with health check only

require('dotenv').config();

const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});