# Deploy na Vercel

Importe `fabriicius/ProjetoEad-Cruzeiro` e selecione a branch `develop` para usar esta implementação antes do merge da PR. O **Root Directory** é a raiz do repositório (`.`), onde estão `manage.py`, `pyproject.toml` e `vercel.json`.

Use o preset **Django**, Python **3.13** e mantenha os comandos de instalação, build e diretório de saída nos padrões do preset. A entrada é `offlab.wsgi:application`. Os estáticos usam `STATIC_ROOT` e WhiteNoise; a coleta fica a cargo do preset. Configuração conforme a [documentação oficial da Vercel](https://vercel.com/docs/frameworks/full-stack/django).

Configure as variáveis em **Settings → Environment Variables**, nos ambientes que receberão o deploy:

| Variável | Valor |
| --- | --- |
| `DJANGO_SECRET_KEY` | Chave aleatória exclusiva deste projeto, mantida no painel. |
| `DJANGO_DEBUG` | `0` |
| `DATABASE_URL` | Conexão direta fornecida pelo Prisma Postgres. |
| `DATABASE_URL_POOLED` | Conexão com pool fornecida pelo Prisma Postgres. |
| `DIRECT_URL` | Opcional: conexão direta para migrações. |

As URLs do Prisma devem manter `sslmode=require`. Vincule o recurso Prisma Postgres ao projeto para disponibilizar as variáveis da integração e confira os nomes. Não envie `.env` ou credenciais ao repositório.

Os hosts de produção, branch e preview são obtidos das variáveis `VERCEL_*` do projeto. Para domínio próprio, acrescente `DJANGO_ALLOWED_HOSTS=pedidos.seudominio.com` e `DJANGO_CSRF_TRUSTED_ORIGINS=https://pedidos.seudominio.com`. O modo Vercel força `DEBUG=False` e reconhece HTTPS no proxy.

As migrações já foram aplicadas no banco configurado. Em futuras alterações de models, gere e versione as migrações e aplique-as pela conexão direta antes de publicar a versão que depende delas:

```bash
.venv/bin/python scripts/migrate_remote.py
```

O build não cria usuários, não inclui dados fictícios e não executa migrações automaticamente. A conta existente no banco pode ser utilizada para entrar na aplicação.

Após o deploy, confira `/entrar/`, o login, o catálogo, as dúvidas frequentes e `/admin/`. Os estáticos devem carregar, a sessão deve persistir e as telas devem consultar o banco remoto. O deployment na Vercel será feito pelo proprietário do projeto; o envio desta implementação ao Git não comprova a publicação.

Para habilitar a verificação periódica após publicar, configure `APP_URL` no GitHub seguindo o [guia de monitoramento](MONITORAMENTO.md).
