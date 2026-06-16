from decimal import Decimal

from django.db import migrations


CARS = [
    {
        "title": "Ferrari 458 Italia",
        "slug": "ferrari-458-italia",
        "model_year": 2011,
        "mileage": 18400,
        "engine": "4.5L V8 aspirado",
        "transmission": "Automático DCT",
        "color": "Rosso Corsa",
        "location": "Miami, FL",
        "price": Decimal("229900.00"),
        "image": "marketplace/img/ferrari-458-italia.png",
        "badge": "Clássica moderna",
    },
    {
        "title": "Ferrari 458 Speciale",
        "slug": "ferrari-458-speciale",
        "model_year": 2015,
        "mileage": 9200,
        "engine": "4.5L V8 Speciale",
        "transmission": "Automático F1 DCT",
        "color": "Rosso Corsa / Stripe",
        "location": "Scottsdale, AZ",
        "price": Decimal("479000.00"),
        "image": "marketplace/img/ferrari-458-speciale.png",
        "badge": "VIP",
    },
    {
        "title": "Ferrari 488 GTB",
        "slug": "ferrari-488-gtb",
        "model_year": 2017,
        "mileage": 12600,
        "engine": "3.9L V8 biturbo",
        "transmission": "Automático DCT",
        "color": "Rosso Corsa",
        "location": "Beverly Hills, CA",
        "price": Decimal("274500.00"),
        "image": "marketplace/img/ferrari-488-gtb.png",
        "badge": "Pronta entrega",
    },
    {
        "title": "Ferrari 488 Pista",
        "slug": "ferrari-488-pista",
        "model_year": 2020,
        "mileage": 5800,
        "engine": "3.9L V8 Pista biturbo",
        "transmission": "Automático DCT",
        "color": "Rosso Corsa / Racing Stripe",
        "location": "Monza, IT",
        "price": Decimal("589000.00"),
        "image": "marketplace/img/ferrari-488-pista.png",
        "badge": "Track pack",
    },
]


def seed_cars(apps, schema_editor):
    Car = apps.get_model("marketplace", "Car")
    for car in CARS:
        Car.objects.update_or_create(slug=car["slug"], defaults=car)


def remove_seeded_cars(apps, schema_editor):
    Car = apps.get_model("marketplace", "Car")
    Car.objects.filter(slug__in=[car["slug"] for car in CARS]).delete()


class Migration(migrations.Migration):
    dependencies = [("marketplace", "0001_initial")]

    operations = [migrations.RunPython(seed_cars, remove_seeded_cars)]
