import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import v8toIstanbul from 'v8-to-istanbul';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

export const productionFiles=['app.js','order-rules.js'];

// Interrompe a coleta antes de navegar para não perder o contexto anterior.
export class BrowserCoverage {
  entries=[];
  pages=new Set();
  async track(page){
    this.pages.add(page);
    await page.coverage.startJSCoverage();
    for(const method of ['goto','reload']){
      const navigate=page[method].bind(page);
      page[method]=async(...args)=>{
        await this.flush(page);
        await page.coverage.startJSCoverage();
        return navigate(...args);
      };
    }
    const close=page.close.bind(page);
    page.close=async(...args)=>{
      if(this.pages.has(page)){
        await this.flush(page);this.pages.delete(page);
      }
      return close(...args);
    };
  }
  async flush(page){
    this.entries.push(...await page.coverage.stopJSCoverage());
  }
  async flushContext(context){
    for(const page of [...this.pages]){
      if(page.context()===context){await this.flush(page);this.pages.delete(page);}
    }
  }
  async save(root){
    for(const page of [...this.pages]){
      if(!page.isClosed())await this.flush(page);
      this.pages.delete(page);
    }
    await mkdir(resolve(root,'coverage'),{recursive:true});
    await writeFile(resolve(root,'coverage/browser-v8.json'),JSON.stringify(this.entries));
  }
}

export async function writeCoverage(root,entries){
  const coverageMap=libCoverage.createCoverageMap({});
  const sources=new Map();
  for(const file of productionFiles){
    const path=resolve(root,file),source=await readFile(path,'utf8');
    sources.set(file,{path,source});
    // Inclui todo o código de produção no denominador, mesmo sem execução.
    const converter=v8toIstanbul(path,0,{source});
    await converter.load();
    converter.applyCoverage([{functionName:'',isBlockCoverage:true,ranges:[{startOffset:0,endOffset:source.length,count:0}]}]);
    coverageMap.merge(converter.toIstanbul());
  }
  for(const entry of entries){
    let path;
    try{path=entry.url.startsWith('file:')?fileURLToPath(entry.url):entry.url.startsWith('/')?entry.url:decodeURIComponent(new URL(entry.url).pathname);}
    catch{continue;}
    const source=sources.get(basename(path));
    if(!source)continue;
    // Entradas do navegador têm fonte; entradas Node precisam do caminho exato.
    if(entry.source!==undefined?entry.source!==source.source:path!==source.path)continue;
    const converter=v8toIstanbul(source.path,0,{source:source.source});
    await converter.load();converter.applyCoverage(entry.functions);
    coverageMap.merge(converter.toIstanbul());
  }
  const context=libReport.createContext({dir:resolve(root,'coverage'),coverageMap});
  for(const format of ['json','json-summary','html','lcovonly','text'])reports.create(format).execute(context);
  const files=Object.fromEntries(coverageMap.files().map(path=>[basename(path),coverageMap.fileCoverageFor(path).toSummary().toJSON()]));
  return {summary:coverageMap.getCoverageSummary().toJSON(),files};
}
