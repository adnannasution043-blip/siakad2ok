from fastapi import APIRouter, Query, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate
from app.utils.dev import (
    get_user_from_request, check_role,
    get_mahasiswa_for_user, get_dosen_for_user, get_kelas_ids_untuk_dosen,
)

router = APIRouter(prefix="/krs", tags=["KRS"])

ADMIN = ["super_admin", "admin_akademik", "staf"]
WALI  = ["super_admin", "admin_akademik", "kaprodi", "dosen"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def enrich(k):
    mhs   = find_by_id("mahasiswa", k.get("mahasiswa_id", ""))
    kelas = find_by_id("kelas",     k.get("kelas_id", ""))
    return {**k, "mahasiswa": mhs, "kelas": kelas}

def _sks_limit(ipk: float) -> int:
    if ipk >= 3.0:   return 24
    if ipk >= 2.5:   return 21
    return 18

def _time_to_min(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)

def _cek_spp_lunas(mahasiswa_id: str, semester_akademik: str):
    """Raise 400 jika ada tagihan SPP/UKT semester ini yang belum lunas."""
    tagihan = [
        t for t in read_all("tagihan")
        if t.get("mahasiswa_id") == mahasiswa_id
        and t.get("semester_akademik") == semester_akademik
        and not t.get("deleted_at")
        and t.get("jenis", "").lower() in ("spp", "ukt")
    ]
    if tagihan and not any(t.get("status") == "lunas" for t in tagihan):
        raise HTTPException(400, "SPP/UKT semester ini belum lunas — selesaikan pembayaran terlebih dahulu")

def _cek_registrasi_semester(mahasiswa_id: str, semester_akademik: str):
    """Raise 400 jika fitur registrasi semester aktif dan mahasiswa belum registrasi."""
    all_reg = [r for r in read_all("registrasi_semester") if not r.get("deleted_at")]
    if not all_reg:
        return  # fitur belum digunakan, lewati
    reg = next(
        (r for r in all_reg
         if r.get("mahasiswa_id") == mahasiswa_id
         and r.get("semester_akademik") == semester_akademik),
        None
    )
    if not reg:
        raise HTTPException(400, "Mahasiswa belum melakukan registrasi semester")
    if reg.get("status") != "aktif":
        raise HTTPException(400, f"Status registrasi '{reg.get('status')}' — hanya status aktif yang dapat mengajukan KRS")

def _scope_rows_krs(rows: list, user: dict) -> list:
    """Filter baris KRS sesuai hak akses role user."""
    role = user.get("role")
    if role in ("super_admin", "admin_akademik", "kaprodi", "staf"):
        return rows
    if role == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        return [r for r in rows if r.get("mahasiswa_id") == mhs_id]
    if role == "dosen":
        dosen = get_dosen_for_user(user)
        if not dosen:
            return []
        dosen_id = dosen["id"]
        kelas_ids = get_kelas_ids_untuk_dosen(dosen_id)
        # Dosen lihat: KRS bimbingan atau KRS di kelas yang diampu
        return [r for r in rows
                if r.get("dosen_wali_id") == dosen_id or r.get("kelas_id") in kelas_ids]
    return []

# ── GET list ───────────────────────────────────────────────────
@router.get("")
def list_krs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    status: str = Query(""),
    semester_akademik: str = Query(""),
    mahasiswa_id: str = Query(""),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    rows = [k for k in read_all("krs") if not k.get("deleted_at")]
    rows = _scope_rows_krs(rows, user)
    rows = search_rows(rows, ["mahasiswa_nama", "mahasiswa_nim", "mata_kuliah_nama", "mata_kuliah_kode"], search)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if semester_akademik:
        rows = [r for r in rows if r.get("semester_akademik") == semester_akademik]
    if mahasiswa_id:
        # Mahasiswa tidak boleh meminta data mahasiswa lain lewat query param
        if user.get("role") == "mahasiswa":
            mhs = get_mahasiswa_for_user(user)
            if not mhs or mhs["id"] != mahasiswa_id:
                raise HTTPException(403, "Akses ditolak")
        rows = [r for r in rows if r.get("mahasiswa_id") == mahasiswa_id]
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)

