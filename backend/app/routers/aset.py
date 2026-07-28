from fastapi import APIRouter, Query, HTTPException
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate

router = APIRouter(prefix="/aset", tags=["Aset & Inventaris"])

_KATEGORI = ("tanah", "bangunan", "kendaraan", "peralatan", "elektronik", "furniture", "lainnya")
_KONDISI  = ("baik", "rusak_ringan", "rusak_berat")
_STATUS   = ("aktif", "dalam_perbaikan", "dihapuskan")
_SEARCH   = ["kode_aset", "nama", "lokasi", "keterangan"]


# ── Stats ─────────────────────────────────────────────────────────────────────
@router.get("/stats")
def get_stats():
    rows = [r for r in read_all("aset") if not r.get("deleted_at")]
    return {
        "success": True,
        "data": {
            "total_aset":       len(rows),
            "kondisi_baik":     sum(1 for r in rows if r.get("kondisi") == "baik"),
            "kondisi_rusak":    sum(1 for r in rows if r.get("kondisi") in ("rusak_ringan", "rusak_berat")),
            "dalam_perbaikan":  sum(1 for r in rows if r.get("status") == "dalam_perbaikan"),
            "total_nilai":      sum(r.get("harga_perolehan") or 0 for r in rows),
            "total_unit":       sum(r.get("jumlah") or 0 for r in rows),
        },
        "message": "Berhasil", "meta": None,
    }


# ── List ──────────────────────────────────────────────────────────────────────
@router.get("")
def list_aset(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    kategori: str = Query(""),
    kondisi: str = Query(""),
    status: str = Query(""),
):
    rows = [r for r in read_all("aset") if not r.get("deleted_at")]
    rows = search_rows(rows, _SEARCH, search)
    if kategori: rows = [r for r in rows if r.get("kategori") == kategori]
    if kondisi:  rows = [r for r in rows if r.get("kondisi") == kondisi]
    if status:   rows = [r for r in rows if r.get("status") == status]
    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


# ── CRUD ──────────────────────────────────────────────────────────────────────
@router.post("")
def create_aset(body: dict):
    body.setdefault("kondisi", "baik")
    body.setdefault("status", "aktif")
    body.setdefault("jumlah", 1)
    row = insert("aset", body)
    return {"success": True, "data": row, "message": "Aset berhasil ditambahkan", "meta": None}


@router.get("/{aset_id}")
def get_aset(aset_id: str):
    r = find_by_id("aset", aset_id)
    if not r: raise HTTPException(404, "Aset tidak ditemukan")
    return {"success": True, "data": r, "message": "Berhasil", "meta": None}


@router.put("/{aset_id}")
def update_aset(aset_id: str, body: dict):
    r = find_by_id("aset", aset_id)
    if not r: raise HTTPException(404, "Aset tidak ditemukan")
    if r.get("status") == "dihapuskan":
        raise HTTPException(400, "Aset yang sudah dihapuskan tidak dapat diubah")
    row = update("aset", aset_id, body)
    return {"success": True, "data": row, "message": "Aset diperbarui", "meta": None}


@router.delete("/{aset_id}")
def delete_aset(aset_id: str):
    r = find_by_id("aset", aset_id)
    if not r: raise HTTPException(404, "Aset tidak ditemukan")
    soft_delete("aset", aset_id)
    return {"success": True, "data": None, "message": "Aset dihapus", "meta": None}


# ── Update kondisi / status ───────────────────────────────────────────────────
@router.patch("/{aset_id}/kondisi")
def update_kondisi(aset_id: str, body: dict):
    r = find_by_id("aset", aset_id)
    if not r: raise HTTPException(404, "Aset tidak ditemukan")
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
    return {"success": True, "data": row, "message": "Kondisi aset diperbarui", "meta": None}
