import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as path from 'path';
import * as fs from 'fs';
import AdmZip from 'adm-zip';

export async function downloadRoute(fastify: FastifyInstance) {
  fastify.get('/api/download-media/:category', async (req: any, reply: FastifyReply) => {
    const { category } = req.params;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', category);

    if (!fs.existsSync(uploadsDir)) {
      return reply.code(404).send({ error: 'Category folder not found' });
    }

    const zip = new AdmZip();
    const files = fs.readdirSync(uploadsDir);

    if (files.length === 0) {
      return reply.code(404).send({ error: 'No files found in this category' });
    }

    files.forEach(file => {
      const filePath = path.join(uploadsDir, file);
      if (fs.statSync(filePath).isFile()) {
        zip.addLocalFile(filePath);
      }
    });

    const zipBuffer = zip.toBuffer();
    const fileName = `Aurora_${category.replace(/\s+/g, '_')}_Media.zip`;

    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    return reply.send(zipBuffer);
  });
}
