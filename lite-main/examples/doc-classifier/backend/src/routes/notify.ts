import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sendDeadlineEmail } from '../services/notification.js';

export async function notifyRoute(fastify: FastifyInstance) {
  fastify.post('/api/notify', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, docTitle, dueDate } = request.body as { 
      email: string; 
      docTitle: string; 
      dueDate: string;
    };

    if (!email || !docTitle || !dueDate) {
      return reply.status(400).send({ error: 'Missing required fields: email, docTitle, or dueDate' });
    }

    try {
      const result = await sendDeadlineEmail(email, docTitle, dueDate);
      return reply.send(result);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to send notification', details: error.message });
    }
  });
}
