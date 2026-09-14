/**
 * Athina Clinical Vault - System Command Catalog & Automation
 * Location: D:\athina\ops\commands.ts
 */

export interface SystemCommand {
  category: "PROCESS" | "DATABASE" | "BACKUP" | "MAINTENANCE";
  name: string;
  command: string;
  description: string;
  runAsAdmin?: boolean;
}

export const ATHINA_COMMAND_CATALOG: SystemCommand[] = [
  // Process Management (PM2)
  {
    category: "PROCESS",
    name: "Start Services",
    command: "npx pm2 start ecosystem.config.cjs",
    description: "Launches the Next.js web console and the WhatsApp auto-ingestion bridge.",
  },
  {
    category: "PROCESS",
    name: "Check Health Status",
    command: "npx pm2 status",
    description: "Displays CPU, memory, uptime, and restart count for running processes.",
  },
  {
    category: "PROCESS",
    name: "Stream Real-Time Logs",
    command: "npx pm2 logs",
    description: "Streams incoming WhatsApp downloads, AI vision analysis, and web requests.",
  },
  {
    category: "PROCESS",
    name: "Restart All Services",
    command: "npx pm2 restart all",
    description: "Gracefully reloads both the web app and ingestion bridge.",
  },
  {
    category: "PROCESS",
    name: "Stop All Services",
    command: "npx pm2 stop all",
    description: "Halts all running background processes.",
  },
  {
    category: "PROCESS",
    name: "Save Startup State",
    command: "npx pm2 save",
    description: "Saves current active processes to reload upon machine reboot.",
  },

  // Database Management (Prisma & SQLite)
  {
    category: "DATABASE",
    name: "Launch Visual DB Studio",
    command: "npx prisma studio",
    description: "Opens local web interface at http://localhost:5555 to review raw patient records.",
  },
  {
    category: "DATABASE",
    name: "Push Schema Updates",
    command: "npx prisma db push",
    description: "Applies any additions in prisma/schema.prisma to the local SQLite database.",
  },
  {
    category: "DATABASE",
    name: "Regenerate Client Types",
    command: "npx prisma generate",
    description: "Regenerates TypeScript types after changing the Prisma schema.",
  },

  // Routine Updates & Deployment
  {
    category: "MAINTENANCE",
    name: "Production Build",
    command: "npm run build",
    description: "Compiles Next.js for production before restarting pm2.",
  },
  {
    category: "MAINTENANCE",
    name: "Pull & Deploy",
    command: "git pull && npm install && npm run build && npx pm2 restart all",
    description: "Full update workflow: pulls Git commits, updates packages, rebuilds, and restarts.",
  },

  // Backup & Storage Protection
  {
    category: "BACKUP",
    name: "Manual DB Snapshot",
    command: "copy D:\\athina\\prisma\\dev.db D:\\athina_backups\\dev.db.bak",
    description: "Quick single-command copy of the SQLite database file.",
  },
  {
    category: "BACKUP",
    name: "Archive Processed Media",
    command: "xcopy D:\\athina_storage\\processed D:\\athina_backups\\storage /E /I /Y",
    description: "Synchronizes processed lab images and PDFs to a secondary backup drive.",
  },
];