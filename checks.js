/* Verificações do protótipo executadas somente com ?teste=1. */
(async()=>{
 const api=window.OffDemo,results=[];
 const check=(name,condition)=>{results.push({name,passed:Boolean(condition)});if(!condition)throw new Error(name);};
 try{
  api.reset();api.render('pedidos');
  check('Paginação: vinte registros na primeira página',document.querySelectorAll('tbody tr').length===20);
  document.getElementById('proxima').click();
  check('Navegação para a segunda página',document.querySelector('.order-id').textContent==='#1021');
  document.getElementById('novo-pedido').click();api.render('novo');
  check('Campos com rótulos associados',[...document.querySelectorAll('input,select')].every(e=>document.querySelector(`label[for="${e.id}"]`)));
  const setQuantity=n=>{const input=document.getElementById('quantidade');input.value=n;input.dispatchEvent(new Event('input',{bubbles:true}));};
  setQuantity(3);
  check('Rejeição de quantidade acima do saldo',api.register()===false);
  check('Erro não altera estoque nem cria pedido',api.getState().stocks['COQ-001']===2&&api.getState().orders.length===40);
  api.render('resultado');
  check('Erro informa disponibilidade e como corrigir',document.getElementById('app').textContent.includes('Há 2 unidades em estoque. Informe no máximo 2.'));
  document.getElementById('corrigir').click();api.render('novo');
  check('Dados preservados ao retornar à correção',document.getElementById('quantidade').value==='3'&&document.getElementById('canal').value==='WhatsApp');
  setQuantity(1);
  check('Pedido válido confirmado',api.register()===true);
  check('Preço e baixa corretos',api.getState().orders[0].id===1042&&api.getState().orders[0].items[0].unit===3990&&api.getState().stocks['COQ-001']===1&&api.total(api.getState().orders[0].items)===3990);
  api.render('resultado');document.getElementById('advance-status').click();
  check('Novo avança para separado sem baixa adicional',api.getState().orders[0].status==='separado'&&api.getState().stocks['COQ-001']===1);
  document.getElementById('advance-status').click();
  check('Separado avança para enviado sem baixa adicional',api.getState().orders[0].status==='enviado'&&api.getState().stocks['COQ-001']===1&&!document.getElementById('advance-status'));
  api.reset();api.getDraft().items[0].q=0;
  check('Quantidade zero recusada',api.register()===false);
  api.reset();api.getDraft().items[0].q=1.5;
  check('Quantidade fracionada recusada',api.register()===false);
  api.reset();api.getDraft().items=[];
  check('Pedido vazio recusado',api.register()===false);
  api.reset();api.getDraft().items.push({sku:'CAT-001',q:9,unit:11990});
  check('Falha no segundo item não altera o primeiro saldo',api.register()===false&&api.getState().stocks['COQ-001']===2&&api.getState().stocks['CAT-001']===8);
  api.reset();api.render('novo');document.getElementById('add-item').click();
  check('Adicionar produto existente não duplica a linha',api.getDraft().items.length===1);
  document.querySelector('[data-dialog="produtos"]').click();
  check('Consulta auxiliar de produtos abre',document.getElementById('aux-dialog').open&&document.getElementById('dialog-content').textContent.includes('COQ-001'));
  document.getElementById('fechar-dialog').click();
  document.querySelector('[data-dialog="duvidas"]').click();
  check('Consulta auxiliar de dúvidas abre',document.getElementById('dialog-content').textContent.includes('600 ml'));
  document.getElementById('fechar-dialog').click();
  api.reset();api.getState().orders=[];api.render('pedidos');
  check('Lista vazia informa zero pedidos',document.querySelector('.empty')?.textContent==='Nenhum pedido registrado.'&&document.querySelector('.pagination').textContent.includes('Exibindo 0 a 0 de 0 pedidos'));
  check('Lista vazia mantém paginação válida e desabilitada',document.querySelector('.page-label').textContent==='1 / 1'&&document.getElementById('anterior').disabled&&document.getElementById('proxima').disabled);
  check('Primeiro pedido recebe identificador válido',api.register()===true&&api.getState().orders[0].id===1);
  check('Novo pedido usa a data atual',api.getState().orders[0].date===new Date().toLocaleDateString('pt-BR'));
  api.reset();api.render('pedidos');document.getElementById('proxima').click();
  api.getState().orders=[];api.render('pedidos');
  check('Paginação retorna à primeira página após esvaziar lista',document.querySelector('.page-label').textContent==='1 / 1');
  api.reset();api.getDraft().items.push({sku:'CAT-001',q:2,unit:11990});
  check('Pedido com dois produtos é registrado',api.register()===true&&api.getState().orders[0].items.length===2);
  api.render('resultado');
  const balances=()=>[...document.querySelectorAll('.stock-update p')].map(p=>p.textContent);
  const expectedBalances=['Coqueteleira OFF 600 ml: 1 unidade(s)','Catalyze Pro 300 g: 6 unidade(s)'];
  check('Resultado mostra o saldo de todos os produtos',JSON.stringify(balances())===JSON.stringify(expectedBalances));
  document.getElementById('advance-status').click();
  check('Mudança de status preserva ambos os saldos',JSON.stringify(balances())===JSON.stringify(expectedBalances));
  const layouts=[];
  for(const route of ['pedidos','novo','resultado']){
   if(route==='resultado'){api.reset();api.register();}
   api.render(route);
   layouts.push({route,viewport:innerWidth,content:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,bodyHeight:innerHeight});
   check('Sem transbordamento horizontal: '+route,document.documentElement.scrollWidth<=innerWidth);
   const visible=[...document.querySelectorAll('button,input,select,.button,.nav-item')].filter(e=>e.getClientRects().length&&!e.closest('dialog'));
   check('Alvos de toque de ao menos 44 px: '+route,visible.every(e=>{const b=e.getBoundingClientRect();return b.width>=44&&b.height>=44;}));
  }
  window.OFF_CHECKS={success:true,results,layouts};
 }catch(e){window.OFF_CHECKS={success:false,results,error:e.message};}
 await new Promise(resolve=>setTimeout(resolve,100));
 const pre=document.createElement('pre');pre.id='test-results';pre.textContent=JSON.stringify(window.OFF_CHECKS);document.body.appendChild(pre);
})();
