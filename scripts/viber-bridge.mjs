import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import 'dotenv/config';

// 1. Locate Viber DB
const viberBaseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'ViberPCB');
let viberDbPath = null;

if (fs.existsSync(viberBaseDir)) {
  const folders = fs.readdirSync(viberBaseDir);
  for (const f of folders) {
    const candidate = path.join(viberBaseDir, f, 'viber.db');
    if (fs.existsSync(candidate)) {
      viberDbPath = candidate;
      break;
    }
  }
}

if (!viberDbPath) {
  console.error('✖ Could not locate viber.db. Make sure Viber Desktop is installed and logged in.');
  process.exit(1);
}

console.log(`✔ Found Viber Database at: ${viberDbPath}`);

const RAW_DIR = 'D:\\athina_storage\\raw';
if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });

// Track last checked message ID in memory or state file
let lastMessageId = 0;

function pollViber() {
  try {
    // Open in readonly mode to prevent database locking
    const db = new Database(viberDbPath, { readonly: true, fileMustExist: true });

    // Initialize lastMessageId on first run to avoid processing all historical messages
    if (lastMessageId === 0) {
      const maxRow = db.prepare('SELECT MAX(EventID) as maxId FROM Messages').get();
      lastMessageId = maxRow?.maxId || 0;
      console.log(`✔ Viber listener initialized. Listening for new messages after ID: ${lastMessageId}`);
      db.close();
      return;
    }

    // Query new incoming messages with attachments (PDFs, Images)
    const query = `
      SELECT 
        m.EventID,
        m.PayloadPath,
        m.Body,
        m.TimeSpan,
        c.Number as PhoneNumber,
        c.Name as ContactName
      FROM Messages m
      LEFT JOIN Contact c ON m.ContactID = c.ContactID
      WHERE m.EventID > ?
        AND m.PayloadPath IS NOT NULL
        AND (m.PayloadPath LIKE '%.pdf' OR m.PayloadPath LIKE '%.jpg' OR m.PayloadPath LIKE '%.png' OR m.PayloadPath LIKE '%.jpeg')
      ORDER BY m.EventID ASC
    `;

    const newMedia = db.prepare(query).all(lastMessageId);
    db.close();

    for (const msg of newMedia) {
      lastMessageId = msg.EventID;

      if (!fs.existsSync(msg.PayloadPath)) {
        continue;
      }

      const fileName = path.basename(msg.PayloadPath);
      const destPath = path.join(RAW_DIR, `${Date.now()}_${fileName}`);

      // Copy file to Athina raw storage
      fs.copyFileSync(msg.PayloadPath, destPath);
      console.log(`✔ [Viber] New file copied from ${msg.ContactName || msg.PhoneNumber}: ${destPath}`);

      // Forward to Athina ingestion API
      triggerPipeline({
        filePath: destPath,
        phone: msg.PhoneNumber,
        name: msg.ContactName,
        source: 'VIBER',
      });
    }
  } catch (err) {
    console.error('✖ Error polling Viber SQLite database:', err.message);
  }
}

async function triggerPipeline(payload) {
  try {
    const res = await fetch('http://localhost:3000/api/ingest/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: payload.filePath,
        senderEmail: payload.phone || 'Viber Patient',
        senderName: payload.name || payload.phone || 'Viber Contact',
        subject: `Viber Lab Report (${payload.source})`,
      }),
    });

    if (res.ok) {
      console.log('✔ [Viber] Successfully ingested into Athina database.');
    }
  } catch (apiErr) {
    console.error('✖ Failed to forward Viber file to API:', apiErr.message);
  }
}

// Poll every 5 seconds
setInterval(pollViber, 5000);
pollViber();