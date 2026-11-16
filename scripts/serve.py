"""Gerencia o servidor local como serviço do usuário (Linux/systemd)."""
import argparse
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("action", choices=["start", "stop", "status"])
args = parser.parse_args()
service = "offlab-ead.service"


def run(*arguments):
    subprocess.run(["systemctl", "--user", *arguments], check=True)


if args.action == "start":
    def quote(value):
        return '"' + str(value).replace('\\', '\\\\').replace('"', '\\"').replace('%', '%%') + '"'
    executable = root / ".venv/bin/gunicorn"
    if not executable.exists():
        raise SystemExit("Instale as dependências em .venv antes de iniciar.")
    target = Path.home() / ".config/systemd/user" / service
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(f'''[Unit]
Description=OFF Nutrition Lab - aplicacao local
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory={str(root).replace("%", "%%")}
ExecStart={quote(executable)} offlab.wsgi:application --bind 127.0.0.1:8765 --workers 2 --timeout 60 --access-logfile - --error-logfile -
Restart=on-failure
RestartSec=3
UMask=0077

[Install]
WantedBy=default.target
''')
    run("daemon-reload")
    run("enable", service)
    run("restart", service)
    print("Servidor iniciado: http://127.0.0.1:8765/")
elif args.action == "stop":
    run("stop", service)
else:
    run("status", service, "--no-pager")
