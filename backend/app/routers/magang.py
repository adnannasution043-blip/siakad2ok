from fastapi import APIRouter, Query, Header, HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.utils.db import read_all, find_by_id, insert, update, soft_delete, paginate
from app.utils.dev import (
    get_user_from_request, check_role,
    get_mahasiswa_for_user, get_dosen_for_user,
)

router = APIRouter(prefix="/magang", tags=["Magang / PKL"])

ADMIN = ["super_admin", "admin_akademik", "staf"]
ADMIN_KAPRODI = ["super_admin", "admin_akademik", "kaprodi", "staf"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def _now():
    return datetime.now(timezone.utc).isoformat()

def _scope_magang(rows: list, user: dict) -> list:
    role = user.get("role")
    if role in ADMIN or role == "kaprodi":
        return rows
    if role == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        return [m for m in rows if m.get("mahasiswa_id") == mhs_id]
    if role == "dosen":
        dosen = get_dosen_for_user(user)
        dosen_id = dosen["id"] if dosen else ""
        return [m for m in rows if m.get("dosen_pembimbing_id") == dosen_id]
    return []

# ─── LIST & DETAIL ────────────────────────────────────────────────────────────

@router.get("")
def list_magang(
    status: Optional[str] = None,
    semester: Optional[str] = None,
    mahasiswa_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    data = [m for m in read_all("magang") if not m.get("deleted_at")]
    data = _scope_magang(data, user)

    if status:
        data = [m for m in data if m.get("status") == status]
    if semester:
        data = [m for m in data if m.get("semester_akademik") == semester]
    if mahasiswa_id:
        if user.get("role") == "mahasiswa":
            mhs = get_mahasiswa_for_user(user)
            if not mhs or mhs["id"] != mahasiswa_id:
                raise HTTPException(403, "Akses ditolak")
        data = [m for m in data if m.get("mahasiswa_id") == mahasiswa_id]
    if search:
        q = search.lower()
        data = [m for m in data if q in m.get("mahasiswa_nama", "").lower()
                or q in m.get("mahasiswa_nim", "").lower()
                or q in m.get("instansi", "").lower()
                or q in m.get("judul_proyek", "").lower()]
    data.sort(key=lambda x: x.get("tgl_mulai", ""), reverse=True)
    items, meta = paginate(data, page, per_page)
    return ok(items, meta=meta)


@router.get("/stats")
def get_stats(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    data = [m for m in read_all("magang") if not m.get("deleted_at")]
    data = _scope_magang(data, user)

    nilai_list = [m["nilai_akhir"] for m in data if m.get("nilai_akhir")]
    instansi_count = {}
    for m in data:
        inst = m.get("instansi", "Lainnya")
        instansi_count[inst] = instansi_count.get(inst, 0) + 1
    top_instansi = sorted(instansi_count.items(), key=lambda x: -x[1])[:5]

    return ok({
        "total": len(data),
        "pending": sum(1 for m in data if m.get("status") == "pending"),
        "berjalan": sum(1 for m in data if m.get("status") == "berjalan"),
        "selesai": sum(1 for m in data if m.get("status") == "selesai"),
        "rata_nilai": round(sum(nilai_list) / len(nilai_list), 2) if nilai_list else None,
        "top_instansi": [{"instansi": k, "jumlah": v} for k, v in top_instansi],
    })


@router.post("")
def ajukan_magang(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    mahasiswa_id = body.get("mahasiswa_id", "").strip()
    instansi = body.get("instansi", "").strip()
    tgl_mulai = body.get("tgl_mulai", "").strip()
    tgl_selesai = body.get("tgl_selesai", "").strip()
    if not all([mahasiswa_id, instansi, tgl_mulai, tgl_selesai]):
        raise HTTPException(400, "mahasiswa_id, instansi, tgl_mulai, tgl_selesai wajib diisi")

    if user.get("role") == "mahasiswa":
        mhs_own = get_mahasiswa_for_user(user)
        if not mhs_own or mhs_own["id"] != mahasiswa_id:
            raise HTTPException(403, "Mahasiswa hanya dapat mengajukan magang untuk dirinya sendiri")
    else:
        check_role(user, ADMIN_KAPRODI + ["dosen"])

    mhs = find_by_id("mahasiswa", mahasiswa_id)
    if not mhs:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")

    aktif = [m for m in read_all("magang")
             if m.get("mahasiswa_id") == mahasiswa_id
             and m.get("status") == "berjalan"
             and not m.get("deleted_at")]
    if aktif:
        raise HTTPException(400, "Mahasiswa sudah memiliki magang yang sedang berjalan")

    pb = find_by_id("dosen", body.get("dosen_pembimbing_id", "")) if body.get("dosen_pembimbing_id") else None
    now = _now()
    rec = {
        "id": str(uuid.uuid4()),
        "mahasiswa_id": mahasiswa_id,
        "mahasiswa_nama": mhs.get("nama_lengkap", ""),
        "mahasiswa_nim": mhs.get("nim", ""),
        "program_studi_id": mhs.get("program_studi_id", ""),
        "instansi": instansi,
        "alamat_instansi": body.get("alamat_instansi", ""),
        "judul_proyek": body.get("judul_proyek", ""),
        "deskripsi": body.get("deskripsi", ""),
        "dosen_pembimbing_id": pb["id"] if pb else None,
        "dosen_pembimbing_nama": pb["nama_lengkap"] if pb else None,
        "tgl_mulai": tgl_mulai,
        "tgl_selesai": tgl_selesai,
        "semester_akademik": body.get("semester_akademik", ""),
        "status": "pending",
        "nilai_akhir": None,
        "catatan": None,
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    insert("magang", rec)
    return ok(rec, "Pengajuan magang berhasil disubmit")


@router.get("/{magang_id}")
def get_magang(magang_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    m = find_by_id("magang", magang_id)
    if not m or m.get("deleted_at"):
        raise HTTPException(404, "Data magang tidak ditemukan")
    if not _scope_magang([m], user):
        raise HTTPException(403, "Akses ditolak")
    return ok(m)


@router.put("/{magang_id}")
def update_magang(magang_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    m = find_by_id("magang", magang_id)
    if not m or m.get("deleted_at"):
        raise HTTPException(404, "Data magang tidak ditemukan")
    if not _scope_magang([m], user):
        raise HTTPException(403, "Akses ditolak")
    if m.get("status") == "selesai":
        raise HTTPException(400, "Magang yang sudah selesai tidak dapat diubah")

    allowed = ("instansi", "alamat_instansi", "judul_proyek", "deskripsi",
               "tgl_mulai", "tgl_selesai", "semester_akademik", "catatan")
    for k, v in body.items():
        if k in allowed:
            m[k] = v

    if body.get("dosen_pembimbing_id"):
        pb = find_by_id("dosen", body["dosen_pembimbing_id"])
        if pb:
            m["dosen_pembimbing_id"] = pb["id"]
            m["dosen_pembimbing_nama"] = pb["nama_lengkap"]

    m["updated_at"] = _now()
    update("magang", magang_id, m)
    return ok(m, "Data magang diperbarui")


@router.post("/{magang_id}/setujui")
def setujui_magang(magang_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    m = find_by_id("magang", magang_id)
    if not m or m.get("deleted_at"):
        raise HTTPException(404, "Data magang tidak ditemukan")
    if m.get("status") != "pending":
        raise HTTPException(400, "Hanya magang berstatus 'pending' yang dapat disetujui")
    m["status"] = "berjalan"
    m["updated_at"] = _now()
    update("magang", magang_id, m)
    return ok(m, "Magang disetujui, status menjadi berjalan")


@router.post("/{magang_id}/tolak")
def tolak_magang(magang_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    m = find_by_id("magang", magang_id)
    if not m or m.get("deleted_at"):
        raise HTTPException(404, "Data magang tidak ditemukan")
    if m.get("status") != "pending":
        raise HTTPException(400, "Hanya magang berstatus 'pending' yang dapat ditolak")
    alasan = body.get("alasan", "").strip()
    if not alasan:
        raise HTTPException(400, "Alasan penolakan wajib diisi")
    soft_delete("magang", magang_id)
    return ok(None, f"Magang ditolak: {alasan}")


@router.post("/{magang_id}/selesai")
def selesai_magang(magang_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI + ["dosen"])
    m = find_by_id("magang", magang_id)
    if not m or m.get("deleted_at"):
        raise HTTPException(404, "Data magang tidak ditemukan")
    if user.get("role") == "dosen":
        dosen = get_dosen_for_user(user)
        if not dosen or m.get("dosen_pembimbing_id") != dosen["id"]:
            raise HTTPException(403, "Hanya dosen pembimbing yang dapat menyelesaikan magang ini")
    if m.get("status") != "berjalan":
        raise HTTPException(400, "Hanya magang berstatus 'berjalan' yang dapat diselesaikan")

    nilai = body.get("nilai_akhir")
    if nilai is not None:
        nilai = float(nilai)
        if not (0 <= nilai <= 100):
            raise HTTPException(400, "Nilai akhir harus antara 0–100")

    m["status"] = "selesai"
    m["nilai_akhir"] = nilai
    m["catatan"] = body.get("catatan", "")
    m["tgl_selesai"] = body.get("tgl_selesai", m.get("tgl_selesai", ""))
    m["updated_at"] = _now()
    update("magang", magang_id, m)
    return ok(m, "Magang selesai, nilai berhasil diinput")


@router.delete("/{magang_id}")
def delete_magang(magang_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    m = find_by_id("magang", magang_id)
    if not m or m.get("deleted_at"):
        raise HTTPException(404, "Data magang tidak ditemukan")

    role = user.get("role")
    if role == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        if not mhs or m.get("mahasiswa_id") != mhs["id"]:
            raise HTTPException(403, "Akses ditolak")
    elif role not in ADMIN:
        raise HTTPException(403, "Akses ditolak")

    if m.get("status") != "pending":
        raise HTTPException(400, "Hanya pengajuan 'pending' yang dapat dihapus")
    soft_delete("magang", magang_id)
    return ok(None, "Pengajuan magang dihapus")
