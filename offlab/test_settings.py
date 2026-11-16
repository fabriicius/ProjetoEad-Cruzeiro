"""Testes usam o banco local, mesmo quando .env aponta para a nuvem."""
from .settings import *  # noqa: F403
from .database import database_config

DATABASES = {"default": database_config(os.environ, use_urls=False)}
DEBUG = True
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
