import logging
import os
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

import pymysql
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field

import telemetry
from telemetry import (
    LEADS, SELL_REQUESTS, STATUS_CHANGES, TEST_DRIVE_CONFLICTS, TEST_DRIVES,
    VALUATION_ESTIMATE, VALUATIONS, span_attrs,
)

app = FastAPI(title="VW Seminovos API", version="2.0.0")
telemetry.instrument(app)
log = logging.getLogger("vw.api")
TZ = ZoneInfo("America/Sao_Paulo")


def now() -> datetime:
    return datetime.now(TZ)


@contextmanager
def db():
    conn = pymysql.connect(
        host=os.getenv("DB_HOST", "db"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "vw_user"),
        password=os.getenv("DB_PASSWORD", "vw_pass"),
        database=os.getenv("DB_NAME", "vw_seminovos"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        client_flag=pymysql.constants.CLIENT.FOUND_ROWS,
        autocommit=True,
    )
    try:
        yield conn
    finally:
        conn.close()


def _fix(row: dict) -> dict:
    for key in ("price", "estimate"):
        if row.get(key) is not None:
            row[key] = float(row[key])
    return row


def _car_exists(cur, car_id: int) -> dict:
    cur.execute("SELECT id, model, version FROM cars WHERE id = %s", (car_id,))
    car = cur.fetchone()
    if not car:
        raise HTTPException(404, "Carro não encontrado")
    span_attrs(car_id=car_id, car_model=car["model"])
    return car


# ---------- modelos de entrada ----------

class Contact(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=8, max_length=30)


class LeadIn(Contact):
    car_id: int
    message: str | None = Field(default=None, max_length=1000)


class TestDriveIn(Contact):
    car_id: int
    visit_date: date
    visit_time: str = Field(pattern=r"^\d{2}:\d{2}$")


class ValuationIn(BaseModel):
    model: str
    year: int = Field(ge=2000, le=2100)
    km: int = Field(ge=0, le=999_999)
    condition: Literal["excelente", "bom", "regular"]


class SellIn(ValuationIn, Contact):
    pass


class StatusIn(BaseModel):
    status: str


# ---------- saúde e estoque ----------

@app.get("/api/health")
def health():
    try:
        with db() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1")
        return {"status": "ok", "database": "ok"}
    except Exception as exc:
        log.error("health check falhou: banco indisponível", extra={"fields": {"error": str(exc)}})
        raise HTTPException(503, f"database unavailable: {exc}")


@app.get("/api/cars")
def list_cars():
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM cars ORDER BY price")
        return [_fix(c) for c in cur.fetchall()]


@app.get("/api/cars/{car_id}")
def get_car(car_id: int):
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM cars WHERE id = %s", (car_id,))
        car = cur.fetchone()
    if not car:
        raise HTTPException(404, "Carro não encontrado")
    return _fix(car)


# ---------- propostas ----------

@app.post("/api/leads", status_code=201)
def create_lead(lead: LeadIn):
    with db() as conn, conn.cursor() as cur:
        car = _car_exists(cur, lead.car_id)
        cur.execute(
            "INSERT INTO leads (car_id, name, email, phone, message) VALUES (%s, %s, %s, %s, %s)",
            (lead.car_id, lead.name.strip(), lead.email, lead.phone.strip(), lead.message),
        )
        lead_id = cur.lastrowid
    source = "simulador" if (lead.message or "").startswith("Simulação:") else "site"
    LEADS.labels(model=car["model"], source=source).inc()
    span_attrs(lead_id=lead_id, lead_source=source)
    log.info("proposta registrada", extra={"fields": {"lead_id": lead_id, "car_id": lead.car_id, "model": car["model"], "source": source}})
    return {"id": lead_id, "message": "Interesse registrado com sucesso"}


@app.get("/api/leads")
def list_leads(status: str | None = None):
    sql = "SELECT l.*, c.model, c.version FROM leads l JOIN cars c ON c.id = l.car_id"
    args: tuple = ()
    if status:
        sql += " WHERE l.status = %s"
        args = (status,)
    with db() as conn, conn.cursor() as cur:
        cur.execute(sql + " ORDER BY l.created_at DESC, l.id DESC", args)
        return cur.fetchall()


# ---------- test drive ----------

WEEKDAY_SLOTS = [f"{h:02d}:00" for h in range(9, 18)]  # seg a sex, 09h às 17h
SATURDAY_SLOTS = [f"{h:02d}:00" for h in range(9, 13)]  # sábado, 09h às 12h
MAX_DAYS_AHEAD = 30


def _slots(cur, car_id: int, day: date) -> tuple[list[dict], str | None]:
    today = now().date()
    if day < today:
        return [], "Escolha uma data a partir de hoje."
    if day > today + timedelta(days=MAX_DAYS_AHEAD):
        return [], f"Agendamentos abertos para os próximos {MAX_DAYS_AHEAD} dias."
    if day.weekday() == 6:
        return [], "A loja não abre aos domingos."
    base = SATURDAY_SLOTS if day.weekday() == 5 else WEEKDAY_SLOTS
    cur.execute(
        "SELECT visit_time FROM test_drives WHERE car_id = %s AND visit_date = %s AND status <> 'cancelado'",
        (car_id, day),
    )
    taken = {r["visit_time"] for r in cur.fetchall()}
    cutoff = now().strftime("%H:%M") if day == today else ""
    slots = [{"time": t, "available": t not in taken and t > cutoff} for t in base]
    if not any(s["available"] for s in slots):
        return slots, "Não há horários livres nesta data."
    return slots, None


@app.get("/api/test-drives/slots")
def test_drive_slots(car_id: int, day: date = Query(alias="date")):
    with db() as conn, conn.cursor() as cur:
        _car_exists(cur, car_id)
        slots, message = _slots(cur, car_id, day)
    return {"date": day, "slots": slots, "message": message}


@app.post("/api/test-drives", status_code=201)
def create_test_drive(td: TestDriveIn):
    with db() as conn, conn.cursor() as cur:
        car = _car_exists(cur, td.car_id)
        slots, message = _slots(cur, td.car_id, td.visit_date)
        slot = next((s for s in slots if s["time"] == td.visit_time), None)
        if slot is None:
            raise HTTPException(400, message or "Horário inválido para esta data.")
        if not slot["available"]:
            TEST_DRIVE_CONFLICTS.inc()
            log.warning("test drive em horário ocupado", extra={"fields": {
                "car_id": td.car_id, "visit_date": td.visit_date, "visit_time": td.visit_time}})
            raise HTTPException(409, "Esse horário acabou de ser reservado. Escolha outro.")
        cur.execute(
            "INSERT INTO test_drives (car_id, name, email, phone, visit_date, visit_time) VALUES (%s, %s, %s, %s, %s, %s)",
            (td.car_id, td.name.strip(), td.email, td.phone.strip(), td.visit_date, td.visit_time),
        )
        td_id = cur.lastrowid
    TEST_DRIVES.labels(model=car["model"]).inc()
    span_attrs(test_drive_id=td_id)
    log.info("test drive agendado", extra={"fields": {
        "test_drive_id": td_id, "car_id": td.car_id, "model": car["model"],
        "visit_date": td.visit_date, "visit_time": td.visit_time}})
    return {"id": td_id, "message": "Test drive agendado"}


@app.get("/api/test-drives")
def list_test_drives(status: str | None = None):
    sql = "SELECT t.*, c.model, c.version FROM test_drives t JOIN cars c ON c.id = t.car_id"
    args: tuple = ()
    if status:
        sql += " WHERE t.status = %s"
        args = (status,)
    with db() as conn, conn.cursor() as cur:
        cur.execute(sql + " ORDER BY t.visit_date, t.visit_time", args)
        return cur.fetchall()


# ---------- avaliação de usado ----------

# Preço de referência fictício de um 0 km, usado só para a estimativa.
REF_PRICES = {
    "Amarok": 320000, "Fox": 70000, "Gol": 75000, "Golf": 280000, "Jetta": 230000,
    "Nivus": 135000, "Polo": 115000, "Polo Track": 90000, "Saveiro": 105000,
    "T-Cross": 155000, "Taos": 210000, "Tera": 120000, "Tiguan Allspace": 280000,
    "Up!": 65000, "Virtus": 140000, "Voyage": 80000,
}
CONDITION_FACTOR = {"excelente": 1.0, "bom": 0.93, "regular": 0.82}
DEALER_MARGIN = 0.85


def _valuate(v: ValuationIn) -> dict:
    if v.model not in REF_PRICES:
        raise HTTPException(422, "Modelo não atendido pela avaliação online.")
    year_now = now().year
    if v.year > year_now + 1:
        raise HTTPException(422, "Ano do veículo inválido.")
    age = max(0, year_now - v.year)
    # depreciação: 8% no ano corrente, 15% no 1º ano e 6% a cada ano seguinte
    value = REF_PRICES[v.model] * (0.92 if age == 0 else 0.85 * 0.94 ** (age - 1))
    expected_km = max(age, 1) * 12000
    if v.km > expected_km:
        value *= max(0.6, 1 - 0.02 * (v.km - expected_km) / 10000)
    else:
        value *= 1 + min(0.05, 0.01 * (expected_km - v.km) / 10000)
    value *= CONDITION_FACTOR[v.condition] * DEALER_MARGIN
    return {
        "estimate": round(value, -2),
        "min": round(value * 0.95, -2),
        "max": round(value * 1.05, -2),
    }


@app.get("/api/valuation/models")
def valuation_models():
    return sorted(REF_PRICES)


@app.post("/api/valuation")
def valuation(v: ValuationIn):
    result = _valuate(v)
    VALUATIONS.labels(model=v.model).inc()
    VALUATION_ESTIMATE.observe(result["estimate"])
    span_attrs(valuation_model=v.model, valuation_year=v.year, valuation_estimate=result["estimate"])
    log.info("estimativa de usado calculada", extra={"fields": {
        "model": v.model, "year": v.year, "km": v.km, "condition": v.condition, "estimate": result["estimate"]}})
    return result


@app.post("/api/sell-requests", status_code=201)
def create_sell_request(req: SellIn):
    result = _valuate(req)
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO sell_requests (name, email, phone, model, year, km, car_condition, estimate) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (req.name.strip(), req.email, req.phone.strip(), req.model, req.year, req.km, req.condition, result["estimate"]),
        )
        sell_id = cur.lastrowid
    SELL_REQUESTS.labels(model=req.model).inc()
    span_attrs(sell_request_id=sell_id, valuation_model=req.model)
    log.info("pedido de avaliação registrado", extra={"fields": {
        "sell_request_id": sell_id, "model": req.model, "year": req.year, "estimate": result["estimate"]}})
    return {"id": sell_id, **result}


