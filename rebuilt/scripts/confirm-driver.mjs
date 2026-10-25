/** Exercise real AlertDialog UI while preserving existing per-test accept/cancel decisions. */
export async function installConfirmDriver(page,decide){
 await page.exposeFunction('qaConfirmDecision',async message=>{
  if(decide)return !!await decide(message);
  let choice=true;
  for(const listener of page.listeners('dialog'))await listener({type:()=> 'confirm',message:()=>message,accept:async()=>{choice=true;},dismiss:async()=>{choice=false;}});
  return choice;
 });
 await page.addInitScript(()=>{const seen=new WeakSet();const scan=()=>{for(const d of document.querySelectorAll('[role="alertdialog"]')){if(seen.has(d))continue;seen.add(d);window.qaPendingDecisions=(window.qaPendingDecisions??0)+1;window.qaConfirmDecision(d.textContent??'').then(ok=>{[...d.querySelectorAll('button')].find(b=>b.textContent?.trim()===(ok?'Lanjutkan':'Batal'))?.click();setTimeout(()=>{window.qaPendingDecisions--;},0);});}};new MutationObserver(scan).observe(document,{childList:true,subtree:true});scan();});
}
export async function settleConfirmation(page){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.waitForFunction(()=>!document.querySelector('[role="alertdialog"]') && !(window.qaPendingDecisions??0));
}
