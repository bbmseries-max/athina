import Imap from 'imap';
import { simpleParser } from 'mailparser';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Storage paths matching your setup
const RAW_DIR = 'D:\\athina_storage\\raw';
const PROCESSED_DIR = 'D:\\athina_storage\\processed';

if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });
if (!fs.existsSync(PROCESSED_DIR)) fs.mkdirSync(PROCESSED_DIR, { recursive: true });

const imapConfig = {
  user: process.env.IMAP_USER,
  password: process.env.IMAP_PASSWORD,
  host: process.env.IMAP_HOST || 'imap.gmail.com',
  port: parseInt(process.env.IMAP_PORT || '993', 10),
  tls: process.env.IMAP_TLS !== 'false',
  tlsOptions: { rejectUnauthorized: false },
};

function connectImap() {
  const imap = new Imap(imapConfig);

  imap.once('ready', () => {
    console.log('✔ Connected to Email IMAP server');
    checkInbox(imap);

    // Periodic check
    const intervalSec = parseInt(process.env.IMAP_CHECK_INTERVAL_SEC || '60', 10);
    setInterval(() => {
      checkInbox(imap);
    }, intervalSec * 1000);
  });

  imap.once('error', (err) => {
    console.error('IMAP connection error:', err);
  });

  imap.once('end', () => {
    console.log('IMAP connection closed. Reconnecting in 30s...');
    setTimeout(connectImap, 30000);
  });

  imap.connect();
}

function checkInbox(imap) {
  imap.openBox('INBOX', false, (err) => {
    if (err) {
      console.error('Failed to open INBOX:', err);
      return;
    }

    // Search for UNSEEN (unread) messages
    imap.search(['UNSEEN'], (err, results) => {
      if (err) {
        console.error('Search error:', err);
        return;
      }

      if (!results || results.length === 0) {
        // No unread emails
        return;
      }

      console.log(`[Email] Found ${results.length} unread email(s). Fetching...`);

      const f = imap.fetch(results, { bodies: '', markSeen: true });

      f.on('message', (msg) => {
        msg.on('body', (stream) => {
          simpleParser(stream, async (err, parsed) => {
            if (err) {
              console.error('Failed to parse email:', err);
              return;
            }

            const senderEmail = parsed.from?.value?.[0]?.address || 'unknown';
            const senderName = parsed.from?.value?.[0]?.name || senderEmail;
            const subject = parsed.subject || 'No Subject';

            console.log(`[Email] Processing from "${senderName}" <${senderEmail}>: "${subject}"`);

            if (!parsed.attachments || parsed.attachments.length === 0) {
              console.log('  -> No attachments found, skipping.');
              return;
            }

            for (const att of parsed.attachments) {
              const ext = path.extname(att.filename).toLowerCase();
              if (['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
                const safeName = `${Date.now()}_${att.filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                const destPath = path.join(RAW_DIR, safeName);

                fs.writeFileSync(destPath, att.content);
                console.log(`  ✔ Saved attachment to: ${destPath}`);

                // Send to local pipeline webhook or trigger extraction script
                try {
                  await triggerPipeline({
                    filePath: destPath,
                    senderEmail,
                    senderName,
                    subject,
                  });
                } catch (pipeErr) {
                  console.error('  ✖ Error processing attachment:', pipeErr);
                }
              }
            }
          });
        });
      });

      f.once('error', (err) => {
        console.error('Fetch error:', err);
      });
    });
  });
}

// Calls your local Athina processing API
async function triggerPipeline(payload) {
  try {
    const res = await fetch('http://localhost:3000/api/ingest/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`Pipeline API responded with error: ${res.status} ${txt}`);
    } else {
      console.log('  ✔ Pipeline processed report successfully');
    }
  } catch (err) {
    console.error('  ✖ Failed to call local ingest pipeline:', err.message);
  }
}

connectImap();