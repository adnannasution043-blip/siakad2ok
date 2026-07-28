from fastapi import APIRouter, Query, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate, find_one
from app.utils.dev import get_user_from_request, check_role

router = APIRouter(prefix="/master/prodi", tags=["Master Data"])

ADMIN = ["super_admin", "admin_akademik"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def enrich(p):
    mk_count = sum(1 for m in read_all("mata_kuliah") if m.get("program_studi_id") == p["id"] and not m.get("deleted_at"))
    mhs_count = sum(1 for m in read_all("mahasiswa") if m.get("program_studi_id") == p["id"] and not m.get("deleted_at"))
    dosen_count = sum(1 for d in read_all("dosen") if d.get("prodi_id") == p["id"] and not d.get("deleted_at"))
    return {**p, "jumlah_mk": mk_count, "jumlah_mahasiswa": mhs_count, "jumlah_dosen": dosen_count}

@router.get("")
def list_prodi(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    jenjang: str = Query(""),
    is_active: Optional[bool] = Query(None),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [r for r in read_all("program_studi") if not r.get("deleted_at")]
    rows = search_rows(rows, ["nama", "kode", "akreditasi"], search)
    if jenjang:
        rows = [r for r in rows if r.get("jenjang") == jenjang]
    if is_active is not None:
        rows = [r for r in rows if r.get("is_active") == is_active]
    rows.sort(key=lambda r: r.get("nama", ""))
    items, meta = paginate(rows, page, per_page)
    return ok([enrich(p) for p in items], meta=meta)

@router.get("/{prodi_id}")
def get_prodi(prodi_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    p = find_by_id("program_studi", prodi_id)
    if not p:
        raise HTTPException(404, "Program studi tidak ditemukan")
    return ok(enrich(p))

class ProdiCreate(BaseModel):
    kode: str
    nama: str
    jenjang: str
    akreditasi: str = "B"
    total_sks_lulus: int = 144
    is_active: bool = True

@router.post("")
def create_prodi(body: ProdiCreate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    all_prodi = read_all("program_studi")
    if any(p["kode"] == body.kode and not p.get("deleted_at") for p in all_prodi):
        raise HTTPException(400, "Kode program studi sudah digunakan")
    data = insert("program_studi", {
        "kode": body.kode.upper(),
        "nama": body.nama,
        "jenjang": body.jenjang,
        "akreditasi": body.akreditasi,
        "total_sks_lulus": body.total_sks_lulus,
        "is_active": body.is_active,
    })
    return ok(data, "Program studi berhasil ditambahkan")

class ProdiUpdate(BaseModel):
    kode: Optional[str] = None
    nama: Optional[str] = None
    jenjang: Optional[str] = None
    akreditasi: Optional[str] = None
    total_sks_lulus: Optional[int] = None
    is_active: Optional[bool] = None

@router.put("/{prodi_id}")
def update_prodi(prodi_id: str, body: ProdiUpdate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    p = find_by_id("program_studi", prodi_id)
    if not p:
        raise HTTPException(404, "Program studi tidak ditemukan")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "kode" in updates:
        updates["kode"] = updates["kode"].upper()
    updated = update("program_studi", prodi_id, updates)
    return ok(updated, "Program studi berhasil diperbarui")

@router.delete("/{prodi_id}")
def delete_prodi(prodi_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ["super_admin"])
    p = find_by_id("program_studi", prodi_id)
    if not p:
        raise HTTPException(404, "Program studi tidak ditemukan")
    mhs = sum(1 for m in read_all("mahasiswa") if m.get("program_studi_id") == prodi_id and not m.get("deleted_at"))
    if mhs > 0:
        raise HTTPException(400, f"Tidak dapat dihapus — masih ada {mhs} mahasiswa terdaftar")
    soft_delete("program_studi", prodi_id)
    return ok(message="Program studi berhasil dihapus")
