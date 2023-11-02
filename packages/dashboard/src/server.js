const express = require('express');
const path = require('path');
const app = express();

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Serve the static files from the 'build' directory
app.use('/dashboard', express.static(path.join(__dirname, '../build')));

// Make sure that requests to /dashboard are handled by returning the index.html file
// app.get('/dashboard/*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../build', 'index.html'));
// });
app.get('/dashboard/*', (req, res) => {
  const indexPath = path.join(__dirname, '../build', 'index.html');
  console.log(`Serving index path: ${indexPath}`);
  res.sendFile(indexPath);
});

// Health check route
app.get('/dashHealth', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
