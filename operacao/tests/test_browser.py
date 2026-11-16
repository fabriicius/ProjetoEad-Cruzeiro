import os
from pathlib import Path
import subprocess
from django.contrib.auth import get_user_model
from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from django.core.management import call_command
from django.test import override_settings
from operacao.models import Produto


@override_settings(DEBUG=True, SECURE_SSL_REDIRECT=False, SESSION_COOKIE_SECURE=False, CSRF_COOKIE_SECURE=False,
                   AXES_ENABLED=False, STORAGES={"default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
                                               "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"}})
class BrowserFlowTests(StaticLiveServerTestCase):
    def test_browser_with_postgresql(self):
        call_command("seed_demo", verbosity=0)
        Produto.objects.create(sku='X"/><img src=x onerror="window.skuXss=true">', nome='Produto <teste>', preco='10.00', estoque=1)
        get_user_model().objects.create_user("browser-test", password="temporary-browser-password")
        root = Path(__file__).resolve().parents[2]
        result = subprocess.run(["node", "scripts/run-checks.mjs"], cwd=root, env={**os.environ,
            "OFFLAB_TEST_URL": self.live_server_url, "OFFLAB_TEST_USER": "browser-test",
            "OFFLAB_TEST_PASSWORD": "temporary-browser-password"}, capture_output=True, text=True, timeout=100)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        print(result.stdout)
