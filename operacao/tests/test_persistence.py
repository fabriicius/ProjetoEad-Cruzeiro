from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import IntegrityError, connection, connections, transaction
from django.test import Client, TestCase, TransactionTestCase, override_settings
from operacao.models import DuvidaFrequente, ItemPedido, Pedido, Produto
from operacao.services import RegraPedidoError, avancar_status, registrar_pedido


def payload(quantity=1, **extra):
    return {"channel": "WhatsApp", "items": [{"sku": "COQ-001", "q": quantity}], "request_key": str(uuid4()), **extra}


@override_settings(AXES_ENABLED=False)
class PersistenceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user("equipe", password="senha-de-teste-apenas")
        cls.product = Produto.objects.create(sku="COQ-001", nome="Coqueteleira", preco=Decimal("39.90"), estoque=2)
        Produto.objects.create(sku="CAT-001", nome="Catalyze", preco=Decimal("119.90"), estoque=8)

    def order(self, data=None):
        return registrar_pedido(usuario=self.user, dados=data or payload())

    def test_uses_real_postgresql(self):
        self.assertEqual(connection.vendor, "postgresql")

    def test_persists_items_price_and_user(self):
        data = payload()
        data["items"][0]["unit"] = 1
        order = self.order(data)
        order.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(order.registrado_por, self.user)
        self.assertEqual(order.status, "novo")
        self.assertEqual(order.itens.get().preco_unitario, Decimal("39.90"))
        self.assertEqual(self.product.estoque, 1)
        self.product.preco = Decimal("99.00")
        self.product.save()
        self.assertEqual(order.itens.get().preco_unitario, Decimal("39.90"))

    def test_second_invalid_item_does_not_change_first_stock(self):
        data = payload()
        data["items"].append({"sku": "CAT-001", "q": 9})
        with self.assertRaises(RegraPedidoError):
            self.order(data)
        self.product.refresh_from_db()
        self.assertEqual(self.product.estoque, 2)
        self.assertFalse(Pedido.objects.exists())
        self.assertFalse(ItemPedido.objects.exists())

    def test_database_failure_rolls_back_order_items_and_stock(self):
        with patch("operacao.services.Produto.save", side_effect=IntegrityError("falha controlada")):
            with self.assertRaises((RegraPedidoError, IntegrityError)):
                self.order()
        self.product.refresh_from_db()
        self.assertEqual(self.product.estoque, 2)
        self.assertFalse(Pedido.objects.exists())
        self.assertFalse(ItemPedido.objects.exists())

    def test_invalid_inputs_are_rejected_without_writes(self):
        cases = [payload(q) for q in [0, -1, 1.5, True, "1", 2147483648]]
        cases += [payload(items=[]), payload(items=[None]), payload(items=[{"sku": "missing", "q": 1}]),
                  payload(channel="desconhecido"), payload(items=[{"sku": "COQ-001", "q": 1}]*2),
                  payload(request_key="invalid"), payload(reference=123)]
        for data in cases:
            with self.subTest(data=data), self.assertRaises(RegraPedidoError):
                self.order(data)
        self.assertFalse(Pedido.objects.exists())
        self.product.refresh_from_db()
        self.assertEqual(self.product.estoque, 2)

    def test_inactive_product_is_rejected(self):
        self.product.ativo = False
        self.product.save()
        with self.assertRaises(RegraPedidoError):
            self.order()

    def test_retry_is_idempotent(self):
        data = payload()
        first = self.order(data)
        self.assertEqual(self.order(data).pk, first.pk)
        self.product.refresh_from_db()
        self.assertEqual(self.product.estoque, 1)
        self.assertEqual(Pedido.objects.count(), 1)
        with self.assertRaises(RegraPedidoError):
            self.order({**data, "channel": "Instagram"})
        other = get_user_model().objects.create_user("outro")
        with self.assertRaises(RegraPedidoError):
            registrar_pedido(usuario=other, dados=data)

    def test_unique_reference_per_channel(self):
        self.order(payload(reference="VENDA-1"))
        with self.assertRaises(RegraPedidoError):
            self.order(payload(reference="VENDA-1"))
        self.order(payload(reference="VENDA-1", channel="Shopee"))
        self.assertEqual(Pedido.objects.count(), 2)

    def test_status_transitions_do_not_deduct_stock_again(self):
        order = self.order()
        for invalid in ["enviado", "novo", None, "se", {}]:
            with self.assertRaises(RegraPedidoError):
                avancar_status(pedido_id=order.pk, novo_status=invalid)
        avancar_status(pedido_id=order.pk, novo_status="separado")
        avancar_status(pedido_id=order.pk, novo_status="enviado")
        with self.assertRaises(RegraPedidoError):
            avancar_status(pedido_id=order.pk, novo_status=None)
        self.product.refresh_from_db()
        self.assertEqual(self.product.estoque, 1)
        order.refresh_from_db()
        self.assertEqual(order.status, "enviado")

    def test_database_constraints(self):
        for changes in [{"estoque": -1}, {"preco": -1}]:
            with self.assertRaises(IntegrityError), transaction.atomic():
                Produto.objects.filter(pk=self.product.pk).update(**changes)
        order = self.order()
        for changes in [{"status": "invalid"}, {"canal": "invalid"}]:
            with self.assertRaises(IntegrityError), transaction.atomic():
                Pedido.objects.filter(pk=order.pk).update(**changes)
        with self.assertRaises(IntegrityError), transaction.atomic():
            ItemPedido.objects.filter(pedido=order).update(quantidade=0)

    def test_seed_never_overwrites_existing_stock(self):
        self.order()
        call_command("seed_demo", verbosity=0)
        call_command("seed_demo", verbosity=0)
        self.product.refresh_from_db()
        self.assertEqual(self.product.estoque, 1)
        self.assertEqual(DuvidaFrequente.objects.count(), 2)

    def test_api_requires_login_and_csrf(self):
        self.assertEqual(self.client.get("/api/state/").status_code, 401)
        secure = Client(enforce_csrf_checks=True)
        secure.force_login(self.user, backend="django.contrib.auth.backends.ModelBackend")
        self.assertEqual(secure.post("/api/orders/", payload(), content_type="application/json").status_code, 403)

    def test_api_persistence_across_independent_clients(self):
        self.client.force_login(self.user, backend="django.contrib.auth.backends.ModelBackend")
        response = self.client.post("/api/orders/", payload(), content_type="application/json")
        self.assertEqual(response.status_code, 201)
        other = Client()
        other.force_login(self.user, backend="django.contrib.auth.backends.ModelBackend")
        state = other.get("/api/state/").json()
        self.assertEqual(state["stocks"]["COQ-001"], 1)
        self.assertEqual(state["orders"][0]["id"], response.json()["order"]["id"])
        detail = other.get(f"/api/orders/{state['orders'][0]['id']}/").json()
        self.assertEqual(detail["order"]["items"][0]["unit"], 3990)

    def test_api_filters_faqs_and_returns_database_catalog(self):
        DuvidaFrequente.objects.create(pergunta="Ativa", resposta="Resposta")
        DuvidaFrequente.objects.create(pergunta="Inativa", resposta="Oculta", ativa=False)
        self.client.force_login(self.user, backend="django.contrib.auth.backends.ModelBackend")
        data = self.client.get("/api/state/").json()
        self.assertEqual(len(data["products"]), 2)
        self.assertEqual([f["question"] for f in data["faqs"]], ["Ativa"])

    def test_api_rejects_malformed_json_and_missing_order(self):
        self.client.force_login(self.user, backend="django.contrib.auth.backends.ModelBackend")
        for body in ["{", "[]", "null"]:
            self.assertEqual(self.client.post("/api/orders/", body, content_type="application/json").status_code, 400)
        self.assertEqual(self.client.get("/api/orders/999/").status_code, 404)

    def test_pagination_is_on_server(self):
        for _ in range(21):
            self.product.estoque = 2
            self.product.save()
            self.order()
        self.client.force_login(self.user, backend="django.contrib.auth.backends.ModelBackend")
        first = self.client.get("/api/state/").json()
        second = self.client.get("/api/state/?page=2").json()
        self.assertEqual(first["count"], 21)
        self.assertEqual(len(first["orders"]), 20)
        self.assertEqual(len(second["orders"]), 1)
        self.assertFalse({o["id"] for o in first["orders"]} & {o["id"] for o in second["orders"]})

    def test_logout_invalidates_session(self):
        self.client.force_login(self.user, backend="django.contrib.auth.backends.ModelBackend")
        self.assertEqual(self.client.post("/sair/").status_code, 302)
        self.assertEqual(self.client.get("/api/state/").status_code, 401)


class ConcurrentSalesTests(TransactionTestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("concorrencia")
        Produto.objects.create(sku="COQ-001", nome="Última unidade", preco=Decimal("39.90"), estoque=1)

    def concurrent_orders(self, same_request=False):
        barrier = Barrier(2)
        common = payload()
        def sell(_):
            connections.close_all()
            try:
                user = get_user_model().objects.get(pk=self.user.pk)
                barrier.wait(timeout=10)
                try:
                    return ("ok", registrar_pedido(usuario=user, dados=common if same_request else payload()).pk)
                except RegraPedidoError:
                    return ("rejected", None)
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(sell, range(2)))

    def test_only_one_sale_of_last_unit(self):
        results = self.concurrent_orders()
        self.assertEqual(sorted(r[0] for r in results), ["ok", "rejected"])
        self.assertEqual(Pedido.objects.count(), 1)
        self.assertEqual(Produto.objects.get().estoque, 0)

    def test_simultaneous_retry_creates_one_order(self):
        results = self.concurrent_orders(same_request=True)
        self.assertEqual(results[0], results[1])
        self.assertEqual(results[0][0], "ok")
        self.assertEqual(Pedido.objects.count(), 1)
        self.assertEqual(Produto.objects.get().estoque, 0)
