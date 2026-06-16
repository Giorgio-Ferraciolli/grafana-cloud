from fastapi import FastAPI, HTTPException, Request, Form
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, HttpUrl
from typing import Optional
import httpx
import time

app = FastAPI(title="Site Monitor API")

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

sites = []
next_id = 1


class SiteCreate(BaseModel):
    name: str
    url: HttpUrl


class Site(BaseModel):
    id: int
    name: str
    url: HttpUrl


class CheckResult(BaseModel):
    site_id: int
    name: str
    url: str
    online: bool
    status_code: Optional[int]
    response_time_ms: Optional[float]
    error: Optional[str] = None


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse("static/favicon.ico")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
        "sites": sites
        }
    )


@app.post("/frontend/sites")
def create_site_frontend(
    name: str = Form(...),
    url: str = Form(...)
):
    global next_id

    new_site = {
        "id": next_id,
        "name": name,
        "url": url,
        "last_check": None
    }

    sites.append(new_site)
    next_id += 1

    return RedirectResponse(url="/", status_code=303)


@app.post("/frontend/sites/{site_id}/check")
async def check_site_frontend(site_id: int):
    result = await check_site(site_id)

    for site in sites:
        if site["id"] == site_id:
            site["last_check"] = result
            break

    return RedirectResponse(url="/", status_code=303)


@app.post("/sites", response_model=Site)
def create_site(site: SiteCreate):
    global next_id

    new_site = {
        "id": next_id,
        "name": site.name,
        "url": site.url,
        "last_check": None
    }

    sites.append(new_site)
    next_id += 1

    return new_site


@app.get("/sites")
def list_sites():
    return sites


@app.get("/sites/{site_id}")
def get_site(site_id: int):
    for site in sites:
        if site["id"] == site_id:
            return site

    raise HTTPException(status_code=404, detail="Site not found")


@app.post("/sites/{site_id}/check", response_model=CheckResult)
async def check_site(site_id: int):
    site = None

    for item in sites:
        if item["id"] == site_id:
            site = item
            break

    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")

    start_time = time.perf_counter()

    try:
        async with httpx.AsyncClient(timeout=5, verify=False) as client:
            response = await client.get(str(site["url"]))

        end_time = time.perf_counter()
        response_time_ms = (end_time - start_time) * 1000

        return {
            "site_id": site["id"],
            "name": site["name"],
            "url": str(site["url"]),
            "online": response.status_code < 500,
            "status_code": response.status_code,
            "response_time_ms": round(response_time_ms, 2),
            "error": None
        }

    except Exception as error:
        return {
            "site_id": site["id"],
            "name": site["name"],
            "url": str(site["url"]),
            "online": False,
            "status_code": None,
            "response_time_ms": None,
            "error": str(error)
        }