# ── GET semesters ──────────────────────────────────────────────
@router.get("/semesters")
def list_semesters(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    rows = [k for k in read_all("krs") if not k.get("deleted_at")]
    rows = _scope_rows_krs(rows, user)
    semesters = sorted(set(r.get("semester_akademik", "") for r in rows if r.get("semester_akademik")), reverse=True)
    return ok(semesters)

# ── GET ringkasan mahasiswa ────────────────────────────────────
@router.get("/ringkasan")
def ringkasan_krs(
    mahasiswa_id: str = Query(""),
    semester_akademik: str = Query(""),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    rows = [k for k in read_all("krs") if not k.get("deleted_at")]
    rows = _scope_rows_krs(rows, user)

    if mahasiswa_id:
        if user.get("role") == "mahasiswa":
            mhs = get_mahasiswa_for_user(user)
            if not mhs or mhs["id"] != mahasiswa_id:
                raise HTTPException(403, "Akses ditolak")
        rows = [r for r in rows if r.get("mahasiswa_id") == mahasiswa_id]
    if semester_akademik:
        rows = [r for r in rows if r.get("semester_akademik") == semester_akademik]

    total_sks     = sum(r.get("sks", 0) for r in rows if r.get("status") in ("disetujui", "pending"))
    sks_disetujui = sum(r.get("sks", 0) for r in rows if r.get("status") == "disetujui")
    return ok({
        "total": len(rows),
        "pending":   sum(1 for r in rows if r.get("status") == "pending"),
        "disetujui": sum(1 for r in rows if r.get("status") == "disetujui"),
        "ditolak":   sum(1 for r in rows if r.get("status") == "ditolak"),
        "dibatalkan": sum(1 for r in rows if r.get("status") == "dibatalkan"),
        "total_sks_diajukan": total_sks,
        "total_sks_disetujui": sks_disetujui,
    })

# ── GET stats summary ──────────────────────────────────────────
@router.get("/stats")
def krs_stats(
    semester_akademik: str = Query(""),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    rows = [k for k in read_all("krs") if not k.get("deleted_at")]
    rows = _scope_rows_krs(rows, user)
    if semester_akademik:
        rows = [r for r in rows if r.get("semester_akademik") == semester_akademik]
    return ok({
        "total": len(rows),
        "pending":    sum(1 for r in rows if r.get("status") == "pending"),
        "disetujui":  sum(1 for r in rows if r.get("status") == "disetujui"),
        "ditolak":    sum(1 for r in rows if r.get("status") == "ditolak"),
        "dibatalkan": sum(1 for r in rows if r.get("status") == "dibatalkan"),
    })

# ── GET detail ─────────────────────────────────────────────────
@router.get("/{krs_id}")
def get_krs(krs_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    k = find_by_id("krs", krs_id)
    if not k or k.get("deleted_at"):
        raise HTTPException(404, "KRS tidak ditemukan")

    role = user.get("role")
    if role == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        if not mhs or k.get("mahasiswa_id") != mhs["id"]:
            raise HTTPException(403, "Akses ditolak")
    elif role == "dosen":
        dosen = get_dosen_for_user(user)
        if dosen:
            kelas_ids = get_kelas_ids_untuk_dosen(dosen["id"])
            if k.get("dosen_wali_id") != dosen["id"] and k.get("kelas_id") not in kelas_ids:
                raise HTTPException(403, "Akses ditolak")
        else:
            raise HTTPException(403, "Akses ditolak")

    return ok(enrich(k))

# ── POST ajukan KRS ────────────────────────────────────────────
class KRSAjukan(BaseModel):
    mahasiswa_id: str
    kelas_id: str
    semester_akademik: str

@router.post("")
def ajukan_krs(body: KRSAjukan, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)

    # Mahasiswa hanya bisa daftarkan dirinya sendiri
    if user.get("role") == "mahasiswa":
        mhs_own = get_mahasiswa_for_user(user)
        if not mhs_own or mhs_own["id"] != body.mahasiswa_id:
            raise HTTPException(403, "Mahasiswa hanya dapat mengajukan KRS untuk dirinya sendiri")

    mhs = find_by_id("mahasiswa", body.mahasiswa_id)
    if not mhs:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")

    if mhs.get("status") != "aktif":
        raise HTTPException(400, f"Status mahasiswa '{mhs.get('status')}' — hanya mahasiswa aktif yang dapat mengajukan KRS")

    kelas = find_by_id("kelas", body.kelas_id)
    if not kelas or kelas.get("deleted_at"):
        raise HTTPException(404, "Kelas tidak ditemukan")

    # Cek registrasi semester (jika fitur diaktifkan)
    _cek_registrasi_semester(body.mahasiswa_id, body.semester_akademik)

    # Cek pembayaran SPP/UKT
    _cek_spp_lunas(body.mahasiswa_id, body.semester_akademik)

    all_krs = read_all("krs")

    # Cek duplikat
    if any(k.get("mahasiswa_id") == body.mahasiswa_id
           and k.get("kelas_id") == body.kelas_id
           and k.get("semester_akademik") == body.semester_akademik
           and k.get("status") not in ("dibatalkan", "ditolak")
           and not k.get("deleted_at") for k in all_krs):
        raise HTTPException(400, "Mahasiswa sudah mendaftar di kelas ini")

    # Cek kapasitas kelas
    peserta = sum(1 for k in all_krs
                  if k.get("kelas_id") == body.kelas_id
                  and k.get("status") not in ("dibatalkan", "ditolak")
                  and not k.get("deleted_at"))
    if peserta >= kelas.get("kapasitas", 0):
        raise HTTPException(400, f"Kelas penuh ({peserta}/{kelas['kapasitas']} peserta)")

    # Cek batas SKS (IPK-based)
    ipk = float(mhs.get("ipk", 0))
    limit = _sks_limit(ipk)
    mhs_krs_sem = [k for k in all_krs
                   if k.get("mahasiswa_id") == body.mahasiswa_id
                   and k.get("semester_akademik") == body.semester_akademik
                   and k.get("status") not in ("dibatalkan", "ditolak")
                   and not k.get("deleted_at")]
    current_sks = sum(k.get("sks", 0) for k in mhs_krs_sem)
    new_sks = kelas.get("sks", 0)
    if current_sks + new_sks > limit:
        raise HTTPException(400,
            f"Melebihi batas SKS ({current_sks} + {new_sks} = {current_sks+new_sks} > {limit} SKS, IPK {ipk:.2f})")

    # Cek bentrok jadwal
    hari_baru  = kelas.get("hari", "")
    start_baru = _time_to_min(kelas.get("jam_mulai", "00:00"))
    end_baru   = _time_to_min(kelas.get("jam_selesai", "00:00"))
    for k in mhs_krs_sem:
        k_kelas = find_by_id("kelas", k.get("kelas_id", ""))
        if not k_kelas: continue
        if k_kelas.get("hari") != hari_baru: continue
        k_start = _time_to_min(k_kelas.get("jam_mulai", "00:00"))
        k_end   = _time_to_min(k_kelas.get("jam_selesai", "00:00"))
        if start_baru < k_end and end_baru > k_start:
            raise HTTPException(400,
                f"Bentrok jadwal dengan {k.get('mata_kuliah_kode','')} {k.get('mata_kuliah_nama','')} "
                f"({hari_baru} {k_kelas.get('jam_mulai','')}–{k_kelas.get('jam_selesai','')})")

    dosen_wali_id = mhs.get("dosen_wali_id", "")
    dosen_wali = find_by_id("dosen", dosen_wali_id) if dosen_wali_id else None

    data = insert("krs", {
        "mahasiswa_id":    body.mahasiswa_id,
        "mahasiswa_nim":   mhs.get("nim", ""),
        "mahasiswa_nama":  mhs.get("nama_lengkap", ""),
        "kelas_id":        body.kelas_id,
        "mata_kuliah_nama": kelas.get("mata_kuliah_nama", ""),
        "mata_kuliah_kode": kelas.get("mata_kuliah_kode", ""),
        "sks":             kelas.get("sks", 0),
        "semester_akademik": body.semester_akademik,
        "status":          "pending",
        "dosen_wali_id":   dosen_wali_id or "",
        "dosen_wali_nama": dosen_wali.get("nama_lengkap", "") if dosen_wali else "",
        "disetujui_at":    None,
    })
    return ok(data, "KRS berhasil diajukan, menunggu persetujuan")

# ── POST setujui ───────────────────────────────────────────────
@router.post("/{krs_id}/setujui")
def setujui_krs(krs_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, WALI)

    k = find_by_id("krs", krs_id)
    if not k or k.get("deleted_at"):
        raise HTTPException(404, "KRS tidak ditemukan")

    # Dosen hanya bisa setujui KRS bimbingannya
    if user.get("role") == "dosen":
        dosen = get_dosen_for_user(user)
        if not dosen or k.get("dosen_wali_id") != dosen["id"]:
            raise HTTPException(403, "Anda bukan dosen wali mahasiswa ini")

    if k.get("status") != "pending":
        raise HTTPException(400, f"KRS sudah berstatus '{k['status']}', tidak bisa disetujui")
    updated = update("krs", krs_id, {"status": "disetujui", "disetujui_at": now_iso()})
    return ok(updated, "KRS berhasil disetujui")

# ── POST tolak ─────────────────────────────────────────────────
class TolakBody(BaseModel):
    alasan: Optional[str] = None

@router.post("/{krs_id}/tolak")
def tolak_krs(krs_id: str, body: TolakBody = TolakBody(), authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, WALI)

    k = find_by_id("krs", krs_id)
    if not k or k.get("deleted_at"):
        raise HTTPException(404, "KRS tidak ditemukan")

    # Dosen hanya bisa tolak KRS bimbingannya
    if user.get("role") == "dosen":
        dosen = get_dosen_for_user(user)
        if not dosen or k.get("dosen_wali_id") != dosen["id"]:
            raise HTTPException(403, "Anda bukan dosen wali mahasiswa ini")

    if k.get("status") != "pending":
        raise HTTPException(400, f"KRS sudah berstatus '{k['status']}', tidak bisa ditolak")
    updates = {"status": "ditolak"}
    if body.alasan:
        updates["alasan_tolak"] = body.alasan
    updated = update("krs", krs_id, updates)
    return ok(updated, "KRS berhasil ditolak")

# ── POST batalkan ──────────────────────────────────────────────
@router.post("/{krs_id}/batalkan")
def batalkan_krs(krs_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    k = find_by_id("krs", krs_id)
    if not k or k.get("deleted_at"):
        raise HTTPException(404, "KRS tidak ditemukan")

    # Mahasiswa hanya bisa batalkan KRS miliknya sendiri
    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        if not mhs or k.get("mahasiswa_id") != mhs["id"]:
            raise HTTPException(403, "Akses ditolak")
    elif user.get("role") not in ("super_admin", "admin_akademik", "staf", "kaprodi"):
        raise HTTPException(403, "Akses ditolak")

    if k.get("status") == "dibatalkan":
        raise HTTPException(400, "KRS sudah dibatalkan")
    updated = update("krs", krs_id, {"status": "dibatalkan"})
    return ok(updated, "KRS berhasil dibatalkan")

# ── DELETE hard-remove (admin only) ───────────────────────────
@router.delete("/{krs_id}")
def delete_krs(krs_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ["super_admin"])
    k = find_by_id("krs", krs_id)
    if not k:
        raise HTTPException(404, "KRS tidak ditemukan")
    soft_delete("krs", krs_id)
    return ok(message="KRS dihapus")
