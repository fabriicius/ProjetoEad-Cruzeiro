import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

// O módulo deve funcionar sem document, window ou localStorage.
const sandbox={};
vm.runInNewContext(readFileSync(new URL('../order-rules.js',import.meta.url),'utf8'),sandbox);
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
