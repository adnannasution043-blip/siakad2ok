from fastapi import APIRouter, Query, Header, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate, find_one
from app.utils.security import hash_password
from app.utils.dev import get_user_from_request, check_role

router = APIRouter(prefix="/dosen", tags=["Dosen"])

ADMIN = ["super_admin", "admin_akademik"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def enrich(d):
    prodi = find_by_id("program_studi", d.get("prodi_id", ""))
    kelas_list = [k for k in read_all("kelas") if k.get("dosen_id") == d["id"] and not k.get("deleted_at")]
    return {
        **d,
        "program_studi": prodi,
        "jumlah_kelas": len(kelas_list),
        "bidang_keahlian": d.get("bidang_keahlian") if isinstance(d.get("bidang_keahlian"), list) else [],
    }

@router.get("")
def list_dosen(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    prodi_id: str = Query(""),
    jabatan: str = Query(""),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [d for d in read_all("dosen") if not d.get("deleted_at")]
    rows = search_rows(rows, ["nama_lengkap", "nidn", "email", "bidang_keahlian"], search)
    if prodi_id:
        rows = [r for r in rows if r.get("prodi_id") == prodi_id]
    if jabatan:
        rows = [r for r in rows if r.get("jabatan_fungsional") == jabatan]
    rows.sort(key=lambda r: r.get("nama_lengkap", ""))
    items, meta = paginate(rows, page, per_page)
    return ok([enrich(d) for d in items], meta=meta)

@router.get("/{dosen_id}")
def get_dosen(dosen_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    d = find_by_id("dosen", dosen_id)
    if not d:
        raise HTTPException(404, "Dosen tidak ditemukan")
    return ok(enrich(d))

class DosenCreate(BaseModel):
    nidn: str
    nama_lengkap: str
    email: str
    password: str = "secret"
    prodi_id: str
    jabatan_fungsional: str = "Tenaga Pengajar"
    pendidikan_terakhir: str = "S2"
    bidang_keahlian: List[str] = []
    max_sks_mengajar: int = 12
    no_hp: Optional[str] = None

@router.post("")
def create_dosen(body: DosenCreate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)

    if find_one("users", email=body.email):
        raise HTTPException(400, "Email sudah terdaftar")
    all_dosen = read_all("dosen")
    if any(d["nidn"] == body.nidn and not d.get("deleted_at") for d in all_dosen):
        raise HTTPException(400, "NIDN sudah terdaftar")
    if not find_by_id("program_studi", body.prodi_id):
        raise HTTPException(404, "Program studi tidak ditemukan")

    new_user = insert("users", {
        "email": body.email,
        "password_hash": hash_password(body.password),
        "role": "dosen",
        "nama": body.nama_lengkap,
        "is_active": True,
        "foto_url": None,
    })
    dosen = insert("dosen", {
        "user_id": new_user["id"],
        "nidn": body.nidn,
        "nama_lengkap": body.nama_lengkap,
        "email": body.email,
        "prodi_id": body.prodi_id,
        "jabatan_fungsional": body.jabatan_fungsional,
        "pendidikan_terakhir": body.pendidikan_terakhir,
        "bidang_keahlian": body.bidang_keahlian,
        "max_sks_mengajar": body.max_sks_mengajar,
        "no_hp": body.no_hp,
    })
    return ok(enrich(dosen), "Dosen berhasil ditambahkan")

class DosenUpdate(BaseModel):
    nama_lengkap: Optional[str] = None
    prodi_id: Optional[str] = None
    jabatan_fungsional: Optional[str] = None
    pendidikan_terakhir: Optional[str] = None
    bidang_keahlian: Optional[List[str]] = None
    max_sks_mengajar: Optional[int] = None
    no_hp: Optional[str] = None

@router.put("/{dosen_id}")
def update_dosen(dosen_id: str, body: DosenUpdate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    d = find_by_id("dosen", dosen_id)
    if not d:
        raise HTTPException(404, "Dosen tidak ditemukan")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = update("dosen", dosen_id, updates)
    return ok(enrich(updated), "Data dosen berhasil diperbarui")

@router.delete("/{dosen_id}")
def delete_dosen(dosen_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    d = find_by_id("dosen", dosen_id)
    if not d:
        raise HTTPException(404, "Dosen tidak ditemukan")
    aktif = sum(1 for k in read_all("kelas") if k.get("dosen_id") == dosen_id and not k.get("deleted_at"))
    if aktif > 0:
        raise HTTPException(400, f"Tidak dapat dihapus — dosen mengampu {aktif} kelas aktif")
    soft_delete("dosen", dosen_id)
    return ok(message="Dosen berhasil dihapus")
