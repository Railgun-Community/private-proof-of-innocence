const express = require('express');
const path = require('path');

const app = express();

// Serve the static files
app.use(express.static(path.join(__dirname, '../build')));

// Handle React routing, return all requests to React app
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

// Handle React routing, return all requests to React app
app.get('/dashboard/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

// Show the health status of the dashboard
app.get('/dashHealth', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
