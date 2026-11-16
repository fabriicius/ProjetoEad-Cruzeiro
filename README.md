# OFF Nutrition Lab: pedidos e estoque

Para publicar este protótipo, importe o repositório e vincule o banco Prisma Postgres ao projeto. Os parâmetros do Django são automáticos; não é necessário preencher variáveis manualmente. Veja o [guia de deploy na Vercel](DEPLOY_VERCEL.md).

Aplicação  web com Python 3.13, Django 5.2 e PostgreSQL 17. A interface usa HTML, CSS e JavaScript. Produtos, pedidos, itens, dúvidas frequentes, usuários e sessões ficam no PostgreSQL, acessado pelo ORM do Django e pelo driver Psycopg. Não há persistência de negócio em localStorage ou fallback para SQLite.

## Prisma Postgres na Vercel

Na Vercel, a aplicação usa as conexões fornecidas automaticamente ao vincular o recurso Prisma Postgres ao projeto. Para execução local, é possível definir `DATABASE_URL` com a conexão **direta** e `DATABASE_URL_POOLED` com a conexão **com pool** em `.env`. Não grave as credenciais no código. `.env.local` preserva a configuração local anterior e também é ignorado pelo Git.

A aplicação prefere `DATABASE_URL_POOLED` para as consultas. A conexão exige SSL, desabilita cursores de servidor e prepared statements e fecha a conexão ao final da requisição, para funcionar com o pool transacional. Se não houver URLs configuradas, são utilizadas as variáveis locais `POSTGRES_*`.

As tabelas continuam sendo gerenciadas pelo Django, mesmo com o banco fornecido pelo Prisma. A migração inicial está em `operacao/migrations/0001_initial.py`. Para aplicar as migrações na conexão direta:

```bash
.venv/bin/python scripts/migrate_remote.py
```

Esse comando utiliza `DIRECT_URL`, se preenchida, ou `DATABASE_URL` e seus aliases `POSTGRES_URL`/`PRISMA_DATABASE_URL`. Não utiliza `DATABASE_URL_POOLED` para migrações. `DIRECT_URL` deve apontar para a conexão direta caso `DATABASE_URL` seja usada para outro destino.

O banco remoto recebeu as tabelas de produtos, pedidos, itens e dúvidas, além das tabelas de autenticação, sessões e controle de tentativas de login. Os cadastros iniciais e a conta existentes foram preservados na transferência. As credenciais de login da aplicação estão no arquivo local `LOCAL_ACCESS.md`, que não é versionado.

`manage.py test` seleciona `offlab.test_settings` automaticamente e usa apenas as variáveis locais `POSTGRES_*`, ignorando as URLs remotas. O PostgreSQL local continua necessário para a suíte de testes. Não execute os testes com um módulo de configurações de produção.

### Servidor local persistente

No Linux com systemd, inicie a aplicação em um serviço do usuário:

```bash
.venv/bin/python scripts/serve.py start
.venv/bin/python scripts/serve.py status
```

Acesse http://127.0.0.1:8765/. O serviço usa Gunicorn, permanece ativo após o terminal fechar e inicia com a sessão do usuário. Para parar, use `.venv/bin/python scripts/serve.py stop`. Para consultar os logs:

```bash
journalctl --user -u offlab-ead.service -n 50 --no-pager
```

O servidor continua na máquina local; o banco está no Prisma Postgres. Isso não publica a aplicação na hospedagem da Vercel. Para desenvolvimento em primeiro plano, `manage.py runserver` continua disponível, usando outra porta se o serviço já estiver ativo.

## Executar localmente

Requisitos: Python 3.13, Docker com Compose e Node.js 22 ou superior para os testes da interface. As dependências Python estão fixadas em `requirements.txt`.

