# Ferrari Sale

Aplicação web de estudos usando **Django + PostgreSQL + Docker**.

A vitrine tem 4 Ferraris fictícias e um formulário para clientes enviarem propostas. As propostas são salvas no PostgreSQL.

## Como rodar

```bash
cd ferrari-sale
cp .env.example .env
docker compose up --build
```

Acesse:

- Site: http://localhost:8000
- Admin: http://localhost:8000/admin/

## Criar usuário admin

Em outro terminal:

```bash
docker compose exec web python manage.py createsuperuser
```

Depois entre em `/admin/` para ver os carros e as propostas recebidas.

## Banco de dados

Serviço PostgreSQL no Docker Compose:

- Database: `ferrari_sale`
- User: `ferrari`
- Password: Veja `.env` file
- Host interno: `db`
- Porta local: `5432`

## Estrutura

```text
ferrari-sale/
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── .env.example
├── manage.py
├── ferrari_sale/
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
└── marketplace/
    ├── admin.py
    ├── apps.py
    ├── forms.py
    ├── models.py
    ├── urls.py
    ├── views.py
    ├── migrations/
    │   ├── 0001_initial.py
    │   └── 0002_seed_cars.py
    ├── static/marketplace/
    │   ├── css/styles.css
    │   └── img/
    └── templates/marketplace/
        ├── home.html
        └── proposal_success.html
```

## Observação

Projeto apenas para estudos. Os preços, locais e detalhes dos carros são fictícios.
