from fastapi import APIRouter, Query, Header, HTTPException
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate
from app.utils.dev import get_user_from_request, check_role

router = APIRouter(prefix="/aset", tags=["Aset & Inventaris"])

ASET_ADMIN = ["super_admin", "admin_aset", "staf"]
ASET_WRITE = ["super_admin", "admin_aset"]

_KATEGORI = ("tanah", "bangunan", "kendaraan", "peralatan", "elektronik", "furniture", "lainnya")
_KONDISI  = ("baik", "rusak_ringan", "rusak_berat")
_STATUS   = ("aktif", "dalam_perbaikan", "dihapuskan")
_SEARCH   = ["kode_aset", "nama", "lokasi", "keterangan"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}


# ── Stats ─────────────────────────────────────────────────────────────────────
@router.get("/stats")
def get_stats(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ASET_ADMIN)
    rows = [r for r in read_all("aset") if not r.get("deleted_at")]
    return ok({
        "total_aset":      len(rows),
        "kondisi_baik":    sum(1 for r in rows if r.get("kondisi") == "baik"),
        "kondisi_rusak":   sum(1 for r in rows if r.get("kondisi") in ("rusak_ringan", "rusak_berat")),
        "dalam_perbaikan": sum(1 for r in rows if r.get("status") == "dalam_perbaikan"),
        "total_nilai":     sum(r.get("harga_perolehan") or 0 for r in rows),
        "total_unit":      sum(r.get("jumlah") or 0 for r in rows),
    })


# ── List ──────────────────────────────────────────────────────────────────────
@router.get("")
def list_aset(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    kategori: str = Query(""),
    kondisi: str = Query(""),
    status: str = Query(""),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    check_role(user, ASET_ADMIN)
    rows = [r for r in read_all("aset") if not r.get("deleted_at")]
    rows = search_rows(rows, _SEARCH, search)
    if kategori: rows = [r for r in rows if r.get("kategori") == kategori]
    if kondisi:  rows = [r for r in rows if r.get("kondisi") == kondisi]
    if status:   rows = [r for r in rows if r.get("status") == status]
    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)


# ── CRUD ──────────────────────────────────────────────────────────────────────
@router.post("")
def create_aset(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ASET_WRITE)
    body.setdefault("kondisi", "baik")
    body.setdefault("status", "aktif")
    body.setdefault("jumlah", 1)
    row = insert("aset", body)
    return ok(row, "Aset berhasil ditambahkan")


@router.get("/{aset_id}")
def get_aset(aset_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ASET_ADMIN)
    r = find_by_id("aset", aset_id)
    if not r:
        raise HTTPException(404, "Aset tidak ditemukan")
    return ok(r)


@router.put("/{aset_id}")
def update_aset(aset_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ASET_WRITE)
    r = find_by_id("aset", aset_id)
    if not r:
        raise HTTPException(404, "Aset tidak ditemukan")
    if r.get("status") == "dihapuskan":
        raise HTTPException(400, "Aset yang sudah dihapuskan tidak dapat diubah")
    row = update("aset", aset_id, body)
    return ok(row, "Aset diperbarui")


@router.delete("/{aset_id}")
def delete_aset(aset_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ASET_WRITE)
    r = find_by_id("aset", aset_id)
    if not r:
        raise HTTPException(404, "Aset tidak ditemukan")
    soft_delete("aset", aset_id)
    return ok(None, "Aset dihapus")


# ── Update kondisi / status ───────────────────────────────────────────────────
@router.patch("/{aset_id}/kondisi")
def update_kondisi(aset_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ASET_ADMIN)
    r = find_by_id("aset", aset_id)
    if not r:
        raise HTTPException(404, "Aset tidak ditemukan")
    kondisi = body.get("kondisi")
    status  = body.get("status")
    if kondisi and kondisi not in _KONDISI:
        raise HTTPException(400, f"Kondisi harus salah satu dari: {', '.join(_KONDISI)}")
    if status and status not in _STATUS:
        raise HTTPException(400, f"Status harus salah satu dari: {', '.join(_STATUS)}")
    patch = {}
    if kondisi: patch["kondisi"] = kondisi
    if status:  patch["status"]  = status
    if body.get("keterangan"): patch["keterangan"] = body["keterangan"]
    row = update("aset", aset_id, patch)
    return ok(row, "Kondisi aset diperbarui")
