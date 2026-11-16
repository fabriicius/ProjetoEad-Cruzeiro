/* Interface do MVP: o servidor Django é a fonte dos produtos, pedidos e saldos. */
const money = cents => (cents / 100).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names = {novo:'Novo',separado:'Separado',enviado:'Enviado'};
const symbols = {novo:'○',separado:'▣',enviado:'✓'};
const channels = ['WhatsApp','Instagram','Shopify','Shopee'];
let products=[], state={stocks:{},orders:[],result:null,count:0,pages:1,faqs:[]};
let page=1, draft;
const newDraft=()=>({channel:'WhatsApp',items:[],selected:products.find(p=>p.active)?.sku||'',q:1,request_key:crypto.randomUUID()});
async function request(url, data){
  const headers={'Accept':'application/json'};
  const options={credentials:'same-origin',headers,cache:'no-store'};
  if(data!==undefined){options.method='POST';headers['Content-Type']='application/json';headers['X-CSRFToken']=document.querySelector('[name=csrfmiddlewaretoken]').value;options.body=JSON.stringify(data);}
  const response=await fetch(url,options);
  if(response.status===401){location.assign('/entrar/');throw new Error('Entre novamente para continuar.');}
  const payload=await response.json().catch(()=>({error:'Não foi possível concluir a operação. Confira o painel antes de tentar novamente.'}));
  if(!response.ok)throw Object.assign(new Error(payload.error||'Não foi possível concluir a operação.'),payload);
  return payload;
}
async function refresh(){const data=await request('/api/state/?page='+page);products=data.products;Object.assign(state,data);page=data.page;}
function showFailure(error){toast(error.message||'Falha de conexão. Confira o painel antes de tentar novamente.');}
async function showOrder(id){
  try{const data=await request('/api/orders/'+id+'/');state.result={kind:'existing',id,order:data.order};await refresh();navigate('resultado');}
  catch(error){showFailure(error);}
}
const app=document.getElementById('app');
const product=sku=>products.find(p=>p.sku===sku);
const total=OffOrderRules.total;
const badge=status=>`<span class="badge ${esc(status)}"><span aria-hidden="true">${symbols[status]}</span>${names[status]}</span>`;

