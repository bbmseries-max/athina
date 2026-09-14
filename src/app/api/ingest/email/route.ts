import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filePath, senderEmail, senderName, subject } = body;

    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 400 });
    }

    // 1. Match or create client profile
    let client = await prisma.client.findFirst({
      where: {
        OR: [
          { name: { contains: senderName } },
          { phone: senderEmail },
        ],
      },
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: senderName || "Lab Email Patient",
          phone: senderEmail || null,
        },
      });
      console.log(`[Email Pipeline] Created new client: ${client.name}`);
    }

    // 2. Move file from raw to processed storage
    const fileName = path.basename(filePath);
    const processedPath = path.join("D:\\athina_storage\\processed", fileName);
    fs.renameSync(filePath, processedPath);

    // 3. Extract Biomarkers via OpenAI Vision
    console.log(`[Email Pipeline] Analyzing lab file with GPT-4o Vision: ${fileName}`);
    const fileBuffer = fs.readFileSync(processedPath);
    const base64Data = fileBuffer.toString("base64");
    
    // Determine mime type
    const ext = path.extname(processedPath).toLowerCase();
    const mimeType = ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : "image/jpeg";

    let extractedData: {
      labName?: string;
      testDate?: string;
      biomarkers?: Array<{
        name: string;
        value?: number;
        valueString?: string;
        unit?: string;
        refLow?: number;
        refHigh?: number;
        flag?: "NORMAL" | "HIGH" | "LOW";
      }>;
    } = {};

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an expert clinical laboratory data extraction system.
Extract all biomarker test results, lab name, and test date from the document.
Return valid JSON matching this schema:
{
  "labName": "Name of diagnostic center or clinic",
  "testDate": "YYYY-MM-DD or null",
  "biomarkers": [
    {
      "name": "Biomarker name (e.g. Hemoglobin, Glucose, TSH, Ferritin)",
      "value": 14.2,
      "valueString": "14.2",
      "unit": "g/dL",
      "refLow": 13.5,
      "refHigh": 17.5,
      "flag": "NORMAL" | "HIGH" | "LOW"
    }
  ]
}`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all clinical tests and biomarkers from this medical laboratory document.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
      });

      const responseText = completion.choices[0]?.message?.content;
      if (responseText) {
        extractedData = JSON.parse(responseText);
      }
    } catch (visionErr) {
      console.error("[Email Pipeline] GPT-4o Vision extraction error:", visionErr);
    }

    // 4. Save TestReport and child Biomarkers into SQLite
    const testReport = await prisma.testReport.create({
      data: {
        clientId: client.id,
        filePath: processedPath,
        labName: extractedData.labName || subject.substring(0, 50) || "Diagnostic Lab",
        testDate: extractedData.testDate ? new Date(extractedData.testDate) : new Date(),
        biomarkers: {
          create: (extractedData.biomarkers || []).map((b) => ({
            name: b.name,
            value: typeof b.value === "number" ? b.value : null,
            valueString: b.valueString || (b.value !== undefined ? String(b.value) : null),
            unit: b.unit || null,
            refLow: typeof b.refLow === "number" ? b.refLow : null,
            refHigh: typeof b.refHigh === "number" ? b.refHigh : null,
            flag: b.flag || "NORMAL",
          })),
        },
      },
      include: {
        biomarkers: true,
      },
    });

    console.log(
      `✔ [Email Pipeline] TestReport ${testReport.id} created with ${testReport.biomarkers.length} biomarkers.`
    );

    return NextResponse.json({ success: true, reportId: testReport.id });
  } catch (error) {
    console.error("[Email Ingest API] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}