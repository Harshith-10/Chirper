module.exports = {
  PORT: process.env.PORT || 5174,
  JWT_SECRET: process.env.JWT_SECRET || 'skylink',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379'
};
