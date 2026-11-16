import json
from functools import wraps
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db import DatabaseError
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST
from .models import DuvidaFrequente, Pedido, Produto
from .services import RegraPedidoError, avancar_status, registrar_pedido


def api(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Sua sessão terminou. Entre novamente."}, status=401)
        try:
            return view(request, *args, **kwargs)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return JsonResponse({"error": "Envie um JSON válido."}, status=400)
        except RegraPedidoError as error:
            return JsonResponse({"error": error.mensagem, **error.detalhes}, status=400)
        except Pedido.DoesNotExist:
            return JsonResponse({"error": "Pedido não encontrado."}, status=404)
        except DatabaseError:
            return JsonResponse({"error": "Não foi possível acessar o banco. Confira os registros antes de tentar novamente."}, status=503)
    return wrapped


def body(request):
    if request.content_type != "application/json":
        raise RegraPedidoError("Envie os dados no formato JSON.")
    data = json.loads(request.body)
    if not isinstance(data, dict):
        raise RegraPedidoError("Envie um objeto JSON.")
    return data


def order_json(order):
    items = [{"sku": item.produto.sku, "q": item.quantidade, "unit": int(item.preco_unitario * 100)} for item in order.itens.all()]
    return {"id": order.pk, "channel": order.canal, "date": timezone.localtime(order.criado_em).strftime("%d/%m/%Y"),
            "status": order.status, "items": items}


@login_required
@require_GET
def index(request):
    return render(request, "index.html")


@api
@require_GET
def state(request):
    products = list(Produto.objects.all())
    orders = Pedido.objects.prefetch_related("itens__produto")
    page = Paginator(orders, 20).get_page(request.GET.get("page", 1))
    return JsonResponse({
        "products": [{"sku": p.sku, "name": p.nome, "price": int(p.preco * 100), "active": p.ativo} for p in products],
        "stocks": {p.sku: p.estoque for p in products}, "orders": [order_json(o) for o in page],
        "page": page.number, "pages": page.paginator.num_pages, "count": page.paginator.count,
        "faqs": [{"question": f.pergunta, "answer": f.resposta, "sku": f.produto.sku if f.produto else None}
                 for f in DuvidaFrequente.objects.filter(ativa=True).select_related("produto")],
    })


@api
@require_POST
def create_order(request):
    order = registrar_pedido(usuario=request.user, dados=body(request))
    order = Pedido.objects.prefetch_related("itens__produto").get(pk=order.pk)
    return JsonResponse({"order": order_json(order), "stocks": {p.sku: p.estoque for p in Produto.objects.filter(itempedido__pedido=order)}}, status=201)


@api
@require_GET
def order_detail(request, pk):
    return JsonResponse({"order": order_json(Pedido.objects.prefetch_related("itens__produto").get(pk=pk))})


@api
@require_POST
def order_status(request, pk):
    order = avancar_status(pedido_id=pk, novo_status=body(request).get("status"))
    return JsonResponse({"order": order_json(Pedido.objects.prefetch_related("itens__produto").get(pk=order.pk))})
