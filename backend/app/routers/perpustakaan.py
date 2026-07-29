from fastapi import APIRouter, Query, HTTPException, Header
from typing import Optional
from datetime import datetime, timezone, date, timedelta
import uuid

from app.utils.db import read_all, find_by_id, insert, update, soft_delete, paginate
from app.utils.dev import get_user_from_request, check_role, get_mahasiswa_for_user

router = APIRouter(prefix="/perpustakaan", tags=["Perpustakaan"])

PUSTAKA_ADMIN = ["super_admin", "admin_perpustakaan", "staf"]

DENDA_PER_HARI = 1000

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def _now():
    return datetime.now(timezone.utc).isoformat()

def _today():
    return date.today().isoformat()


# ─── STATS ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PUSTAKA_ADMIN)
    koleksi = [k for k in read_all("koleksi_perpustakaan") if not k.get("deleted_at")]
    pinjam = [p for p in read_all("peminjaman_perpustakaan") if not p.get("deleted_at")]
    today = _today()
    sedang_dipinjam = len([p for p in pinjam if p.get("status") == "dipinjam"])
    terlambat = len([p for p in pinjam
                     if p.get("status") == "dipinjam" and p.get("tgl_kembali_estimasi", "9999") < today])
    total_denda = sum(p.get("denda", 0) for p in pinjam)
    return ok({
        "total_koleksi": len(koleksi),
        "total_eksemplar": sum(k.get("stok_total", 0) for k in koleksi),
        "tersedia": sum(k.get("stok_tersedia", 0) for k in koleksi),
        "sedang_dipinjam": sedang_dipinjam,
        "terlambat_kembali": terlambat,
        "total_denda": total_denda,
    })


# ─── KOLEKSI ──────────────────────────────────────────────────────────────────

