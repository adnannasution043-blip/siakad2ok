from fastapi import APIRouter, Query, HTTPException, Header
from datetime import datetime
from app.utils.db import (
    read_all, find_by_id, insert, update, soft_delete,
    search_rows, filter_rows, paginate,
)
from app.utils.dev import get_user_from_request, check_role

router = APIRouter(prefix="/pmb", tags=["PMB"])

PMB_ADMIN = ["super_admin", "admin_pmb", "staf"]

_STATUS_GELOMBANG = ("draft", "buka", "seleksi", "selesai")
_STATUS_PENDAFTAR = ("menunggu", "lulus_seleksi", "tidak_lulus", "diterima", "mundur")
_SEARCH_FIELDS_G = ["nama", "tahun_akademik", "jalur"]
_SEARCH_FIELDS_P = ["nama", "no_daftar", "asal_sekolah", "email", "no_hp",
                    "pilihan_prodi_1_nama", "pilihan_prodi_2_nama"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}


# ── Stats ─────────────────────────────────────────────────────────────────────
@router.get("/stats")
def get_stats(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PMB_ADMIN)
    gelombang = [g for g in read_all("gelombang_pmb") if not g.get("deleted_at")]
    pendaftar = [p for p in read_all("pendaftar_pmb") if not p.get("deleted_at")]
    return ok({
        "total_gelombang":  len(gelombang),
        "gelombang_buka":   sum(1 for g in gelombang if g.get("status") == "buka"),
        "total_pendaftar":  len(pendaftar),
        "lulus_seleksi":    sum(1 for p in pendaftar if p.get("status_seleksi") in ("lulus_seleksi", "diterima")),
        "diterima":         sum(1 for p in pendaftar if p.get("status_seleksi") == "diterima"),
        "mundur":           sum(1 for p in pendaftar if p.get("status_seleksi") == "mundur"),
    })


# ── Gelombang List ────────────────────────────────────────────────────────────
@router.get("/gelombang")
def list_gelombang(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    status: str = Query(""),
    tahun_akademik: str = Query(""),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [g for g in read_all("gelombang_pmb") if not g.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_FIELDS_G, search)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if tahun_akademik:
        rows = [r for r in rows if r.get("tahun_akademik") == tahun_akademik]

    pendaftar_all = [p for p in read_all("pendaftar_pmb") if not p.get("deleted_at")]
    for g in rows:
        gid = g["id"]
        pts = [p for p in pendaftar_all if p.get("gelombang_id") == gid]
        g["jumlah_pendaftar"] = len(pts)
        g["jumlah_diterima"] = sum(1 for p in pts if p.get("status_seleksi") == "diterima")

    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)


# ── Gelombang CRUD ────────────────────────────────────────────────────────────
@router.post("/gelombang")
def create_gelombang(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PMB_ADMIN)
    body.setdefault("status", "draft")
    body.setdefault("diterima", 0)
    if body.get("status") not in _STATUS_GELOMBANG:
        raise HTTPException(400, "Status tidak valid")
    row = insert("gelombang_pmb", body)
    return ok(row, "Gelombang berhasil dibuat")


