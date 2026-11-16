"""Configuração PostgreSQL local ou por URL, sem expor credenciais em erros."""
from urllib.parse import parse_qs, unquote, urlsplit
from django.core.exceptions import ImproperlyConfigured


def database_config(env, *, direct=False, use_urls=True):
    if use_urls:
        names = ("DIRECT_URL", "DATABASE_URL", "POSTGRES_URL", "PRISMA_DATABASE_URL") if direct else (
            "DATABASE_URL_POOLED", "DATABASE_URL", "POSTGRES_URL", "PRISMA_DATABASE_URL")
        url = next((env.get(name) for name in names if env.get(name)), None)
    else:
        url = None
    if url:
        try:
            parsed = urlsplit(url)
            if parsed.scheme not in ("postgres", "postgresql") or not parsed.hostname or not parsed.path.strip("/"):
                raise ValueError
            query = parse_qs(parsed.query, strict_parsing=True)
            options = {name: values[-1] for name, values in query.items()
                       if name in ("sslmode", "sslrootcert", "sslcert", "sslkey", "options", "application_name")}
            options.setdefault("sslmode", "require")
            options["connect_timeout"] = 10
            options["prepare_threshold"] = None
            return {
                "ENGINE": "django.db.backends.postgresql", "NAME": unquote(parsed.path[1:]),
                "USER": unquote(parsed.username or ""), "PASSWORD": unquote(parsed.password or ""),
                "HOST": parsed.hostname, "PORT": str(parsed.port or 5432),
                "CONN_MAX_AGE": 0, "CONN_HEALTH_CHECKS": True, "DISABLE_SERVER_SIDE_CURSORS": True,
                "OPTIONS": options,
            }
        except (ValueError, TypeError):
            raise ImproperlyConfigured("A URL PostgreSQL é inválida. Confira as variáveis de conexão.") from None
    if use_urls and env.get("VERCEL") == "1":
        raise ImproperlyConfigured("Vincule o Prisma Postgres a este projeto da Vercel para disponibilizar a conexão automaticamente.")
    return {
        "ENGINE": "django.db.backends.postgresql", "NAME": env.get("POSTGRES_DB", "offlab"),
        "USER": env.get("POSTGRES_USER", "offlab"), "PASSWORD": env.get("POSTGRES_PASSWORD", ""),
        "HOST": env.get("POSTGRES_HOST", "127.0.0.1"), "PORT": env.get("POSTGRES_PORT", "54329"),
        "CONN_MAX_AGE": 60, "CONN_HEALTH_CHECKS": True,
        "OPTIONS": {"sslmode": env.get("POSTGRES_SSLMODE", "prefer"), "connect_timeout": 10},
    }
