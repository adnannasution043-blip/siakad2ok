from fastapi import APIRouter, Query, Header, HTTPException
from datetime import date
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate
from app.utils.dev import get_user_from_request, check_role

router = APIRouter(prefix="/akreditasi", tags=["Akreditasi"])

ADMIN_KAPRODI = ["super_admin", "admin_akademik", "kaprodi", "staf"]

_PERINGKAT = ("Unggul", "Baik Sekali", "Baik", "A", "B", "C", "Terakreditasi", "Belum Terakreditasi")
_BADAN     = ("BAN-PT", "LAM-PTKes", "LAM Teknik", "LAM Ekonomi", "LAM Hukum", "LAM Sains Alam")
_SEARCH_P  = ["prodi_nama", "badan_akreditasi", "peringkat", "nomor_sk"]
_SEARCH_D  = ["judul", "jenis", "prodi_nama", "keterangan"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}


# ── Stats ─────────────────────────────────────────────────────────────────────
@router.get("/stats")
def get_stats(authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    rows = [r for r in read_all("akreditasi_prodi") if not r.get("deleted_at")]
    today = date.today().isoformat()
    from datetime import timedelta
    cutoff = (date.today() + timedelta(days=180)).isoformat()
    akan_berakhir = [r for r in rows if r.get("tgl_berakhir") and today < r["tgl_berakhir"] <= cutoff]
    return ok({
        "total_prodi":   len(rows),
        "terakreditasi": sum(1 for r in rows if r.get("peringkat") not in ("Belum Terakreditasi", None, "")),
        "unggul":        sum(1 for r in rows if r.get("peringkat") == "Unggul"),
        "baik_sekali":   sum(1 for r in rows if r.get("peringkat") == "Baik Sekali"),
        "akan_berakhir": len(akan_berakhir),
        "total_dokumen": len([d for d in read_all("akreditasi_dokumen") if not d.get("deleted_at")]),
    })


# ── Prodi Akreditasi ──────────────────────────────────────────────────────────
@router.get("/prodi")
def list_prodi(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    badan_akreditasi: str = Query(""),
    peringkat: str = Query(""),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [r for r in read_all("akreditasi_prodi") if not r.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_P, search)
    if badan_akreditasi: rows = [r for r in rows if r.get("badan_akreditasi") == badan_akreditasi]
    if peringkat:        rows = [r for r in rows if r.get("peringkat") == peringkat]
    rows.sort(key=lambda x: x.get("prodi_nama", ""))
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)


@router.post("/prodi")
def create_prodi(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    if not body.get("prodi_nama"):
        raise HTTPException(400, "Nama prodi wajib diisi")
    row = insert("akreditasi_prodi", body)
    return ok(row, "Data akreditasi prodi ditambahkan")


@router.get("/prodi/{prodi_id}")
def get_prodi(prodi_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    r = find_by_id("akreditasi_prodi", prodi_id)
    if not r:
        raise HTTPException(404, "Data akreditasi prodi tidak ditemukan")
    dokumen = [d for d in read_all("akreditasi_dokumen") if not d.get("deleted_at") and d.get("prodi_id") == prodi_id]
    r["dokumen"] = dokumen
    return ok(r)


@router.put("/prodi/{prodi_id}")
def update_prodi(prodi_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    r = find_by_id("akreditasi_prodi", prodi_id)
    if not r:
        raise HTTPException(404, "Data akreditasi prodi tidak ditemukan")
    row = update("akreditasi_prodi", prodi_id, body)
    return ok(row, "Data akreditasi prodi diperbarui")


@router.delete("/prodi/{prodi_id}")
def delete_prodi(prodi_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    r = find_by_id("akreditasi_prodi", prodi_id)
    if not r:
        raise HTTPException(404, "Data akreditasi prodi tidak ditemukan")
    soft_delete("akreditasi_prodi", prodi_id)
    return ok(None, "Data akreditasi prodi dihapus")


# ── Dokumen Akreditasi ────────────────────────────────────────────────────────
@router.get("/dokumen")
def list_dokumen(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    prodi_id: str = Query(""),
    jenis: str = Query(""),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [r for r in read_all("akreditasi_dokumen") if not r.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_D, search)
    if prodi_id: rows = [r for r in rows if r.get("prodi_id") == prodi_id]
    if jenis:    rows = [r for r in rows if r.get("jenis") == jenis]
    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)


@router.post("/dokumen")
def create_dokumen(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    if not body.get("judul"):
        raise HTTPException(400, "Judul dokumen wajib diisi")
    row = insert("akreditasi_dokumen", body)
    return ok(row, "Dokumen berhasil ditambahkan")


@router.put("/dokumen/{dok_id}")
def update_dokumen(dok_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    r = find_by_id("akreditasi_dokumen", dok_id)
    if not r:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    row = update("akreditasi_dokumen", dok_id, body)
    return ok(row, "Dokumen diperbarui")


@router.delete("/dokumen/{dok_id}")
def delete_dokumen(dok_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    r = find_by_id("akreditasi_dokumen", dok_id)
    if not r:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    soft_delete("akreditasi_dokumen", dok_id)
    return ok(None, "Dokumen dihapus")
