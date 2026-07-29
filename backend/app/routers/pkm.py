from fastapi import APIRouter, Query, HTTPException, Header
from datetime import datetime
from app.utils.db import (
    read_all, find_by_id, insert, update, soft_delete,
    search_rows, paginate,
)
from app.utils.dev import get_user_from_request, check_role, get_dosen_for_user

router = APIRouter(prefix="/pkm", tags=["PKM"])

LPPM_ADMIN = ["super_admin", "admin_akademik", "lppm", "staf"]
DOSEN_LPPM_ADMIN = ["super_admin", "admin_akademik", "lppm", "kaprodi", "dosen", "staf"]

_SEARCH_P = ["judul", "ketua_nama", "skema", "lokasi", "mitra"]
_SEARCH_L = ["judul", "jenis", "ketua_nama", "pkm_judul"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def _is_member(p: dict, dosen_id: str) -> bool:
    return p.get("ketua_id") == dosen_id or any(
        a.get("id") == dosen_id for a in p.get("anggota", [])
    )


# ── Stats ─────────────────────────────────────────────────────────────────────
@router.get("/stats")
def get_stats(authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    rows   = [p for p in read_all("pkm")         if not p.get("deleted_at")]
    luaran = [l for l in read_all("luaran_pkm")  if not l.get("deleted_at")]
    return ok({
        "total_pkm":          len(rows),
        "aktif":              sum(1 for p in rows   if p.get("status") == "aktif"),
        "selesai":            sum(1 for p in rows   if p.get("status") == "selesai"),
        "total_luaran":       len(luaran),
        "luaran_tervalidasi": sum(1 for l in luaran if l.get("status_validasi") == "tervalidasi"),
        "total_dana":         sum(p.get("dana_disetujui") or 0 for p in rows),
    })


# ── PKM List ──────────────────────────────────────────────────────────────────
@router.get("")
def list_pkm(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    status: str = Query(""),
    skema: str = Query(""),
    tahun: str = Query(""),
    dosen_id: str = Query(""),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    rows = [p for p in read_all("pkm") if not p.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_P, search)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if skema:
        rows = [r for r in rows if r.get("skema") == skema]
    if tahun:
        rows = [r for r in rows if str(r.get("tahun", "")) == tahun]

    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        rows = [r for r in rows if _is_member(r, did)]
    elif dosen_id:
        rows = [r for r in rows if _is_member(r, dosen_id)]

    luaran_all = [l for l in read_all("luaran_pkm") if not l.get("deleted_at")]
    for p in rows:
        p["jumlah_luaran"] = sum(1 for l in luaran_all if l.get("pkm_id") == p["id"])

    rows.sort(key=lambda x: (x.get("tahun", 0), x.get("created_at", "")), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)


# ── PKM CRUD ──────────────────────────────────────────────────────────────────
@router.post("")
def create_pkm(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_LPPM_ADMIN)
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        if d:
            body.setdefault("ketua_id", d["id"])
            body.setdefault("ketua_nama", d.get("nama_lengkap", ""))
    body.setdefault("status", "draft")
    body.setdefault("laporan_kemajuan_persen", 0)
    body.setdefault("anggota", [])
    row = insert("pkm", body)
    return ok(row, "PKM berhasil dibuat")


@router.get("/{pkm_id}")
def get_pkm(pkm_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    p = find_by_id("pkm", pkm_id)
    if not p:
        raise HTTPException(404, "PKM tidak ditemukan")
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if not _is_member(p, did):
            raise HTTPException(403, "Akses ditolak")
    luaran = [l for l in read_all("luaran_pkm")
              if not l.get("deleted_at") and l.get("pkm_id") == pkm_id]
    p["luaran"] = luaran
    return ok(p)


@router.put("/{pkm_id}")
def update_pkm(pkm_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_LPPM_ADMIN)
    p = find_by_id("pkm", pkm_id)
    if not p:
        raise HTTPException(404, "PKM tidak ditemukan")
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if p.get("ketua_id") != did:
            raise HTTPException(403, "Hanya ketua PKM yang dapat mengubah data")
    if p.get("status") in ("selesai", "ditolak"):
        raise HTTPException(400, "PKM yang sudah final tidak dapat diubah")
    row = update("pkm", pkm_id, body)
    return ok(row, "PKM diperbarui")


@router.delete("/{pkm_id}")
def delete_pkm(pkm_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_LPPM_ADMIN)
    p = find_by_id("pkm", pkm_id)
    if not p:
        raise HTTPException(404, "PKM tidak ditemukan")
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if p.get("ketua_id") != did:
            raise HTTPException(403, "Hanya ketua PKM yang dapat menghapus")
    if p.get("status") not in ("draft",):
        raise HTTPException(400, "Hanya PKM berstatus draft yang dapat dihapus")
    soft_delete("pkm", pkm_id)
    return ok(None, "PKM dihapus")


# ── Status Transitions ────────────────────────────────────────────────────────
@router.post("/{pkm_id}/ajukan")
def ajukan(pkm_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_LPPM_ADMIN)
    p = find_by_id("pkm", pkm_id)
    if not p:
        raise HTTPException(404, "PKM tidak ditemukan")
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if p.get("ketua_id") != did:
            raise HTTPException(403, "Hanya ketua PKM yang dapat mengajukan")
    if p.get("status") != "draft":
        raise HTTPException(400, "Hanya PKM draft yang dapat diajukan")
    row = update("pkm", pkm_id, {"status": "diajukan"})
    return ok(row, "PKM diajukan ke LPPM")


@router.post("/{pkm_id}/setujui")
def setujui(pkm_id: str, body: dict = {}, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, LPPM_ADMIN)
    p = find_by_id("pkm", pkm_id)
    if not p:
        raise HTTPException(404, "PKM tidak ditemukan")
    if p.get("status") != "diajukan":
        raise HTTPException(400, "PKM harus berstatus diajukan untuk disetujui")

    skema = p.get("skema")
    tahun = p.get("tahun")
    ketua = p.get("ketua_id")
    konflik = [x for x in read_all("pkm")
               if not x.get("deleted_at") and x["id"] != pkm_id
               and x.get("status") == "aktif"
               and x.get("skema") == skema
               and x.get("tahun") == tahun
               and x.get("ketua_id") == ketua]
    if konflik:
        raise HTTPException(400,
            f"Dosen sudah memiliki PKM aktif pada skema '{skema}' tahun {tahun}")

    row = update("pkm", pkm_id, {
        "status": "aktif",
        "dana_disetujui": body.get("dana_disetujui", p.get("dana_diajukan")),
        "tgl_mulai":  body.get("tgl_mulai", datetime.now().strftime("%Y-%m-%d")),
        "tgl_selesai": body.get("tgl_selesai", f"{p.get('tahun', datetime.now().year)}-12-31"),
    })
    return ok(row, "PKM disetujui dan aktif")


@router.post("/{pkm_id}/tolak")
def tolak(pkm_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, LPPM_ADMIN)
    p = find_by_id("pkm", pkm_id)
    if not p:
        raise HTTPException(404, "PKM tidak ditemukan")
    if p.get("status") not in ("diajukan",):
        raise HTTPException(400, "Hanya PKM yang sedang diajukan yang dapat ditolak")
    if not body.get("catatan"):
        raise HTTPException(400, "Alasan penolakan wajib diisi")
    row = update("pkm", pkm_id, {"status": "ditolak", "catatan": body["catatan"]})
    return ok(row, "PKM ditolak")


@router.post("/{pkm_id}/selesaikan")
def selesaikan(pkm_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_LPPM_ADMIN)
    p = find_by_id("pkm", pkm_id)
    if not p:
        raise HTTPException(404, "PKM tidak ditemukan")
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if p.get("ketua_id") != did:
            raise HTTPException(403, "Hanya ketua PKM yang dapat menyelesaikan")
    if p.get("status") != "aktif":
        raise HTTPException(400, "Hanya PKM aktif yang dapat diselesaikan")
    if (p.get("laporan_kemajuan_persen") or 0) < 100:
        raise HTTPException(400, "Laporan kemajuan harus 100% sebelum PKM dapat diselesaikan")
    row = update("pkm", pkm_id, {"status": "selesai"})
    return ok(row, "PKM diselesaikan")


@router.patch("/{pkm_id}/laporan")
def update_laporan(pkm_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_LPPM_ADMIN)
    p = find_by_id("pkm", pkm_id)
    if not p:
        raise HTTPException(404, "PKM tidak ditemukan")
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if p.get("ketua_id") != did:
            raise HTTPException(403, "Hanya ketua PKM yang dapat memperbarui laporan")
    if p.get("status") != "aktif":
        raise HTTPException(400, "Laporan hanya bisa diupdate saat PKM aktif")
    persen = body.get("laporan_kemajuan_persen", 0)
    if not (0 <= persen <= 100):
        raise HTTPException(400, "Persentase laporan harus 0-100")
    row = update("pkm", pkm_id, {"laporan_kemajuan_persen": persen})
    return ok(row, f"Laporan kemajuan diperbarui: {persen}%")


# ── Luaran ────────────────────────────────────────────────────────────────────
@router.get("/luaran/list")
def list_luaran(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    pkm_id: str = Query(""),
    jenis: str = Query(""),
    status_validasi: str = Query(""),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [l for l in read_all("luaran_pkm") if not l.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_L, search)
    if pkm_id:
        rows = [r for r in rows if r.get("pkm_id") == pkm_id]
    if jenis:
        rows = [r for r in rows if r.get("jenis") == jenis]
    if status_validasi:
        rows = [r for r in rows if r.get("status_validasi") == status_validasi]
    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)


@router.post("/{pkm_id}/luaran")
def create_luaran(pkm_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_LPPM_ADMIN)
    p = find_by_id("pkm", pkm_id)
    if not p:
        raise HTTPException(404, "PKM tidak ditemukan")
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if not _is_member(p, did):
            raise HTTPException(403, "Hanya anggota PKM yang dapat menambahkan luaran")
    body["pkm_id"]    = pkm_id
    body["pkm_judul"] = p.get("judul", "")[:60]
    body["ketua_nama"] = p.get("ketua_nama", "")
    body.setdefault("status_validasi", "menunggu_validasi")
    row = insert("luaran_pkm", body)
    return ok(row, "Luaran berhasil ditambahkan")


@router.put("/luaran/{luaran_id}")
def update_luaran(luaran_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_LPPM_ADMIN)
    l = find_by_id("luaran_pkm", luaran_id)
    if not l:
        raise HTTPException(404, "Luaran tidak ditemukan")
    if user.get("role") == "dosen":
        p = find_by_id("pkm", l.get("pkm_id", ""))
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if not p or not _is_member(p, did):
            raise HTTPException(403, "Akses ditolak")
    if l.get("status_validasi") == "tervalidasi":
        raise HTTPException(400, "Luaran yang sudah tervalidasi tidak dapat diubah")
    row = update("luaran_pkm", luaran_id, body)
    return ok(row, "Luaran diperbarui")


@router.delete("/luaran/{luaran_id}")
def delete_luaran(luaran_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_LPPM_ADMIN)
    l = find_by_id("luaran_pkm", luaran_id)
    if not l:
        raise HTTPException(404, "Luaran tidak ditemukan")
    if user.get("role") == "dosen":
        p = find_by_id("pkm", l.get("pkm_id", ""))
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if not p or not _is_member(p, did):
            raise HTTPException(403, "Akses ditolak")
    if l.get("status_validasi") == "tervalidasi":
        raise HTTPException(400, "Luaran yang sudah tervalidasi tidak dapat dihapus")
    soft_delete("luaran_pkm", luaran_id)
    return ok(None, "Luaran dihapus")


@router.post("/luaran/{luaran_id}/validasi")
def validasi_luaran(luaran_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, LPPM_ADMIN)
    l = find_by_id("luaran_pkm", luaran_id)
    if not l:
        raise HTTPException(404, "Luaran tidak ditemukan")
    status = body.get("status_validasi")
    if status not in ("tervalidasi", "ditolak"):
        raise HTTPException(400, "Status validasi harus 'tervalidasi' atau 'ditolak'")
    if status == "ditolak" and not body.get("catatan_lppm"):
        raise HTTPException(400, "Catatan LPPM wajib diisi jika ditolak")
    row = update("luaran_pkm", luaran_id, {
        "status_validasi": status,
        "catatan_lppm": body.get("catatan_lppm", ""),
    })
    return ok(row, f"Luaran {status}")
