import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeCoverage, productionFiles } from './coverage.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const started=performance.now();
async function run(args,env=process.env){
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit'});
    child.once('error',reject);
    child.once('exit',code=>code===0?resolve():reject(new Error(`Execução reprovada: ${args.join(' ')} (código ${code}).`)));
  });
}
try{
  await mkdir(resolve(root,'coverage'),{recursive:true});
  const nodeDir=await mkdtemp(resolve(root,'coverage/node-'));
  await run(['--test','tests/order-rules.test.mjs'],{...process.env,NODE_V8_COVERAGE:nodeDir});
  await run(['scripts/run-checks.mjs','--coverage']);
  const entries=JSON.parse(await readFile(resolve(root,'coverage/browser-v8.json'),'utf8'));
  for(const file of await readdir(nodeDir)){
    if(file.endsWith('.json'))entries.push(...JSON.parse(await readFile(resolve(nodeDir,file),'utf8')).result);
  }
  const coverage=await writeCoverage(root,entries);
  const sourceHashes=Object.fromEntries(await Promise.all(productionFiles.map(async file=>[file,createHash('sha256').update(await readFile(resolve(root,file))).digest('hex')])));
  const measurement={executedAt:new Date().toISOString(),success:true,scope:productionFiles,sourceHashes,metric:'lines',integerPercent:Math.floor(coverage.summary.lines.pct),...coverage,durationMs:Math.round(performance.now()-started)};
  await writeFile(resolve(root,'coverage/measurement.json'),JSON.stringify(measurement,null,2)+'\n');
  if(process.env.GITHUB_STEP_SUMMARY){
    const checks=JSON.parse(await readFile(resolve(root,'test-results/verificacao.json'),'utf8'));
    const count=checks.regressions.length+checks.viewports.reduce((sum,viewport)=>sum+viewport.results.length,0);
    const summary=[
      '## Testes e cobertura','',
      `Testes unitários e de integração: **PASS**. Verificações no navegador: **${count} aprovadas**.`,'',
      '| Métrica | Resultado |','| --- | --- |',
      `| Linhas | ${measurement.summary.lines.pct}% (${measurement.summary.lines.covered}/${measurement.summary.lines.total}) |`,
      `| Funções | ${measurement.summary.functions.pct}% |`,
      `| Ramos | ${measurement.summary.branches.pct}% |`,
      `| Duração total | ${(measurement.durationMs/1000).toFixed(2)} s |`,'',
      'Escopo: `app.js` e `order-rules.js`. Relatórios disponíveis no artefato `verificacao-prototipo`.',''
    ].join('\n');
    await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
  }
  console.log(`COVERAGE: ${measurement.summary.lines.pct}% das linhas de app.js e order-rules.js (${measurement.summary.lines.covered}/${measurement.summary.lines.total}).`);
  console.log(`PASS: testes unitários e de integração aprovados em ${(measurement.durationMs/1000).toFixed(2)} segundos.`);
}catch(error){console.error(error);process.exitCode=1;}
