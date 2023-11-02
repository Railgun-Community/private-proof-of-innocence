const express = require('express');
const path = require('path');
const app = express();

// Serve the static files from the React app
app.use('/dashboard', express.static(path.join(__dirname, '../build')));

// The "index.html" file will be served for any get request to '/dashboard'
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

// All other requests related to '/dashboard' should also serve the "index.html" file
app.get('/dashboard/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
