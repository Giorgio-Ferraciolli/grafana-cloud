from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routes.health import router as health_router
from app.routes.pages import router as pages_router
from app.routes.pessoas import router as pessoas_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Grafana O11y")

app.mount("/static", StaticFiles(directory="app/static"), name="static")

app.include_router(pages_router)
app.include_router(health_router)
app.include_router(pessoas_router)