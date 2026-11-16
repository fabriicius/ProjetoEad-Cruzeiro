"""Cria configuração local sem sobrescrever credenciais existentes."""
from pathlib import Path
import secrets

root = Path(__file__).resolve().parent.parent
target = root / ".env"
if target.exists():
    print(".env já existe; mantido sem alterações.")
else:
    text = (root / ".env.example").read_text()
    text = text.replace("DJANGO_SECRET_KEY=\n", "DJANGO_SECRET_KEY=" + secrets.token_urlsafe(48) + "\n")
    text = text.replace("POSTGRES_PASSWORD=\n", "POSTGRES_PASSWORD=" + secrets.token_urlsafe(32) + "\n")
    target.write_text(text)
    target.chmod(0o600)
    print(".env local criado com credenciais aleatórias.")
