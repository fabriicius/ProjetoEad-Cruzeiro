from unittest.mock import patch
from django.db import DatabaseError
from django.test import TestCase


class HealthTests(TestCase):
    def test_public_health_checks_database(self):
        response = self.client.get('/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'UP', 'database': 'UP'})
        self.assertIn('no-store', response['Cache-Control'])

    def test_database_failure_returns_down_without_internal_details(self):
        with patch('django.db.connection.cursor', side_effect=DatabaseError('segredo-interno')):
            response = self.client.get('/health/')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {'status': 'DOWN', 'database': 'DOWN'})
        self.assertNotContains(response, 'segredo-interno', status_code=503)
