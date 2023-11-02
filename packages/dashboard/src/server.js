const express = require('express');
const path = require('path');
const app = express();

// Serve the static files from the 'build' directory
app.use('/dashboard', express.static(path.join(__dirname, '../build')));

// Make sure that requests to /dashboard are handled by returning the index.html file
app.get('/dashboard/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

// Health check route
app.get('/dashHealth', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
