from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Pessoa

router = APIRouter()

templates = Jinja2Templates(directory="app/templates")


@router.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html"
    )


@router.get("/pessoas", response_class=HTMLResponse)
def pessoas(request: Request, db: Session = Depends(get_db)):
    pessoas_cadastradas = db.query(Pessoa).order_by(Pessoa.id.desc()).all()

    return templates.TemplateResponse(
        request=request,
        name="pessoas.html",
        context={
            "pessoas": pessoas_cadastradas
        }
    )