     import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { classifyRoute } from './routes/classify.js';
import { chatRoute } from './routes/chat.js';
import { downloadRoute } from './routes/download.js';
import { deleteRoute } from './routes/delete.js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const server = Fastify({ logger: true });

// Register multipart support for file uploads
server.register(multipart);

// Serve static frontend files
server.register(fastifyStatic, {
  root: path.join(__dirname, '../public'),
  prefix: '/public/',
});

server.get('/', (req, reply) => {
  return reply.sendFile('index.html');
});

import { globalChatRoute } from './routes/globalChat.js';
import { notifyRoute } from './routes/notify.js';

// Register routes
server.register(classifyRoute);
server.register(chatRoute);
server.register(globalChatRoute);
server.register(notifyRoute);
server.register(downloadRoute);
server.register(deleteRoute);

const start = async () => {
  try {
    await server.listen({ port: 3000 });
    console.log('Server running at http://localhost:3000');
    console.log('Current Working Directory:', process.cwd());
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
