import makeWASocket, {
  useMultiFileAuthState as initAuthState,
  DisconnectReason,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STORAGE_PATH = process.env.MEDIA_STORAGE_PATH || 'D:/athina_storage';
const RAW_DIR = path.resolve(STORAGE_PATH, 'raw');
const PROCESSED_DIR = path.resolve(STORAGE_PATH, 'processed');

[RAW_DIR, PROCESSED_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Zod schemas for structured biomarker parsing
const BiomarkerSchema = z.object({
  name: z.string(),
  value: z.number().nullable(),
  valueString: z.string(),
  unit: z.string().nullable(),
  refLow: z.number().nullable(),
  refHigh: z.number().nullable(),
  flag: z.enum(['NORMAL', 'HIGH', 'LOW']),
});

const MedicalReportSchema = z.object({
  labName: z.string().nullable(),
  testDate: z.string().nullable(),
  summary: z.string(),
  biomarkers: z.array(BiomarkerSchema),
});

// Standalone processing routine called immediately upon file download
async function processMedicalFile(messageRecordId, filePath, mediaType, clientId, clientName) {
  console.log(`⚙ Starting immediate extraction for ${clientName}...`);

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    const mimeType = mediaType === 'image' ? 'image/jpeg' : 'application/pdf';

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
            { type: 'text', text: 'Extract test date, laboratory name, and biomarker lines accurately into structured JSON.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
          ],
        },
      ],
      response_format: zodResponseFormat(MedicalReportSchema, 'medical_report'),
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    const fileName = path.basename(filePath);
    const finalPath = path.join(PROCESSED_DIR, fileName);

    fs.renameSync(filePath, finalPath);

    await prisma.testReport.create({
      data: {
        clientId,
        messageId: messageRecordId,
        labName: parsed.labName,
        summary: parsed.summary,
        filePath: finalPath,
        testDate: parsed.testDate ? new Date(parsed.testDate) : null,
        biomarkers: {
          create: (parsed.biomarkers || []).map((b) => ({
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
      where: { id: messageRecordId },
      data: { filePath: finalPath },
    });

    console.log(`✔ Ingestion finished: ${parsed.biomarkers?.length || 0} biomarkers saved for ${clientName}.`);
    return true;
  } catch (err) {
    console.error(`AI analysis failed for ${filePath}:`, err);
    return false;
  }
}

async function startWhatsAppBridge() {
  const { state, saveCreds } = await initAuthState('whatsapp_auth_session');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP ---');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`Connection closed (status: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) setTimeout(startWhatsAppBridge, 3000);
    } else if (connection === 'open') {
      console.log('✔ WhatsApp Bridge active: monitoring and auto-analyzing incoming tests.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;

      const senderJid = msg.key.remoteJid;
      if (!senderJid || senderJid.includes('@g.us')) continue;

      const senderPhone = senderJid.replace('@s.whatsapp.net', '');
      const pushName = msg.pushName || `Client ${senderPhone}`;

      const client = await prisma.client.upsert({
        where: { phone: senderPhone },
        update: { name: pushName },
        create: { name: pushName, phone: senderPhone },
      });

      const content = msg.message;
      if (!content) continue;

      const isImage = !!content.imageMessage;
      const isDocument = !!content.documentMessage;

      if (isImage || isDocument) {
        try {
          const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
          const ext = isImage ? '.jpg' : path.extname(content.documentMessage?.fileName || '.pdf') || '.pdf';
          const filename = `${Date.now()}_${senderPhone}${ext}`;
          const rawDestPath = path.join(RAW_DIR, filename);

          fs.writeFileSync(rawDestPath, buffer);
          console.log(`📥 Downloaded document from ${pushName}: ${filename}`);

          const dbMessage = await prisma.message.create({
            data: {
              clientId: client.id,
              channel: 'whatsapp',
              mediaType: isImage ? 'image' : 'pdf',
              filePath: rawDestPath,
              rawText: content.imageMessage?.caption || content.documentMessage?.title || null,
            },
          });

          // Run AI extraction in background
          processMedicalFile(dbMessage.id, rawDestPath, isImage ? 'image' : 'pdf', client.id, pushName)
            .then(async (success) => {
              if (success) {
                // Send automated patient confirmation
                await sock.sendMessage(senderJid, {
                  text: 'Your medical document has been received and added to your private clinical record.',
                });
              }
            });
        } catch (err) {
          console.error('Media download error:', err);
        }
      }
    }
  });

  // Listen for the initial sync of past chats and contacts
sock.ev.on('messaging-history.set', async ({ chats, contacts }) => {
  console.log(`📥 Synced ${chats?.length || 0} chats and ${contacts?.length || 0} contacts from WhatsApp history.`);

  if (chats) {
    for (const chat of chats) {
      const jid = chat.id;
      if (!jid || jid.includes('@g.us')) continue; // Skip groups

      const phone = jid.replace('@s.whatsapp.net', '');
      const name = chat.name || `Chat ${phone}`;

      await prisma.discoveredChat.upsert({
        where: { jid },
        update: {
          name,
          unreadCount: chat.unreadCount || 0,
        },
        create: {
          jid,
          phone,
          name,
          unreadCount: chat.unreadCount || 0,
        },
      });
    }
  }
});

// Keep discovered list fresh as new chats come in
sock.ev.on('chats.upsert', async (chats) => {
  for (const chat of chats) {
    if (!chat.id || chat.id.includes('@g.us')) continue;
    const phone = chat.id.replace('@s.whatsapp.net', '');
    await prisma.discoveredChat.upsert({
      where: { jid: chat.id },
      update: { name: chat.name || `Chat ${phone}` },
      create: { jid: chat.id, phone, name: chat.name || `Chat ${phone}` },
    });
  }
});
}

startWhatsAppBridge().catch(console.error);