import app from './app.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  console.log('Running in DEMO SIMULATION MODE (In-Memory)');
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
