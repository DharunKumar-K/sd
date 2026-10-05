import mongoose from 'mongoose';

const config = {
  mongoURI: process.env.MONGO_URI || 'mongodb://admin:password@localhost:27017/glowrush?authSource=admin',
  redisURI: process.env.REDIS_URI || 'redis://localhost:6379',
  rabbitMQURI: process.env.RABBITMQ_URI || 'amqp://admin:password@localhost:5672'
};

export const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoURI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
  }
};

export default config;
