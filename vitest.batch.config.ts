import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/batch.integration.ts'],environment:'node',fileParallelism:false,testTimeout:60000,hookTimeout:90000}});
