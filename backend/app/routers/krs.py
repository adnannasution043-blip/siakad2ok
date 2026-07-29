from fastapi import APIRouter, Query, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate
from app.utils.dev import get_user_from_request, check_role

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
    get_user_from_request(authorization)
    rows = [k for k in read_all("krs") if not k.get("deleted_at")]
    rows = search_rows(rows, ["mahasiswa_nama", "mahasiswa_nim", "mata_kuliah_nama", "mata_kuliah_kode"], search)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if semester_akademik:
        rows = [r for r in rows if r.get("semester_akademik") == semester_akademik]
    if mahasiswa_id:
        rows = [r for r in rows if r.get("mahasiswa_id") == mahasiswa_id]
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)

# ── GET semesters ──────────────────────────────────────────────
@router.get("/semesters")
def list_semesters(authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    rows = [k for k in read_all("krs") if not k.get("deleted_at")]
    semesters = sorted(set(r.get("semester_akademik", "") for r in rows if r.get("semester_akademik")), reverse=True)
    return ok(semesters)

# ── GET ringkasan mahasiswa ────────────────────────────────────
@router.get("/ringkasan")
def ringkasan_krs(
    mahasiswa_id: str = Query(""),
    semester_akademik: str = Query(""),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [k for k in read_all("krs") if not k.get("deleted_at")]
    if mahasiswa_id:
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

# ── GET stats summary (for dashboard-like header) ─────────────
@router.get("/stats")
def krs_stats(
    semester_akademik: str = Query(""),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [k for k in read_all("krs") if not k.get("deleted_at")]
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
    get_user_from_request(authorization)
    k = find_by_id("krs", krs_id)
    if not k or k.get("deleted_at"):
        raise HTTPException(404, "KRS tidak ditemukan")
    return ok(enrich(k))

# ── POST ajukan KRS ────────────────────────────────────────────
class KRSAjukan(BaseModel):
    mahasiswa_id: str
    kelas_id: str
    semester_akademik: str

@router.post("")
def ajukan_krs(body: KRSAjukan, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)

    mhs = find_by_id("mahasiswa", body.mahasiswa_id)
    if not mhs:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")

    kelas = find_by_id("kelas", body.kelas_id)
    if not kelas or kelas.get("deleted_at"):
        raise HTTPException(404, "Kelas tidak ditemukan")

    # Cek duplikat — sudah daftar kelas yang sama di semester ini
    all_krs = read_all("krs")
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

    # Temukan dosen wali
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
