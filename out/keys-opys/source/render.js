const {chromium}=require('playwright');const fs=require('fs');
const FPS=50;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
await p.goto('file://'+__dirname+'/index.html');await p.evaluate(()=>document.fonts.ready);
const dur=await p.evaluate(()=>DUR);const n=Math.round(dur*FPS);
for(let c=0;c<5;c++){const d=`frames/c${c+1}`;fs.mkdirSync(d,{recursive:true});
 for(let f=0;f<n;f++){await p.evaluate(([c,t])=>render(c,t),[c,f/FPS]);await p.screenshot({path:`${d}/${String(f).padStart(4,'0')}.png`,omitBackground:true});}
 console.log('case',c+1,n);}
await b.close();})();
