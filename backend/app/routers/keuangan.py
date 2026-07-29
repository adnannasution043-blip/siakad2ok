from fastapi import APIRouter, Query, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, date
import secrets
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate
from app.utils.dev import get_user_from_request, check_role, get_mahasiswa_for_user

router = APIRouter(prefix="/keuangan", tags=["Keuangan"])

ADMIN_KEU = ["super_admin", "admin_akademik", "admin_keuangan", "staf"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def fmt_rp(n):
    return f"Rp {n:,.0f}".replace(",", ".")

def _tagihan_status(tagihan, payments):
    """Recalculate tagihan status from payments."""
    total_bayar = sum(p.get("jumlah", 0) for p in payments if p.get("status") == "sukses")
    jumlah = tagihan.get("jumlah", 0)
    if total_bayar >= jumlah:
        return "lunas"
    elif total_bayar > 0:
        return "cicilan"
    return "belum_lunas"

# ── GET ringkasan ──────────────────────────────────────────────
@router.get("/ringkasan")
def ringkasan(
    semester_akademik: str = Query(""),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    # Mahasiswa hanya bisa lihat ringkasan keuangannya sendiri
    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        tagihan = [t for t in read_all("tagihan") if not t.get("deleted_at") and t.get("mahasiswa_id") == mhs_id]
        pembayaran = [p for p in read_all("pembayaran") if not p.get("deleted_at") and p.get("mahasiswa_id") == mhs_id]
    else:
        check_role(user, ADMIN_KEU)
        tagihan = [t for t in read_all("tagihan") if not t.get("deleted_at")]
        pembayaran = [p for p in read_all("pembayaran") if not p.get("deleted_at")]
    if semester_akademik:
        tagihan = [t for t in tagihan if t.get("semester_akademik") == semester_akademik]

    total_tagihan  = sum(t.get("jumlah", 0) for t in tagihan)
    total_lunas    = sum(t.get("jumlah", 0) for t in tagihan if t.get("status") == "lunas")
    total_belum    = sum(t.get("jumlah", 0) for t in tagihan if t.get("status") in ("belum_lunas", "cicilan"))
    total_cicilan  = sum(t.get("jumlah", 0) for t in tagihan if t.get("status") == "cicilan")

    # pembayaran masuk bulan ini
    bulan_ini = datetime.now().strftime("%Y-%m")
    masuk_bulan = sum(p.get("jumlah", 0) for p in pembayaran
                      if p.get("status") == "sukses" and (p.get("tgl_bayar") or "").startswith(bulan_ini))

    return ok({
        "total_tagihan":      len(tagihan),
        "tagihan_lunas":      sum(1 for t in tagihan if t.get("status") == "lunas"),
        "tagihan_belum_lunas": sum(1 for t in tagihan if t.get("status") == "belum_lunas"),
        "tagihan_cicilan":    sum(1 for t in tagihan if t.get("status") == "cicilan"),
        "nominal_total":      total_tagihan,
        "nominal_lunas":      total_lunas,
        "nominal_belum":      total_belum,
        "nominal_cicilan":    total_cicilan,
        "total_pembayaran":   len(pembayaran),
        "masuk_bulan_ini":    masuk_bulan,
    })

# ── GET tagihan list ───────────────────────────────────────────
@router.get("/tagihan")
def list_tagihan(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    status: str = Query(""),
    semester_akademik: str = Query(""),
    jenis: str = Query(""),
    mahasiswa_id: str = Query(""),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    rows = [t for t in read_all("tagihan") if not t.get("deleted_at")]

    # Mahasiswa hanya lihat tagihan dirinya sendiri
    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        rows = [r for r in rows if r.get("mahasiswa_id") == mhs_id]
    else:
        check_role(user, ADMIN_KEU)

    rows = search_rows(rows, ["mahasiswa_nama", "mahasiswa_nim", "jenis", "semester_akademik"], search)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if semester_akademik:
        rows = [r for r in rows if r.get("semester_akademik") == semester_akademik]
    if jenis:
        rows = [r for r in rows if r.get("jenis") == jenis]
    if mahasiswa_id:
        if user.get("role") == "mahasiswa":
            mhs = get_mahasiswa_for_user(user)
            if not mhs or mhs["id"] != mahasiswa_id:
                raise HTTPException(403, "Akses ditolak")
        rows = [r for r in rows if r.get("mahasiswa_id") == mahasiswa_id]
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)

# ── GET tagihan semesters ──────────────────────────────────────
@router.get("/tagihan/semesters")
def list_semesters(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    rows = [t for t in read_all("tagihan") if not t.get("deleted_at")]
    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        rows = [r for r in rows if r.get("mahasiswa_id") == mhs_id]
    semesters = sorted(set(r.get("semester_akademik", "") for r in rows if r.get("semester_akademik")), reverse=True)
    return ok(semesters)

# ── GET tagihan detail ─────────────────────────────────────────
@router.get("/tagihan/{tagihan_id}")
def get_tagihan(tagihan_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    t = find_by_id("tagihan", tagihan_id)
    if not t or t.get("deleted_at"):
        raise HTTPException(404, "Tagihan tidak ditemukan")

    # Mahasiswa hanya bisa lihat tagihan miliknya
    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        if not mhs or t.get("mahasiswa_id") != mhs["id"]:
            raise HTTPException(403, "Akses ditolak")

    payments = [p for p in read_all("pembayaran")
                if p.get("tagihan_id") == tagihan_id and not p.get("deleted_at")]
    payments.sort(key=lambda p: p.get("tgl_bayar", ""), reverse=True)
    total_bayar = sum(p.get("jumlah", 0) for p in payments if p.get("status") == "sukses")
    return ok({**t, "pembayaran": payments,
                "total_terbayar": total_bayar,
                "sisa": max(0, t.get("jumlah", 0) - total_bayar)})

# ── POST buat tagihan ──────────────────────────────────────────
class TagihanCreate(BaseModel):
    mahasiswa_id: str
    semester_akademik: str
    jenis: str = "SPP"
    jumlah: float
    jatuh_tempo: Optional[str] = None
    keterangan: Optional[str] = None

@router.post("/tagihan")
def buat_tagihan(body: TagihanCreate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KEU)

    mhs = find_by_id("mahasiswa", body.mahasiswa_id)
    if not mhs:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")

    # Cek duplikat jenis + semester
    existing = [t for t in read_all("tagihan")
                if t.get("mahasiswa_id") == body.mahasiswa_id
                and t.get("semester_akademik") == body.semester_akademik
                and t.get("jenis") == body.jenis
                and not t.get("deleted_at")]
    if existing:
        raise HTTPException(400, f"Tagihan {body.jenis} semester {body.semester_akademik} sudah ada untuk mahasiswa ini")

    data = insert("tagihan", {
        "mahasiswa_id":    body.mahasiswa_id,
        "mahasiswa_nama":  mhs.get("nama_lengkap", ""),
        "mahasiswa_nim":   mhs.get("nim", ""),
        "semester_akademik": body.semester_akademik,
        "jenis":           body.jenis,
        "jumlah":          body.jumlah,
        "status":          "belum_lunas",
        "jatuh_tempo":     body.jatuh_tempo,
        "keterangan":      body.keterangan,
    })
    return ok(data, "Tagihan berhasil dibuat")

# ── POST generate tagihan massal ──────────────────────────────
class GenerateMassalBody(BaseModel):
    semester_akademik: str
    jenis: str = "SPP"
    jumlah: float
    jatuh_tempo: Optional[str] = None

@router.post("/tagihan/generate-massal")
def generate_massal(body: GenerateMassalBody, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KEU)

    mhs_list = [m for m in read_all("mahasiswa")
                if not m.get("deleted_at") and m.get("status") == "aktif"]

    existing_ids = {t.get("mahasiswa_id") for t in read_all("tagihan")
                    if t.get("semester_akademik") == body.semester_akademik
                    and t.get("jenis") == body.jenis
                    and not t.get("deleted_at")}

    dibuat = 0
    dilewati = 0
    for mhs in mhs_list:
        mid = mhs.get("id")
        if mid in existing_ids:
            dilewati += 1
            continue
        insert("tagihan", {
            "mahasiswa_id":    mid,
            "mahasiswa_nama":  mhs.get("nama_lengkap", ""),
            "mahasiswa_nim":   mhs.get("nim", ""),
            "semester_akademik": body.semester_akademik,
            "jenis":           body.jenis,
            "jumlah":          body.jumlah,
            "status":          "belum_lunas",
            "jatuh_tempo":     body.jatuh_tempo,
        })
        dibuat += 1

    return ok({"dibuat": dibuat, "dilewati": dilewati},
              f"Generate selesai: {dibuat} tagihan baru, {dilewati} dilewati (sudah ada)")

# ── PUT update tagihan ─────────────────────────────────────────
class TagihanUpdate(BaseModel):
    jumlah: Optional[float] = None
    jatuh_tempo: Optional[str] = None
    keterangan: Optional[str] = None
    status: Optional[str] = None

@router.put("/tagihan/{tagihan_id}")
def update_tagihan(tagihan_id: str, body: TagihanUpdate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KEU)
    t = find_by_id("tagihan", tagihan_id)
    if not t or t.get("deleted_at"):
        raise HTTPException(404, "Tagihan tidak ditemukan")
    if body.status and body.status not in ("belum_lunas", "cicilan", "lunas", "dibatalkan"):
        raise HTTPException(400, "Status tidak valid")
    changes = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = update("tagihan", tagihan_id, changes)
    return ok(updated, "Tagihan diperbarui")

# ── DELETE tagihan ─────────────────────────────────────────────
@router.delete("/tagihan/{tagihan_id}")
def delete_tagihan(tagihan_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ["super_admin", "admin_keuangan"])
    t = find_by_id("tagihan", tagihan_id)
    if not t:
        raise HTTPException(404, "Tagihan tidak ditemukan")
    # Block if has sukses payments
    sukses_pay = [p for p in read_all("pembayaran")
                  if p.get("tagihan_id") == tagihan_id and p.get("status") == "sukses"
                  and not p.get("deleted_at")]
    if sukses_pay:
        raise HTTPException(400, "Tagihan tidak bisa dihapus karena sudah ada pembayaran sukses")
    soft_delete("tagihan", tagihan_id)
    return ok(message="Tagihan dihapus")

# ── GET pembayaran list ────────────────────────────────────────
@router.get("/pembayaran")
def list_pembayaran(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    status: str = Query(""),
    metode: str = Query(""),
    tagihan_id: str = Query(""),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [p for p in read_all("pembayaran") if not p.get("deleted_at")]
    rows = search_rows(rows, ["kode_transaksi", "metode", "mahasiswa_nama", "mahasiswa_nim"], search)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if metode:
        rows = [r for r in rows if r.get("metode") == metode]
    if tagihan_id:
        rows = [r for r in rows if r.get("tagihan_id") == tagihan_id]
    rows.sort(key=lambda r: r.get("tgl_bayar", "") or r.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)

# ── GET pembayaran detail ──────────────────────────────────────
@router.get("/pembayaran/{pembayaran_id}")
def get_pembayaran(pembayaran_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    p = find_by_id("pembayaran", pembayaran_id)
    if not p or p.get("deleted_at"):
        raise HTTPException(404, "Pembayaran tidak ditemukan")
    tagihan = find_by_id("tagihan", p.get("tagihan_id", ""))
    return ok({**p, "tagihan": tagihan})

# ── POST input pembayaran ──────────────────────────────────────
class PembayaranCreate(BaseModel):
    tagihan_id: str
    jumlah: float
    metode: str = "transfer"       # transfer | qris | tunai | va
    kode_transaksi: Optional[str] = None
    tgl_bayar: Optional[str] = None
    keterangan: Optional[str] = None

@router.post("/pembayaran")
def input_pembayaran(body: PembayaranCreate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KEU)

    tagihan = find_by_id("tagihan", body.tagihan_id)
    if not tagihan or tagihan.get("deleted_at"):
        raise HTTPException(404, "Tagihan tidak ditemukan")
    if tagihan.get("status") == "lunas":
        raise HTTPException(400, "Tagihan sudah lunas")
    if tagihan.get("status") == "dibatalkan":
        raise HTTPException(400, "Tagihan sudah dibatalkan")
    if body.jumlah <= 0:
        raise HTTPException(400, "Jumlah pembayaran harus lebih dari 0")

    kode = body.kode_transaksi or f"TRX{secrets.token_hex(6).upper()}"
    # Idempotency — reject duplicate kode_transaksi
    dup = next((p for p in read_all("pembayaran")
                if p.get("kode_transaksi") == kode and not p.get("deleted_at")), None)
    if dup:
        raise HTTPException(400, f"Kode transaksi {kode} sudah digunakan")

    tgl = body.tgl_bayar or now_iso()
    data = insert("pembayaran", {
        "tagihan_id":     body.tagihan_id,
        "mahasiswa_id":   tagihan.get("mahasiswa_id", ""),
        "mahasiswa_nama": tagihan.get("mahasiswa_nama", ""),
        "mahasiswa_nim":  tagihan.get("mahasiswa_nim", ""),
        "jumlah":         body.jumlah,
        "metode":         body.metode,
        "kode_transaksi": kode,
        "status":         "sukses",
        "tgl_bayar":      tgl,
        "keterangan":     body.keterangan,
        "dicatat_oleh":   user.get("id", ""),
        "dicatat_oleh_nama": user.get("nama", ""),
    })

    # Recalculate tagihan status
    all_payments = [p for p in read_all("pembayaran")
                    if p.get("tagihan_id") == body.tagihan_id
                    and p.get("status") == "sukses"
                    and not p.get("deleted_at")]
    total_bayar = sum(p.get("jumlah", 0) for p in all_payments)
    new_status = "lunas" if total_bayar >= tagihan.get("jumlah", 0) else "cicilan"
    update("tagihan", body.tagihan_id, {"status": new_status})

    return ok(data, f"Pembayaran berhasil dicatat. Status tagihan: {new_status}")

# ── POST batalkan pembayaran ───────────────────────────────────
class BatalkanBody(BaseModel):
    alasan: Optional[str] = None

@router.post("/pembayaran/{pembayaran_id}/batalkan")
def batalkan_pembayaran(pembayaran_id: str, body: BatalkanBody = BatalkanBody(),
                        authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ["super_admin", "admin_keuangan"])
    p = find_by_id("pembayaran", pembayaran_id)
    if not p or p.get("deleted_at"):
        raise HTTPException(404, "Pembayaran tidak ditemukan")
    if p.get("status") == "dibatalkan":
        raise HTTPException(400, "Pembayaran sudah dibatalkan")

    updated = update("pembayaran", pembayaran_id, {
        "status":   "dibatalkan",
        "keterangan": f"Dibatalkan: {body.alasan or '-'}",
    })

    # Recalculate tagihan status
    tagihan_id = p.get("tagihan_id")
    all_payments = [p2 for p2 in read_all("pembayaran")
                    if p2.get("tagihan_id") == tagihan_id
                    and p2.get("status") == "sukses"
                    and not p2.get("deleted_at")]
    tagihan = find_by_id("tagihan", tagihan_id)
    if tagihan:
        total_bayar = sum(p2.get("jumlah", 0) for p2 in all_payments)
        jumlah = tagihan.get("jumlah", 0)
        new_status = "lunas" if total_bayar >= jumlah else ("cicilan" if total_bayar > 0 else "belum_lunas")
        update("tagihan", tagihan_id, {"status": new_status})

    return ok(updated, "Pembayaran dibatalkan")
