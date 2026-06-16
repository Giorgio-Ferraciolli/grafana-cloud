# Generated manually for the study project.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Car",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=120, verbose_name="Título")),
                ("slug", models.SlugField(unique=True, verbose_name="Slug")),
                ("model_year", models.PositiveIntegerField(verbose_name="Ano")),
                ("mileage", models.PositiveIntegerField(verbose_name="Milhas")),
                ("engine", models.CharField(max_length=80, verbose_name="Motor")),
                ("transmission", models.CharField(max_length=50, verbose_name="Câmbio")),
                ("color", models.CharField(max_length=50, verbose_name="Cor")),
                ("location", models.CharField(max_length=80, verbose_name="Localização")),
                ("price", models.DecimalField(decimal_places=2, max_digits=12, verbose_name="Preço em dólar")),
                ("image", models.CharField(max_length=180, verbose_name="Imagem estática")),
                ("badge", models.CharField(blank=True, max_length=40, verbose_name="Selo")),
                ("is_featured", models.BooleanField(default=True, verbose_name="Exibir na vitrine")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Criado em")),
            ],
            options={"verbose_name": "Carro", "verbose_name_plural": "Carros", "ordering": ["price"]},
        ),
        migrations.CreateModel(
            name="Proposal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, verbose_name="Nome")),
                ("email", models.EmailField(max_length=254, verbose_name="E-mail")),
                ("phone", models.CharField(blank=True, max_length=30, verbose_name="Telefone")),
                ("offered_price", models.DecimalField(decimal_places=2, max_digits=12, verbose_name="Proposta em dólar")),
                ("message", models.TextField(blank=True, verbose_name="Mensagem")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Enviada em")),
                ("car", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="proposals", to="marketplace.car", verbose_name="Carro")),
            ],
            options={"verbose_name": "Proposta", "verbose_name_plural": "Propostas", "ordering": ["-created_at"]},
        ),
    ]
