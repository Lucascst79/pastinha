// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.js',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    acceptDownloads: true,
    viewport: { width: 1400, height: 820 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node tests/serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 820 } }, testIgnore: /stress/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1400, height: 820 } }, testIgnore: /stress/ },
    { name: 'safari', use: { ...devices['Desktop Safari'], viewport: { width: 1400, height: 820 } }, testIgnore: /stress/ },
    { name: 'celular', use: { ...devices['Pixel 7'] }, testIgnore: /stress/ },
    // Edge de verdade, quando instalado (no Windows ele já vem)
    ...(process.env.CI ? [] : [{ name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1400, height: 820 } }, testIgnore: /stress/ }]),
    // Dossiê grande: roda só quando pedido (npm run test:stress)
    { name: 'stress', use: { ...devices['Desktop Chrome'] }, testMatch: /stress/, timeout: 600_000 },
  ],
});