No diretório deste README:

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/configure.py
docker compose up -d --wait
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 127.0.0.1:8765
```

Se usar uv, substitua os dois primeiros comandos por `uv venv --python 3.13 .venv` e `source .venv/bin/activate`. Para instalar, pode usar `uv pip install -r requirements.txt`.

Acesse http://127.0.0.1:8765/ e entre com a conta criada. O banco começa sem produtos ou pedidos. Para incluir dois produtos e duas dúvidas fictícias, execute separadamente:

```bash
python manage.py seed_demo
```

Esse comando não cria usuários ou pedidos, não apaga registros e não repõe o saldo de produtos já existentes. Dados do antigo protótipo no navegador não são importados automaticamente.

## Uso

- Em **Administração**, a responsável pode cadastrar e editar produtos, registrar reposições, desativar produtos e manter dúvidas frequentes. Crie as contas da equipe em Usuários. Contas ativas podem usar o painel de pedidos; o admin exige `is_staff` e as permissões específicas do Django. Conceda à equipe apenas as permissões necessárias; edição de respostas e administração de contas ficam com a responsável.
- Em **Novo pedido**, selecione o canal, produto e quantidade, clique em **Adicionar item** e confirme. O servidor utiliza o preço cadastrado e recusa produtos inativos, repetidos, quantidades inválidas e estoque insuficiente.
- **Pedido**, **itens** e **baixa de estoque** são confirmados na mesma transação. Os produtos são bloqueados com `select_for_update()` em ordem de SKU. Falhas desfazem a operação inteira. Uma chave única por confirmação permite repetir a mesma requisição sem duplicar a venda.
- O painel lista 20 pedidos por página, com paginação no servidor. A consulta mostra o preço preservado na venda. As transições permitidas são **Novo → Separado → Enviado**, sem outra baixa de estoque.
- As consultas de produtos e dúvidas frequentes leem o banco. Para consultar alterações feitas por outra pessoa, recarregue o painel.
- **Sair** encerra a sessão no servidor. Recarregar ou usar outro navegador autenticado recupera os registros do mesmo banco.

Pedidos e itens ficam somente para leitura na administração, para impedir alterações que contornem as regras de estoque. Produtos vendidos são protegidos contra exclusão por relacionamento; a interface administrativa oferece desativação.

## Configuração e dados

`scripts/configure.py` cria `.env` com chave Django e senha PostgreSQL aleatórias. Não sobrescreve um arquivo existente. `.env`, `.venv` e relatórios gerados são ignorados pelo Git. Consulte `.env.example` para os nomes das variáveis. O banco local fica em `127.0.0.1:54329`, com volume persistente do Docker. `docker compose stop` preserva os dados; não remova o volume para uma simples reinicialização.

As migrações estão em `operacao/migrations`. O PostgreSQL mantém restrições de SKU único, estoque e preço não negativos, quantidade positiva, canais e status válidos, produto único por pedido e referência de origem única por canal quando informada. O valor monetário é armazenado como decimal, e o preço de cada item é preservado no momento da venda. O serviço usa apenas preços do catálogo, nunca os enviados pelo navegador.

Para uma cópia local de segurança:

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > offlab-backup.dump
```

Guarde o arquivo fora do repositório, com acesso restrito. Para validar a restauração, crie outro banco e use `pg_restore`, sem sobrescrever a base em uso. Em produção, programe backups diários, retenção e testes de restauração no provedor.

## Monitoramento

A rota `/health/` verifica a conexão ao banco. O workflow `disponibilidade.yml` consulta esse endpoint a cada cinco minutos depois de configurada a variável `APP_URL` e integrado o arquivo à branch padrão. O resumo distingue UP, DOWN e ausência de URL. Consulte o [guia de monitoramento](MONITORAMENTO.md) para ativação, notificações e prints.

## Testes

Com o banco local ativo e o ambiente virtual preparado:

```bash
pip install -r requirements-dev.txt
npm ci
npx playwright install chromium
npm test
npm run test:coverage
.venv/bin/python -m coverage report
```

