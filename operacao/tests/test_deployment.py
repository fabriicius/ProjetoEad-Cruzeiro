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
