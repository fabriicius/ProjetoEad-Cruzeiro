from decimal import Decimal
from django.core.management.base import BaseCommand
from operacao.models import DuvidaFrequente, Produto


class Command(BaseCommand):
    help = "Inclui catálogo e dúvidas fictícios ausentes, sem apagar dados ou repor saldos existentes."

    def handle(self, *args, **options):
        for sku, nome, preco, estoque in [("COQ-001", "Coqueteleira OFF 600 ml", "39.90", 2), ("CAT-001", "Catalyze Pro 300 g", "119.90", 8)]:
            Produto.objects.get_or_create(sku=sku, defaults={"nome": nome, "preco": Decimal(preco), "estoque": estoque})
        for pergunta, resposta in [("Qual é a capacidade da coqueteleira?", "A coqueteleira tem capacidade de 600 ml."),
                                   ("Como acompanhar um pedido?", "Consulte o identificador no painel e acompanhe os status Novo, Separado e Enviado.")]:
            DuvidaFrequente.objects.get_or_create(pergunta=pergunta, defaults={"resposta": resposta})
        self.stdout.write(self.style.SUCCESS("Dados fictícios incluídos; registros existentes preservados."))
