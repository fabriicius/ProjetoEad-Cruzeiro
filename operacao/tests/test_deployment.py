from django.http import HttpRequest
from django.test import SimpleTestCase, override_settings
from offlab.deployment import web_settings


class VercelSettingsTests(SimpleTestCase):
    def test_vercel_uses_only_own_deployment_hosts_and_https(self):
        config = web_settings({"VERCEL": "1", "DJANGO_DEBUG": "1", "VERCEL_URL": "offlab-preview.vercel.app",
                               "VERCEL_PROJECT_PRODUCTION_URL": "offlab.vercel.app", "VERCEL_BRANCH_URL": "offlab-develop.vercel.app"})
        self.assertFalse(config["DEBUG"])
        self.assertIn("offlab-preview.vercel.app", config["ALLOWED_HOSTS"])
        self.assertIn("offlab.vercel.app", config["ALLOWED_HOSTS"])
        self.assertNotIn(".vercel.app", config["ALLOWED_HOSTS"])
        self.assertIn("https://offlab-develop.vercel.app", config["CSRF_TRUSTED_ORIGINS"])
        self.assertEqual(config["SECURE_PROXY_SSL_HEADER"], ("HTTP_X_FORWARDED_PROTO", "https"))

    def test_custom_domain_and_origin_are_preserved(self):
        config = web_settings({"VERCEL": "1", "DJANGO_ALLOWED_HOSTS": "pedidos.example.com", "DJANGO_CSRF_TRUSTED_ORIGINS": "https://pedidos.example.com"})
        self.assertEqual(config["ALLOWED_HOSTS"], ["pedidos.example.com"])
        self.assertEqual(config["CSRF_TRUSTED_ORIGINS"], ["https://pedidos.example.com"])

    def test_local_mode_does_not_trust_forwarded_headers(self):
        config = web_settings({"DJANGO_DEBUG": "1", "VERCEL_URL": "unused.vercel.app"})
        self.assertTrue(config["DEBUG"])
        self.assertIsNone(config["SECURE_PROXY_SSL_HEADER"])
        self.assertNotIn("unused.vercel.app", config["ALLOWED_HOSTS"])

    @override_settings(SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"))
    def test_forwarded_https_avoids_redirect_loop(self):
        request = HttpRequest()
        request.META["HTTP_X_FORWARDED_PROTO"] = "https"
        self.assertTrue(request.is_secure())


class AutomaticSecretTests(SimpleTestCase):
    def test_explicit_key_keeps_existing_sessions_compatible(self):
        from offlab.deployment import application_secret
        self.assertEqual(application_secret({'DJANGO_SECRET_KEY': 'existing-secret'}), 'existing-secret')

    def test_same_credential_produces_same_secret_for_direct_and_pool(self):
        from offlab.deployment import application_secret
        direct = {'DATABASE_URL': 'postgres://user:private-password@db.example/postgres'}
        pooled = {'DATABASE_URL_POOLED': 'postgres://user:private-password@pool.example/postgres'}
        key = application_secret(direct)
        self.assertEqual(key, application_secret(pooled))
        self.assertEqual(len(key), 128)
        self.assertNotIn('private-password', key)
        self.assertNotEqual(key, application_secret({'POSTGRES_PASSWORD': 'another-password'}))

    def test_url_encoding_does_not_change_secret(self):
        from offlab.deployment import application_secret
        self.assertEqual(application_secret({'DATABASE_URL': 'postgres://user:p%40ss%3Aword@db.example/postgres'}),
                         application_secret({'POSTGRES_PASSWORD': 'p@ss:word'}))

    def test_missing_integration_has_clear_error_without_secret(self):
        from django.core.exceptions import ImproperlyConfigured
        from offlab.deployment import application_secret
        with self.assertRaisesMessage(ImproperlyConfigured, 'Vincule o banco Prisma Postgres'):
            application_secret({'VERCEL': '1'})

    def test_vercel_initializes_without_manual_django_variables(self):
        import json
        import os
        import subprocess
        import sys
        env = {name: value for name, value in os.environ.items() if not name.startswith(('DJANGO_', 'DATABASE_', 'POSTGRES_', 'PRISMA_', 'DIRECT_URL'))}
        env.update(VERCEL='1', VERCEL_URL='prototype.vercel.app',
                   DATABASE_URL='postgres://test:integration-password@db.invalid/postgres?sslmode=require')
        code = '''import json; import offlab.wsgi; from django.conf import settings; print(json.dumps({'debug':settings.DEBUG,'hosts':settings.ALLOWED_HOSTS,'key_length':len(settings.SECRET_KEY),'database_host':settings.DATABASES['default']['HOST']}))'''
        result = subprocess.run([sys.executable, '-c', code], env=env, capture_output=True, text=True, check=True)
        config = json.loads(result.stdout)
        self.assertFalse(config['debug'])
        self.assertIn('prototype.vercel.app', config['hosts'])
        self.assertEqual(config['key_length'], 128)
        self.assertEqual(config['database_host'], 'db.invalid')
