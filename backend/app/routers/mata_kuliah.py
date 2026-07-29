from fastapi import APIRouter, Query, Header, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate
from app.utils.dev import get_user_from_request, check_role

router = APIRouter(prefix="/master/mk", tags=["Master Data"])

ADMIN = ["super_admin", "admin_akademik"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def enrich(m):
    prodi = find_by_id("program_studi", m.get("program_studi_id", ""))
    prasyarat = [find_by_id("mata_kuliah", pid) for pid in (m.get("prasyarat_ids") or [])]
    prasyarat = [p for p in prasyarat if p]
    return {**m, "program_studi": prodi, "prasyarat": prasyarat}

@router.get("")
def list_mk(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    prodi_id: str = Query(""),
    jenis: str = Query(""),
    semester: Optional[int] = Query(None),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [r for r in read_all("mata_kuliah") if not r.get("deleted_at")]
    rows = search_rows(rows, ["nama", "kode_mk"], search)
    if prodi_id:
        rows = [r for r in rows if r.get("program_studi_id") == prodi_id]
    if jenis:
        rows = [r for r in rows if r.get("jenis") == jenis]
    if semester is not None:
        rows = [r for r in rows if r.get("semester") == semester]
    rows.sort(key=lambda r: (r.get("program_studi_id", ""), r.get("semester", 0), r.get("nama", "")))
    items, meta = paginate(rows, page, per_page)
    return ok([enrich(m) for m in items], meta=meta)

@router.get("/{mk_id}")
def get_mk(mk_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    m = find_by_id("mata_kuliah", mk_id)
    if not m:
        raise HTTPException(404, "Mata kuliah tidak ditemukan")
    return ok(enrich(m))

class MKCreate(BaseModel):
    kode_mk: str
    nama: str
    sks: int
    semester: int
    jenis: str = "wajib"
    program_studi_id: str
    prasyarat_ids: List[str] = []
    silabus_url: Optional[str] = None

@router.post("")
def create_mk(body: MKCreate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    all_mk = read_all("mata_kuliah")
    if any(m["kode_mk"] == body.kode_mk and not m.get("deleted_at") for m in all_mk):
        raise HTTPException(400, "Kode mata kuliah sudah digunakan")
    if not find_by_id("program_studi", body.program_studi_id):
        raise HTTPException(404, "Program studi tidak ditemukan")
    data = insert("mata_kuliah", {
        "kode_mk": body.kode_mk.upper(),
        "nama": body.nama,
        "sks": body.sks,
        "semester": body.semester,
        "jenis": body.jenis,
        "program_studi_id": body.program_studi_id,
        "prasyarat_ids": body.prasyarat_ids,
        "silabus_url": body.silabus_url,
    })
    return ok(data, "Mata kuliah berhasil ditambahkan")

class MKUpdate(BaseModel):
    kode_mk: Optional[str] = None
    nama: Optional[str] = None
    sks: Optional[int] = None
    semester: Optional[int] = None
    jenis: Optional[str] = None
    program_studi_id: Optional[str] = None
    prasyarat_ids: Optional[List[str]] = None
    silabus_url: Optional[str] = None

@router.put("/{mk_id}")
def update_mk(mk_id: str, body: MKUpdate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    m = find_by_id("mata_kuliah", mk_id)
    if not m:
        raise HTTPException(404, "Mata kuliah tidak ditemukan")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "kode_mk" in updates:
        updates["kode_mk"] = updates["kode_mk"].upper()
    updated = update("mata_kuliah", mk_id, updates)
    return ok(updated, "Mata kuliah berhasil diperbarui")

@router.delete("/{mk_id}")
def delete_mk(mk_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    m = find_by_id("mata_kuliah", mk_id)
    if not m:
        raise HTTPException(404, "Mata kuliah tidak ditemukan")
    used = sum(1 for k in read_all("kelas") if k.get("mata_kuliah_id") == mk_id and not k.get("deleted_at"))
    if used > 0:
        raise HTTPException(400, f"Tidak dapat dihapus — digunakan oleh {used} kelas aktif")
    soft_delete("mata_kuliah", mk_id)
    return ok(message="Mata kuliah berhasil dihapus")
