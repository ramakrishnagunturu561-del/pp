import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { processDocument } from '../services/classifier.js';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import { pipeline } from 'stream';
const pump = util.promisify(pipeline);
import * as os from 'os';
import AdmZip from 'adm-zip';

export async function classifyRoute(fastify: FastifyInstance) {
  fastify.post('/api/classify', async (req: FastifyRequest, reply: FastifyReply) => {
    logToProcess("POST /api/classify hit");
    const data = await req.file();
    
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const tempFilePath = path.join(os.tmpdir(), `upload-${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`);
    logToProcess(`Temp file path designated: ${tempFilePath}`);

    try {
      await pump(data.file, fs.createWriteStream(tempFilePath));
      
      const stat = fs.statSync(tempFilePath);
      logToProcess(`File saved to temp. Size: ${stat.size} bytes`);

      const fileExt = path.extname(data.filename).toLowerCase();

      if (fileExt === '.zip') {
        const results = [];
        const zipData = fs.readFileSync(tempFilePath);
        const zip = new AdmZip(zipData);
        const extractDir = path.join(os.tmpdir(), `extract-${Date.now()}`);
        fs.mkdirSync(extractDir, { recursive: true });
        
        zip.extractAllTo(extractDir, true);
        
        const files = getAllFiles(extractDir);
        logToProcess(`ZIP extracted: Found ${files.length} potential files to process.`);
        
        for (let i = 0; i < files.length; i++) {
          // Reduce delay to 1 second — much faster processing. We rely on the 429 retry logic if we hit burst limits.
          if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000));
          
          const fullPath = files[i];
          if (fullPath === undefined) continue;
          let retryCount = 0;
          const maxRetries = 1;
          
          while (retryCount <= maxRetries) {
            try {
              const ext = path.extname(fullPath).toLowerCase();
              if (['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp', '.txt'].includes(ext)) {
                logToProcess(`Processing zip item (${i+1}/${files.length}): ${path.basename(fullPath)} ${retryCount > 0 ? '(Retry '+retryCount+')' : ''}`);
                const result = await processDocument(fullPath) as any;
                result.filename = path.basename(fullPath);
                
                const category = result.documentType || 'Unknown';
                logToProcess(`Categorized ${path.basename(fullPath)} as ${category}`);
                const uploadsDir = path.join(process.cwd(), 'frontend', 'public', 'uploads', category);
                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                
                const uniqueFilename = `${Date.now()}-${path.basename(fullPath).replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
                const finalPath = path.join(uploadsDir, uniqueFilename);
                await fs.promises.rename(fullPath, finalPath);
                
                result.filename = uniqueFilename;
                result.originalFilename = path.basename(fullPath);
                results.push(result);
                break; // Success, exit retry loop
              } else {
                break; // Not a supported file, exit
              }
            } catch (e: any) {
              if (e.message.includes('429') && retryCount < maxRetries) {
                logToProcess(`Rate limit hit on ${path.basename(fullPath)}. Waiting 30s before retry...`);
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s on 429
                continue;
              }
              
              logToProcess(`Error processing zip item ${fullPath}: ${e.message}`);
              results.push({
                filename: path.basename(fullPath),
                documentType: 'Error',
                summary: `Failed to process: ${e.message}. (API Quota usually resets every minute)`,
                confidenceScore: '0%',
                processingTime: '0 sec',
                risks: [],
                clauses: []
              });
              break;
            }
          }
        }
        
        logToProcess(`Batch completed. Returning ${results.length} results.`);
        // Cleanup extraction dir
        fs.rmSync(extractDir, { recursive: true, force: true });
        fs.unlinkSync(tempFilePath);
        
        return reply.send(results);
      } else {
        logToProcess(`Processing single file: ${data.filename}`);
        const result = await processDocument(tempFilePath) as any;
        result.filename = data.filename;
        
        const category = result.documentType || 'Unknown';
        logToProcess(`Categorized ${data.filename} as ${category}`);
        const uploadsDir = path.join(process.cwd(), 'frontend', 'public', 'uploads', category);
        
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const uniqueFilename = `${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
        const finalPath = path.join(uploadsDir, uniqueFilename);
        await fs.promises.rename(tempFilePath, finalPath);
        
        result.filename = uniqueFilename;
        result.originalFilename = data.filename;
        
        return reply.send(result);
      }
    } catch (error: any) {
      const logMsg = `[${new Date().toISOString()}] Classification Error: ${error.message}\n${error.stack}\n`;
      fs.appendFileSync(path.join(process.cwd(), 'frontend', 'public', 'process.log'), logMsg);
      // Cleanup temp file on error if it still exists
      if (fs.existsSync(tempFilePath)) {
        try { await fs.promises.unlink(tempFilePath); } catch(e) {}
      }
      return reply.code(500).send({ error: 'Failed to process document', details: error.message, stack: error.stack });
    }
  });
}

function logToProcess(msg: string) {
  const fullMsg = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(path.join(process.cwd(), 'frontend', 'public', 'process.log'), fullMsg);
  console.log(msg);
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}
