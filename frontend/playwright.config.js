import { defineConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(resolve(root, '.local'), { recursive: true });

export default defineConfig({
  testDir: './tests', workers: 1, retries: 0,
  use: { baseURL: 'http://127.0.0.1:5179', trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: [
    {
      command: 'dotnet backend/bin/Debug/net8.0/UsuariosCrud.Api.dll', cwd: root,
      url: 'http://127.0.0.1:5089/api/health', reuseExistingServer: false,
      env: { ASPNETCORE_URLS: 'http://127.0.0.1:5089', ASPNETCORE_ENVIRONMENT: 'Production', ConnectionStrings__UsersDb: `Data Source=${resolve(root, '.local/e2e.db')}` },
    },
    {
      command: 'node node_modules/vite/bin/vite.js --port 5179', url: 'http://127.0.0.1:5179', reuseExistingServer: false,
      env: { API_PROXY_TARGET: 'http://127.0.0.1:5089' },
    },
  ],
});
