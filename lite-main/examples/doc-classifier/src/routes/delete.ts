import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as path from 'path';
import * as fs from 'fs';

export async function deleteRoute(fastify: FastifyInstance) {
  fastify.post('/api/delete-file', async (req: any, reply: FastifyReply) => {
    const { category, filename } = req.body;
    
    if (!category || !filename) {
      return reply.code(400).send({ error: 'Missing category or filename' });
    }

    const filePath = path.join(process.cwd(), 'public', 'uploads', category, filename);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return reply.send({ success: true, message: 'File deleted from server' });
      } else {
        return reply.code(404).send({ error: 'File not found on server' });
      }
    } catch (err: any) {
      console.error("Delete Error:", err);
      return reply.code(500).send({ error: 'Failed to delete file', details: err.message });
    }
  });
}
