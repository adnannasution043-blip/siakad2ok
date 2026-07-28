from fastapi import APIRouter, Query
from fastapi.params import Header
from pydantic import BaseModel
from typing import Optional
from app.utils.db import (
    read_all, find_by_id, insert, update, soft_delete,
    search_rows, filter_rows, paginate, find_one
)
from app.utils.security import hash_password
from app.utils.dev import get_user_from_request, check_role, DEV_MODE

router = APIRouter(prefix="/mahasiswa", tags=["Mahasiswa"])

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def enrich(m):
    prodi = find_by_id("program_studi", m.get("program_studi_id", ""))
    return {**m, "program_studi": prodi, "ipk": round(float(m.get("ipk", 0)), 2)}

ADMIN_ROLES = ["super_admin", "admin_akademik", "staf"]

# ── GET list ───────────────────────────────────────────────
@router.get("")
def list_mahasiswa(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    status: str = Query(""),
    prodi_id: str = Query(""),
    angkatan: Optional[int] = Query(None),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [r for r in read_all("mahasiswa") if r.get("deleted_at") is None]
    rows = search_rows(rows, ["nama_lengkap", "nim", "email"], search)
    rows = filter_rows(rows, status=status, program_studi_id=prodi_id)
    if angkatan:
        rows = [r for r in rows if r.get("angkatan") == angkatan]
    rows.sort(key=lambda r: r.get("nama_lengkap", ""))
    items, meta = paginate(rows, page, per_page)
    return ok([enrich(m) for m in items], meta=meta)

# ── GET prodi ──────────────────────────────────────────────
@router.get("/prodi")
def list_prodi(authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    rows = [r for r in read_all("program_studi") if r.get("is_active") and not r.get("deleted_at")]
    return ok(sorted(rows, key=lambda r: r["nama"]))

# ── GET detail ─────────────────────────────────────────────
@router.get("/{mahasiswa_id}")
def get_mahasiswa(mahasiswa_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    m = find_by_id("mahasiswa", mahasiswa_id)
    if not m:
        from fastapi import HTTPException
        raise HTTPException(404, "Mahasiswa tidak ditemukan")
    if not DEV_MODE and user["role"] == "mahasiswa" and m.get("user_id") != user["id"]:
        from fastapi import HTTPException
        raise HTTPException(403, "Akses ditolak")
    return ok(enrich(m))

# ── POST create ────────────────────────────────────────────
class MahasiswaCreate(BaseModel):
    nim: str
    nama_lengkap: str
    email: str
    password: str = "secret"
    program_studi_id: str
    angkatan: int
    jenis_kelamin: Optional[str] = None
    tempat_lahir: Optional[str] = None
    tanggal_lahir: Optional[str] = None
    alamat: Optional[str] = None
    no_hp: Optional[str] = None
    no_hp_ortu: Optional[str] = None
    nik: Optional[str] = None

@router.post("")
def create_mahasiswa(body: MahasiswaCreate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_ROLES)

    if find_one("users", email=body.email):
        from fastapi import HTTPException
        raise HTTPException(400, "Email sudah terdaftar")
    all_mhs = read_all("mahasiswa")
    if any(m["nim"] == body.nim and not m.get("deleted_at") for m in all_mhs):
        from fastapi import HTTPException
        raise HTTPException(400, "NIM sudah terdaftar")
    if not find_by_id("program_studi", body.program_studi_id):
        from fastapi import HTTPException
        raise HTTPException(404, "Program studi tidak ditemukan")

    new_user = insert("users", {
        "email": body.email,
        "password_hash": hash_password(body.password),
        "role": "mahasiswa",
        "nama": body.nama_lengkap,
        "is_active": True,
        "foto_url": None,
    })
    mhs = insert("mahasiswa", {
        "user_id": new_user["id"],
        "nim": body.nim,
        "nama_lengkap": body.nama_lengkap,
        "email": body.email,
        "program_studi_id": body.program_studi_id,
        "angkatan": body.angkatan,
        "semester_aktif": 1,
        "status": "aktif",
        "ipk": 0.0,
        "total_sks_lulus": 0,
        "jenis_kelamin": body.jenis_kelamin,
        "tempat_lahir": body.tempat_lahir,
        "tanggal_lahir": body.tanggal_lahir,
        "alamat": body.alamat,
        "no_hp": body.no_hp,
        "no_hp_ortu": body.no_hp_ortu,
        "nik": body.nik,
        "foto_url": None,
    })
    return ok({"id": mhs["id"], "nim": mhs["nim"], "nama_lengkap": mhs["nama_lengkap"]}, "Mahasiswa berhasil ditambahkan")

# ── PUT update ─────────────────────────────────────────────
class MahasiswaUpdate(BaseModel):
    nama_lengkap: Optional[str] = None
    jenis_kelamin: Optional[str] = None
    tempat_lahir: Optional[str] = None
    tanggal_lahir: Optional[str] = None
    alamat: Optional[str] = None
    no_hp: Optional[str] = None
    no_hp_ortu: Optional[str] = None
    status: Optional[str] = None
    semester_aktif: Optional[int] = None

@router.put("/{mahasiswa_id}")
def update_mahasiswa(mahasiswa_id: str, body: MahasiswaUpdate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_ROLES)
    m = find_by_id("mahasiswa", mahasiswa_id)
    if not m:
        from fastapi import HTTPException
        raise HTTPException(404, "Mahasiswa tidak ditemukan")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = update("mahasiswa", mahasiswa_id, updates)
    return ok({"id": updated["id"], "nama_lengkap": updated["nama_lengkap"]}, "Data diperbarui")

# ── DELETE ─────────────────────────────────────────────────
@router.delete("/{mahasiswa_id}")
def delete_mahasiswa(mahasiswa_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ["super_admin", "admin_akademik"])
    if not find_by_id("mahasiswa", mahasiswa_id):
        from fastapi import HTTPException
        raise HTTPException(404, "Mahasiswa tidak ditemukan")
    soft_delete("mahasiswa", mahasiswa_id)
    return ok(message="Mahasiswa berhasil dihapus")
