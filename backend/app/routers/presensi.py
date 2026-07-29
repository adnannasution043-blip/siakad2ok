from fastapi import APIRouter, Query, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import secrets
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate
from app.utils.dev import get_user_from_request, check_role

router = APIRouter(prefix="/presensi", tags=["Presensi"])

DOSEN = ["super_admin", "admin_akademik", "kaprodi", "dosen", "staf"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def _enrich_sesi(s):
    kelas = find_by_id("kelas", s.get("kelas_id", ""))
    now = datetime.now(timezone.utc)
    active = False
    if s.get("qr_expires_at") and s.get("status") == "aktif":
        try:
            exp = datetime.fromisoformat(s["qr_expires_at"].replace("Z", "+00:00"))
            active = exp > now
        except Exception:
            pass
    return {**s, "kelas": kelas, "qr_active": active}

# ── GET rekap (stats) ──────────────────────────────────────────
@router.get("/rekap")
def rekap_presensi(authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    rows = [p for p in read_all("presensi") if not p.get("deleted_at")]
    distribusi: dict[str, int] = {}
    for p in rows:
        s = p.get("status", "?")
        distribusi[s] = distribusi.get(s, 0) + 1

    kelas_all = [k for k in read_all("kelas") if not k.get("deleted_at")]
    return ok({
        "total": len(rows),
        "distribusi_status": distribusi,
        "total_kelas": len(kelas_all),
        "persen_hadir": round(distribusi.get("hadir", 0) / len(rows) * 100, 1) if rows else 0,
    })

# ── GET rekap per mahasiswa per kelas ──────────────────────────
@router.get("/rekap-kelas")
def rekap_kelas(
    kelas_id: str = Query(""),
    mahasiswa_id: str = Query(""),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [p for p in read_all("presensi") if not p.get("deleted_at")]
    if kelas_id:
        rows = [r for r in rows if r.get("kelas_id") == kelas_id]
    if mahasiswa_id:
        rows = [r for r in rows if r.get("mahasiswa_id") == mahasiswa_id]

    # Aggregate by mahasiswa
    by_mhs: dict[str, dict] = {}
    for p in rows:
        mid = p.get("mahasiswa_id", "")
        if mid not in by_mhs:
            by_mhs[mid] = {
                "mahasiswa_id": mid,
                "mahasiswa_nama": p.get("mahasiswa_nama", ""),
                "mahasiswa_nim":  p.get("mahasiswa_nim", ""),
                "total": 0, "hadir": 0, "izin": 0, "sakit": 0, "alpha": 0,
            }
        by_mhs[mid]["total"] += 1
        st = p.get("status", "alpha")
        by_mhs[mid][st] = by_mhs[mid].get(st, 0) + 1

    result = []
    for m in by_mhs.values():
        t = m["total"]
        hadir = m.get("hadir", 0) + m.get("izin", 0) + m.get("sakit", 0)
        pct   = round(hadir / t * 100, 1) if t else 0
        result.append({**m, "persen_hadir": pct, "status_kehadiran": "ok" if pct >= 75 else "warning"})

    result.sort(key=lambda r: r["mahasiswa_nim"])
    return ok(result)

# ── GET list sesi kuliah ───────────────────────────────────────
@router.get("/sesi")
def list_sesi(
    kelas_id: str = Query(""),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [s for s in read_all("sesi_kuliah") if not s.get("deleted_at")]
    if kelas_id:
        rows = [r for r in rows if r.get("kelas_id") == kelas_id]
    rows.sort(key=lambda r: (r.get("tanggal", ""), r.get("pertemuan_ke", 0)), reverse=True)
    items, meta = paginate(rows, page, per_page)
    enriched = [_enrich_sesi(s) for s in items]
    return ok(enriched, meta=meta)

# ── GET sesi detail ────────────────────────────────────────────
@router.get("/sesi/{sesi_id}")
def get_sesi(sesi_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    s = find_by_id("sesi_kuliah", sesi_id)
    if not s or s.get("deleted_at"):
        raise HTTPException(404, "Sesi tidak ditemukan")
    # Count presensi for this sesi
    prs = [p for p in read_all("presensi") if p.get("sesi_id") == sesi_id and not p.get("deleted_at")]
    return ok({**_enrich_sesi(s), "presensi_count": len(prs), "presensi": prs})

# ── POST buat sesi baru ────────────────────────────────────────
class SesiCreate(BaseModel):
    kelas_id: str
    tanggal: str
    topik: str = ""
    pertemuan_ke: int = 1

@router.post("/sesi")
def buat_sesi(body: SesiCreate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN)

    kelas = find_by_id("kelas", body.kelas_id)
    if not kelas or kelas.get("deleted_at"):
        raise HTTPException(404, "Kelas tidak ditemukan")

    # Check duplicate pertemuan
    existing = [s for s in read_all("sesi_kuliah")
                if s.get("kelas_id") == body.kelas_id
                and s.get("pertemuan_ke") == body.pertemuan_ke
                and not s.get("deleted_at")]
    if existing:
        raise HTTPException(400, f"Pertemuan ke-{body.pertemuan_ke} sudah ada untuk kelas ini")

    data = insert("sesi_kuliah", {
        "kelas_id":       body.kelas_id,
        "mata_kuliah_nama": kelas.get("mata_kuliah_nama", ""),
        "kelas_kode":     kelas.get("kode_kelas", ""),
        "pertemuan_ke":   body.pertemuan_ke,
        "tanggal":        body.tanggal,
        "topik":          body.topik or f"Pertemuan {body.pertemuan_ke}",
        "qr_token":       None,
        "qr_expires_at":  None,
        "status":         "belum_mulai",
        "dibuat_oleh":    user.get("id", ""),
        "dibuat_oleh_nama": user.get("nama", ""),
    })
    return ok(data, "Sesi berhasil dibuat")

# ── POST mulai sesi (generate QR) ─────────────────────────────
@router.post("/sesi/{sesi_id}/mulai")
def mulai_sesi(sesi_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN)
    s = find_by_id("sesi_kuliah", sesi_id)
    if not s or s.get("deleted_at"):
        raise HTTPException(404, "Sesi tidak ditemukan")
    if s.get("status") == "selesai":
        raise HTTPException(400, "Sesi sudah selesai, tidak bisa dimulai kembali")

    token = secrets.token_hex(8)  # 16 hex chars
    expires = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    updated = update("sesi_kuliah", sesi_id, {
        "status":        "aktif",
        "qr_token":      token,
        "qr_expires_at": expires,
        "mulai_at":      now_iso(),
    })
    return ok(_enrich_sesi(updated), "Sesi dimulai, QR aktif 15 menit")

# ── POST perpanjang QR ─────────────────────────────────────────
@router.post("/sesi/{sesi_id}/perpanjang")
def perpanjang_qr(sesi_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN)
    s = find_by_id("sesi_kuliah", sesi_id)
    if not s or s.get("deleted_at"):
        raise HTTPException(404, "Sesi tidak ditemukan")
    if s.get("status") != "aktif":
        raise HTTPException(400, "Sesi tidak aktif")

    token = secrets.token_hex(8)
    expires = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    updated = update("sesi_kuliah", sesi_id, {"qr_token": token, "qr_expires_at": expires})
    return ok(_enrich_sesi(updated), "QR diperpanjang 15 menit")

# ── POST selesaikan sesi ───────────────────────────────────────
@router.post("/sesi/{sesi_id}/selesai")
def selesai_sesi(sesi_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN)
    s = find_by_id("sesi_kuliah", sesi_id)
    if not s or s.get("deleted_at"):
        raise HTTPException(404, "Sesi tidak ditemukan")

    # Auto-mark alpha for KRS students who didn't attend
    kelas_id = s.get("kelas_id", "")
    krs_list = [k for k in read_all("krs")
                if k.get("kelas_id") == kelas_id
                and k.get("status") == "disetujui"
                and not k.get("deleted_at")]
    prs_list = [p for p in read_all("presensi")
                if p.get("sesi_id") == sesi_id and not p.get("deleted_at")]
    hadir_ids = {p.get("mahasiswa_id") for p in prs_list}
    alpha_count = 0
    for krs in krs_list:
        mid = krs.get("mahasiswa_id")
        if mid not in hadir_ids:
            insert("presensi", {
                "sesi_id":       sesi_id,
                "kelas_id":      kelas_id,
                "mahasiswa_id":  mid,
                "mahasiswa_nama": krs.get("mahasiswa_nama", ""),
                "mahasiswa_nim":  krs.get("mahasiswa_nim", ""),
                "status":        "alpha",
                "waktu_scan":    None,
                "keterangan":    "Tidak hadir (otomatis)",
            })
            alpha_count += 1

    updated = update("sesi_kuliah", sesi_id, {
        "status":     "selesai",
        "selesai_at": now_iso(),
        "qr_expires_at": None,
    })
    return ok(_enrich_sesi(updated), f"Sesi selesai. {alpha_count} mahasiswa ditandai alpha.")

# ── POST scan QR (mahasiswa check-in) ─────────────────────────
class ScanBody(BaseModel):
    qr_token: str
    mahasiswa_id: str
    keterangan: Optional[str] = None

@router.post("/scan")
def scan_presensi(body: ScanBody, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)

    # Find active sesi with this token
    sesi = next((s for s in read_all("sesi_kuliah")
                 if s.get("qr_token") == body.qr_token
                 and s.get("status") == "aktif"
                 and not s.get("deleted_at")), None)
    if not sesi:
        raise HTTPException(400, "Token tidak valid atau sesi tidak aktif")

    # Check QR not expired
    if sesi.get("qr_expires_at"):
        try:
            exp = datetime.fromisoformat(sesi["qr_expires_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > exp:
                raise HTTPException(400, "Token QR sudah kadaluarsa")
        except HTTPException:
            raise
        except Exception:
            pass

    # Check mahasiswa is enrolled in kelas
    kelas_id = sesi.get("kelas_id", "")
    enrolled = any(k for k in read_all("krs")
                   if k.get("mahasiswa_id") == body.mahasiswa_id
                   and k.get("kelas_id") == kelas_id
                   and k.get("status") == "disetujui"
                   and not k.get("deleted_at"))
    if not enrolled:
        raise HTTPException(400, "Mahasiswa tidak terdaftar di kelas ini")

    # Check duplicate scan
    sesi_id = sesi.get("id")
    dup = any(p for p in read_all("presensi")
              if p.get("sesi_id") == sesi_id
              and p.get("mahasiswa_id") == body.mahasiswa_id
              and not p.get("deleted_at"))
    if dup:
        raise HTTPException(400, "Mahasiswa sudah melakukan presensi di sesi ini")

    mhs = find_by_id("mahasiswa", body.mahasiswa_id)
    data = insert("presensi", {
        "sesi_id":       sesi_id,
        "kelas_id":      kelas_id,
        "mahasiswa_id":  body.mahasiswa_id,
        "mahasiswa_nama": mhs.get("nama_lengkap", "") if mhs else "",
        "mahasiswa_nim":  mhs.get("nim", "") if mhs else "",
        "status":        "hadir",
        "waktu_scan":    now_iso(),
        "keterangan":    body.keterangan,
    })
    return ok(data, f"Presensi berhasil — {mhs.get('nama_lengkap','') if mhs else ''}")

# ── POST input presensi manual ─────────────────────────────────
class ManualBody(BaseModel):
    sesi_id: str
    mahasiswa_id: str
    status: str       # hadir | izin | sakit | alpha
    keterangan: Optional[str] = None

@router.post("/manual")
def input_manual(body: ManualBody, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN)

    if body.status not in ("hadir", "izin", "sakit", "alpha"):
        raise HTTPException(400, "Status tidak valid")

    sesi = find_by_id("sesi_kuliah", body.sesi_id)
    if not sesi or sesi.get("deleted_at"):
        raise HTTPException(404, "Sesi tidak ditemukan")

    kelas_id = sesi.get("kelas_id", "")
    mhs = find_by_id("mahasiswa", body.mahasiswa_id)
    if not mhs:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")

    # Upsert — update if exists, insert if not
    all_prs = read_all("presensi")
    existing = next((p for p in all_prs
                     if p.get("sesi_id") == body.sesi_id
                     and p.get("mahasiswa_id") == body.mahasiswa_id
                     and not p.get("deleted_at")), None)
    if existing:
        updated = update("presensi", existing["id"], {
            "status": body.status,
            "keterangan": body.keterangan,
        })
        return ok(updated, "Presensi diperbarui")

    data = insert("presensi", {
        "sesi_id":       body.sesi_id,
        "kelas_id":      kelas_id,
        "mahasiswa_id":  body.mahasiswa_id,
        "mahasiswa_nama": mhs.get("nama_lengkap", ""),
        "mahasiswa_nim":  mhs.get("nim", ""),
        "status":        body.status,
        "waktu_scan":    now_iso() if body.status == "hadir" else None,
        "keterangan":    body.keterangan or "Input manual",
    })
    return ok(data, "Presensi berhasil diinput")

# ── PUT update presensi ────────────────────────────────────────
class UpdateBody(BaseModel):
    status: str
    keterangan: Optional[str] = None

@router.put("/{presensi_id}")
def update_presensi(presensi_id: str, body: UpdateBody, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN)
    if body.status not in ("hadir", "izin", "sakit", "alpha"):
        raise HTTPException(400, "Status tidak valid")
    p = find_by_id("presensi", presensi_id)
    if not p or p.get("deleted_at"):
        raise HTTPException(404, "Presensi tidak ditemukan")
    updated = update("presensi", presensi_id, {
        "status": body.status,
        "keterangan": body.keterangan,
    })
    return ok(updated, "Presensi diperbarui")

# ── GET list presensi ──────────────────────────────────────────
@router.get("")
def list_presensi(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    status: str = Query(""),
    kelas_id: str = Query(""),
    sesi_id: str = Query(""),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [p for p in read_all("presensi") if not p.get("deleted_at")]
    rows = search_rows(rows, ["mahasiswa_nama", "mahasiswa_nim"], search)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if kelas_id:
        rows = [r for r in rows if r.get("kelas_id") == kelas_id]
    if sesi_id:
        rows = [r for r in rows if r.get("sesi_id") == sesi_id]
    rows.sort(key=lambda r: r.get("waktu_scan") or "", reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)

# ── GET kelas list (helper for filter dropdowns) ───────────────
@router.get("/kelas")
def list_kelas(authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    rows = [k for k in read_all("kelas") if not k.get("deleted_at")]
    rows.sort(key=lambda r: r.get("mata_kuliah_nama", ""))
    return ok(rows)

# ── DELETE presensi ────────────────────────────────────────────
@router.delete("/{presensi_id}")
def delete_presensi(presensi_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ["super_admin", "admin_akademik"])
    p = find_by_id("presensi", presensi_id)
    if not p:
        raise HTTPException(404, "Presensi tidak ditemukan")
    soft_delete("presensi", presensi_id)
    return ok(message="Presensi dihapus")
