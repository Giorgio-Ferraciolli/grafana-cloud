from django.db import models


class Car(models.Model):
    title = models.CharField("Título", max_length=120)
    slug = models.SlugField("Slug", unique=True)
    model_year = models.PositiveIntegerField("Ano")
    mileage = models.PositiveIntegerField("Milhas")
    engine = models.CharField("Motor", max_length=80)
    transmission = models.CharField("Câmbio", max_length=50)
    color = models.CharField("Cor", max_length=50)
    location = models.CharField("Localização", max_length=80)
    price = models.DecimalField("Preço em dólar", max_digits=12, decimal_places=2)
    image = models.CharField("Imagem estática", max_length=180)
    badge = models.CharField("Selo", max_length=40, blank=True)
    is_featured = models.BooleanField("Exibir na vitrine", default=True)
    created_at = models.DateTimeField("Criado em", auto_now_add=True)

    class Meta:
        ordering = ["price"]
        verbose_name = "Carro"
        verbose_name_plural = "Carros"

    def __str__(self):
        return self.title


class Proposal(models.Model):
    car = models.ForeignKey(Car, on_delete=models.CASCADE, related_name="proposals", verbose_name="Carro")
    name = models.CharField("Nome", max_length=120)
    email = models.EmailField("E-mail")
    phone = models.CharField("Telefone", max_length=30, blank=True)
    offered_price = models.DecimalField("Proposta em dólar", max_digits=12, decimal_places=2)
    message = models.TextField("Mensagem", blank=True)
    created_at = models.DateTimeField("Enviada em", auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Proposta"
        verbose_name_plural = "Propostas"

    def __str__(self):
        return f"{self.name} - {self.car.title}"
