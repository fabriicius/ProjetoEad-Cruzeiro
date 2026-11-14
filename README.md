# Protótipo local da OFF Nutrition Lab

Abra `index.html` em um navegador atual. Os arquivos HTML, CSS e JavaScript são locais, sem dependências externas. Para uma abertura por servidor local, execute neste diretório:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Acesse `http://127.0.0.1:8765/`. Para encerrar o servidor, use Ctrl+C.

## Fluxo de demonstração

1. No painel, use Novo pedido. O formulário começa com uma unidade fictícia de COQ-001 no resumo para facilitar a demonstração.
2. Com o saldo inicial de duas unidades, informe quantidade 3 e registre. O resultado explica a falta de estoque sem confirmar a venda.
3. Use Corrigir quantidade, altere para 1 e registre novamente. Com os dados iniciais, o pedido 1042 será confirmado com a data atual, total de R$ 39,90 e saldo de uma unidade.
4. Avance para Separado e Enviado. O saldo não será reduzido outra vez.
5. Volte ao painel e consulte o pedido. Produtos e Dúvidas frequentes abrem consultas auxiliares. Reiniciar demonstração restaura os dados fictícios.

## Dados salvos e capturas

As regras de validação do estado, cálculo de totais e identificação dos pedidos ficam em `order-rules.js`, sem acesso ao DOM ou ao armazenamento. O arquivo `app.js` cuida da navegação, das telas e da persistência. Os scripts são carregados nessa ordem, mantendo a abertura direta de `index.html`.

Antes de registrar uma venda, as regras também recusam produtos repetidos, quantidades fora da precisão segura, produtos desconhecidos e saldos inválidos. Os itens são reconstruídos somente com SKU, quantidade e preço do catálogo, ignorando preços e campos extras recebidos no rascunho. A validação de todos os itens termina antes de criar o pedido ou reduzir o estoque.

A navegação normal salva os dados fictícios no armazenamento local do navegador. Ao reabrir a página, o protótipo valida os pedidos e saldos. Dados inválidos fazem a demonstração voltar ao estado inicial. Se o navegador bloquear o armazenamento, a navegação continua em memória, sem garantia de manter as alterações após recarregar.

Para preparar capturas com dados iniciais, abra `index.html?captura=1`. Os parâmetros `tela=novo`, `tela=resultado` e `tela=resultado&estado=erro` permitem abrir os estados da demonstração. Testes e páginas com `captura`, `teste` ou `tela` trabalham em memória e não alteram os dados salvos da navegação normal.

## Verificações realizadas

O executor verifica o fluxo de pedidos e as dimensões da interface em áreas de visualização de 1440, 390 e 320 pixels CSS. Inclui paginação, rótulos, quantidades inválidas, falta de estoque, correção de dados, registro e andamento dos pedidos, pedidos com dois produtos, lista vazia, data atual, recuperação de dados salvos e isolamento dos testes. Também verifica transbordamento horizontal, controles de ao menos 44 pixels e o tempo limite do host.

Para executar automaticamente, instale Node.js 22 ou superior e rode:

```bash
npm ci
npx playwright install chromium
npm test
```

O comando executa primeiro os testes unitários das regras, sem navegador, e depois as verificações de interface e armazenamento com Chromium. Para executar somente os testes unitários, use `npm run test:unit`.

Para medir a cobertura, execute `npm run test:coverage`. O comando reúne as execuções V8 dos testes unitários e dos testes no Chromium, convertidas e consolidadas pelo Istanbul. O escopo é o código JavaScript de produção: `app.js` e `order-rules.js`. Testes, scripts de automação, bibliotecas, HTML e CSS ficam fora desse percentual. Arquivos de produção sem execução também entram no denominador.

O relatório detalhado fica em `coverage/index.html`, o resumo em `coverage/coverage-summary.json` e a medição com escopo, hashes dos fontes e duração em `coverage/measurement.json`. O terminal mostra linhas, funções e ramos separadamente. Como o código contém várias operações na mesma linha, 100% de linhas não implica que todas as funções ou alternativas de decisão foram exercitadas.

Em Linux, se faltarem bibliotecas do sistema, use `npx playwright install --with-deps chromium`. O executor inicia e encerra seu próprio servidor local. O processo retorna código diferente de zero se alguma verificação falhar e salva o relatório em `test-results/verificacao.json`. Para atualizar o relatório versionado, execute `npm run test:report` depois de instalar as dependências.

Se quiser usar um Google Chrome já instalado, execute `PLAYWRIGHT_CHANNEL=chrome npm test`. Essa alternativa não exige o download do Chromium. Node.js e Playwright são usados somente nas verificações; a interface continua sem dependências externas em execução.

O workflow `.github/workflows/verificacoes.yml` executa `npm run test:coverage` em pushes para `main` e `develop`, em pull requests para `main`, e também pode ser iniciado manualmente. O resumo da execução mostra aprovação, cobertura e duração. Os relatórios de testes e cobertura ficam disponíveis como artefato `verificacao-prototipo` no GitHub Actions por 14 dias. Os dados brutos do V8 ficam fora desse artefato. O workflow não altera automaticamente o relatório versionado.

`contraste.json` registra o cálculo das combinações principais de texto e fundo, todas acima de 4,5:1. Isso não constitui auditoria completa de acessibilidade. A avaliação com representante externo, a operação em aparelhos reais, o teste integral de teclado, leitor de tela e ampliação de texto ainda deverão ocorrer.

Para executar apenas as verificações de interface manualmente, com o servidor ativo, abra `checks-host.html?width=320`, `checks-host.html?width=390` ou `checks-host.html?width=1440`. O resultado é apresentado como JSON após as verificações. O host informa uma falha se não receber resultados em 10 segundos. Os testes adicionais de armazenamento e data controlada são executados por `npm test`.

## Alcance

Este é um protótipo de interface com dados fictícios e simulação local no navegador. Ele não realiza vendas, não recebe pagamentos e não possui autenticação real, autorização no servidor, proteção de concorrência entre usuários ou banco PostgreSQL. Os dados demonstrativos podem ser guardados no armazenamento local do navegador.

A arquitetura planejada em Python, Django e PostgreSQL permanece válida para a implementação. O RNF03 de carregamento em rede móvel não foi medido neste protótipo; as capturas e os testes locais não o comprovam. Nenhuma captura foi enviada automaticamente ao ambiente acadêmico.
