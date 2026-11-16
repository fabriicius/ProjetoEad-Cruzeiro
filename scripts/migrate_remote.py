"""Aplica migrações pela conexão direta configurada no .env."""
import os
from pathlib import Path
import subprocess
import sys
from dotenv import load_dotenv

root = Path(__file__).resolve().parent.parent
load_dotenv(root / ".env")
if not any(os.environ.get(key) for key in ("DIRECT_URL", "DATABASE_URL", "POSTGRES_URL", "PRISMA_DATABASE_URL")):
    raise SystemExit("Configure DATABASE_URL ou DIRECT_URL com a conexão direta do banco.")
os.environ["DJANGO_DB_DIRECT"] = "1"
raise SystemExit(subprocess.call([sys.executable, str(root / "manage.py"), "migrate", "--noinput"], cwd=root))
