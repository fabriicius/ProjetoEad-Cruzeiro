from django.contrib import admin
from .models import DuvidaFrequente, ItemPedido, Pedido, Produto


@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    list_display = ["sku", "nome", "preco", "estoque", "ativo"]
    search_fields = ["sku", "nome"]
    list_filter = ["ativo"]
    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(DuvidaFrequente)
class DuvidaAdmin(admin.ModelAdmin):
    list_display = ["pergunta", "produto", "ativa"]
    list_filter = ["ativa"]


class ItensInline(admin.TabularInline):
    model = ItemPedido
    extra = 0
    readonly_fields = ["produto", "quantidade", "preco_unitario"]
    can_delete = False
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ["id", "criado_em", "canal", "status", "registrado_por"]
    list_filter = ["canal", "status"]
    readonly_fields = ["criado_em", "canal", "status", "registrado_por", "referencia_origem", "chave_requisicao", "assinatura_requisicao"]
    inlines = [ItensInline]
    def has_add_permission(self, request):
        return False
    def has_change_permission(self, request, obj=None):
        return False
    def has_delete_permission(self, request, obj=None):
        return False


admin.site.site_header = "OFF Nutrition Lab"
