FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py gunicorn.conf.py ./
COPY static/ static/

# Usuário sem privilégios (os dados ficam no PostgreSQL, não no container)
RUN useradd --create-home --shell /usr/sbin/nologin appuser

USER appuser

EXPOSE 5000

# opentelemetry-instrument: liga traces/métricas OTel (configurado por env no compose).
# gunicorn.conf.py: liga o profiling Pyroscope no worker.
# --workers 1 --threads 4: um processo (um pool de conexões, um profiler) atendendo
# 4 requisições ao mesmo tempo. A concorrência dos ids agora é resolvida pelo banco.
CMD ["opentelemetry-instrument", "gunicorn", "--config", "gunicorn.conf.py", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "4", "--access-logfile", "-", "app:app"]
