from fastapi import APIRouter, Query, Header, HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.utils.db import read_all, find_by_id, insert, update, soft_delete, paginate
from app.utils.dev import get_user_from_request, check_role, get_mahasiswa_for_user

router = APIRouter(prefix="/klinik", tags=["Klinik & Kesehatan"])

KLINIK_STAFF = ["super_admin", "admin_akademik", "staf"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def _now():
    return datetime.now(timezone.utc).isoformat()


# ─── STATS ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, KLINIK_STAFF)
    kunjungan = [k for k in read_all("kunjungan_klinik") if not k.get("deleted_at")]
    diagnosa_set = set(k.get("diagnosa", "") for k in kunjungan if k.get("diagnosa"))
    pasien_set = set(k.get("mahasiswa_id") for k in kunjungan)
    return ok({
        "total_kunjungan": len(kunjungan),
        "selesai": len([k for k in kunjungan if k.get("status") == "selesai"]),
        "dirujuk": len([k for k in kunjungan if k.get("status") == "dirujuk"]),
        "total_pasien_unik": len(pasien_set),
        "jenis_diagnosa": len(diagnosa_set),
    })


# ─── KUNJUNGAN ────────────────────────────────────────────────────────────────

@router.get("")
def list_kunjungan(
    status: Optional[str] = None,
    mahasiswa_id: Optional[str] = None,
    search: Optional[str] = None,
    dari: Optional[str] = None,
    sampai: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    data = [k for k in read_all("kunjungan_klinik") if not k.get("deleted_at")]

    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        data = [k for k in data if k.get("mahasiswa_id") == mhs_id]
    else:
        check_role(user, KLINIK_STAFF)

    if status:
        data = [k for k in data if k.get("status") == status]
    if mahasiswa_id and user.get("role") != "mahasiswa":
        data = [k for k in data if k.get("mahasiswa_id") == mahasiswa_id]
    if search:
        q = search.lower()
        data = [k for k in data if
                q in k.get("nama_pasien", "").lower() or
                q in k.get("nim", "").lower() or
                q in k.get("keluhan", "").lower() or
                q in k.get("diagnosa", "").lower()]
    if dari:
        data = [k for k in data if k.get("tanggal", "") >= dari]
    if sampai:
        data = [k for k in data if k.get("tanggal", "") <= sampai]
    data.sort(key=lambda k: k.get("tanggal", ""), reverse=True)
    items, meta = paginate(data, page, per_page)
    return ok(items, meta=meta)


@router.post("")
def create_kunjungan(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, KLINIK_STAFF)
    required = ["nama_pasien", "nim", "tanggal", "keluhan", "petugas"]
    for f in required:
        if not body.get(f):
            raise HTTPException(400, f"Field '{f}' wajib diisi")
    now = _now()
    record = {
        "id": f"knj-{uuid.uuid4().hex[:8]}",
        "mahasiswa_id": body.get("mahasiswa_id"),
        "nim": body["nim"],
        "nama_pasien": body["nama_pasien"],
        "tanggal": body["tanggal"],
        "keluhan": body["keluhan"],
        "diagnosa": body.get("diagnosa"),
        "tindakan": body.get("tindakan"),
        "petugas": body["petugas"],
        "status": body.get("status", "selesai"),
        "catatan": body.get("catatan"),
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    insert("kunjungan_klinik", record)
    return ok(record, "Kunjungan berhasil dicatat")


@router.get("/{kunjungan_id}")
def get_kunjungan(kunjungan_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    rec = find_by_id("kunjungan_klinik", kunjungan_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Kunjungan tidak ditemukan")
    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        if not mhs or rec.get("mahasiswa_id") != mhs["id"]:
            raise HTTPException(403, "Akses ditolak")
    return ok(rec)


@router.put("/{kunjungan_id}")
def update_kunjungan(kunjungan_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, KLINIK_STAFF)
    rec = find_by_id("kunjungan_klinik", kunjungan_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Kunjungan tidak ditemukan")
    updatable = ["keluhan", "diagnosa", "tindakan", "petugas", "status", "catatan", "tanggal"]
    changes = {k: body[k] for k in updatable if k in body}
    changes["updated_at"] = _now()
    updated = update("kunjungan_klinik", kunjungan_id, changes)
    return ok(updated, "Kunjungan berhasil diperbarui")


@router.delete("/{kunjungan_id}")
def delete_kunjungan(kunjungan_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, KLINIK_STAFF)
    rec = find_by_id("kunjungan_klinik", kunjungan_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Kunjungan tidak ditemukan")
    soft_delete("kunjungan_klinik", kunjungan_id)
    return ok(None, "Data kunjungan dihapus")
