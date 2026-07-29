from fastapi import APIRouter, Query, HTTPException
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate

router = APIRouter(prefix="/kepegawaian", tags=["Kepegawaian"])

_STATUS = ("tetap", "kontrak", "honorer")
_SEARCH = ["nip", "nama", "jabatan", "unit_kerja", "pendidikan_terakhir"]


# ── Stats ─────────────────────────────────────────────────────────────────────
@router.get("/stats")
def get_stats():
    rows = [r for r in read_all("pegawai") if not r.get("deleted_at")]
    return {
        "success": True,
        "data": {
            "total_pegawai": len(rows),
            "tetap":         sum(1 for r in rows if r.get("status_kepegawaian") == "tetap"),
            "kontrak":       sum(1 for r in rows if r.get("status_kepegawaian") == "kontrak"),
            "honorer":       sum(1 for r in rows if r.get("status_kepegawaian") == "honorer"),
            "total_gaji":    sum((r.get("gaji_pokok") or 0) + (r.get("tunjangan") or 0) for r in rows),
            "unit_kerja":    len(set(r.get("unit_kerja", "") for r in rows if r.get("unit_kerja"))),
        },
        "message": "Berhasil", "meta": None,
    }


# ── List ──────────────────────────────────────────────────────────────────────
@router.get("/pegawai")
def list_pegawai(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    status_kepegawaian: str = Query(""),
    unit_kerja: str = Query(""),
):
    rows = [r for r in read_all("pegawai") if not r.get("deleted_at")]
    rows = search_rows(rows, _SEARCH, search)
    if status_kepegawaian:
        rows = [r for r in rows if r.get("status_kepegawaian") == status_kepegawaian]
    if unit_kerja:
        rows = [r for r in rows if r.get("unit_kerja", "").lower() == unit_kerja.lower()]
    rows.sort(key=lambda x: x.get("nama", ""))
    items, meta = paginate(rows, page, per_page)
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


# ── CRUD ──────────────────────────────────────────────────────────────────────
@router.post("/pegawai")
def create_pegawai(body: dict):
    if not body.get("nip") or not body.get("nama"):
        raise HTTPException(400, "NIP dan nama wajib diisi")
    existing = [r for r in read_all("pegawai") if not r.get("deleted_at") and r.get("nip") == body["nip"]]
    if existing:
        raise HTTPException(400, "NIP sudah terdaftar")
    body.setdefault("status_kepegawaian", "tetap")
    row = insert("pegawai", body)
    return {"success": True, "data": row, "message": "Pegawai berhasil ditambahkan", "meta": None}


@router.get("/pegawai/{pegawai_id}")
def get_pegawai(pegawai_id: str):
    r = find_by_id("pegawai", pegawai_id)
    if not r: raise HTTPException(404, "Pegawai tidak ditemukan")
    return {"success": True, "data": r, "message": "Berhasil", "meta": None}


@router.put("/pegawai/{pegawai_id}")
def update_pegawai(pegawai_id: str, body: dict):
    r = find_by_id("pegawai", pegawai_id)
    if not r: raise HTTPException(404, "Pegawai tidak ditemukan")
    if "nip" in body and body["nip"] != r["nip"]:
        dup = [x for x in read_all("pegawai") if not x.get("deleted_at") and x["id"] != pegawai_id and x.get("nip") == body["nip"]]
        if dup: raise HTTPException(400, "NIP sudah digunakan pegawai lain")
    row = update("pegawai", pegawai_id, body)
    return {"success": True, "data": row, "message": "Data pegawai diperbarui", "meta": None}


@router.delete("/pegawai/{pegawai_id}")
def delete_pegawai(pegawai_id: str):
    r = find_by_id("pegawai", pegawai_id)
    if not r: raise HTTPException(404, "Pegawai tidak ditemukan")
    soft_delete("pegawai", pegawai_id)
    return {"success": True, "data": None, "message": "Data pegawai dihapus", "meta": None}
