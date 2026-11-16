import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// O módulo deve funcionar sem document, window ou localStorage.
const sandbox={};
const rulesFile=fileURLToPath(new URL('../assets/order-rules.js',import.meta.url));
vm.runInNewContext(readFileSync(rulesFile,'utf8'),sandbox,{filename:rulesFile});
const rules=sandbox.OffOrderRules;
const config={products:[{sku:'COQ-001'},{sku:'CAT-001'}],channels:['WhatsApp'],statuses:{novo:'Novo'}};
const fixture=()=>({stocks:{'COQ-001':2,'CAT-001':8},orders:[{id:1,channel:'WhatsApp',date:'13/11/2026',status:'novo',items:[{sku:'COQ-001',q:1,unit:3990}]}]});

test('valida datas reais, inclusive anos bissextos',()=>{
  assert.equal(rules.validDate('29/02/2028'),true);
  for(const value of ['29/02/2026','31/04/2026','2026-11-13',null])assert.equal(rules.validDate(value),false);
});

test('valida estado salvo sem depender da interface',()=>{
  assert.equal(rules.validState(fixture(),config),true);
  const empty=fixture();empty.orders=[];
  assert.equal(rules.validState(empty,config),true);
  for(const value of [null,{}, {stocks:[],orders:[]}])assert.equal(rules.validState(value,config),false);
});

test('recusa saldos inválidos, itens desconhecidos e identificadores repetidos',()=>{
  const mutations=[
    s=>{s.stocks['COQ-001']=-1;},
    s=>{s.orders[0].items[0].sku='INVALID';},
    s=>{s.orders.push(structuredClone(s.orders[0]));}
  ];
  for(const mutate of mutations){const state=fixture();mutate(state);assert.equal(rules.validState(state,config),false);}
});

test('calcula o total em centavos, incluindo lista vazia',()=>{
  assert.equal(rules.total([{q:2,unit:3990},{q:1,unit:11990}]),19970);
  assert.equal(rules.total([]),0);
});

test('gera identificador após o maior existente e começa em um na lista vazia',()=>{
  assert.equal(rules.nextOrderId([{id:8},{id:3}]),9);
  assert.equal(rules.nextOrderId([]),1);
});

const orderConfig=()=>({stocks:{'COQ-001':2,'CAT-001':8},products:[{sku:'COQ-001',price:3990},{sku:'CAT-001',price:11990}],channels:['WhatsApp']});
const draft=()=>({channel:'WhatsApp',items:[{sku:'COQ-001',q:1,unit:1,extra:'campo não permitido'}]});

test('normaliza os itens, usa o preço do catálogo e não modifica a entrada',()=>{
  const input=draft(),before=JSON.stringify(input);
  const result=rules.validateOrder(input,orderConfig());
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{channel:'WhatsApp',items:[{sku:'COQ-001',q:1,unit:3990}]});
  assert.equal(JSON.stringify(input),before);
});

test('recusa SKU repetido antes de qualquer baixa de estoque',()=>{
  const input=draft(),options=orderConfig(),before=JSON.stringify(options.stocks);
  input.items.push({sku:'COQ-001',q:2});
  assert.equal(rules.validateOrder(input,options).error,'duplicado');
  assert.equal(JSON.stringify(options.stocks),before);
});

test('recusa canal inválido, lista malformada e produto desconhecido',()=>{
  assert.equal(rules.validateOrder(null,orderConfig()).error,'canal');
  assert.equal(rules.validateOrder({...draft(),channel:'<script>'},orderConfig()).error,'canal');
  for(const items of [null,{},[]])assert.equal(rules.validateOrder({...draft(),items},orderConfig()).error,'vazio');
  for(const item of [null,{sku:'INVALID',q:1}])assert.equal(rules.validateOrder({...draft(),items:[item]},orderConfig()).error,'produto');
});

test('recusa quantidades não inteiras ou fora da precisão segura',()=>{
  for(const q of [0,-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1,'1']){
    const input=draft();input.items[0].q=q;
    assert.equal(rules.validateOrder(input,orderConfig()).error,'quantidade');
  }
});

test('recusa saldo inválido e informa falta de estoque sem mutação parcial',()=>{
  for(const available of [-1,undefined,'2',NaN]){
    const options=orderConfig();options.stocks['COQ-001']=available;
    assert.equal(rules.validateOrder(draft(),options).error,'saldo');
  }
  const input=draft(),options=orderConfig(),before=JSON.stringify(options.stocks);
  input.items.push({sku:'CAT-001',q:9});
  const result=rules.validateOrder(input,options);
  assert.equal(result.error,'estoque');assert.equal(result.available,8);assert.equal(result.requested,9);
  assert.equal(JSON.stringify(options.stocks),before);
});

test('recusa preço inválido e totais fora da precisão segura',()=>{
  const badPrice=orderConfig();badPrice.products[0].price=NaN;
  assert.equal(rules.validateOrder(draft(),badPrice).error,'valor');
  const huge=2**52,options=orderConfig();
  options.products.forEach(p=>{p.price=1;options.stocks[p.sku]=huge;});
  const input={channel:'WhatsApp',items:[{sku:'COQ-001',q:huge},{sku:'CAT-001',q:huge}]};
  assert.equal(rules.validateOrder(input,options).error,'valor');
  options.products[0].price=3990;
  assert.equal(rules.validateOrder({...draft(),items:[{sku:'COQ-001',q:huge}]},options).error,'valor');
});
