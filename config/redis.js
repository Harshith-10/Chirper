const { createClient } = require('redis');
const { REDIS_URL } = require('./index');

let redisClient = null;

/**
 * Get Redis client instance (singleton pattern)
 * @returns {Object} Redis client
 */
async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          // Exponential backoff with max delay of 10 seconds
          const delay = Math.min(Math.pow(2, retries) * 100, 10000);
          return delay;
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis client error', err);
    });

    redisClient.on('connect', () => {
      console.log('Connected to Redis server');
    });

    redisClient.on('reconnecting', () => {
      console.log('Reconnecting to Redis server...');
    });

    try {
      await redisClient.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      // If Redis connection fails, create a fallback memory store
      console.log('Using memory store fallback');
      redisClient = null;
      return null;
    }
  }

  return redisClient;
}

/**
 * Close Redis client connection
 */
async function closeRedisConnection() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('Redis connection closed');
  }
}

module.exports = {
  getRedisClient,
  closeRedisConnection
};