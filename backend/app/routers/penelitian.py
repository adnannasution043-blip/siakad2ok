from fastapi import APIRouter, Query, HTTPException
from datetime import datetime
from app.utils.db import (
    read_all, find_by_id, insert, update, soft_delete,
    search_rows, paginate,
)

router = APIRouter(prefix="/penelitian", tags=["Penelitian"])

_STATUS     = ("draft", "diajukan", "aktif", "selesai", "ditolak")
_STATUS_LUR = ("menunggu_validasi", "tervalidasi", "ditolak")
_SEARCH_P   = ["judul", "ketua_nama", "skema"]
_SEARCH_L   = ["judul", "jenis", "ketua_nama", "penerbit", "penelitian_judul"]


# ── Stats ─────────────────────────────────────────────────────────────────────
@router.get("/stats")
def get_stats():
    rows   = [p for p in read_all("penelitian")         if not p.get("deleted_at")]
    luaran = [l for l in read_all("luaran_penelitian")  if not l.get("deleted_at")]
    return {
        "success": True,
        "data": {
            "total_penelitian": len(rows),
            "aktif":            sum(1 for p in rows   if p.get("status") == "aktif"),
            "selesai":          sum(1 for p in rows   if p.get("status") == "selesai"),
            "total_luaran":     len(luaran),
            "luaran_tervalidasi": sum(1 for l in luaran if l.get("status_validasi") == "tervalidasi"),
            "total_dana":       sum(p.get("dana_disetujui") or 0 for p in rows),
        },
        "message": "Berhasil",
        "meta": None,
    }


