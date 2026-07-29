from fastapi import APIRouter, Query, HTTPException
from datetime import datetime
from app.utils.db import (
    read_all, find_by_id, insert, update, soft_delete,
    search_rows, paginate,
)

router = APIRouter(prefix="/surat", tags=["Surat Menyurat"])

_STATUS = ("menunggu", "diproses", "selesai", "ditolak")
_SEARCH_P = ["mahasiswa_nama", "mahasiswa_nim", "nama_surat", "keperluan", "no_surat"]
_SEARCH_T = ["nama", "kode", "jenis", "deskripsi"]


# ── Stats ─────────────────────────────────────────────────────────────────────
@router.get("/stats")
def get_stats():
    pengajuan = [p for p in read_all("pengajuan_surat") if not p.get("deleted_at")]
    templates  = [t for t in read_all("template_surat")  if not t.get("deleted_at")]
    return {
        "success": True,
        "data": {
            "total_pengajuan": len(pengajuan),
            "menunggu":  sum(1 for p in pengajuan if p.get("status") == "menunggu"),
            "diproses":  sum(1 for p in pengajuan if p.get("status") == "diproses"),
            "selesai":   sum(1 for p in pengajuan if p.get("status") == "selesai"),
            "ditolak":   sum(1 for p in pengajuan if p.get("status") == "ditolak"),
            "total_template": len(templates),
        },
        "message": "Berhasil",
        "meta": None,
    }


# ── Template ──────────────────────────────────────────────────────────────────
@router.get("/template")
def list_template(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=1000),
    search: str = Query(""),
    is_active: str = Query(""),
):
    rows = [t for t in read_all("template_surat") if not t.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_T, search)
    if is_active != "":
        flag = is_active.lower() == "true"
        rows = [r for r in rows if r.get("is_active") == flag]
    items, meta = paginate(rows, page, per_page)
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


@router.post("/template")
def create_template(body: dict):
    body.setdefault("is_active", True)
    body.setdefault("biaya", 0)
    body.setdefault("syarat", [])
    row = insert("template_surat", body)
    return {"success": True, "data": row, "message": "Template berhasil dibuat", "meta": None}


@router.put("/template/{template_id}")
def update_template(template_id: str, body: dict):
    t = find_by_id("template_surat", template_id)
    if not t:
        raise HTTPException(404, "Template tidak ditemukan")
    row = update("template_surat", template_id, body)
    return {"success": True, "data": row, "message": "Template berhasil diperbarui", "meta": None}


@router.delete("/template/{template_id}")
def delete_template(template_id: str):
    t = find_by_id("template_surat", template_id)
    if not t:
        raise HTTPException(404, "Template tidak ditemukan")
    # Check if any pengajuan uses this template
    aktif = [p for p in read_all("pengajuan_surat")
             if not p.get("deleted_at") and p.get("template_id") == template_id
             and p.get("status") in ("menunggu", "diproses")]
    if aktif:
        raise HTTPException(400, f"Template sedang digunakan oleh {len(aktif)} pengajuan aktif")
    soft_delete("template_surat", template_id)
    return {"success": True, "data": None, "message": "Template dihapus", "meta": None}


# ── Pengajuan List ────────────────────────────────────────────────────────────
@router.get("/pengajuan")
def list_pengajuan(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    status: str = Query(""),
    jenis_surat: str = Query(""),
):
    rows = [p for p in read_all("pengajuan_surat") if not p.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_P, search)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if jenis_surat:
        rows = [r for r in rows if r.get("jenis_surat") == jenis_surat]
    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


# ── Pengajuan CRUD ────────────────────────────────────────────────────────────
@router.post("/pengajuan")
def create_pengajuan(body: dict):
    body.setdefault("status", "menunggu")
    body.setdefault("tgl_pengajuan", datetime.now().isoformat())

    # Enrich from template
    tmpl = find_by_id("template_surat", body.get("template_id", ""))
    if tmpl:
        body["jenis_surat"] = tmpl["jenis"]
        body["nama_surat"] = tmpl["nama"]

    row = insert("pengajuan_surat", body)
    return {"success": True, "data": row, "message": "Pengajuan berhasil dibuat", "meta": None}


