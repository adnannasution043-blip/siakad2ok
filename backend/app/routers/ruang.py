from fastapi import APIRouter, Query, Header, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate
from app.utils.dev import get_user_from_request, check_role

router = APIRouter(prefix="/master/ruang", tags=["Master Data"])

ADMIN = ["super_admin", "admin_akademik", "admin_aset"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

@router.get("")
def list_ruang(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    gedung: str = Query(""),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [r for r in read_all("ruang") if not r.get("deleted_at")]
    rows = search_rows(rows, ["nama", "kode", "gedung"], search)
    if gedung:
        rows = [r for r in rows if r.get("gedung") == gedung]
    rows.sort(key=lambda r: (r.get("gedung", ""), r.get("lantai", 0), r.get("nama", "")))
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)

@router.get("/gedung-list")
def list_gedung(authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    rows = [r for r in read_all("ruang") if not r.get("deleted_at")]
    gedung_list = sorted(set(r.get("gedung", "") for r in rows if r.get("gedung")))
    return ok(gedung_list)

@router.get("/{ruang_id}")
def get_ruang(ruang_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    r = find_by_id("ruang", ruang_id)
    if not r:
        raise HTTPException(404, "Ruang tidak ditemukan")
    return ok(r)

class RuangCreate(BaseModel):
    kode: str
    nama: str
    gedung: str
    lantai: int = 1
    kapasitas: int = 30
    fasilitas: List[str] = []

@router.post("")
def create_ruang(body: RuangCreate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    all_ruang = read_all("ruang")
    if any(r["kode"] == body.kode and not r.get("deleted_at") for r in all_ruang):
        raise HTTPException(400, "Kode ruang sudah digunakan")
    data = insert("ruang", {
        "kode": body.kode.upper(),
        "nama": body.nama,
        "gedung": body.gedung,
        "lantai": body.lantai,
        "kapasitas": body.kapasitas,
        "fasilitas": body.fasilitas,
    })
    return ok(data, "Ruang berhasil ditambahkan")

class RuangUpdate(BaseModel):
    kode: Optional[str] = None
    nama: Optional[str] = None
    gedung: Optional[str] = None
    lantai: Optional[int] = None
    kapasitas: Optional[int] = None
    fasilitas: Optional[List[str]] = None

@router.put("/{ruang_id}")
def update_ruang(ruang_id: str, body: RuangUpdate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    r = find_by_id("ruang", ruang_id)
    if not r:
        raise HTTPException(404, "Ruang tidak ditemukan")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "kode" in updates:
        updates["kode"] = updates["kode"].upper()
    updated = update("ruang", ruang_id, updates)
    return ok(updated, "Ruang berhasil diperbarui")

@router.delete("/{ruang_id}")
def delete_ruang(ruang_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    r = find_by_id("ruang", ruang_id)
    if not r:
        raise HTTPException(404, "Ruang tidak ditemukan")
    used = sum(1 for k in read_all("kelas") if k.get("ruang_id") == ruang_id and not k.get("deleted_at"))
    if used > 0:
        raise HTTPException(400, f"Tidak dapat dihapus — digunakan oleh {used} jadwal kelas aktif")
    soft_delete("ruang", ruang_id)
    return ok(message="Ruang berhasil dihapus")
