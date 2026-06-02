from fastapi import FastAPI
from pydantic import BaseModel
from datetime import datetime

app = FastAPI()

request_count = 0

class MinhaAPIRequest(BaseModel):
    nome: str
    idade: int


@app.get("/health")
def health():
    global request_count
    request_count += 1

    return {
        "status": "UP",
        "timestamp": datetime.now().isoformat(),
        "requests": request_count
    }


@app.post("/minha-api")
def minha_api(payload: MinhaAPIRequest):
    global request_count
    request_count += 1

    return {
        "mensagem": "Request recebida com sucesso",
        "dados": payload.dict(),
        "requests": request_count
    }