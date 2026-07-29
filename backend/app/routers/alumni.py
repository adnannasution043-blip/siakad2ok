from fastapi import APIRouter, Query, Header, HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.utils.db import read_all, find_by_id, insert, update, soft_delete, paginate
from app.utils.dev import get_user_from_request, check_role, get_mahasiswa_for_user

router = APIRouter(prefix="/alumni", tags=["Alumni & Yudisium"])

ADMIN = ["super_admin", "admin_akademik", "staf"]
ADMIN_KAPRODI = ["super_admin", "admin_akademik", "kaprodi", "staf"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def _now():
    return datetime.now(timezone.utc).isoformat()


# ─── STATS ───────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    alumni = [a for a in read_all("alumni") if not a.get("deleted_at")]
    yudisium = [y for y in read_all("yudisium") if not y.get("deleted_at")]

    sudah_bekerja = len([a for a in alumni if a.get("pekerjaan") and a.get("pekerjaan") != "Belum Bekerja"])
    belum_bekerja = len([a for a in alumni if not a.get("instansi")])
    prodi_set = set(a.get("program_studi_id") for a in alumni)

    return ok({
        "total_alumni": len(alumni),
        "sudah_bekerja": sudah_bekerja,
        "belum_bekerja": belum_bekerja,
        "jumlah_prodi": len(prodi_set),
        "yudisium_selesai": len([y for y in yudisium if y.get("status") == "selesai"]),
        "yudisium_dijadwalkan": len([y for y in yudisium if y.get("status") == "dijadwalkan"]),
    })


# ─── ALUMNI ───────────────────────────────────────────────────────────────────

@router.get("")
def list_alumni(
    program_studi_id: Optional[str] = None,
    angkatan: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    data = [a for a in read_all("alumni") if not a.get("deleted_at")]

    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        data = [a for a in data if a.get("mahasiswa_id") == mhs_id]
    else:
        check_role(user, ADMIN_KAPRODI + ["alumni"])

    if program_studi_id:
        data = [a for a in data if a.get("program_studi_id") == program_studi_id]
    if angkatan:
        data = [a for a in data if str(a.get("angkatan")) == angkatan]
    if search:
        q = search.lower()
        data = [a for a in data if
                q in a.get("nama", "").lower() or
                q in a.get("nim", "").lower() or
                q in (a.get("instansi") or "").lower()]
    items, meta = paginate(data, page, per_page)
    return ok(items, meta=meta)


@router.post("")
def create_alumni(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    required = ["mahasiswa_id", "nim", "nama", "program_studi_id", "program_studi",
                "angkatan", "ipk", "total_sks", "tgl_lulus", "no_ijazah", "no_transkrip"]
    for f in required:
        if not body.get(f):
            raise HTTPException(400, f"Field '{f}' wajib diisi")

    existing = [a for a in read_all("alumni") if not a.get("deleted_at")]
    if any(a["mahasiswa_id"] == body["mahasiswa_id"] for a in existing):
        raise HTTPException(409, "Alumni untuk mahasiswa ini sudah terdaftar")
    if any(a["no_ijazah"] == body["no_ijazah"] for a in existing):
        raise HTTPException(409, "Nomor ijazah sudah digunakan")

    now = _now()
    record = {
        "id": f"alm-{uuid.uuid4().hex[:8]}",
        "mahasiswa_id": body["mahasiswa_id"],
        "nim": body["nim"],
        "nama": body["nama"],
        "program_studi_id": body["program_studi_id"],
        "program_studi": body["program_studi"],
        "angkatan": str(body["angkatan"]),
        "ipk": float(body["ipk"]),
        "total_sks": int(body["total_sks"]),
        "tgl_lulus": body["tgl_lulus"],
        "no_ijazah": body["no_ijazah"],
        "no_transkrip": body["no_transkrip"],
        "pekerjaan": body.get("pekerjaan"),
        "instansi": body.get("instansi"),
        "email_alumni": body.get("email_alumni"),
        "no_hp": body.get("no_hp"),
        "kota_domisili": body.get("kota_domisili"),
        "status_yudisium": body.get("status_yudisium", "belum"),
        "tgl_yudisium": body.get("tgl_yudisium"),
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    insert("alumni", record)
    return ok(record, "Alumni berhasil ditambahkan")


@router.get("/{alumni_id}")
def get_alumni(alumni_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    rec = find_by_id("alumni", alumni_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Alumni tidak ditemukan")
    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        if not mhs or rec.get("mahasiswa_id") != mhs["id"]:
            raise HTTPException(403, "Akses ditolak")
    return ok(rec)


@router.put("/{alumni_id}")
def update_alumni(alumni_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    rec = find_by_id("alumni", alumni_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Alumni tidak ditemukan")
    if user.get("role") == "alumni":
        # Alumni can update own contact info
        mhs = get_mahasiswa_for_user(user)
        if not mhs or rec.get("mahasiswa_id") != mhs["id"]:
            raise HTTPException(403, "Akses ditolak")
        allowed = ["pekerjaan", "instansi", "email_alumni", "no_hp", "kota_domisili"]
        body = {k: v for k, v in body.items() if k in allowed}
    else:
        check_role(user, ADMIN)
        allowed = ["pekerjaan", "instansi", "email_alumni", "no_hp", "kota_domisili",
                   "status_yudisium", "tgl_yudisium"]
        body = {k: v for k, v in body.items() if k in allowed}
    body["updated_at"] = _now()
    updated = update("alumni", alumni_id, body)
    return ok(updated, "Alumni berhasil diperbarui")


@router.delete("/{alumni_id}")
def delete_alumni(alumni_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    rec = find_by_id("alumni", alumni_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Alumni tidak ditemukan")
    soft_delete("alumni", alumni_id)
    return ok(None, "Alumni berhasil dihapus")


# ─── YUDISIUM ─────────────────────────────────────────────────────────────────

@router.get("/yudisium/list")
def list_yudisium(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    data = [y for y in read_all("yudisium") if not y.get("deleted_at")]
    if status:
        data = [y for y in data if y.get("status") == status]
    data.sort(key=lambda y: y.get("tanggal", ""), reverse=True)
    items, meta = paginate(data, page, per_page)
    return ok(items, meta=meta)


@router.post("/yudisium")
def create_yudisium(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    required = ["nama", "tanggal", "periode", "tempat"]
    for f in required:
        if not body.get(f):
            raise HTTPException(400, f"Field '{f}' wajib diisi")
    now = _now()
    record = {
        "id": f"yud-{uuid.uuid4().hex[:8]}",
        "nama": body["nama"],
        "tanggal": body["tanggal"],
        "periode": body["periode"],
        "tempat": body["tempat"],
        "jumlah_peserta": int(body.get("jumlah_peserta", 0)),
        "status": "dijadwalkan",
        "keterangan": body.get("keterangan"),
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    insert("yudisium", record)
    return ok(record, "Yudisium berhasil dijadwalkan")


@router.get("/yudisium/{yudisium_id}")
def get_yudisium(yudisium_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    rec = find_by_id("yudisium", yudisium_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Yudisium tidak ditemukan")
    return ok(rec)


@router.put("/yudisium/{yudisium_id}")
def update_yudisium(yudisium_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    rec = find_by_id("yudisium", yudisium_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Yudisium tidak ditemukan")
    updatable = ["nama", "tanggal", "periode", "tempat", "jumlah_peserta", "status", "keterangan"]
    changes = {k: body[k] for k in updatable if k in body}
    changes["updated_at"] = _now()
    updated = update("yudisium", yudisium_id, changes)
    return ok(updated, "Yudisium berhasil diperbarui")


@router.delete("/yudisium/{yudisium_id}")
def delete_yudisium(yudisium_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    rec = find_by_id("yudisium", yudisium_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Yudisium tidak ditemukan")
    soft_delete("yudisium", yudisium_id)
    return ok(None, "Yudisium berhasil dihapus")
