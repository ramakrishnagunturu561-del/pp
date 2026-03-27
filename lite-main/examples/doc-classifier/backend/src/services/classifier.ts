import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ 
  model: 'gemini-flash-latest',
  generationConfig: {
    responseMimeType: 'application/json'
  }
});

let parser: any = null;

// Warm up parser eagerly in background so the first real request doesn't pay the import cost
(async () => {
  try {
    const { LiteParse } = await import('../../../../../dist/src/lib.js');
    parser = new LiteParse();
    console.log('[classifier] LiteParse parser pre-loaded.');
  } catch (e) {
    console.warn('[classifier] Parser pre-load failed (will retry on first use):', (e as Error).message);
  }
})();

export async function processDocument(filePath: string) {
  const startTime = Date.now();

  try {
    const path = await import('path');
    const fileExt = path.extname(filePath).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(fileExt);
    const docType = isImage ? 'image' : 'document';

    let mimeType: string | null = null;
    if (['.jpg', '.jpeg'].includes(fileExt)) mimeType = 'image/jpeg';
    else if (fileExt === '.png') mimeType = 'image/png';
    else if (fileExt === '.webp') mimeType = 'image/webp';
    else if (fileExt === '.pdf') mimeType = 'application/pdf';

    // 1. Read file once into buffer to avoid double disk read
    const fileData = await fs.readFile(filePath);
    let textContent = '';

    // Gemini 1.5 Flash supports PDF and Images natively, so we only need LiteParse for other generic text formats
    const skipLiteParse = isImage || fileExt === '.pdf';

    if (!skipLiteParse) {
      // For raw text docs: parse using the buffer
      if (!parser) {
        const { LiteParse } = await import('../../../../../dist/src/lib.js');
        parser = new LiteParse();
      }
      const parsedData = await parser.parse(fileData);
      textContent = parsedData.text || '';
    }

    // 2. Build prompt
    const basePrompt = `You are an expert ${docType} classifier. 
Classify the provided ${docType} into exactly one of these predefined categories:
- Identity Proofs (e.g., Aadhaar, PAN, Driving Licence, Passport)
- Financial Documents (e.g., Bank Statements, Invoices, Receipts, Debit/Credit Cards)
- Government Certificates (e.g., Income Certificate, Caste Certificate, Domicile)
- Legal Agreements
- Compliance Documents
- Tax Documents
- Business Registration Documents
- Presentations / Pitch Decks
- Academic / Project Proposals
- Unknown (if it doesn't fit the above)

SPECIAL INSTRUCTIONS FOR DEADLINES:
- For Debit/Credit Cards, find the "Expiry Date" or "Valid Thru" and set as "due_date".
- For Income/Caste Certificates, find the "Validity Period" or "Expiry Date" and set as "due_date".
- If a document has an expiration or renewal date, ALWAYS extract it.

You must return ONLY a JSON response matching this exact structure:
{
  "category": "category name",
  "confidence": <number between 0 and 100>,
  "summary": "A 2-3 sentence overview of the ${docType}. IMPORTANT: You MUST include highly specific identifying details (exact names, dates, document numbers, or total amounts) so the summary is completely unique and distinguishable from other similar documents.",
  "clauses": ["Key point/clause 1", "Key point/clause 2"],
  "risks": ["Potential risk or red flag 1", "Potential risk 2 (if any)"],
  "due_date": "YYYY-MM-DD or null if no deadline/expiry/renewal date found",
  "reminder_days": <number of days before the due_date to remind the user, e.g. 7 or 14>
}`;

    const promptWithText = textContent.trim()
      ? basePrompt + `\n\nExtracted Text:\n---\n${textContent.substring(0, 8000)}\n---`
      : basePrompt;

    // 3. Call Gemini — always pass file natively when we have it
    let result;
    if (mimeType && fileData) {
      const filePart = {
        inlineData: {
          data: fileData.toString('base64'),
          mimeType
        }
      };
      const finalPrompt = skipLiteParse
        ? basePrompt + '\n\nAnalyze the attached file natively.'
        : promptWithText + '\n\nPlease heavily rely on the visually attached document if the extracted text above seems garbled.';
      result = await model.generateContent([finalPrompt, filePart]);
    } else {
      result = await model.generateContent(promptWithText);
    }

    
    const responseText = result.response.text();
    
    let classification;
    try {
        classification = JSON.parse(responseText);
    } catch(e) {
        classification = { category: 'Unknown', confidence: 0, summary: "Could not parse document correctly.", clauses: [], risks: [] };
    }

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

    return {
      documentType: classification.category,
      confidenceScore: `${classification.confidence}%`,
      processingTime: `${processingTime} sec`,
      summary: classification.summary || "No summary available.",
      clauses: classification.clauses || [],
      risks: classification.risks || [],
      due_date: classification.due_date || null,
      reminder_days: classification.reminder_days || 7
    };
  } catch (error) {
    throw error;
  }
}