# ── Penelitian List ───────────────────────────────────────────────────────────
@router.get("")
def list_penelitian(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    status: str = Query(""),
    skema: str = Query(""),
    tahun: str = Query(""),
    dosen_id: str = Query(""),
):
    rows = [p for p in read_all("penelitian") if not p.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_P, search)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if skema:
        rows = [r for r in rows if r.get("skema") == skema]
    if tahun:
        rows = [r for r in rows if str(r.get("tahun", "")) == tahun]
    if dosen_id:
        rows = [r for r in rows if
                r.get("ketua_id") == dosen_id or
                any(a.get("id") == dosen_id for a in r.get("anggota", []))]

    luaran_all = [l for l in read_all("luaran_penelitian") if not l.get("deleted_at")]
    for p in rows:
        p["jumlah_luaran"] = sum(1 for l in luaran_all if l.get("penelitian_id") == p["id"])

    rows.sort(key=lambda x: (x.get("tahun", 0), x.get("created_at", "")), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


# ── Penelitian CRUD ───────────────────────────────────────────────────────────
@router.post("")
def create_penelitian(body: dict):
    body.setdefault("status", "draft")
    body.setdefault("laporan_kemajuan_persen", 0)
    body.setdefault("anggota", [])
    row = insert("penelitian", body)
    return {"success": True, "data": row, "message": "Penelitian berhasil dibuat", "meta": None}


@router.get("/{penelitian_id}")
def get_penelitian(penelitian_id: str):
    p = find_by_id("penelitian", penelitian_id)
    if not p:
        raise HTTPException(404, "Penelitian tidak ditemukan")
    luaran = [l for l in read_all("luaran_penelitian")
              if not l.get("deleted_at") and l.get("penelitian_id") == penelitian_id]
    p["luaran"] = luaran
    return {"success": True, "data": p, "message": "Berhasil", "meta": None}


@router.put("/{penelitian_id}")
def update_penelitian(penelitian_id: str, body: dict):
    p = find_by_id("penelitian", penelitian_id)
    if not p:
        raise HTTPException(404, "Penelitian tidak ditemukan")
    if p.get("status") in ("selesai", "ditolak"):
        raise HTTPException(400, "Penelitian yang sudah final tidak dapat diubah")
    row = update("penelitian", penelitian_id, body)
    return {"success": True, "data": row, "message": "Penelitian diperbarui", "meta": None}


@router.delete("/{penelitian_id}")
def delete_penelitian(penelitian_id: str):
    p = find_by_id("penelitian", penelitian_id)
    if not p:
        raise HTTPException(404, "Penelitian tidak ditemukan")
    if p.get("status") not in ("draft",):
        raise HTTPException(400, "Hanya penelitian berstatus draft yang dapat dihapus")
    soft_delete("penelitian", penelitian_id)
    return {"success": True, "data": None, "message": "Penelitian dihapus", "meta": None}


# ── Status Transitions ────────────────────────────────────────────────────────
@router.post("/{penelitian_id}/ajukan")
def ajukan(penelitian_id: str):
    p = find_by_id("penelitian", penelitian_id)
    if not p:
        raise HTTPException(404, "Penelitian tidak ditemukan")
    if p.get("status") != "draft":
        raise HTTPException(400, "Hanya penelitian draft yang dapat diajukan")
    row = update("penelitian", penelitian_id, {"status": "diajukan"})
    return {"success": True, "data": row, "message": "Penelitian diajukan ke LPPM", "meta": None}


@router.post("/{penelitian_id}/setujui")
def setujui(penelitian_id: str, body: dict = {}):
    p = find_by_id("penelitian", penelitian_id)
    if not p:
        raise HTTPException(404, "Penelitian tidak ditemukan")
    if p.get("status") != "diajukan":
        raise HTTPException(400, "Penelitian harus berstatus diajukan untuk disetujui")

    # Business rule: cek tidak ada penelitian aktif lain dengan skema + tahun + ketua sama
    skema  = p.get("skema")
    tahun  = p.get("tahun")
    ketua  = p.get("ketua_id")
    konflik = [x for x in read_all("penelitian")
               if not x.get("deleted_at") and x["id"] != penelitian_id
               and x.get("status") == "aktif"
               and x.get("skema") == skema
               and x.get("tahun") == tahun
               and x.get("ketua_id") == ketua]
    if konflik:
        raise HTTPException(400,
            f"Dosen sudah memiliki penelitian aktif pada skema '{skema}' tahun {tahun}")

    row = update("penelitian", penelitian_id, {
        "status": "aktif",
        "dana_disetujui": body.get("dana_disetujui", p.get("dana_diajukan")),
        "tgl_mulai": body.get("tgl_mulai", datetime.now().strftime("%Y-%m-%d")),
        "tgl_selesai": body.get("tgl_selesai", f"{p.get('tahun', datetime.now().year)}-12-31"),
    })
    return {"success": True, "data": row, "message": "Penelitian disetujui dan aktif", "meta": None}


@router.post("/{penelitian_id}/tolak")
def tolak(penelitian_id: str, body: dict):
    p = find_by_id("penelitian", penelitian_id)
    if not p:
        raise HTTPException(404, "Penelitian tidak ditemukan")
    if p.get("status") not in ("diajukan",):
        raise HTTPException(400, "Hanya penelitian yang sedang diajukan yang dapat ditolak")
    if not body.get("catatan"):
        raise HTTPException(400, "Alasan penolakan wajib diisi")
    row = update("penelitian", penelitian_id, {"status": "ditolak", "catatan": body["catatan"]})
    return {"success": True, "data": row, "message": "Penelitian ditolak", "meta": None}


@router.post("/{penelitian_id}/selesaikan")
def selesaikan(penelitian_id: str):
    p = find_by_id("penelitian", penelitian_id)
    if not p:
        raise HTTPException(404, "Penelitian tidak ditemukan")
    if p.get("status") != "aktif":
        raise HTTPException(400, "Hanya penelitian aktif yang dapat diselesaikan")
    if (p.get("laporan_kemajuan_persen") or 0) < 100:
        raise HTTPException(400, "Laporan kemajuan harus 100% sebelum penelitian dapat diselesaikan")
    row = update("penelitian", penelitian_id, {"status": "selesai"})
    return {"success": True, "data": row, "message": "Penelitian diselesaikan", "meta": None}


@router.patch("/{penelitian_id}/laporan")
def update_laporan(penelitian_id: str, body: dict):
    p = find_by_id("penelitian", penelitian_id)
    if not p:
        raise HTTPException(404, "Penelitian tidak ditemukan")
    if p.get("status") != "aktif":
        raise HTTPException(400, "Laporan hanya bisa diupdate saat penelitian aktif")
    persen = body.get("laporan_kemajuan_persen", 0)
    if not (0 <= persen <= 100):
        raise HTTPException(400, "Persentase laporan harus 0-100")
    row = update("penelitian", penelitian_id, {"laporan_kemajuan_persen": persen})
    return {"success": True, "data": row, "message": f"Laporan kemajuan diperbarui: {persen}%", "meta": None}


# ── Luaran ────────────────────────────────────────────────────────────────────
@router.get("/luaran/list")
def list_luaran(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    penelitian_id: str = Query(""),
    jenis: str = Query(""),
    status_validasi: str = Query(""),
):
    rows = [l for l in read_all("luaran_penelitian") if not l.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_L, search)
    if penelitian_id:
        rows = [r for r in rows if r.get("penelitian_id") == penelitian_id]
    if jenis:
        rows = [r for r in rows if r.get("jenis") == jenis]
    if status_validasi:
        rows = [r for r in rows if r.get("status_validasi") == status_validasi]
    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


@router.post("/{penelitian_id}/luaran")
def create_luaran(penelitian_id: str, body: dict):
    p = find_by_id("penelitian", penelitian_id)
    if not p:
        raise HTTPException(404, "Penelitian tidak ditemukan")
    body["penelitian_id"]    = penelitian_id
    body["penelitian_judul"] = p.get("judul", "")[:60]
    body["ketua_nama"]       = p.get("ketua_nama", "")
    body.setdefault("status_validasi", "menunggu_validasi")
    row = insert("luaran_penelitian", body)
    return {"success": True, "data": row, "message": "Luaran berhasil ditambahkan", "meta": None}


@router.put("/luaran/{luaran_id}")
def update_luaran(luaran_id: str, body: dict):
    l = find_by_id("luaran_penelitian", luaran_id)
    if not l:
        raise HTTPException(404, "Luaran tidak ditemukan")
    if l.get("status_validasi") == "tervalidasi":
        raise HTTPException(400, "Luaran yang sudah tervalidasi tidak dapat diubah")
    row = update("luaran_penelitian", luaran_id, body)
    return {"success": True, "data": row, "message": "Luaran diperbarui", "meta": None}


@router.delete("/luaran/{luaran_id}")
def delete_luaran(luaran_id: str):
    l = find_by_id("luaran_penelitian", luaran_id)
    if not l:
        raise HTTPException(404, "Luaran tidak ditemukan")
    if l.get("status_validasi") == "tervalidasi":
        raise HTTPException(400, "Luaran yang sudah tervalidasi tidak dapat dihapus")
    soft_delete("luaran_penelitian", luaran_id)
    return {"success": True, "data": None, "message": "Luaran dihapus", "meta": None}


@router.post("/luaran/{luaran_id}/validasi")
def validasi_luaran(luaran_id: str, body: dict):
    l = find_by_id("luaran_penelitian", luaran_id)
    if not l:
        raise HTTPException(404, "Luaran tidak ditemukan")
    status = body.get("status_validasi")
    if status not in ("tervalidasi", "ditolak"):
        raise HTTPException(400, "Status validasi harus 'tervalidasi' atau 'ditolak'")
    if status == "ditolak" and not body.get("catatan_lppm"):
        raise HTTPException(400, "Catatan LPPM wajib diisi jika ditolak")
    row = update("luaran_penelitian", luaran_id, {
        "status_validasi": status,
        "catatan_lppm": body.get("catatan_lppm", ""),
    })
    return {"success": True, "data": row, "message": f"Luaran {status}", "meta": None}
