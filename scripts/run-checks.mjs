import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { BrowserCoverage } from './coverage.mjs';

const base=process.env.OFFLAB_TEST_URL;
if(!base||!process.env.OFFLAB_TEST_USER||!process.env.OFFLAB_TEST_PASSWORD){
  throw new Error('Execute pelo teste Django: python manage.py test operacao.tests.test_browser. O banco de testes é isolado.');
}
const coverage=new BrowserCoverage();
const report={executedAt:new Date().toISOString(),success:false,checks:[]};
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
async function check(name,run){await run();report.checks.push({name,passed:true});console.log('PASS: '+name);}
async function login(context){
  const page=await context.newPage();
  await coverage.track(page);
  await page.goto(base);
  await page.locator('[name=username]').fill(process.env.OFFLAB_TEST_USER);
  await page.locator('[name=password]').fill(process.env.OFFLAB_TEST_PASSWORD);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.locator('#novo-pedido').waitFor();
  return page;
}
let context;
try{
  context=await browser.newContext({locale:'pt-BR'});
  const page=await login(context),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await check('Bloqueia quantidade indisponível sem criar pedido',async()=>{
    await page.locator('#novo-pedido').click();
    await page.locator('#produto').selectOption('COQ-001');
    await page.locator('#quantidade').fill('3');
    await page.locator('#add-item').click();
    await page.locator('#registrar').click();
    await page.getByRole('alert').filter({hasText:'Há 2 unidades'}).waitFor();
    const state=await page.evaluate(()=>fetch('/api/state/').then(r=>r.json()));
    assert.equal(state.count,0);assert.equal(state.stocks['COQ-001'],2);
  });
  await check('Conteúdo do catálogo não executa HTML na seleção de produtos',async()=>{assert.equal(await page.evaluate(()=>window.skuXss),undefined);assert.equal(await page.locator('#app img').count(),0);});
  await check('Corrige quantidade e grava pedido no PostgreSQL',async()=>{
    await page.locator('#corrigir').click();
    await page.locator('#quantidade').fill('1');
    await page.locator('#registrar').click();
    await page.getByRole('heading',{name:'Pedido registrado com sucesso',exact:true}).waitFor();
    await page.getByText('1 unidade(s)').first().waitFor();
    assert.match(await page.locator('.result-total').innerText(),/39,90/);
  });
  await check('Outro navegador recupera pedido, preço e saldo do banco',async()=>{
    const other=await browser.newContext();
    try{
      // A persistência independe de localStorage e de um navegador anterior.
      await other.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('bloqueado');};Storage.prototype.setItem=()=>{throw new Error('bloqueado');};});
      const second=await login(other);
      assert.equal(await second.locator('tbody tr').count(),1);
      const state=await second.evaluate(()=>fetch('/api/state/').then(r=>r.json()));
      assert.equal(state.count,1);assert.equal(state.stocks['COQ-001'],1);
      assert.equal(state.orders[0].items[0].unit,3990);
      await second.close();
    }finally{await other.close();}
  });
  await check('Avança status sem nova baixa e preserva após recarregar',async()=>{
    await page.locator('#advance-status').click();
    await page.getByRole('button',{name:/Marcar como enviado/}).waitFor();
    await page.locator('#advance-status').click();
    await page.getByText('Todas as etapas foram concluídas.').waitFor();
    await page.reload();
    await page.locator('tbody tr').waitFor();
    await page.locator('.view-order').click();
    await page.getByText('Todas as etapas foram concluídas.').waitFor();
    const state=await page.evaluate(()=>fetch('/api/state/').then(r=>r.json()));
    assert.equal(state.orders[0].status,'enviado');assert.equal(state.stocks['COQ-001'],1);
  });
  await check('Consultas de produtos e dúvidas usam conteúdo do banco',async()=>{
    await page.locator('[data-dialog=produtos]').click();
    await page.locator('#aux-dialog[open]').waitFor();
    assert.match(await page.locator('#dialog-content').innerText(),/COQ-001/);
    await page.locator('#fechar-dialog').click();
    await page.locator('[data-dialog=duvidas]').click();
    assert.match(await page.locator('#dialog-content').innerText(),/600 ml/);
    await page.locator('#fechar-dialog').click();
  });
  for(const width of [1440,390,320]){
    await check(`Layout de pedidos e formulário em ${width}px sem rolagem horizontal`,async()=>{
      await page.setViewportSize({width,height:1000});
      await page.locator('a[href="#pedidos"]').first().click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.locator('#novo-pedido').click();
      await page.locator('#registrar').waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    });
  }
  await check('Sair encerra a sessão no servidor',async()=>{
    await page.locator('#sair').click();
    await page.locator('[name=password]').waitFor();
    assert.equal(await page.evaluate(()=>fetch('/api/state/').then(r=>r.status)),401);
  });
  assert.deepEqual(errors,[]);
  await page.close();
  report.success=true;
}catch(error){report.error=error.message;process.exitCode=1;console.error(error);}
finally{
  await coverage.save(process.cwd());
  if(context)await context.close();
  await browser.close();
  await mkdir('test-results',{recursive:true});
  await writeFile('test-results/verificacao.json',JSON.stringify(report,null,2)+'\n');
}
