import type { NextConfig } from 'next';
import { withWorkflow } from 'workflow/next';
const config:NextConfig={poweredByHeader:false,agentRules:false,turbopack:{root:process.cwd()},distDir:process.env.NODE_ENV==='development'?'.next-dev':'.next'};
export default withWorkflow(config);