@app.get("/api/sell-requests")
def list_sell_requests(status: str | None = None):
    sql = "SELECT * FROM sell_requests"
    args: tuple = ()
    if status:
        sql += " WHERE status = %s"
        args = (status,)
    with db() as conn, conn.cursor() as cur:
        cur.execute(sql + " ORDER BY created_at DESC, id DESC", args)
        return [_fix(r) for r in cur.fetchall()]


# ---------- status (painel) ----------

STATUSES = {
    "leads": ["novo", "em contato", "fechado", "perdido"],
    "test_drives": ["agendado", "realizado", "cancelado"],
    "sell_requests": ["novo", "avaliado", "comprado", "recusado"],
}


@app.get("/api/statuses")
def statuses():
    return STATUSES


def _set_status(table: str, item_id: int, status: str) -> dict:
    if status not in STATUSES[table]:
        raise HTTPException(422, f"Status inválido. Use: {', '.join(STATUSES[table])}")
    with db() as conn, conn.cursor() as cur:
        cur.execute(f"UPDATE {table} SET status = %s WHERE id = %s", (status, item_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "Registro não encontrado")
    STATUS_CHANGES.labels(entity=table, status=status).inc()
    log.info("status alterado no painel", extra={"fields": {"entity": table, "id": item_id, "status": status}})
    return {"id": item_id, "status": status}


@app.patch("/api/leads/{item_id}")
def update_lead(item_id: int, body: StatusIn):
    return _set_status("leads", item_id, body.status)


@app.patch("/api/test-drives/{item_id}")
def update_test_drive(item_id: int, body: StatusIn):
    return _set_status("test_drives", item_id, body.status)


@app.patch("/api/sell-requests/{item_id}")
def update_sell_request(item_id: int, body: StatusIn):
    return _set_status("sell_requests", item_id, body.status)


# ---------- resumo ----------

@app.get("/api/stats")
def stats():
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS cars, MIN(price) AS min_price, AVG(price) AS avg_price FROM cars")
        stock = cur.fetchone()
        cur.execute("SELECT COUNT(*) AS n FROM leads WHERE status = 'novo'")
        new_leads = cur.fetchone()["n"]
        cur.execute(
            "SELECT COUNT(*) AS n FROM test_drives WHERE status = 'agendado' AND visit_date >= %s",
            (now().date(),),
        )
        upcoming = cur.fetchone()["n"]
        cur.execute("SELECT COUNT(*) AS n FROM sell_requests WHERE status = 'novo'")
        new_sells = cur.fetchone()["n"]
        cur.execute(
            "SELECT c.id, c.model, c.version, COUNT(l.id) AS leads FROM cars c "
            "JOIN leads l ON l.car_id = c.id GROUP BY c.id ORDER BY leads DESC, c.id LIMIT 5"
        )
        top = cur.fetchall()
    return {
        "cars": stock["cars"],
        "min_price": float(stock["min_price"] or 0),
        "avg_price": float(stock["avg_price"] or 0),
        "new_leads": new_leads,
        "upcoming_test_drives": upcoming,
        "new_sell_requests": new_sells,
        "top_cars": top,
    }
