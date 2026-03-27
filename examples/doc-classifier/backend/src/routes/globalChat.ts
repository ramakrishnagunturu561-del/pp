import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { askGlobalQuestion } from '../services/globalChat.js';

interface GlobalChatBody {
  message: string;
  context: string;
}

export async function globalChatRoute(fastify: FastifyInstance) {
  fastify.post('/api/global-chat', async (req: FastifyRequest, reply: FastifyReply) => {
    const { message, context } = req.body as GlobalChatBody;
    
    if (!message) {
      return reply.code(400).send({ error: 'Message is required' });
    }

    // Default context if array is empty
    const finalContext = context && context.trim() !== '' ? context : 'The library is currently empty.';

    try {
      const responseText = await askGlobalQuestion(message, finalContext);
      return reply.send({ response: responseText });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Failed to process global chat query', 
        details: error.message 
      });
    }
  });
}
