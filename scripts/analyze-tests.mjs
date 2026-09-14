import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PROCESSED_DIR = 'D:/athina_storage/processed';

// Define the extraction format using Zod
const BiomarkerSchema = z.object({
  name: z.string().describe("Standard test name, e.g., 'Glucose', 'Hemoglobin', 'TSH'"),
  value: z.number().nullable().describe("Numeric value if present"),
  valueString: z.string().describe("Raw representation, e.g. '<0.01', '120'"),
  unit: z.string().nullable().describe("e.g., 'mg/dL', 'g/dL', 'μIU/mL'"),
  refLow: z.number().nullable().describe("Lower reference bound"),
  refHigh: z.number().nullable().describe("Upper reference bound"),
  flag: z.enum(['NORMAL', 'HIGH', 'LOW']).describe("Normal, or out of range"),
});

const MedicalReportSchema = z.object({
  labName: z.string().nullable().describe("Name of the diagnostic center/lab"),
  testDate: z.string().nullable().describe("Test date in YYYY-MM-DD format if visible"),
  summary: z.string().describe("Brief 1-sentence clinical summary of what test this is"),
  biomarkers: z.array(BiomarkerSchema),
});

async function runAnalysisQueue() {
  console.log('🔍 Checking for unanalyzed incoming files...');

  const pendingMessages = await prisma.message.findMany({
    where: {
      mediaType: { in: ['image', 'pdf'] },
      testReports: { none: {} },
    },
    include: { client: true },
  });

  if (pendingMessages.length === 0) {
    console.log('No pending files to process.');
    return;
  }

  for (const message of pendingMessages) {
    if (!message.filePath || !fs.existsSync(message.filePath)) {
      console.log(`File not found: ${message.filePath}`);
      continue;
    }

    console.log(`⚙ Processing document from ${message.client.name}...`);

    try {
      const fileBuffer = fs.readFileSync(message.filePath);
      const base64Data = fileBuffer.toString('base64');
      const mimeType = message.mediaType === 'image' ? 'image/jpeg' : 'application/pdf';

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert clinical laboratory data extraction system. Extract all individual test parameters, values, units, reference intervals, and flags from the medical report screenshot or document.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract the test date, laboratory name, and every biomarker line item accurately into structured JSON.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`,
                },
              },
            ],
          },
        ],
        response_format: zodResponseFormat(MedicalReportSchema, 'medical_report'),
      });

      const rawContent = response.choices[0].message.content;
      if (!rawContent) {
        console.error('Empty response from AI.');
        continue;
      }

      const extracted = JSON.parse(rawContent);

      // Ensure processed folder exists
      if (!fs.existsSync(PROCESSED_DIR)) {
        fs.mkdirSync(PROCESSED_DIR, { recursive: true });
      }

      // Move file to processed directory
      const fileName = path.basename(message.filePath);
      const newFilePath = path.join(PROCESSED_DIR, fileName);
      fs.renameSync(message.filePath, newFilePath);

      // Save report and biomarkers in database
      const report = await prisma.testReport.create({
        data: {
          clientId: message.clientId,
          messageId: message.id,
          labName: extracted.labName,
          summary: extracted.summary,
          filePath: newFilePath,
          testDate: extracted.testDate ? new Date(extracted.testDate) : null,
          biomarkers: {
            create: extracted.biomarkers.map((b) => ({
              name: b.name,
              value: typeof b.value === 'number' ? b.value : null,
              valueString: String(b.valueString || b.value || ''),
              unit: b.unit || null,
              refLow: typeof b.refLow === 'number' ? b.refLow : null,
              refHigh: typeof b.refHigh === 'number' ? b.refHigh : null,
              flag: ['NORMAL', 'HIGH', 'LOW'].includes(b.flag) ? b.flag : 'NORMAL',
            })),
          },
        },
      });

      await prisma.message.update({
        where: { id: message.id },
        data: { filePath: newFilePath },
      });

      console.log(
        `✔ Extracted ${extracted.biomarkers.length} biomarkers for ${message.client.name} (Report ID: ${report.id})`
      );
    } catch (err) {
      console.error('Error during AI analysis:', err);
    }
  }
}

runAnalysisQueue()
  .catch(console.error)
  .finally(() => prisma.$disconnect());