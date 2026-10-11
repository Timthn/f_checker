// Next's local Workflow integration persists state but does not start recovery itself.
// No provider call here; this only re-enqueues already persisted SDK runs.
export async function register(){
 if(process.env.NEXT_RUNTIME!=='nodejs')return;
 const { getWorld }=await import('workflow/runtime');
 const world=await getWorld();
 await world.start?.();
}