`npm test` executa os testes unitários JavaScript e a suíte Django, incluindo navegador real. Django cria e remove `test_offlab` no PostgreSQL local, sem alterar o banco `offlab` ou o banco remoto. O usuário de testes precisa poder criar bancos; essa permissão é fornecida pelo contêiner local, mas não deve ser concedida ao usuário de execução em produção.

A suíte verifica validação, persistência entre clientes, preço do servidor, rollback, restrições do banco, concorrência pela última unidade, repetição de confirmação, status, paginação, autenticação, CSRF e logout. O Playwright testa o fluxo pelas telas, inclusive com localStorage bloqueado, e os layouts em 1440, 390 e 320 pixels. Seus dados são criados apenas no banco descartável de testes.

Relatórios: `test-results/verificacao.json`, `coverage/index.html` para JavaScript e `coverage report` ou `coverage html` para Python. Os percentuais medem linguagens separadamente e não representam auditoria completa de segurança ou acessibilidade. `verificacao.json` e `contraste.json` na raiz são registros históricos do protótipo anterior, não evidências da versão atual.

O workflow `.github/workflows/verificacoes.yml` prepara PostgreSQL 17, Python 3.13 e Chromium, confere migrações e executa a suíte. Sua execução remota depende de enviar as alterações ao GitHub.

## Estrutura

- `offlab/`: configuração, URLs e inicialização WSGI.
- `operacao/models.py`: entidades relacionais e restrições.
- `operacao/services.py`: transações, validação de pedidos e status.
- `operacao/views.py`: consultas e operações autenticadas em JSON.
- `operacao/admin.py`: manutenção de produtos, dúvidas e consulta de pedidos.
- `templates/` e `assets/`: telas e arquivos estáticos.
- `operacao/tests/`: testes de banco, concorrência, API e navegador.

Endpoints internos: `GET /api/state/?page=1`, `POST /api/orders/`, `GET /api/orders/<id>/` e `POST /api/orders/<id>/status/`. Os POSTs exigem sessão e CSRF. As rotas `#pedidos`, `#novo` e `#resultado` continuam organizando as telas no navegador.

## Implantação

Na Vercel, os valores de HTTPS, debug e domínios são automáticos. Sem `DJANGO_SECRET_KEY`, a chave da aplicação é derivada da credencial privada fornecida pela integração do banco. Não é necessário configurar essas variáveis manualmente. As opções abaixo continuam disponíveis para hospedagens próprias.


A configuração padrão fora do `.env` local exige HTTPS e cookies seguros. Para produção, use `DJANGO_DEBUG=0`, chave secreta própria, `DJANGO_ALLOWED_HOSTS` explícito, PostgreSQL com conexão protegida (`POSTGRES_SSLMODE=verify-full` e certificado adequado), credenciais restritas para a aplicação e credenciais separadas para migrações. Prepare os estáticos com `python manage.py collectstatic --noinput` e execute `gunicorn offlab.wsgi:application`, atrás de um proxy com TLS. O WhiteNoise serve os estáticos coletados. A configuração de proxy deve preservar o reconhecimento de HTTPS pelo Django.

O acesso usa autenticação Django, senhas com hash PBKDF2, sessão de 30 minutos de inatividade e proteção CSRF. O django-axes bloqueia após cinco falhas por usuário ou IP, com intervalo de 15 minutos. Programe `python manage.py axes_reset_logs --age 7` diariamente para remover registros de acesso antigos. A configuração de hospedagem, monitoramento e validação operacional com a OFF ainda precisa ser feita; não houve publicação em nuvem nesta implementação.

Integrações automáticas com canais, pagamentos, emissão fiscal, filtro por canal/status e importação CSV não estão incluídos.

As transações e os bloqueios seguem a [documentação oficial do Django](https://docs.djangoproject.com/en/5.2/topics/db/transactions/) e o [uso de select_for_update](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update).
