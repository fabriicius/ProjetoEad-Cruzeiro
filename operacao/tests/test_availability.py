from io import BytesIO
import json
from tempfile import TemporaryDirectory
from pathlib import Path
from urllib.error import HTTPError, URLError
from django.test import SimpleTestCase
from scripts.check_availability import check_once, health_url, monitor, save_report


class Response(BytesIO):
    status = 200


class AvailabilityTests(SimpleTestCase):
    def test_url_without_credentials_and_https(self):
        self.assertEqual(health_url('https://app.example/'), 'https://app.example/health/')
        self.assertEqual(health_url('http://127.0.0.1:8765/health/'), 'http://127.0.0.1:8765/health/')
        for url in ['http://app.example', 'https://user:secret@app.example', 'https://app.example/?token=secret']:
            with self.assertRaises(ValueError):
                health_url(url)

    def test_healthy_application_requires_database_up(self):
        report = check_once('https://app.example/health/', opener=lambda *a, **k: Response(json.dumps({'status': 'UP', 'database': 'UP'}).encode()))
        self.assertEqual(report['status'], 'UP')
        for body in [b'<html>Login</html>', b'{"status":"UP","database":"DOWN"}', b'[]']:
            self.assertEqual(check_once('https://app.example/health/', opener=lambda *a, **k: Response(body))['status'], 'DOWN')

    def test_timeout_and_http_failure_are_down(self):
        def network_failure(*args, **kwargs):
            raise URLError('timeout')
        def http_failure(*args, **kwargs):
            raise HTTPError('https://app.example/health/', 503, 'error', {}, None)
        self.assertEqual(check_once('https://app.example/health/', opener=network_failure)['reason'], 'network_error')
        self.assertEqual(check_once('https://app.example/health/', opener=http_failure)['http_status'], 503)

    def test_no_url_is_not_reported_as_up(self):
        result = monitor('')
        self.assertEqual(result['status'], 'NOT_CONFIGURED')
        self.assertEqual(result['checks'], [])

    def test_retries_and_recovers_after_temporary_error(self):
        outcomes = iter([{'status': 'DOWN'}, {'status': 'UP'}])
        result = monitor('https://app.example', checker=lambda url: next(outcomes), sleep=lambda _: None)
        self.assertEqual(result['status'], 'UP')
        self.assertEqual(len(result['checks']), 2)

    def test_persistent_failure_and_config_error(self):
        result = monitor('https://app.example', checker=lambda url: {'status': 'DOWN'}, sleep=lambda _: None)
        self.assertEqual(result['status'], 'DOWN')
        self.assertEqual(len(result['checks']), 3)
        self.assertEqual(monitor('invalid')['status'], 'CONFIG_ERROR')

    def test_report_and_summary_distinguish_missing_configuration(self):
        with TemporaryDirectory() as directory:
            path, summary = Path(directory)/'result.json', Path(directory)/'summary.md'
            save_report(monitor(''), path, summary)
            self.assertEqual(json.loads(path.read_text())['status'], 'NOT_CONFIGURED')
            self.assertIn('AGUARDANDO URL', summary.read_text())
