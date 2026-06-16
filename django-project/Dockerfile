FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Para ambiente com Zscaler / inspeção SSL
ENV PIP_TRUSTED_HOST="pypi.org files.pythonhosted.org pypi.python.org"
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

COPY requirements.txt .

RUN pip install --no-cache-dir \
    --trusted-host pypi.org \
    --trusted-host files.pythonhosted.org \
    --trusted-host pypi.python.org \
    -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["ddtrace-run", "python", "manage.py", "runserver", "0.0.0.0:8000"]