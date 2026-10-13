import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'tests/e2e',timeout:30000,fullyParallel:false,
 use:{baseURL:'http://localhost:3000',trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'bun run dev',url:'http://localhost:3000',reuseExistingServer:!process.env.CI,timeout:60000},
});
