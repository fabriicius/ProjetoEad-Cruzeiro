import hashlib
import json
from uuid import UUID
from django.db import IntegrityError, transaction
from .models import ItemPedido, Pedido, Produto


class RegraPedidoError(Exception):
    def __init__(self, mensagem, **detalhes):
        self.mensagem = mensagem
        self.detalhes = detalhes
        super().__init__(mensagem)


def _existing(key, user, signature):
    order = Pedido.objects.filter(chave_requisicao=key).first()
    if order and (order.registrado_por_id != user.pk or order.assinatura_requisicao != signature):
        raise RegraPedidoError("Esta confirmação já foi utilizada. Abra um novo pedido.")
    return order


def registrar_pedido(*, usuario, dados):
    if not isinstance(dados, dict) or dados.get("channel") not in Pedido.Canal.values:
        raise RegraPedidoError("Selecione um canal de venda válido.")
    raw = dados.get("items")
    if not isinstance(raw, list) or not 1 <= len(raw) <= 100:
        raise RegraPedidoError("Informe entre 1 e 100 produtos no pedido.")
    items = {}
    for item in raw:
        if not isinstance(item, dict) or not isinstance(item.get("sku"), str):
            raise RegraPedidoError("Selecione um produto válido.")
        sku, quantity = item["sku"], item.get("q")
        if sku in items:
            raise RegraPedidoError("O pedido contém um produto repetido.")
        if type(quantity) is not int or not 1 <= quantity <= 2147483647:
            raise RegraPedidoError("Informe uma quantidade inteira maior que zero.")
        items[sku] = quantity
    reference = dados.get("reference") or None
    if reference is not None and (not isinstance(reference, str) or not reference.strip() or len(reference) > 120):
        raise RegraPedidoError("A referência de origem deve ter até 120 caracteres.")
    try:
        key = UUID(str(dados.get("request_key")))
    except (ValueError, TypeError, AttributeError):
        raise RegraPedidoError("Abra o formulário novamente para confirmar o pedido.")
    signature = hashlib.sha256(json.dumps([dados["channel"], sorted(items.items()), reference], ensure_ascii=False).encode()).hexdigest()
    existing = _existing(key, usuario, signature)
    if existing:
        return existing
    try:
        with transaction.atomic():
            # A mesma ordem de bloqueio evita deadlocks entre pedidos com vários produtos.
            products = list(Produto.objects.select_for_update().filter(sku__in=items).order_by("sku"))
            existing = _existing(key, usuario, signature)
            if existing:
                return existing
            if len(products) != len(items) or any(not p.ativo for p in products):
                raise RegraPedidoError("Selecione produtos ativos do catálogo.")
            for product in products:
                if items[product.sku] > product.estoque:
                    raise RegraPedidoError(
                        f"Quantidade indisponível. Há {product.estoque} unidades em estoque. Informe no máximo {product.estoque}.",
                        sku=product.sku, available=product.estoque, requested=items[product.sku])
            if sum(int(p.preco * 100) * items[p.sku] for p in products) > 9007199254740991:
                raise RegraPedidoError("O total excede o limite permitido. Reduza as quantidades.")
            order = Pedido.objects.create(canal=dados["channel"], registrado_por=usuario, referencia_origem=reference,
                                          chave_requisicao=key, assinatura_requisicao=signature)
            ItemPedido.objects.bulk_create([ItemPedido(pedido=order, produto=p, quantidade=items[p.sku], preco_unitario=p.preco) for p in products])
            for product in products:
                product.estoque -= items[product.sku]
                product.save(update_fields=["estoque"])
            return order
    except IntegrityError:
        existing = _existing(key, usuario, signature)
        if existing:
            return existing
        if reference is not None and Pedido.objects.filter(canal=dados["channel"], referencia_origem=reference).exists():
            raise RegraPedidoError("Já existe um pedido com essa referência no canal informado.")
        raise


@transaction.atomic
def avancar_status(*, pedido_id, novo_status):
    order = Pedido.objects.select_for_update().get(pk=pedido_id)
    if order.status == "enviado" or novo_status != {"novo": "separado", "separado": "enviado"}.get(order.status):
        raise RegraPedidoError("Avance uma etapa por vez: novo, separado e enviado.")
    order.status = novo_status
    order.save(update_fields=["status"])
    return order
