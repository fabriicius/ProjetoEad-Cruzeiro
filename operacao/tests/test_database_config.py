from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase
from offlab.database import database_config


class DatabaseConfigTests(SimpleTestCase):
    def setUp(self):
        self.env = {
            "DATABASE_URL": "postgres://user:senha@direct.invalid:5432/remote?sslmode=require",
            "DATABASE_URL_POOLED": "postgres://user:senha@pool.invalid:5432/remote?sslmode=require",
            "POSTGRES_DB": "local", "POSTGRES_HOST": "127.0.0.1",
        }

    def test_runtime_prefers_pool_and_disables_server_cursors(self):
        config = database_config(self.env)
        self.assertEqual(config["HOST"], "pool.invalid")
        self.assertEqual(config["OPTIONS"]["sslmode"], "require")
        self.assertTrue(config["DISABLE_SERVER_SIDE_CURSORS"])
        self.assertIsNone(config["OPTIONS"]["prepare_threshold"])
        self.assertEqual(config["CONN_MAX_AGE"], 0)

    def test_migrations_use_direct_url(self):
        self.assertEqual(database_config(self.env, direct=True)["HOST"], "direct.invalid")
        self.env["DIRECT_URL"] = "postgres://user:senha@another.invalid/remote"
        self.assertEqual(database_config(self.env, direct=True)["HOST"], "another.invalid")

    def test_tests_ignore_all_remote_urls(self):
        config = database_config(self.env, use_urls=False)
        self.assertEqual(config["HOST"], "127.0.0.1")
        self.assertEqual(config["NAME"], "local")

    def test_credentials_are_url_decoded(self):
        config = database_config({"DATABASE_URL": "postgres://user%40test:p%40ss%3Aword@direct.invalid/data%2Dbase"})
        self.assertEqual(config["USER"], "user@test")
        self.assertEqual(config["PASSWORD"], "p@ss:word")
        self.assertEqual(config["NAME"], "data-base")

    def test_invalid_url_does_not_disclose_secret(self):
        for url in ["https://user:secret@host/database", "postgres://user:secret@host:invalid/database", "postgres://host/"]:
            with self.subTest(url=url), self.assertRaises(ImproperlyConfigured) as error:
                database_config({"DATABASE_URL": url})
            self.assertNotIn("secret", str(error.exception))

    def test_vercel_does_not_silently_connect_to_localhost(self):
        with self.assertRaisesMessage(ImproperlyConfigured, 'Vincule o Prisma Postgres'):
            database_config({'VERCEL': '1'})
