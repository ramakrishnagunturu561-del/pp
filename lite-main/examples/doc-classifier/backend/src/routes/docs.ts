import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Document } from '../models/Document.js';

export async function docsRoute(fastify: FastifyInstance) {
  fastify.get('/api/documents/:userId', async (req: any, reply: FastifyReply) => {
    const { userId } = req.params;
    const docs = await Document.find({ owner: userId }).sort({ createdAt: -1 });
    return reply.send(docs);
  });

  fastify.post('/api/documents', async (req: any, reply: FastifyReply) => {
    const { userId, ...docData } = req.body;
    if (!userId) return reply.code(400).send({ error: 'User ID required. Please log in again.' });

    const doc = new Document({ owner: userId, ...docData });
    await doc.save();
    return reply.send(doc);
  });

  fastify.delete('/api/documents/:id', async (req: any, reply: FastifyReply) => {
    const { id } = req.params;
    await Document.findByIdAndDelete(id);
    return reply.send({ success: true });
  });
}
