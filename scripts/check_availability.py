"""Verifica /health/ e registra UP, DOWN ou ausência de configuração."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen


def health_url(base_url):
    parsed = urlsplit(base_url.strip())
    local = parsed.hostname in {"127.0.0.1", "localhost", "::1"}
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("Informe somente a URL pública da aplicação, sem credenciais ou parâmetros.")
    if parsed.scheme != "https" and not (local and parsed.scheme == "http"):
        raise ValueError("A aplicação pública deve utilizar HTTPS.")
    if parsed.path not in ("", "/", "/health", "/health/"):
        raise ValueError("Informe a URL inicial da aplicação ou a rota /health/.")
    return urlunsplit((parsed.scheme, parsed.netloc, "/health/", "", ""))


def check_once(url, *, timeout=12, opener=urlopen):
    start = time.monotonic()
    result = {"status": "DOWN", "http_status": None, "reason": "network_error"}
    try:
        request = Request(url, headers={"Accept": "application/json", "User-Agent": "OFFLab-Availability-Monitor/1.0", "Cache-Control": "no-cache"})
        with opener(request, timeout=timeout) as response:
            result["http_status"] = response.status
            if response.status != 200:
                result["reason"] = "http_error"
            else:
                try:
                    body = json.loads(response.read(4096))
                except (ValueError, UnicodeDecodeError):
                    body = None
                if isinstance(body, dict) and body.get("status") == "UP" and body.get("database") == "UP":
                    result.update(status="UP", reason="healthy")
                else:
                    result["reason"] = "invalid_health_response"
    except HTTPError as error:
        result.update(http_status=error.code, reason="http_error")
        error.close()
    except (URLError, OSError, TimeoutError):
        pass
    result["duration_ms"] = round((time.monotonic() - start) * 1000)
    return result


def monitor(base_url, *, attempts=3, delay=5, checker=check_once, sleep=time.sleep):
    report = {"checked_at": datetime.now(timezone.utc).isoformat(), "status": "NOT_CONFIGURED", "checks": []}
    if not base_url.strip():
        return report
    try:
        url = health_url(base_url)
    except ValueError as error:
        report.update(status="CONFIG_ERROR", reason=str(error))
        return report
    report["url"] = url
    for attempt in range(attempts):
        result = checker(url)
        report["checks"].append(result)
        report["status"] = result["status"]
        if result["status"] == "UP":
            break
        if attempt + 1 < attempts:
            sleep(delay)
    return report


def save_report(report, path, summary_path=None):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2) + "\n")
    if summary_path:
        label = {"UP": "🟢 UP", "DOWN": "🔴 DOWN", "NOT_CONFIGURED": "🟡 AGUARDANDO URL", "CONFIG_ERROR": "🟡 ERRO DE CONFIGURAÇÃO"}[report["status"]]
        last = report["checks"][-1] if report["checks"] else {}
        summary = f'''## Disponibilidade da aplicação

| Campo | Resultado |
| --- | --- |
| Estado | {label} |
| Endpoint | {report.get("url", "APP_URL ainda não definida")} |
| Verificação (UTC) | {report["checked_at"]} |
| HTTP | {last.get("http_status") or "Sem resposta"} |
| Tentativas | {len(report["checks"])} |
| Tempo da última tentativa | {last.get("duration_ms", 0)} ms |

'''
        if report["status"] == "NOT_CONFIGURED":
            summary += "Defina a variável APP_URL no repositório para iniciar a verificação pública. Esta execução não comprova disponibilidade.\n"
        with Path(summary_path).open("a") as file:
            file.write(summary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.environ.get("APP_URL", ""))
    parser.add_argument("--output", default="test-results/availability.json")
    args = parser.parse_args()
    report = monitor(args.url)
    save_report(report, args.output, os.environ.get("GITHUB_STEP_SUMMARY"))
    print("Disponibilidade:", report["status"])
    if report["status"] in {"DOWN", "CONFIG_ERROR"}:
        print("::error title=Monitoramento da aplicação::Verificação sem sucesso. Consulte o resumo e o relatório de disponibilidade.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
