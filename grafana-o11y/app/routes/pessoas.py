from fastapi import APIRouter, Depends, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Pessoa

router = APIRouter()


@router.post("/pessoas")
def cadastrar_pessoa(
    nome: str = Form(...),
    email: str = Form(...),
    db: Session = Depends(get_db)
):
    pessoa = Pessoa(
        nome=nome,
        email=email
    )

    db.add(pessoa)
    db.commit()
    db.refresh(pessoa)

    return RedirectResponse(
        url="/pessoas",
        status_code=303
    )