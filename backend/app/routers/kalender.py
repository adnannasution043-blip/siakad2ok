from fastapi import APIRouter, Query, HTTPException
from fastapi.params import Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date, timezone
import uuid
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, paginate, search_rows
from app.utils.dev import get_user_from_request, check_role

router = APIRouter(prefix="/kalender", tags=["Kalender Akademik"])

ADMIN_ROLES = ["super_admin", "admin_akademik", "kaprodi"]

KODE_VALID = [
    "pmb", "registrasi", "krs", "perkuliahan",
    "uts", "uas", "nilai", "remedi", "sp", "wisuda", "libur",
]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def _period_status(record: dict) -> str:
    today = date.today()
    try:
        mulai   = date.fromisoformat(record["tanggal_mulai"])
        selesai = date.fromisoformat(record["tanggal_selesai"])
    except (KeyError, ValueError):
        return "unknown"
    if today < mulai:  return "upcoming"
    if today > selesai: return "past"
    return "active"

def _enrich(r: dict) -> dict:
    return {**r, "status_hari_ini": _period_status(r)}

# ── Public helper — dipakai router lain (mis. krs.py) ────────
def is_periode_aktif(kode: str, semester_akademik: str) -> bool:
    """Return True jika hari ini masuk dalam periode kode/semester tsb.
    Fail-open: jika belum ada data kalender, izinkan saja."""
    today = date.today()
    records = [
        r for r in read_all("kalender_akademik")
        if not r.get("deleted_at")
        and r.get("kode") == kode
        and r.get("semester_akademik") == semester_akademik
    ]
    if not records:
        return True
    for r in records:
        try:
            mulai   = date.fromisoformat(r["tanggal_mulai"])
            selesai = date.fromisoformat(r["tanggal_selesai"])
            if mulai <= today <= selesai:
                return True
        except (KeyError, ValueError):
            continue
    return False


# ── GET list ───────────────────────────────────────────────────
@router.get("")
def list_kalender(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: str = Query(""),
    semester_akademik: str = Query(""),
    kode: str = Query(""),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [r for r in read_all("kalender_akademik") if not r.get("deleted_at")]
    rows = search_rows(rows, ["nama", "semester_akademik", "kode", "keterangan"], search)
    if semester_akademik:
        rows = [r for r in rows if r.get("semester_akademik") == semester_akademik]
    if kode:
        rows = [r for r in rows if r.get("kode") == kode]
    rows.sort(key=lambda r: (r.get("semester_akademik", ""), r.get("tanggal_mulai", "")))
    items, meta = paginate(rows, page, per_page)
    return ok([_enrich(r) for r in items], meta=meta)


# ── GET aktif ──────────────────────────────────────────────────
@router.get("/aktif")
def get_periode_aktif(authorization: str = Header(default="dev")):
    """Semua periode yang sedang aktif hari ini."""
    get_user_from_request(authorization)
    today = date.today()
    aktif = []
    for r in read_all("kalender_akademik"):
        if r.get("deleted_at"):
            continue
        try:
            mulai   = date.fromisoformat(r["tanggal_mulai"])
            selesai = date.fromisoformat(r["tanggal_selesai"])
            if mulai <= today <= selesai:
                aktif.append(_enrich(r))
        except (KeyError, ValueError):
            continue
    return ok(aktif)


# ── GET detail ─────────────────────────────────────────────────
@router.get("/{kalender_id}")
def get_kalender(kalender_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    r = find_by_id("kalender_akademik", kalender_id)
    if not r or r.get("deleted_at"):
        raise HTTPException(404, "Periode tidak ditemukan")
    return ok(_enrich(r))


# ── POST create ────────────────────────────────────────────────
class KalenderCreate(BaseModel):
    semester_akademik: str
    nama: str
    kode: str
    tanggal_mulai: str
    tanggal_selesai: str
    keterangan: Optional[str] = ""

@router.post("")
def create_kalender(body: KalenderCreate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_ROLES)
    if not body.semester_akademik.strip() or not body.nama.strip():
        raise HTTPException(400, "Semester akademik dan nama wajib diisi")
    if body.kode not in KODE_VALID:
        raise HTTPException(400, f"Kode tidak valid. Pilihan: {', '.join(KODE_VALID)}")
    try:
        mulai   = date.fromisoformat(body.tanggal_mulai)
        selesai = date.fromisoformat(body.tanggal_selesai)
    except ValueError:
        raise HTTPException(400, "Format tanggal tidak valid (YYYY-MM-DD)")
    if selesai < mulai:
        raise HTTPException(400, "Tanggal selesai tidak boleh sebelum tanggal mulai")
    now = datetime.now(timezone.utc).isoformat()
    new_rec = {
        "id":                  f"kal-{uuid.uuid4().hex[:8]}",
        "semester_akademik":   body.semester_akademik.strip(),
        "nama":                body.nama.strip(),
        "kode":                body.kode,
        "tanggal_mulai":       body.tanggal_mulai,
        "tanggal_selesai":     body.tanggal_selesai,
        "keterangan":          (body.keterangan or "").strip(),
        "deleted_at":          None,
        "created_at":          now,
        "updated_at":          now,
    }
    inserted = insert("kalender_akademik", new_rec)
    return ok(_enrich(inserted), "Periode berhasil ditambahkan")


# ── PUT update ─────────────────────────────────────────────────
class KalenderUpdate(BaseModel):
    semester_akademik: Optional[str] = None
    nama:              Optional[str] = None
    kode:              Optional[str] = None
    tanggal_mulai:     Optional[str] = None
    tanggal_selesai:   Optional[str] = None
    keterangan:        Optional[str] = None

@router.put("/{kalender_id}")
def update_kalender(kalender_id: str, body: KalenderUpdate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_ROLES)
    r = find_by_id("kalender_akademik", kalender_id)
    if not r or r.get("deleted_at"):
        raise HTTPException(404, "Periode tidak ditemukan")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Tidak ada perubahan yang dikirim")
    if "kode" in updates and updates["kode"] not in KODE_VALID:
        raise HTTPException(400, f"Kode tidak valid. Pilihan: {', '.join(KODE_VALID)}")
    mulai_str   = updates.get("tanggal_mulai",   r.get("tanggal_mulai", ""))
    selesai_str = updates.get("tanggal_selesai", r.get("tanggal_selesai", ""))
    try:
        mulai   = date.fromisoformat(mulai_str)
        selesai = date.fromisoformat(selesai_str)
    except ValueError:
        raise HTTPException(400, "Format tanggal tidak valid (YYYY-MM-DD)")
    if selesai < mulai:
        raise HTTPException(400, "Tanggal selesai tidak boleh sebelum tanggal mulai")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updated = update("kalender_akademik", kalender_id, updates)
    return ok(_enrich(updated), "Periode berhasil diperbarui")


# ── DELETE ─────────────────────────────────────────────────────
@router.delete("/{kalender_id}")
def delete_kalender(kalender_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_ROLES)
    r = find_by_id("kalender_akademik", kalender_id)
    if not r or r.get("deleted_at"):
        raise HTTPException(404, "Periode tidak ditemukan")
    soft_delete("kalender_akademik", kalender_id)
    return ok(message=f"Periode '{r.get('nama', '')}' berhasil dihapus")
