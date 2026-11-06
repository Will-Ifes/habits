import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } },
    },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    {
      command: 'npm run db:migrate -w @habits/server && npm run dev -w @habits/server',
      url: 'http://127.0.0.1:3334/api/health',
      env: {
        DATABASE_URL: `file:./prisma/test-e2e-${Date.now()}.db`,
        PORT: '3334',
        HOST: '127.0.0.1',
      },
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -w @habits/web -- --port 5174',
      url: 'http://127.0.0.1:5174',
      env: { VITE_API_PROXY: 'http://127.0.0.1:3334' },
      reuseExistingServer: false,
    },
  ],
})
