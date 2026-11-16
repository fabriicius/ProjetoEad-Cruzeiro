# Monitoramento de disponibilidade

O projeto possui uma rota pública `GET /health/` e o workflow **Monitorar disponibilidade**. A rota consulta o banco com `SELECT 1`, sem alterar os dados, e responde:

- HTTP 200 com `status: UP` e `database: UP` quando a consulta funciona.
- HTTP 503 com `status: DOWN` e `database: DOWN` quando o banco está indisponível.

A resposta não inclui credenciais ou detalhes internos e não deve ser armazenada em cache. Ela verifica a aplicação e a conexão ao banco; não substitui os testes das operações de venda.

## Ativar depois do deploy

1. Integre a PR do monitoramento em `main`. Os agendamentos do GitHub Actions executam na branch padrão.
2. No repositório, abra **Settings → Secrets and variables → Actions → Variables → New repository variable**.
3. Crie a variável **APP_URL** com a URL pública HTTPS da aplicação, sem credenciais ou parâmetros. Exemplo de formato: `https://seu-projeto.vercel.app`.
4. Abra **Actions → Monitorar disponibilidade → Run workflow**, selecione `main` e execute.
5. Abra a execução e consulte o resumo **Disponibilidade da aplicação**.

A programação é de cinco em cinco minutos, fora do início de cada hora. O horário efetivo pode sofrer atrasos na fila do GitHub Actions. Consulte a [documentação dos agendamentos](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Resultados e falhas

O script `scripts/check_availability.py` acessa `/health/`, exige HTTP 200 e verifica os dois campos UP no JSON. HTML de login, erros HTTP, timeout ou banco indisponível não contam como sucesso. São feitas até três tentativas, com timeout de 12 segundos por tentativa e intervalo de cinco segundos entre falhas.

- **UP:** resposta válida da aplicação e do banco.
- **DOWN:** falha nas três tentativas; o workflow termina com erro e fica vermelho no Actions.
- **AGUARDANDO URL:** APP_URL não foi configurada; nenhum teste público foi executado. A conclusão do job não deve ser interpretada como disponibilidade da aplicação.
- **ERRO DE CONFIGURAÇÃO:** endereço inválido; o workflow termina com erro.

O resumo mostra endpoint, horário UTC, HTTP, tentativas e duração. O relatório JSON fica no artefato `disponibilidade-<id da execução>`, com retenção de 30 dias. O histórico de execuções permite comparar verificações UP e DOWN, mas não calcula um percentual mensal de uptime.

Para receber avisos, configure no seu perfil do GitHub **Settings → Notifications → System → Actions**, habilitando notificações na web ou por e-mail e, se desejar, somente de workflows com falha. As preferências da conta não foram alteradas por esta implementação. Veja a [orientação oficial de notificações](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications).

## Prints para a atividade

Depois de configurar a URL, execute o monitor, abra o resultado e capture o resumo com **UP**, endpoint público, horário e HTTP 200. Mantenha o nome do workflow visível. Um segundo print pode mostrar APP_URL na aba de variáveis do repositório. Uma execução aguardando URL comprova apenas a preparação, não a disponibilidade em produção.

## Conferência local

Com o servidor local iniciado, execute:

```bash
.venv/bin/python scripts/check_availability.py --url http://127.0.0.1:8765/ --output test-results/availability-local.json
```

Sem APP_URL, executar o script sem argumentos gera um relatório NOT_CONFIGURED. Os testes de UP, DOWN, falhas HTTP, timeout, repetição e configuração fazem parte de `python manage.py test`.
