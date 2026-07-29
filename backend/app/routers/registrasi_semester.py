from fastapi import APIRouter, Query, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate
from app.utils.dev import (
    get_user_from_request, check_role,
    get_mahasiswa_for_user, get_dosen_for_user,
)

router = APIRouter(prefix="/registrasi-semester", tags=["Registrasi Semester"])

ADMIN = ["super_admin", "admin_akademik", "staf"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def enrich(r):
    mhs = find_by_id("mahasiswa", r.get("mahasiswa_id", ""))
    return {**r, "mahasiswa": mhs}

def _scope_rows(rows: list, user: dict) -> list:
    role = user.get("role")
    if role in ("super_admin", "admin_akademik", "staf"):
        return rows
    if role == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        return [r for r in rows if r.get("mahasiswa_id") == mhs_id]
    if role in ("dosen", "kaprodi"):
        dosen = get_dosen_for_user(user)
        if dosen and role == "kaprodi" and dosen.get("prodi_id"):
            mhs_prodi = {m["id"] for m in read_all("mahasiswa")
                         if m.get("program_studi_id") == dosen["prodi_id"] and not m.get("deleted_at")}
            return [r for r in rows if r.get("mahasiswa_id") in mhs_prodi]
    return []

# ── GET list ───────────────────────────────────────────────────
@router.get("")
def list_registrasi(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    status: str = Query(""),
    semester_akademik: str = Query(""),
    mahasiswa_id: str = Query(""),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    rows = [r for r in read_all("registrasi_semester") if not r.get("deleted_at")]
    rows = _scope_rows(rows, user)
    rows = search_rows(rows, ["mahasiswa_nama", "mahasiswa_nim", "semester_akademik"], search)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if semester_akademik:
        rows = [r for r in rows if r.get("semester_akademik") == semester_akademik]
    if mahasiswa_id:
        if user.get("role") == "mahasiswa":
            mhs = get_mahasiswa_for_user(user)
            if not mhs or mhs["id"] != mahasiswa_id:
                raise HTTPException(403, "Akses ditolak")
        rows = [r for r in rows if r.get("mahasiswa_id") == mahasiswa_id]
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok([enrich(r) for r in items], meta=meta)

# ── GET detail ─────────────────────────────────────────────────
@router.get("/{reg_id}")
def get_registrasi(reg_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    r = find_by_id("registrasi_semester", reg_id)
    if not r or r.get("deleted_at"):
        raise HTTPException(404, "Registrasi tidak ditemukan")
    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        if not mhs or r.get("mahasiswa_id") != mhs["id"]:
            raise HTTPException(403, "Akses ditolak")
    return ok(enrich(r))

# ── POST daftar (mahasiswa self-register atau admin) ───────────
class RegCreate(BaseModel):
    mahasiswa_id: str
    semester_akademik: str
    status: str = "aktif"  # aktif | cuti | nonaktif

@router.post("")
def buat_registrasi(body: RegCreate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)

    # Mahasiswa hanya bisa mendaftar untuk dirinya sendiri
    if user.get("role") == "mahasiswa":
        mhs_own = get_mahasiswa_for_user(user)
        if not mhs_own or mhs_own["id"] != body.mahasiswa_id:
            raise HTTPException(403, "Mahasiswa hanya dapat mendaftar untuk dirinya sendiri")
        body.status = "aktif"  # mahasiswa selalu daftar sebagai aktif
    else:
        check_role(user, ADMIN)
        if body.status not in ("aktif", "cuti", "nonaktif"):
            raise HTTPException(400, "Status harus: aktif, cuti, atau nonaktif")

    mhs = find_by_id("mahasiswa", body.mahasiswa_id)
    if not mhs:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")
    if mhs.get("status") not in ("aktif", "cuti"):
        raise HTTPException(400, f"Status mahasiswa '{mhs.get('status')}' tidak dapat melakukan registrasi")

    # Cek duplikat
    existing = next(
        (r for r in read_all("registrasi_semester")
         if r.get("mahasiswa_id") == body.mahasiswa_id
         and r.get("semester_akademik") == body.semester_akademik
         and not r.get("deleted_at")),
        None
    )
    if existing:
        raise HTTPException(400, f"Mahasiswa sudah registrasi semester {body.semester_akademik}")

    data = insert("registrasi_semester", {
        "mahasiswa_id":     body.mahasiswa_id,
        "mahasiswa_nim":    mhs.get("nim", ""),
        "mahasiswa_nama":   mhs.get("nama_lengkap", ""),
        "semester_akademik": body.semester_akademik,
        "status":           body.status,
        "registrasi_at":    now_iso(),
        "dibuat_oleh":      user.get("id", ""),
    })
    return ok(enrich(data), "Registrasi semester berhasil")

# ── PATCH update status (admin only) ──────────────────────────
class RegUpdate(BaseModel):
    status: str

@router.patch("/{reg_id}")
def update_registrasi(reg_id: str, body: RegUpdate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    if body.status not in ("aktif", "cuti", "nonaktif"):
        raise HTTPException(400, "Status harus: aktif, cuti, atau nonaktif")
    r = find_by_id("registrasi_semester", reg_id)
    if not r or r.get("deleted_at"):
        raise HTTPException(404, "Registrasi tidak ditemukan")
    updated = update("registrasi_semester", reg_id, {"status": body.status})
    return ok(enrich(updated), "Status registrasi diperbarui")

# ── DELETE (admin only) ────────────────────────────────────────
@router.delete("/{reg_id}")
def delete_registrasi(reg_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ["super_admin"])
    r = find_by_id("registrasi_semester", reg_id)
    if not r:
        raise HTTPException(404, "Registrasi tidak ditemukan")
    soft_delete("registrasi_semester", reg_id)
    return ok(message="Registrasi dihapus")
