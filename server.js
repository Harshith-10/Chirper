const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const { createAdapter } = require('@socket.io/redis-adapter');
const { PORT } = require('./config');
const { getRedisClient } = require('./config/redis');
const rateLimiter = require('./middlewares/rateLimiter');
const socketController = require('./controllers/socketController');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  }
});

// Set up Redis adapter for Socket.IO when Redis is available
(async () => {
  try {
    const pubClient = await getRedisClient();
    if (pubClient) {
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.IO Redis adapter enabled');
    } else {
      console.log('Socket.IO using in-memory adapter (Redis not available)');
    }
  } catch (error) {
    console.error('Failed to set up Socket.IO Redis adapter:', error);
    console.log('Socket.IO using in-memory adapter as fallback');
  }
})();

// Enable trust proxy for express-rate-limit to work correctly behind a proxy
app.set('trust proxy', true);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimiter);
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
  res.send('Signaling server is up and running!');
});

app.post('/auth/token', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    res.json({
      message: 'Authentication endpoint ready. Use socket connection for actual auth.'
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO
socketController(io);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Signaling server running on http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  
  // Close Redis connections
  (async () => {
    try {
      await require('./config/redis').closeRedisConnection();
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  })();
  
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
