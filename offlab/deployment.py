"""Configuração HTTP para execução local e para o proxy da Vercel."""
import hashlib
import hmac
from urllib.parse import unquote, urlsplit
from django.core.exceptions import ImproperlyConfigured


def web_settings(env):
    on_vercel = env.get("VERCEL") == "1"
    hosts = [host.strip() for host in env.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,[::1]").split(",") if host.strip()]
    origins = [origin.strip() for origin in env.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if origin.strip()]
    if on_vercel:
        for name in ("VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_BRANCH_URL"):
            value = env.get(name, "").strip()
            if value:
                host = urlsplit(value if "://" in value else "https://" + value).hostname
                if host:
                    hosts.append(host)
                    origins.append("https://" + host)
    return {
        "DEBUG": False if on_vercel else env.get("DJANGO_DEBUG", "0") == "1",
        "ALLOWED_HOSTS": list(dict.fromkeys(hosts)),
        "CSRF_TRUSTED_ORIGINS": list(dict.fromkeys(origins)),
        "SECURE_PROXY_SSL_HEADER": ("HTTP_X_FORWARDED_PROTO", "https") if on_vercel else None,
    }


def application_secret(env):
    """Evita configurar uma segunda credencial no protótipo com Prisma integrado."""
    explicit = env.get("DJANGO_SECRET_KEY", "").strip()
    if explicit:
        return explicit
    password = ""
    for name in ("DATABASE_URL_POOLED", "DATABASE_URL", "POSTGRES_URL", "PRISMA_DATABASE_URL", "DIRECT_URL"):
        value = env.get(name, "")
        if not value:
            continue
        try:
            parsed = urlsplit(value)
            if parsed.scheme in ("postgres", "postgresql") and parsed.password:
                password = unquote(parsed.password)
                break
        except ValueError:
            continue
    if not password:
        password = env.get("POSTGRES_PASSWORD", "")
    if not password:
        raise ImproperlyConfigured(
            "Vincule o banco Prisma Postgres ao projeto na Vercel. "
            "A integração fornece as credenciais automaticamente; não é necessário configurar DJANGO_SECRET_KEY."
        )
    return hmac.new(password.encode(), b"off-nutrition-lab:django-secret:v1", hashlib.sha512).hexdigest()