@router.get("/gelombang/{gelombang_id}")
def get_gelombang(gelombang_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    g = find_by_id("gelombang_pmb", gelombang_id)
    if not g:
        raise HTTPException(404, "Gelombang tidak ditemukan")
    pendaftar_all = [p for p in read_all("pendaftar_pmb") if not p.get("deleted_at")]
    pts = [p for p in pendaftar_all if p.get("gelombang_id") == gelombang_id]
    g["jumlah_pendaftar"] = len(pts)
    g["jumlah_diterima"] = sum(1 for p in pts if p.get("status_seleksi") == "diterima")
    return ok(g)


@router.put("/gelombang/{gelombang_id}")
def update_gelombang(gelombang_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PMB_ADMIN)
    g = find_by_id("gelombang_pmb", gelombang_id)
    if not g:
        raise HTTPException(404, "Gelombang tidak ditemukan")
    if body.get("status") and body["status"] not in _STATUS_GELOMBANG:
        raise HTTPException(400, "Status tidak valid")
    row = update("gelombang_pmb", gelombang_id, body)
    return ok(row, "Gelombang berhasil diperbarui")


@router.delete("/gelombang/{gelombang_id}")
def delete_gelombang(gelombang_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PMB_ADMIN)
    g = find_by_id("gelombang_pmb", gelombang_id)
    if not g:
        raise HTTPException(404, "Gelombang tidak ditemukan")
    if g.get("status") != "draft":
        raise HTTPException(400, "Hanya gelombang berstatus draft yang dapat dihapus")
    soft_delete("gelombang_pmb", gelombang_id)
    return ok(None, "Gelombang berhasil dihapus")


# ── Gelombang Status Transitions ──────────────────────────────────────────────
@router.post("/gelombang/{gelombang_id}/buka")
def buka_gelombang(gelombang_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PMB_ADMIN)
    g = find_by_id("gelombang_pmb", gelombang_id)
    if not g:
        raise HTTPException(404, "Gelombang tidak ditemukan")
    if g.get("status") not in ("draft", "seleksi"):
        raise HTTPException(400, f"Tidak bisa membuka dari status '{g.get('status')}'")
    row = update("gelombang_pmb", gelombang_id, {"status": "buka"})
    return ok(row, "Gelombang dibuka")


@router.post("/gelombang/{gelombang_id}/tutup")
def tutup_gelombang(gelombang_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PMB_ADMIN)
    g = find_by_id("gelombang_pmb", gelombang_id)
    if not g:
        raise HTTPException(404, "Gelombang tidak ditemukan")
    if g.get("status") != "buka":
        raise HTTPException(400, "Gelombang harus berstatus buka untuk ditutup ke seleksi")
    row = update("gelombang_pmb", gelombang_id, {"status": "seleksi"})
    return ok(row, "Pendaftaran ditutup, masuk fase seleksi")


@router.post("/gelombang/{gelombang_id}/selesaikan")
def selesaikan_gelombang(gelombang_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PMB_ADMIN)
    g = find_by_id("gelombang_pmb", gelombang_id)
    if not g:
        raise HTTPException(404, "Gelombang tidak ditemukan")
    if g.get("status") != "seleksi":
        raise HTTPException(400, "Gelombang harus berstatus seleksi untuk diselesaikan")
    row = update("gelombang_pmb", gelombang_id, {"status": "selesai"})
    return ok(row, "Gelombang diselesaikan")


# ── Pendaftar List ────────────────────────────────────────────────────────────
@router.get("/pendaftar")
def list_pendaftar(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    gelombang_id: str = Query(""),
    status_seleksi: str = Query(""),
    jalur: str = Query(""),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    check_role(user, PMB_ADMIN)
    rows = [p for p in read_all("pendaftar_pmb") if not p.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_FIELDS_P, search)
    if gelombang_id:
        rows = [r for r in rows if r.get("gelombang_id") == gelombang_id]
    if status_seleksi:
        rows = [r for r in rows if r.get("status_seleksi") == status_seleksi]
    if jalur:
        rows = [r for r in rows if r.get("jalur") == jalur]
    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)


# ── Pendaftar CRUD ────────────────────────────────────────────────────────────
@router.post("/pendaftar")
def create_pendaftar(body: dict, authorization: str = Header(default="dev")):
    # Public registration — any authenticated user (or unauthenticated via dev token)
    get_user_from_request(authorization)
    body.setdefault("status_seleksi", "menunggu")
    body.setdefault("tgl_daftar", datetime.now().isoformat())

    all_p = read_all("pendaftar_pmb")
    tahun = body.get("tahun_akademik", datetime.now().year)
    count = sum(1 for p in all_p if not p.get("deleted_at") and
                str(p.get("tgl_daftar", ""))[:4] == str(tahun)[:4])
    body["no_daftar"] = f"PMB-{str(tahun)[:4]}-{str(count+1).zfill(3)}"

    row = insert("pendaftar_pmb", body)
    return ok(row, "Pendaftar berhasil ditambahkan")


@router.get("/pendaftar/{pendaftar_id}")
def get_pendaftar(pendaftar_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PMB_ADMIN)
    p = find_by_id("pendaftar_pmb", pendaftar_id)
    if not p:
        raise HTTPException(404, "Pendaftar tidak ditemukan")
    return ok(p)


@router.put("/pendaftar/{pendaftar_id}")
def update_pendaftar(pendaftar_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PMB_ADMIN)
    p = find_by_id("pendaftar_pmb", pendaftar_id)
    if not p:
        raise HTTPException(404, "Pendaftar tidak ditemukan")
    if p.get("status_seleksi") in ("diterima", "tidak_lulus"):
        raise HTTPException(400, "Pendaftar yang sudah diputuskan tidak dapat diubah")
    row = update("pendaftar_pmb", pendaftar_id, body)
    return ok(row, "Data pendaftar diperbarui")


@router.delete("/pendaftar/{pendaftar_id}")
def delete_pendaftar(pendaftar_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PMB_ADMIN)
    p = find_by_id("pendaftar_pmb", pendaftar_id)
    if not p:
        raise HTTPException(404, "Pendaftar tidak ditemukan")
    soft_delete("pendaftar_pmb", pendaftar_id)
    return ok(None, "Data pendaftar dihapus")


# ── Update Status Seleksi ─────────────────────────────────────────────────────
@router.post("/pendaftar/{pendaftar_id}/update-status")
def update_status_seleksi(pendaftar_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, PMB_ADMIN)
    p = find_by_id("pendaftar_pmb", pendaftar_id)
    if not p:
        raise HTTPException(404, "Pendaftar tidak ditemukan")
    new_status = body.get("status_seleksi")
    if new_status not in _STATUS_PENDAFTAR:
        raise HTTPException(400, "Status tidak valid")
    updates = {
        "status_seleksi": new_status,
        "catatan": body.get("catatan", p.get("catatan", "")),
        "tgl_seleksi": datetime.now().isoformat(),
    }
    row = update("pendaftar_pmb", pendaftar_id, updates)
    return ok(row, f"Status diperbarui menjadi {new_status}")
