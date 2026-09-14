module.exports = {
  apps: [
    {
      name: 'athina-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'athina-whatsapp',
      script: 'scripts/whatsapp-bridge.mjs',
      instances: 1,
      autorestart: true,
      watch: false,
      restart_delay: 5000,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
    ,
    {
      name: "athina-email",
      script: "scripts/email-bridge.mjs",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "athina-viber",
      script: "scripts/viber-bridge.mjs",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "athina-dropzone",
      script: "scripts/dropzone-bridge.mjs",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};