import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',workers:1,retries:0,timeout:60000,reporter:'list',use:{baseURL:'http://127.0.0.1:3000',headless:true,launchOptions:{executablePath:process.env.FC_CHROMIUM_PATH},trace:'retain-on-failure'}});
