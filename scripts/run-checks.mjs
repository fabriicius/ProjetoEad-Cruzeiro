import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const reportPath=resolve(root,process.argv.includes('--update-report')?'verificacao.json':'test-results/verificacao.json');
const report={executedAt:new Date().toISOString(),success:false,viewports:[],regressions:[]};
const files={'/index.html':'text/html','/checks-host.html':'text/html','/order-rules.js':'text/javascript','/app.js':'text/javascript','/checks.js':'text/javascript','/style.css':'text/css'};
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  const file=path==='/'?'/index.html':path;
  if(!Object.hasOwn(files,file)){res.writeHead(404);res.end();return;}
  try{res.writeHead(200,{'Content-Type':files[file]+'; charset=utf-8'});res.end(await readFile(resolve(root,'.'+file)));}
  catch{res.writeHead(500);res.end();}
});
let browser,deadline;
const storageKey='off-prototipo-v1';
async function check(name,run){
  try{await run();report.regressions.push({name,passed:true});console.log('PASS: '+name);}
  catch(error){report.regressions.push({name,passed:false,error:error.message});throw error;}
}

async function run(){
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  report.browserVersion=browser.version();
  const context=await browser.newContext({locale:'pt-BR',timezoneId:'America/Sao_Paulo'});
  context.setDefaultTimeout(15000);
  for(const width of [1440,390,320]){
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.setViewportSize({width:Math.max(1440,width+40),height:1100});
    await page.goto(`${base}/checks-host.html?width=${width}`);
    const result=JSON.parse(await page.locator('#test-results').innerText());
    report.viewports.push({requestedWidth:width,...result});
    assert.equal(result.success,true,`${width}px: ${result.error||'verificações falharam'}`);
    assert.ok(result.results.length>0,'O relatório deve conter verificações.');
    assert.ok(result.results.every(test=>test.passed),'Há verificações reprovadas.');
    assert.deepEqual(errors,[],'Erros de JavaScript durante a execução.');
    console.log(`PASS: ${result.results.length} verificações em ${width}px`);
    await page.close();
  }

  const page=await context.newPage();
  await page.clock.install({time:new Date('2027-01-02T15:00:00-03:00')});
  await page.goto(base);
  const saved=await page.evaluate(()=>{
    const state=OffDemo.getState();state.stocks['COQ-001']=7;
    const json=JSON.stringify(state);localStorage.setItem('off-prototipo-v1',json);return json;
  });
  await check('Restaura pedidos e saldos válidos após recarregar',async()=>{
    await page.reload();
    assert.equal(await page.evaluate(()=>OffDemo.getState().stocks['COQ-001']),7);
    assert.equal(await page.evaluate(()=>OffDemo.getState().orders.length),40);
  });
  await check('Registra a data do navegador em vez da data fixa da demonstração',async()=>{
    await page.evaluate(()=>{OffDemo.register();});
    assert.equal(await page.evaluate(()=>OffDemo.getState().orders[0].date),'02/01/2027');
    await page.evaluate(({storageKey,saved})=>localStorage.setItem(storageKey,saved),{storageKey,saved});
  });
  for(const mode of ['captura=1','tela=resultado','teste=1']){
    await check(`Preserva armazenamento da demonstração em ?${mode}`,async()=>{
      await page.goto(`${base}/index.html?${mode}`);
      if(mode==='teste=1'){
        await page.waitForFunction(()=>window.OFF_CHECKS);
        assert.equal(await page.evaluate(()=>OFF_CHECKS.success),true);
      }
      await page.evaluate(()=>{OffDemo.reset();OffDemo.register();document.getElementById('reiniciar').click();});
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),storageKey),saved);
    });
  }
  const invalidCases={
    'JSON incompleto':()=>'{',
    'saldo negativo':s=>{s.stocks['COQ-001']=-1;},
    'saldo ausente':s=>{delete s.stocks['CAT-001'];},
    'pedidos fora de uma lista':s=>{s.orders={};},
    'produto desconhecido':s=>{s.orders[0].items[0].sku='INVALID';},
    'status desconhecido':s=>{s.orders[0].status='INVALID';},
    'quantidade inválida':s=>{s.orders[0].items[0].q=0;},
    'preço inválido':s=>{s.orders[0].items[0].unit=-1;},
    'data inexistente':s=>{s.orders[0].date='31/02/2026';},
    'identificadores repetidos':s=>{s.orders[1].id=s.orders[0].id;},
    'pedido sem itens':s=>{s.orders[0].items=[];}
  };
  for(const [name,corrupt] of Object.entries(invalidCases)){
    await check(`Recupera demonstração com ${name}`,async()=>{
      const state=JSON.parse(saved),raw=corrupt(state)||JSON.stringify(state);
      await page.evaluate(({storageKey,raw})=>localStorage.setItem(storageKey,raw),{storageKey,raw});
      await page.goto(base);
      assert.equal(await page.evaluate(()=>OffDemo.getState().stocks['COQ-001']),2);
      assert.equal(await page.locator('tbody tr').count(),20);
    });
  }
  await check('Restaura lista vazia válida e persiste o primeiro pedido',async()=>{
    const empty=JSON.parse(saved);empty.orders=[];empty.result=null;
    await page.evaluate(({storageKey,empty})=>localStorage.setItem(storageKey,JSON.stringify(empty)),{storageKey,empty});
    await page.goto(base);
    assert.equal(await page.locator('.empty').innerText(),'Nenhum pedido registrado.');
    await page.evaluate(()=>{OffDemo.register();});await page.reload();
    assert.equal(await page.evaluate(()=>OffDemo.getState().orders[0].id),1);
    assert.equal(await page.evaluate(()=>OffDemo.getState().stocks['COQ-001']),6);
  });
  await page.close();
  await check('Funciona quando o navegador bloqueia o armazenamento local',async()=>{
    const blocked=await browser.newContext();
    try{
      await blocked.addInitScript(()=>{
        Storage.prototype.getItem=()=>{throw new Error('Armazenamento bloqueado');};
        Storage.prototype.setItem=()=>{throw new Error('Armazenamento bloqueado');};
      });
      const p=await blocked.newPage();await p.goto(base);
      assert.equal(await p.evaluate(()=>OffDemo.register()),true);
    }finally{await blocked.close();}
  });
  await check('Host informa tempo limite se os testes não carregarem',async()=>{
    const p=await context.newPage();
    try{
      await p.route('**/checks.js',route=>route.abort());
      await p.goto(`${base}/checks-host.html?width=320`);
      const result=JSON.parse(await p.locator('#test-results').innerText());
      assert.equal(result.success,false);assert.match(result.error,/Tempo limite/);
    }finally{await p.close();}
  });
  await context.close();report.success=true;
}

try{
  await Promise.race([run(),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('Tempo limite global de 120 segundos excedido.')),120000);})]);
}catch(error){report.error=error.message;console.error(error);process.exitCode=1;}
finally{
  clearTimeout(deadline);
  if(browser)await browser.close();
  if(server.listening)await new Promise(resolve=>server.close(resolve));
  await mkdir(dirname(reportPath),{recursive:true});
  await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log('Relatório: '+reportPath);
}
