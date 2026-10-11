import { defineConfig } from 'vitest/config';
// Remote TLS/pooler round trips: lifecycle tests perform more than a dozen transactions.
// Assertions remain unchanged; timeouts identify transport stalls, not acceptable results.
export default defineConfig({test:{include:['tests/*.integration.ts'],environment:'node',fileParallelism:false,testTimeout:60000,hookTimeout:30000}});
