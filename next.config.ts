import type { NextConfig } from 'next';
import { withWorkflow } from 'workflow/next';
// Bound build-worker memory on the personal development machine.
const config:NextConfig={poweredByHeader:false,agentRules:false,experimental:{cpus:2},turbopack:{root:process.cwd()},distDir:process.env.NODE_ENV==='development'?'.next-dev':'.next'};
export default withWorkflow(config);
