const Redis = require('ioredis');
const logger = require('../config/logger');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new Redis(redisUrl, {
  retryStrategy(times) {
    if (times > 3) {
      logger.warn('Redis connection failed, gracefully degrading cache features.');
      return null; // Stop retrying
    }
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 1
});

redis.on('error', (error) => {
  if (error.code !== 'ECONNREFUSED') {
    logger.error('Redis error: ', error);
  }
});

redis.on('connect', () => {
  logger.info('Connected to Redis server');
});

class CacheService {
  /**
   * Set cache with expiry (in seconds)
   */
  static async set(key, value, expiry = 3600) {
    if (redis.status !== 'ready') return false;
    try {
      await redis.set(key, JSON.stringify(value), 'EX', expiry);
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get cached value
   */
  static async get(key) {
    if (redis.status !== 'ready') return null;
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete specific key
   */
  static async del(key) {
    if (redis.status !== 'ready') return false;
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache del error for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Delete keys by pattern using non-blocking SCAN stream
   */
  static async delPattern(pattern) {
    if (redis.status !== 'ready') return false;
    try {
      const stream = redis.scanStream({
        match: pattern,
        count: 100
      });
      const keysToDelete = [];
      for await (const resultKeys of stream) {
        if (resultKeys.length > 0) {
          keysToDelete.push(...resultKeys);
        }
      }
      if (keysToDelete.length > 0) {
        await redis.del(keysToDelete);
      }
      return true;
    } catch (error) {
      logger.error(`Cache delPattern error for pattern ${pattern}: ${error.message}`);
      return false;
    }
  }
}

module.exports = CacheService;
