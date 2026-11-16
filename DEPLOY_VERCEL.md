# Deploy do protótipo na Vercel

1. Importe `fabriicius/ProjetoEad-Cruzeiro`. Selecione `develop` para testar esta implementação antes do merge da PR.
2. Use a raiz do repositório (`.`), o preset **Django** e Python **3.13**. Mantenha os demais comandos nos padrões do preset.
3. Na área **Storage** do projeto, vincule o banco **prisma-postgres-almond-drum** já criado na integração Prisma Postgres. Autorize a conexão nos ambientes que receberão o deploy.
4. Faça o deploy. Se o banco já foi vinculado depois de um build, refaça o deploy para disponibilizar a conexão à aplicação.

Não é necessário cadastrar manualmente `DJANGO_SECRET_KEY`, `DJANGO_DEBUG` ou os domínios `vercel.app`. O projeto já define os padrões do protótipo: entrada WSGI, arquivos estáticos, HTTPS, cookies seguros, sessão e identificação automática dos domínios de preview e produção.

A integração fornece a conexão PostgreSQL automaticamente. O código aceita `DATABASE_URL_POOLED`, `DATABASE_URL`, `POSTGRES_URL` e `PRISMA_DATABASE_URL`. Esses valores continuam privados na Vercel. Se o recurso não estiver vinculado ao projeto, o deploy informará essa necessidade; não será feita uma conexão silenciosa com um banco local inexistente.

Sem uma chave Django explícita, a aplicação deriva uma chave estável da credencial privada do banco usando HMAC-SHA512 e um identificador exclusivo de finalidade. Assim, as instâncias compartilham a mesma chave sem publicar uma senha no código. Uma chave `DJANGO_SECRET_KEY` já configurada continua sendo respeitada. Se a credencial do banco for rotacionada e a aplicação utilizar a chave derivada, será necessário entrar novamente.

As migrações já foram aplicadas no banco remoto. Para futuras alterações de models, versione as migrações e aplique-as pela conexão direta:

```bash
.venv/bin/python scripts/migrate_remote.py
```

O build não altera o banco, não cria usuários e não inclui dados fictícios. A conta existente permanece válida. Após publicar, confira `/entrar/`, `/health/`, o painel e `/admin/`.

O monitoramento do GitHub utiliza o endereço público depois do deploy. Sua ativação está no [guia de monitoramento](MONITORAMENTO.md).

Referência da plataforma: [Django na Vercel](https://vercel.com/docs/frameworks/full-stack/django).