@router.get("/koleksi")
def list_koleksi(
    kategori: Optional[str] = None,
    search: Optional[str] = None,
    tersedia: Optional[bool] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    data = [k for k in read_all("koleksi_perpustakaan") if not k.get("deleted_at")]
    if kategori:
        data = [k for k in data if k.get("kategori") == kategori]
    if tersedia is True:
        data = [k for k in data if (k.get("stok_tersedia", 0) or 0) > 0]
    if tersedia is False:
        data = [k for k in data if (k.get("stok_tersedia", 0) or 0) == 0]
    if search:
        q = search.lower()
        data = [k for k in data if
                q in k.get("judul", "").lower() or
                q in k.get("penulis", "").lower() or
                q in (k.get("isbn") or "").lower()]
    items, meta = paginate(data, page, per_page)
    return ok(items, meta=meta)


@router.post("/koleksi")
def create_koleksi(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PUSTAKA_ADMIN)
    required = ["judul", "penulis", "penerbit", "tahun"]
    for f in required:
        if not body.get(f):
            raise HTTPException(400, f"Field '{f}' wajib diisi")
    stok = int(body.get("stok_total", 1))
    record = {
        "id": f"buku-{uuid.uuid4().hex[:8]}",
        "isbn": body.get("isbn"),
        "judul": body["judul"],
        "penulis": body["penulis"],
        "penerbit": body["penerbit"],
        "tahun": int(body["tahun"]),
        "kategori": body.get("kategori", "Umum"),
        "stok_total": stok,
        "stok_tersedia": stok,
        "lokasi_rak": body.get("lokasi_rak"),
        "created_at": _now(),
        "deleted_at": None,
    }
    insert("koleksi_perpustakaan", record)
    return ok(record, "Koleksi berhasil ditambahkan")


@router.get("/koleksi/{buku_id}")
def get_koleksi(buku_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    rec = find_by_id("koleksi_perpustakaan", buku_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Buku tidak ditemukan")
    return ok(rec)


@router.put("/koleksi/{buku_id}")
def update_koleksi(buku_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PUSTAKA_ADMIN)
    rec = find_by_id("koleksi_perpustakaan", buku_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Buku tidak ditemukan")
    updatable = ["isbn", "judul", "penulis", "penerbit", "tahun",
                 "kategori", "stok_total", "stok_tersedia", "lokasi_rak"]
    changes = {k: body[k] for k in updatable if k in body}
    updated = update("koleksi_perpustakaan", buku_id, changes)
    return ok(updated, "Koleksi berhasil diperbarui")


@router.delete("/koleksi/{buku_id}")
def delete_koleksi(buku_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PUSTAKA_ADMIN)
    rec = find_by_id("koleksi_perpustakaan", buku_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Buku tidak ditemukan")
    soft_delete("koleksi_perpustakaan", buku_id)
    return ok(None, "Koleksi berhasil dihapus")


# ─── PEMINJAMAN ───────────────────────────────────────────────────────────────

@router.get("/peminjaman")
def list_peminjaman(
    status: Optional[str] = None,
    mahasiswa_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    data = [p for p in read_all("peminjaman_perpustakaan") if not p.get("deleted_at")]

    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        data = [p for p in data if p.get("mahasiswa_id") == mhs_id]
    else:
        check_role(user, PUSTAKA_ADMIN)
        if mahasiswa_id:
            data = [p for p in data if p.get("mahasiswa_id") == mahasiswa_id]

    if status:
        data = [p for p in data if p.get("status") == status]
    if search:
        q = search.lower()
        data = [p for p in data if
                q in p.get("judul_buku", "").lower() or
                q in p.get("mahasiswa_nama", "").lower() or
                q in p.get("mahasiswa_nim", "").lower()]
    data.sort(key=lambda p: p.get("tgl_pinjam", ""), reverse=True)
    items, meta = paginate(data, page, per_page)
    return ok(items, meta=meta)


@router.post("/peminjaman")
def create_peminjaman(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PUSTAKA_ADMIN)
    required = ["buku_id", "mahasiswa_id", "mahasiswa_nama", "mahasiswa_nim", "tgl_pinjam"]
    for f in required:
        if not body.get(f):
            raise HTTPException(400, f"Field '{f}' wajib diisi")

    buku = find_by_id("koleksi_perpustakaan", body["buku_id"])
    if not buku or buku.get("deleted_at"):
        raise HTTPException(404, "Buku tidak ditemukan")
    if (buku.get("stok_tersedia") or 0) <= 0:
        raise HTTPException(409, "Stok buku habis, tidak dapat dipinjam")

    tgl_pinjam = body["tgl_pinjam"]
    tgl_estimasi = (date.fromisoformat(tgl_pinjam) + timedelta(days=14)).isoformat()

    record = {
        "id": f"pjm-{uuid.uuid4().hex[:8]}",
        "buku_id": body["buku_id"],
        "judul_buku": buku.get("judul", ""),
        "mahasiswa_id": body["mahasiswa_id"],
        "mahasiswa_nama": body["mahasiswa_nama"],
        "mahasiswa_nim": body["mahasiswa_nim"],
        "tgl_pinjam": tgl_pinjam,
        "tgl_kembali_estimasi": tgl_estimasi,
        "tgl_kembali_aktual": None,
        "status": "dipinjam",
        "denda": 0,
        "created_at": _now(),
        "deleted_at": None,
    }
    insert("peminjaman_perpustakaan", record)
    update("koleksi_perpustakaan", body["buku_id"],
           {"stok_tersedia": max(0, (buku.get("stok_tersedia") or 1) - 1)})
    return ok(record, "Peminjaman berhasil dicatat")


@router.post("/peminjaman/{pinjam_id}/kembali")
def kembalikan_buku(pinjam_id: str, body: dict = None, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PUSTAKA_ADMIN)
    rec = find_by_id("peminjaman_perpustakaan", pinjam_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Data peminjaman tidak ditemukan")
    if rec.get("status") == "dikembalikan":
        raise HTTPException(409, "Buku sudah dikembalikan")

    tgl_aktual = (body or {}).get("tgl_kembali_aktual") or _today()
    tgl_estimasi = rec.get("tgl_kembali_estimasi", tgl_aktual)

    denda = 0
    try:
        selisih = (date.fromisoformat(tgl_aktual) - date.fromisoformat(tgl_estimasi)).days
        if selisih > 0:
            denda = selisih * DENDA_PER_HARI
    except Exception:
        pass

    updated = update("peminjaman_perpustakaan", pinjam_id, {
        "tgl_kembali_aktual": tgl_aktual,
        "status": "dikembalikan",
        "denda": denda,
    })

    buku = find_by_id("koleksi_perpustakaan", rec.get("buku_id", ""))
    if buku and not buku.get("deleted_at"):
        update("koleksi_perpustakaan", buku["id"],
               {"stok_tersedia": (buku.get("stok_tersedia") or 0) + 1})

    msg = "Buku berhasil dikembalikan"
    if denda:
        msg += f". Denda keterlambatan: Rp {denda:,}"
    return ok(updated, msg)
