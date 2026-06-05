const express = require('express');

const usersRoutes = require('./routes/users.routes');

const app = express();

app.use(express.json());

// Healthcheck
app.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'UP',
    timestamp: new Date()
  });
});

app.use('/users', usersRoutes);

module.exports = app;