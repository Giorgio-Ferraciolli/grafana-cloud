# Config do gunicorn. Liga o profiling (Pyroscope) sem mudar o app.py.
import os


def post_fork(server, worker):
    # O profiler roda dentro do worker (é ele que atende as requisições).
    # Sem PYROSCOPE_SERVER_ADDRESS no ambiente, fica desligado.
    address = os.environ.get("PYROSCOPE_SERVER_ADDRESS")
    if not address:
        return
    import pyroscope

    pyroscope.configure(
        application_name=os.environ.get("PYROSCOPE_APPLICATION_NAME", "flask-lab-api"),
        server_address=address,
        oncpu=True,       # só tempo de CPU (não conta thread parada esperando I/O)
        gil_only=False,   # inclui threads que soltaram o GIL
        tags={"deployment.environment": "wsl-lab"},
    )
