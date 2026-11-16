"""Configuração HTTP para execução local e para o proxy da Vercel."""
from urllib.parse import urlsplit


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
