/* Regras puras: não acessam o DOM nem o armazenamento do navegador. */
(function(root){
  'use strict';
function validDate(value){
  if(typeof value!=='string'||!/^\d{2}\/\d{2}\/\d{4}$/.test(value))return false;
  const [day,month,year]=value.split('/').map(Number),date=new Date(year,month-1,day);
  return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day;
}
function validState(value,{products,channels,statuses}){
  if(!value||typeof value!=='object'||!value.stocks||typeof value.stocks!=='object'||Array.isArray(value.stocks)||!Array.isArray(value.orders))return false;
  if(!products.every(p=>Number.isSafeInteger(value.stocks[p.sku])&&value.stocks[p.sku]>=0))return false;
  const ids=new Set();
  return value.orders.every(o=>{
    if(!o||!Number.isSafeInteger(o.id)||o.id<1||o.id>=Number.MAX_SAFE_INTEGER||ids.has(o.id)||!channels.includes(o.channel)||!Object.hasOwn(statuses,o.status)||!validDate(o.date)||!Array.isArray(o.items)||!o.items.length)return false;
    ids.add(o.id);
    const skus=new Set();
    return o.items.every(i=>{
      if(!i||!products.some(p=>p.sku===i.sku)||skus.has(i.sku)||!Number.isSafeInteger(i.q)||i.q<1||!Number.isSafeInteger(i.unit)||i.unit<0||!Number.isSafeInteger(i.q*i.unit))return false;
      skus.add(i.sku);return true;
    })&&Number.isSafeInteger(o.items.reduce((sum,i)=>sum+i.q*i.unit,0));
  });
}

function total(items){return items.reduce((sum,item)=>sum+item.q*item.unit,0);}
function nextOrderId(orders){return orders.reduce((max,order)=>Math.max(max,order.id),0)+1;}
function validateOrder(draft,{stocks,products,channels}){
  if(!draft||!channels.includes(draft.channel))return {error:'canal'};
  if(!Array.isArray(draft.items)||!draft.items.length)return {error:'vazio'};
  const skus=new Set(),items=[];
  let amount=0;
  for(const item of draft.items){
    const product=products.find(p=>p.sku===item?.sku);
    if(!product)return {error:'produto'};
    const sku=product.sku;
    if(skus.has(sku))return {error:'duplicado',sku};
    if(!Number.isSafeInteger(item.q)||item.q<1)return {error:'quantidade',sku};
    const available=stocks?.[sku];
    if(!Number.isSafeInteger(available)||available<0)return {error:'saldo',sku};
    if(item.q>available)return {error:'estoque',sku,requested:item.q,available};
    if(!Number.isSafeInteger(product.price)||product.price<0||!Number.isSafeInteger(item.q*product.price))return {error:'valor',sku};
    amount+=item.q*product.price;
    if(!Number.isSafeInteger(amount))return {error:'valor',sku};
    skus.add(sku);
    // Aceita somente os campos previstos e usa o preço do catálogo.
    items.push({sku,q:item.q,unit:product.price});
  }
  return {channel:draft.channel,items};
}
root.OffOrderRules=Object.freeze({validDate,validState,total,nextOrderId,validateOrder});
})(globalThis);
