import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';

const DROPZONE_DIR = 'D:\\athina_storage\\dropzone';
const RAW_DIR = 'D:\\athina_storage\\raw';

// Ensure required directories exist
if (!fs.existsSync(DROPZONE_DIR)) fs.mkdirSync(DROPZONE_DIR, { recursive: true });
if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });

console.log(`✔ Monitoring Hot Folder: ${DROPZONE_DIR}`);

// Initialize watcher with write-completion detection
const watcher = chokidar.watch(DROPZONE_DIR, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: false,     // Processes files already sitting in the folder on startup
  awaitWriteFinish: {
    stabilityThreshold: 2000, // Waits 2s after write finishes (crucial for large PDF scans)
    pollInterval: 200,
  },
});

watcher.on('add', async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
    console.log(`[Dropzone] Ignored non-medical file: ${path.basename(filePath)}`);
    return;
  }

  const fileName = path.basename(filePath);
  console.log(`\n[Dropzone] Detected file drop: ${fileName}`);

  // 1. Move to raw staging directory with a timestamped unique name
  const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const rawPath = path.join(RAW_DIR, safeName);

  try {
    fs.copyFileSync(filePath, rawPath);
    fs.unlinkSync(filePath); // remove from dropzone
    console.log(`[Dropzone] Staged to: ${rawPath}`);

    // 2. Trigger Athina pipeline API
    const response = await fetch('http://localhost:3000/api/ingest/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: rawPath,
        senderEmail: null,
        senderName: 'Manual Drop / Scanner',
        subject: `Manual Import: ${fileName}`,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`✖ Pipeline failed (${response.status}): ${errText}`);
    } else {
      const data = await response.json();
      console.log(`✔ Successfully ingested! Report ID: ${data.reportId}`);
    }
  } catch (err) {
    console.error(`✖ Error processing dropped file ${fileName}:`, err.message);
  }
});

watcher.on('error', (error) => console.error(`[Dropzone] Watcher error: ${error}`));