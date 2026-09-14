module.exports = {
  apps: [
    {
      name: "athina-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: "D:\\athina",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "athina-whatsapp",
      script: "scripts/whatsapp-bridge.mjs",
      cwd: "D:\\athina",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "athina-dropzone",
      script: "scripts/dropzone-bridge.mjs",
      cwd: "D:\\athina",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};