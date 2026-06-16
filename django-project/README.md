# Projeto Django simples rodando em Docker

Projeto mínimo para testar Django com uma página inicial e um formulário.

## Como rodar

```bash
docker compose up --build
```

Depois acesse:

```text
http://localhost:8000
```

## Estrutura

```text
django-form-docker/
├── app/
│   ├── core/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── formulario/
│   │   ├── forms.py
│   │   ├── urls.py
│   │   ├── views.py
│   │   └── templates/formulario/
│   │       ├── home.html
│   │       └── sucesso.html
│   └── manage.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

## Parar o container

```bash
docker compose down
```
