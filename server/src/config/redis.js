import Redis from 'ioredis';
import config from './db.js';

let redisClient = null;

export const initRedis = () => {
  redisClient = new Redis(config.redisURI);
  redisClient.on('connect', () => console.log('Redis Connected'));
  redisClient.on('error', (err) => console.error('Redis Error', err));
  return redisClient;
};

export const getRedis = () => redisClient;
