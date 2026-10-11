import { defineConfig } from 'vitest/config';
// Real Auth and HTTP integration against the designated project/local production server.
export default defineConfig({test:{include:['tests/auth.integration.ts'],environment:'node',fileParallelism:false,testTimeout:60000,hookTimeout:120000}});
