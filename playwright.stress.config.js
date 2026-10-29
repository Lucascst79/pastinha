// Dossiê grande (60 fotos de 12 MP): npm run test:stress
const { devices } = require('@playwright/test');
const base = require('./playwright.config.js');

module.exports = {
  ...base,
  projects: [{ name: 'stress', use: { ...devices['Desktop Chrome'] }, testMatch: /stress/, timeout: 600_000 }],
};
