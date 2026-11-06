import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e-pages',
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4174/habits/', trace: 'retain-on-failure' },
  projects: [1366, 768, 375].flatMap((width) =>
    ['paper', 'forest'].map((theme) => ({
      name: `${theme}-${width}`,
      metadata: { theme },
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width, height: 1000 },
        colorScheme: theme === 'forest' ? ('dark' as const) : ('light' as const),
      },
    }))
  ),
  webServer: {
    command: 'npm run build:pages && npm run preview:pages',
    url: 'http://127.0.0.1:4174/habits/',
    reuseExistingServer: false,
    timeout: 120000,
  },
})
