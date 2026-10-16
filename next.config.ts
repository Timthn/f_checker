import type { NextConfig } from 'next';
import { withWorkflow } from 'workflow/next';
// Bound build-worker memory on the personal development machine.
const staged=process.env.FC_NEXT_DIST_DIR||undefined;
if(staged&&!['.next','data/preview-build-a','data/preview-build-b'].includes(staged))throw Error('INVALID_PROJECT_BUILD_DIRECTORY');
const config:NextConfig={poweredByHeader:false,agentRules:false,experimental:{cpus:2},turbopack:{root:process.cwd()},distDir:process.env.NODE_ENV==='development'?'.next-dev':staged??'.next'};
export default withWorkflow(config);