function toast(text){const el=document.getElementById('toast');el.textContent=text;el.hidden=false;setTimeout(()=>el.hidden=true,6000);}
function steps(current){return `<div class="step-line" aria-label="Etapas do registro"><div class="${current===1?'current':''}"><span>1</span> Pedidos</div><i class="step-rule" aria-hidden="true"></i><div class="${current===2?'current':''}"><span>2</span> Novo pedido</div><i class="step-rule" aria-hidden="true"></i><div class="${current===3?'current':''}"><span>3</span> Resultado</div></div>`;}
function heading(title,sub,action='',eyebrow='CONTROLE DA OPERAÇÃO'){return `<div class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1 tabindex="-1">${title}</h1><p class="subtitle">${sub}</p></div>${action}</div>`;}
function navigate(route){if(location.hash.slice(1)===route)render(route);else location.hash=route;}
function render(route=location.hash.slice(1)||'pedidos'){
  document.getElementById('order-count').textContent=state.count;
  if(route==='novo'){renderForm();document.title='Novo pedido | OFF Nutrition Lab';}
  else if(route==='resultado'){renderResult();document.title='Resultado do pedido | OFF Nutrition Lab';}
  else{renderOrders();document.title='Pedidos | OFF Nutrition Lab';}
}
function renderOrders(){
  const pages=state.pages;
  page=Math.min(Math.max(1,page),pages);
  const items=state.orders;
  app.innerHTML=heading('Pedidos','Todas as vendas em um só lugar, da entrada ao envio.',`<button class="button primary" id="novo-pedido"><span class="plus" aria-hidden="true">+</span> Novo pedido</button>`)+
  `<div class="inline-note"><span class="note-icon" aria-hidden="true">◈</span> Registre os pedidos dos seus canais e acompanhe cada etapa.</div><section class="panel" aria-labelledby="lista-title"><div class="panel-head"><h2 id="lista-title">Registro de vendas</h2><span class="small-meta">${state.count} pedidos · 20 por página</span></div><div class="table-scroll"><table><caption class="skip">Pedidos registrados na OFF Nutrition Lab</caption><thead><tr><th>Pedido</th><th>Canal</th><th>Produto / quantidade</th><th>Data</th><th>Total</th><th>Status</th><th><span aria-label="Ações">Ação</span></th></tr></thead><tbody>${items.map(o=>`<tr><td data-label="Pedido"><span class="order-id">#${o.id}</span></td><td data-label="Canal"><span class="channel"><span class="channel-symbol" aria-hidden="true">${esc(o.channel[0])}</span>${esc(o.channel)}</span></td><td data-label="Produto"><span class="item-name">${esc(product(o.items[0].sku).name)}</span><span class="item-code">${esc(o.items[0].sku)} · ${o.items[0].q} un.${o.items.length>1?` + ${o.items.length-1} item(ns)`:''}</span></td><td data-label="Data">${esc(o.date)}</td><td data-label="Total" class="money">${money(total(o.items))}</td><td data-label="Status">${badge(o.status)}</td><td data-label="Ação"><button class="view-order" data-order="${o.id}" aria-label="Consultar pedido ${o.id}">↗</button></td></tr>`).join('')}</tbody></table>${state.orders.length?'':'<p class="empty">Nenhum pedido registrado.</p>'}</div><div class="pagination"><span>Exibindo ${state.count?(page-1)*20+1:0} a ${Math.min(page*20,state.count)} de ${state.count} pedidos</span><div class="pager-actions"><button id="anterior" aria-label="Página anterior" ${page===1?'disabled':''}>‹</button><span class="page-label">${page} / ${pages}</span><button id="proxima" aria-label="Próxima página" ${page>=pages?'disabled':''}>›</button></div></div></section>`;
  document.getElementById('novo-pedido').onclick=()=>{draft=newDraft();navigate('novo');};
  document.getElementById('anterior').onclick=async()=>{page--;try{await refresh();renderOrders();}catch(error){page++;showFailure(error);}};
  document.getElementById('proxima').onclick=async()=>{page++;try{await refresh();renderOrders();}catch(error){page--;showFailure(error);}};
  document.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>showOrder(Number(b.dataset.order)));
}
function renderForm(){
  const selected=product(draft.selected);
  if(!selected){app.innerHTML=heading('Novo pedido','Cadastre um produto ativo na administração antes de registrar uma venda.')+'<a class="button" href="/admin/operacao/produto/">Administrar produtos</a>';return;}
  app.innerHTML=heading('Novo pedido','Preencha os dados da venda recebida em um dos seus canais.','','REGISTRO MANUAL')+steps(2)+
  `<form id="order-form" novalidate><div class="form-layout"><section class="panel" aria-labelledby="dados-title"><div class="panel-head"><h2 id="dados-title">Dados da venda</h2><span class="small-meta">* Campo obrigatório</span></div><div class="panel-body"><div class="field"><label for="canal">Canal de venda <span class="required">* obrigatório</span></label><select id="canal" required>${channels.map(c=>`<option ${c===draft.channel?'selected':''}>${c}</option>`).join('')}</select><span class="hint">Selecione onde este pedido foi recebido.</span></div><div class="section-label"><h3>Produto e quantidade</h3><span>Estoque central</span></div><div class="product-fields"><div><label for="produto">Produto <span class="required">*</span></label><select id="produto" required>${products.filter(p=>p.active).map(p=>`<option value="${esc(p.sku)}" ${p.sku===draft.selected?'selected':''}>${esc(p.name)} · ${esc(p.sku)}</option>`).join('')}</select><p id="stock-note" class="stock-line"><span aria-hidden="true">●</span> Estoque disponível: <b>${state.stocks[selected.sku]} unidades</b></p></div><div><label for="quantidade">Quantidade <span class="required">*</span></label><input id="quantidade" type="number" inputmode="numeric" min="1" step="1" value="${esc(draft.q)}" required aria-describedby="qty-help"></div></div><span id="qty-help" class="hint">Use uma quantidade inteira maior que zero. O saldo será conferido ao registrar.</span><button type="button" id="add-item" class="add-item">+ Adicionar item ao pedido</button><div class="cart-heading"><h3>Itens do pedido</h3><div id="cart-items"></div></div></div></section><aside class="panel summary" aria-labelledby="resumo-title"><div class="panel-head"><h2 id="resumo-title">Resumo do pedido</h2></div><div class="panel-body"><div class="summary-row"><span>Canal</span><strong id="summary-channel">${esc(draft.channel)}</strong></div><div class="summary-row"><span>Quantidade de itens</span><strong id="summary-count"></strong></div><div class="total-row"><span>Total do pedido</span><b id="summary-total"></b></div><div class="inline-note"><span class="note-icon" aria-hidden="true">○</span> Status inicial: Novo</div><p class="summary-help">Confira os dados antes de registrar. A confirmação atualiza o estoque uma única vez.</p><button type="submit" class="button primary" id="registrar">Registrar pedido <span aria-hidden="true">→</span></button><a class="back-link" href="#pedidos">← Voltar para pedidos</a><p class="form-footer">Os preços e saldos são conferidos no servidor ao confirmar.</p></div></aside></div></form>`;
  renderCart();
  document.getElementById('canal').onchange=e=>{draft.channel=e.target.value;document.getElementById('summary-channel').textContent=draft.channel;};
  document.getElementById('produto').onchange=e=>{draft.selected=e.target.value;draft.q=draft.items.find(i=>i.sku===draft.selected)?.q||1;renderForm();document.getElementById('produto').focus();};
  document.getElementById('quantidade').oninput=e=>{draft.q=e.target.value;const item=draft.items.find(i=>i.sku===draft.selected);if(item){item.q=Number(draft.q);renderCart();}};
  document.getElementById('add-item').onclick=()=>{const q=Number(draft.q);if(!Number.isInteger(q)||q<1){showError('quantidade');return;}const item=draft.items.find(i=>i.sku===draft.selected);if(item)item.q=q;else draft.items.push({sku:draft.selected,q,unit:product(draft.selected).price});renderCart();toast('Item incluído no resumo do pedido.');};
  document.getElementById('order-form').onsubmit=e=>{e.preventDefault();register();};
}
function renderCart(){
  document.getElementById('cart-items').innerHTML=draft.items.length?draft.items.map(i=>`<div class="cart-item"><div class="cart-item-main"><span class="product-tile" aria-hidden="true">▣</span><div><span class="name">${esc(product(i.sku).name)}</span><small>${esc(i.sku)} · ${esc(i.q)} un. × ${money(i.unit)}</small></div></div><button type="button" class="remove-item" data-remove="${esc(i.sku)}" aria-label="Remover ${esc(product(i.sku).name)} do pedido">×</button></div>`).join(''):'<p class="hint">Nenhum item adicionado. Selecione um produto e use Adicionar item.</p>';
  document.getElementById('summary-count').textContent=draft.items.length;
  const value=total(draft.items);document.getElementById('summary-total').textContent=Number.isFinite(value)?money(value):'Confira a quantidade';
  document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{draft.items=draft.items.filter(i=>i.sku!==b.dataset.remove);renderCart();});
}
function showError(reason,sku=draft.selected,details={}){const item=Array.isArray(draft.items)?draft.items.find(i=>i?.sku===sku):null;state.result={kind:'error',reason,sku,requested:item?.q??draft.q,available:state.stocks[sku],...details};navigate('resultado');}
async function register(){
  const button=document.getElementById('registrar');
  if(button?.disabled)return;
  if(button)button.disabled=true;
  try{
    const {order,stocks}=await request('/api/orders/',{channel:draft.channel,items:draft.items.map(i=>({sku:i.sku,q:i.q})),request_key:draft.request_key});
    Object.assign(state.stocks,stocks);
    state.result={kind:'created',id:order.id,order};
    page=1;
    try{await refresh();}catch{toast('Pedido registrado. Atualize o painel para consultar o saldo atual.');}
    navigate('resultado');
  }catch(error){
    state.result={kind:'error',message:error.message||'Falha de conexão. Confira o painel antes de tentar novamente.',...error};navigate('resultado');
  }finally{if(button)button.disabled=false;}
}
function renderResult(){
  if(!state.result){navigate('pedidos');return;}
  if(state.result.kind==='error'){renderError();return;}
  const o=state.result.order;if(!o){navigate('pedidos');return;}
  const current=['novo','separado','enviado'].indexOf(o.status),created=state.result.kind==='created';
  app.innerHTML=heading('Resultado do pedido',created?'Venda registrada. Confira os dados e acompanhe as próximas etapas.':'Consulte os dados e o andamento desta venda.','','PEDIDO #'+o.id)+steps(3)+
  `<div class="result-layout"><section class="panel" aria-labelledby="result-title"><div class="success-banner"><span class="result-icon" aria-hidden="true">✓</span><div><h2 id="result-title">${created?'Pedido registrado com sucesso':'Pedido #'+o.id}</h2><p>${created?'Os itens foram registrados e o estoque foi atualizado.':'Registro disponível para acompanhamento da equipe.'}</p></div></div><div class="panel-body"><dl class="details-grid"><div><dt>Identificador</dt><dd>#${o.id}</dd></div><div><dt>Canal de venda</dt><dd>${esc(o.channel)}</dd></div><div><dt>Data do pedido</dt><dd>${esc(o.date)}</dd></div></dl><div class="section-label"><h3>Itens registrados</h3><span>${o.items.length} item(ns)</span></div>${o.items.map(i=>`<div class="result-product"><div><b>${esc(product(i.sku).name)}</b><small>${esc(i.sku)} · ${i.q} unidade(s) × ${money(i.unit)}</small></div><strong class="money">${money(i.q*i.unit)}</strong></div>`).join('')}<div class="result-total"><span>Total do pedido</span><b>${money(total(o.items))}</b></div><div class="stock-update"><span aria-hidden="true">✓</span><div><strong>${created?'Estoque atualizado':'Estoque disponível agora'}</strong>${o.items.map(i=>`<p>${esc(product(i.sku).name)}: <b>${state.stocks[i.sku]} unidade(s)</b></p>`).join('')}</div></div><div class="result-actions"><a class="button" href="#pedidos">← Voltar para pedidos</a><button id="outro-pedido" class="button">+ Novo pedido</button></div></div></section><aside class="panel summary"><div class="panel-head"><h2>Andamento do pedido</h2></div><div class="panel-body">${badge(o.status)}<div class="timeline">${['novo','separado','enviado'].map((s,i)=>`<div class="stage ${i<=current?'on':''}"><span class="stage-dot" aria-hidden="true">${i<=current?'✓':i+1}</span><div class="stage-text"><b>${names[s]}</b><small>${['Pedido recebido e registrado','Itens separados para envio','Pedido encaminhado ao cliente'][i]}</small></div></div>`).join('')}</div><div class="side-action">${current<2?`<button id="advance-status" class="button primary">Marcar como ${current===0?'separado':'enviado'} →</button>`:'<p>✓ Todas as etapas foram concluídas.</p>'}<p>A mudança de status não altera novamente o estoque.</p></div></div></aside></div>`;
  document.getElementById('outro-pedido').onclick=()=>{draft=newDraft();navigate('novo');};
  const next=document.getElementById('advance-status');if(next)next.onclick=async()=>{next.disabled=true;try{const data=await request('/api/orders/'+o.id+'/status/',{status:['novo','separado','enviado'][current+1]});state.result.order=data.order;try{await refresh();}catch{toast('Status salvo. Atualize o painel para consultar os dados atuais.');}renderResult();toast('Status atualizado.');}catch(error){showFailure(error);next.disabled=false;}};
}
function renderError(){
  const r=state.result,p=product(r.sku)||products[0];
  const messages={vazio:'Adicione ao menos um produto ao pedido antes de registrar.',canal:'Selecione um dos quatro canais de venda disponíveis.',produto:'Selecione um produto disponível no catálogo.',duplicado:'O pedido contém um produto repetido. Remova o item repetido e ajuste a quantidade.',saldo:'Não foi possível conferir o estoque. Atualize o painel e tente novamente.',valor:'Não foi possível calcular o total do pedido. Confira os produtos e as quantidades.',identificador:'Não foi possível gerar um identificador válido. Atualize o painel e tente novamente.'};
  const message=r.message|| (r.reason==='estoque'?`Quantidade indisponível. Há ${r.available} unidades em estoque. Informe no máximo ${r.available}.`:messages[r.reason]||'Informe uma quantidade inteira maior que zero.');
  app.innerHTML=heading('Confira o pedido','Confira o resultado antes de continuar. Os dados preenchidos foram mantidos.','','REVISÃO DO PEDIDO')+steps(3)+`<section class="panel" aria-labelledby="error-title"><div class="success-banner error-banner"><span class="result-icon" aria-hidden="true">!</span><div><h2 id="error-title">Não foi possível registrar o pedido</h2><p>Confira a mensagem abaixo. Em caso de falha de conexão, consulte o painel antes de tentar novamente.</p></div></div><div class="panel-body"><div role="alert"><p class="error-copy">${esc(message)}</p>${r.available!==undefined?`<div class="error-detail"><p><strong>${esc(p.name)}</strong> · ${esc(p.sku)}</p><p>Quantidade solicitada: <strong>${esc(r.requested)}</strong></p><p>Estoque disponível: <strong>${r.available} unidades</strong></p></div>`:''}</div><p class="hint">Volte ao formulário, confira os itens e tente registrar novamente.</p><div class="result-actions"><button id="corrigir" class="button primary">${r.reason==='estoque'||r.reason==='quantidade'?'Corrigir quantidade':'Voltar ao formulário'} →</button><a class="button" href="#pedidos">← Voltar para pedidos</a></div></div></section>`;
  document.getElementById('corrigir').onclick=()=>{navigate('novo');setTimeout(()=>document.getElementById('quantidade')?.focus(),0);};
}
function openDialog(kind){const dialog=document.getElementById('aux-dialog');document.getElementById('dialog-title').textContent=kind==='produtos'?'Produtos e estoque':'Dúvidas frequentes';document.getElementById('dialog-content').innerHTML=kind==='produtos'?`<p class="dialog-copy">Disponibilidade registrada no banco de dados.</p>${products.map(p=>`<article class="mini-card"><h3>${esc(p.name)}</h3><p>${esc(p.sku)} · ${money(p.price)} · ${p.active?'Ativo':'Inativo'}</p><p>Estoque disponível: <strong>${state.stocks[p.sku]} unidades</strong></p></article>`).join('')}`:`<p class="dialog-copy">Respostas disponíveis para o atendimento.</p>${state.faqs.map(f=>`<article class="mini-card"><h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p></article>`).join('')||'<p>Nenhuma dúvida cadastrada.</p>'}`;dialog.showModal();}
document.querySelectorAll('[data-dialog]').forEach(b=>b.onclick=()=>openDialog(b.dataset.dialog));
document.getElementById('fechar-dialog').onclick=()=>document.getElementById('aux-dialog').close();
document.getElementById('sair').onclick=()=>document.getElementById('logout-form').requestSubmit();
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);document.querySelector('h1')?.focus();});
async function start(){
  try{
    await refresh();draft=newDraft();
    // Links diretos sem um pedido selecionado retornam ao painel.
    const route=location.hash.slice(1);
    render(route==='novo'?'novo':'pedidos');
  }catch(error){app.innerHTML=heading('Não foi possível carregar os dados','Confira sua conexão e tente novamente.')+'<button id="recarregar" class="button primary">Tentar novamente</button>';document.getElementById('recarregar').onclick=start;showFailure(error);}
}
start();
