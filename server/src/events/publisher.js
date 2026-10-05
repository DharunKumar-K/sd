import amqp from 'amqplib';
import config from '../config/db.js';

let channel = null;

export const initRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(config.rabbitMQURI);
    channel = await connection.createChannel();
    await channel.assertExchange('glowrush_events', 'topic', { durable: true });
    console.log('RabbitMQ Connected');
  } catch (error) {
    console.error('RabbitMQ Connection Error:', error);
  }
};

export const publishEvent = async (routingKey, event) => {
  if (!channel) return;
  channel.publish('glowrush_events', routingKey, Buffer.from(JSON.stringify(event)), {
    persistent: true
  });
};

export const getChannel = () => channel;