@router.get("/pengajuan/{pengajuan_id}")
def get_pengajuan(pengajuan_id: str):
    p = find_by_id("pengajuan_surat", pengajuan_id)
    if not p:
        raise HTTPException(404, "Pengajuan tidak ditemukan")
    return {"success": True, "data": p, "message": "Berhasil", "meta": None}


@router.put("/pengajuan/{pengajuan_id}")
def update_pengajuan(pengajuan_id: str, body: dict):
    p = find_by_id("pengajuan_surat", pengajuan_id)
    if not p:
        raise HTTPException(404, "Pengajuan tidak ditemukan")
    if p.get("status") in ("selesai", "ditolak"):
        raise HTTPException(400, "Pengajuan yang sudah selesai/ditolak tidak dapat diubah")
    row = update("pengajuan_surat", pengajuan_id, body)
    return {"success": True, "data": row, "message": "Pengajuan diperbarui", "meta": None}


@router.delete("/pengajuan/{pengajuan_id}")
def delete_pengajuan(pengajuan_id: str):
    p = find_by_id("pengajuan_surat", pengajuan_id)
    if not p:
        raise HTTPException(404, "Pengajuan tidak ditemukan")
    if p.get("status") not in ("menunggu",):
        raise HTTPException(400, "Hanya pengajuan berstatus menunggu yang dapat dihapus")
    soft_delete("pengajuan_surat", pengajuan_id)
    return {"success": True, "data": None, "message": "Pengajuan dihapus", "meta": None}


# ── Status Transitions ────────────────────────────────────────────────────────
@router.post("/pengajuan/{pengajuan_id}/proses")
def proses_pengajuan(pengajuan_id: str, body: dict = {}):
    p = find_by_id("pengajuan_surat", pengajuan_id)
    if not p:
        raise HTTPException(404, "Pengajuan tidak ditemukan")
    if p.get("status") != "menunggu":
        raise HTTPException(400, "Hanya pengajuan berstatus menunggu yang dapat diproses")
    row = update("pengajuan_surat", pengajuan_id, {
        "status": "diproses",
        "catatan_admin": body.get("catatan_admin", ""),
    })
    return {"success": True, "data": row, "message": "Pengajuan sedang diproses", "meta": None}


@router.post("/pengajuan/{pengajuan_id}/selesai")
def selesaikan_pengajuan(pengajuan_id: str, body: dict = {}):
    p = find_by_id("pengajuan_surat", pengajuan_id)
    if not p:
        raise HTTPException(404, "Pengajuan tidak ditemukan")
    if p.get("status") not in ("menunggu", "diproses"):
        raise HTTPException(400, "Pengajuan tidak dalam status yang bisa diselesaikan")

    # Generate nomor surat
    all_p = read_all("pengajuan_surat")
    selesai_count = sum(1 for x in all_p if x.get("status") == "selesai" and
                        str(x.get("tgl_selesai",""))[:4] == str(datetime.now().year))
    kode = p.get("nama_surat","SURAT").split()[0].upper()[:3]
    no_surat = body.get("no_surat") or f"{str(selesai_count+1).zfill(3)}/SURAT/{kode}/{datetime.now().year}"

    row = update("pengajuan_surat", pengajuan_id, {
        "status": "selesai",
        "no_surat": no_surat,
        "tgl_selesai": datetime.now().isoformat(),
        "catatan_admin": body.get("catatan_admin", p.get("catatan_admin", "")),
    })
    return {"success": True, "data": row, "message": "Surat selesai dibuat", "meta": None}


@router.post("/pengajuan/{pengajuan_id}/tolak")
def tolak_pengajuan(pengajuan_id: str, body: dict):
    p = find_by_id("pengajuan_surat", pengajuan_id)
    if not p:
        raise HTTPException(404, "Pengajuan tidak ditemukan")
    if p.get("status") in ("selesai", "ditolak"):
        raise HTTPException(400, "Pengajuan sudah final")
    if not body.get("catatan_admin"):
        raise HTTPException(400, "Alasan penolakan wajib diisi")
    row = update("pengajuan_surat", pengajuan_id, {
        "status": "ditolak",
        "catatan_admin": body["catatan_admin"],
    })
    return {"success": True, "data": row, "message": "Pengajuan ditolak", "meta": None}
