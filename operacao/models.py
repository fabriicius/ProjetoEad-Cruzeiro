from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Produto(models.Model):
    sku = models.CharField(max_length=60, unique=True)
    nome = models.CharField(max_length=150)
    preco = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    estoque = models.PositiveIntegerField(default=0)
    ativo = models.BooleanField(default=True)

    class Meta:
        ordering = ["sku"]
        constraints = [models.CheckConstraint(condition=models.Q(preco__gte=0), name="produto_preco_nao_negativo")]

    def __str__(self):
        return f"{self.sku} - {self.nome}"


class Pedido(models.Model):
    class Canal(models.TextChoices):
        WHATSAPP = "WhatsApp"
        INSTAGRAM = "Instagram"
        SHOPIFY = "Shopify"
        SHOPEE = "Shopee"

    class Status(models.TextChoices):
        NOVO = "novo", "Novo"
        SEPARADO = "separado", "Separado"
        ENVIADO = "enviado", "Enviado"

    criado_em = models.DateTimeField(auto_now_add=True)
    canal = models.CharField(max_length=20, choices=Canal.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NOVO)
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    referencia_origem = models.CharField(max_length=120, null=True, blank=True)
    chave_requisicao = models.UUIDField(unique=True)
    assinatura_requisicao = models.CharField(max_length=64)

    class Meta:
        ordering = ["-criado_em", "-id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(canal__in=["WhatsApp", "Instagram", "Shopify", "Shopee"]), name="pedido_canal_valido"),
            models.CheckConstraint(condition=models.Q(status__in=["novo", "separado", "enviado"]), name="pedido_status_valido"),
            models.UniqueConstraint(fields=["canal", "referencia_origem"], condition=models.Q(referencia_origem__isnull=False), name="pedido_origem_unica_por_canal"),
        ]

    def __str__(self):
        return f"Pedido {self.pk}"


class ItemPedido(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.PROTECT, related_name="itens")
    produto = models.ForeignKey(Produto, on_delete=models.PROTECT)
    quantidade = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    preco_unitario = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["pedido", "produto"], name="item_produto_unico"),
            models.CheckConstraint(condition=models.Q(quantidade__gt=0), name="item_quantidade_positiva"),
            models.CheckConstraint(condition=models.Q(preco_unitario__gte=0), name="item_preco_nao_negativo"),
        ]


class DuvidaFrequente(models.Model):
    pergunta = models.CharField(max_length=200)
    resposta = models.TextField(max_length=3000)
    produto = models.ForeignKey(Produto, on_delete=models.PROTECT, null=True, blank=True)
    ativa = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.pergunta
