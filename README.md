# Protótipo local da OFF Nutrition Lab

Abra `index.html` em um navegador atual. Os arquivos HTML, CSS e JavaScript são locais, sem dependências externas. Para uma abertura por servidor local, execute neste diretório:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Acesse `http://127.0.0.1:8765/`. Para encerrar o servidor, use Ctrl+C.

## Fluxo de demonstração

1. No painel, use Novo pedido. O formulário começa com uma unidade fictícia de COQ-001 no resumo para facilitar a demonstração.
2. Com o saldo inicial de duas unidades, informe quantidade 3 e registre. O resultado explica a falta de estoque sem confirmar a venda.
3. Use Corrigir quantidade, altere para 1 e registre novamente. O pedido 1042 será confirmado com total de R$ 39,90 e saldo de uma unidade.
4. Avance para Separado e Enviado. O saldo não será reduzido outra vez.
5. Volte ao painel e consulte o pedido. Produtos e Dúvidas frequentes abrem consultas auxiliares. Reiniciar demonstração restaura os dados fictícios.

## Capturas

As imagens finais estão em `../respostas/imagens/`, com três telas principais e um estado de erro adicional da terceira tela. Foram renderizadas no Chrome em 1440 × 1000 pixels, sem elementos do navegador ou dados pessoais reais.

O arquivo `../respostas/questions2.2-resposta.md` contém as capturas no corpo das respostas e as descrições correspondentes.

## Verificações realizadas

`verificacao.json` registra verificações do comportamento demonstrativo e das dimensões da interface em áreas de visualização de 1440, 390 e 320 pixels CSS. Foram conferidos: paginação, rótulos associados, quantidades inválidas, falta de estoque, preservação dos dados na correção, registro válido, avanço dos status sem nova baixa, pedido vazio, ausência de alteração parcial dos saldos e consultas auxiliares. Foram verificadas ainda a ausência de transbordamento horizontal e dimensões mínimas de 44 pixels dos controles avaliados.

`contraste.json` registra o cálculo das combinações principais de texto e fundo, todas acima de 4,5:1. Isso não constitui auditoria completa de acessibilidade. A avaliação com representante externo, a operação em aparelhos reais, o teste integral de teclado, leitor de tela e ampliação de texto ainda deverão ocorrer.

Para repetir as verificações automatizadas com o servidor ativo, abra `checks-host.html?width=320`, `checks-host.html?width=390` ou `checks-host.html?width=1440`. O resultado é apresentado como JSON após as verificações.

## Alcance

Este é um protótipo de interface com dados fictícios e simulação local no navegador. Ele não realiza vendas, não recebe pagamentos e não possui autenticação real, autorização no servidor, proteção de concorrência entre usuários ou banco PostgreSQL. Os dados demonstrativos podem ser guardados no armazenamento local do navegador.

A arquitetura planejada em Python, Django e PostgreSQL permanece válida para a implementação. O RNF03 de carregamento em rede móvel não foi medido neste protótipo; as capturas e os testes locais não o comprovam. Nenhuma captura foi enviada automaticamente ao ambiente acadêmico.
