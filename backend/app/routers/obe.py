from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.utils.db import read_all, find_by_id, insert, update, soft_delete, paginate

router = APIRouter(prefix="/obe", tags=["OBE"])

def _now():
    return datetime.now(timezone.utc).isoformat()

# ─── STATS ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats():
    cpl      = [c for c in read_all("cpl")           if not c.get("deleted_at")]
    cpmk     = [c for c in read_all("cpmk")          if not c.get("deleted_at")]
    rps      = [r for r in read_all("rps")           if not r.get("deleted_at")]
    penilaian= [p for p in read_all("penilaian_obe") if not p.get("deleted_at")]
    return {
        "success": True,
        "data": {
            "total_cpl":       len(cpl),
            "total_cpmk":      len(cpmk),
            "total_rps":       len(rps),
            "rps_disetujui":   len([r for r in rps if r.get("status") == "disetujui"]),
            "total_penilaian": len(penilaian),
        },
        "message": "OK"
    }

# ─── LAPORAN (static routes — must come before /{id} routes) ──────────────────

@router.get("/laporan/cpl")
def laporan_cpl(prodi_id: Optional[str] = None):
    cpls = [c for c in read_all("cpl") if not c.get("deleted_at")]
    if prodi_id:
        cpls = [c for c in cpls if c.get("prodi_id") == prodi_id]

    penilaian = [p for p in read_all("penilaian_obe") if not p.get("deleted_at")]
    cpmks     = {c["id"]: c for c in read_all("cpmk") if not c.get("deleted_at")}

    hasil = []
    for cpl in cpls:
        cpmk_ids = {cid for c in cpmks.values() if cpl["id"] in (c.get("cpl_ids") or []) for cid in [c["id"]]}
        scores = [
            cs.get("nilai", 0)
            for p in penilaian
            for cs in (p.get("cpmk_scores") or [])
            if cs.get("cpmk_id") in cpmk_ids
        ]
        tercapai = len([s for s in scores if s >= 60])
        hasil.append({
            "cpl_id":       cpl["id"],
            "kode":         cpl.get("kode"),
            "deskripsi":    cpl.get("deskripsi"),
            "ranah":        cpl.get("ranah"),
            "prodi":        cpl.get("prodi_nama"),
            "rata_rata":    round(sum(scores)/len(scores), 2) if scores else 0,
            "total_data":   len(scores),
            "tercapai":     tercapai,
            "pct_tercapai": round(tercapai/len(scores)*100, 1) if scores else 0,
        })
    return {"success": True, "data": hasil, "message": "OK"}


@router.get("/laporan/cpmk")
def laporan_cpmk(mk_id: Optional[str] = None):
    cpmks = [c for c in read_all("cpmk") if not c.get("deleted_at")]
    if mk_id:
        cpmks = [c for c in cpmks if c.get("mk_id") == mk_id]

    penilaian = [p for p in read_all("penilaian_obe") if not p.get("deleted_at")]
    if mk_id:
        penilaian = [p for p in penilaian if p.get("mk_id") == mk_id]

    hasil = []
    for cpmk in cpmks:
        scores = [
            cs.get("nilai", 0)
            for p in penilaian
            for cs in (p.get("cpmk_scores") or [])
            if cs.get("cpmk_id") == cpmk["id"]
        ]
        tercapai = len([s for s in scores if s >= 60])
        hasil.append({
            "cpmk_id":      cpmk["id"],
            "kode":         cpmk.get("kode"),
            "deskripsi":    cpmk.get("deskripsi"),
            "mk_nama":      cpmk.get("mk_nama"),
            "bobot":        cpmk.get("bobot", 0),
            "rata_rata":    round(sum(scores)/len(scores), 2) if scores else 0,
            "total_data":   len(scores),
            "tercapai":     tercapai,
            "pct_tercapai": round(tercapai/len(scores)*100, 1) if scores else 0,
        })
    return {"success": True, "data": hasil, "message": "OK"}

# ─── CPL ──────────────────────────────────────────────────────────────────────

@router.get("/cpl")
def list_cpl(
    prodi_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
):
    data = [c for c in read_all("cpl") if not c.get("deleted_at")]
    if prodi_id:
        data = [c for c in data if c.get("prodi_id") == prodi_id]
    if search:
        q = search.lower()
        data = [c for c in data if q in c.get("kode","").lower()
                or q in c.get("deskripsi","").lower()
                or q in c.get("prodi_nama","").lower()]
    data.sort(key=lambda c: (c.get("prodi_id",""), c.get("kode","")))
    items, meta = paginate(data, page, per_page)
    return {"success": True, "data": items, "message": "OK", "meta": meta}


@router.post("/cpl")
def create_cpl(body: dict):
    for f in ["kode", "prodi_id", "prodi_nama", "deskripsi", "ranah"]:
        if not body.get(f):
            raise HTTPException(400, f"Field '{f}' wajib diisi")
    record = {
        "id":         f"cpl-{uuid.uuid4().hex[:8]}",
        "kode":       body["kode"],
        "prodi_id":   body["prodi_id"],
        "prodi_nama": body["prodi_nama"],
        "deskripsi":  body["deskripsi"],
        "ranah":      body["ranah"],
        "created_at": _now(),
        "deleted_at": None,
    }
    insert("cpl", record)
    return {"success": True, "data": record, "message": "CPL berhasil ditambahkan"}


@router.get("/cpl/{cpl_id}")
def get_cpl(cpl_id: str):
    rec = find_by_id("cpl", cpl_id)
    if not rec:
        raise HTTPException(404, "CPL tidak ditemukan")
    return {"success": True, "data": rec, "message": "OK"}


@router.put("/cpl/{cpl_id}")
def update_cpl(cpl_id: str, body: dict):
    if not find_by_id("cpl", cpl_id):
        raise HTTPException(404, "CPL tidak ditemukan")
    changes = {k: body[k] for k in ["kode","prodi_id","prodi_nama","deskripsi","ranah"] if k in body}
    return {"success": True, "data": update("cpl", cpl_id, changes), "message": "CPL diperbarui"}


@router.delete("/cpl/{cpl_id}")
def delete_cpl(cpl_id: str):
    if not find_by_id("cpl", cpl_id):
        raise HTTPException(404, "CPL tidak ditemukan")
    soft_delete("cpl", cpl_id)
    return {"success": True, "data": None, "message": "CPL dihapus"}

# ─── CPMK ─────────────────────────────────────────────────────────────────────

@router.get("/cpmk")
def list_cpmk(
    mk_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
):
    data = [c for c in read_all("cpmk") if not c.get("deleted_at")]
    if mk_id:
        data = [c for c in data if c.get("mk_id") == mk_id]
    if search:
        q = search.lower()
        data = [c for c in data if q in c.get("kode","").lower()
                or q in c.get("deskripsi","").lower()
                or q in c.get("mk_nama","").lower()]
    items, meta = paginate(data, page, per_page)
    return {"success": True, "data": items, "message": "OK", "meta": meta}


@router.post("/cpmk")
def create_cpmk(body: dict):
    for f in ["kode", "mk_id", "mk_nama", "deskripsi"]:
        if not body.get(f):
            raise HTTPException(400, f"Field '{f}' wajib diisi")
    record = {
        "id":         f"cpmk-{uuid.uuid4().hex[:8]}",
        "kode":       body["kode"],
        "mk_id":      body["mk_id"],
        "mk_nama":    body["mk_nama"],
        "cpl_ids":    body.get("cpl_ids", []),
        "deskripsi":  body["deskripsi"],
        "bobot":      int(body.get("bobot", 0)),
        "created_at": _now(),
        "deleted_at": None,
    }
    insert("cpmk", record)
    return {"success": True, "data": record, "message": "CPMK berhasil ditambahkan"}


@router.get("/cpmk/{cpmk_id}")
def get_cpmk(cpmk_id: str):
    rec = find_by_id("cpmk", cpmk_id)
    if not rec:
        raise HTTPException(404, "CPMK tidak ditemukan")
    return {"success": True, "data": rec, "message": "OK"}


@router.put("/cpmk/{cpmk_id}")
def update_cpmk(cpmk_id: str, body: dict):
    if not find_by_id("cpmk", cpmk_id):
        raise HTTPException(404, "CPMK tidak ditemukan")
    changes = {k: body[k] for k in ["kode","mk_id","mk_nama","cpl_ids","deskripsi","bobot"] if k in body}
    return {"success": True, "data": update("cpmk", cpmk_id, changes), "message": "CPMK diperbarui"}


@router.delete("/cpmk/{cpmk_id}")
def delete_cpmk(cpmk_id: str):
    if not find_by_id("cpmk", cpmk_id):
        raise HTTPException(404, "CPMK tidak ditemukan")
    soft_delete("cpmk", cpmk_id)
    return {"success": True, "data": None, "message": "CPMK dihapus"}

# ─── RPS ──────────────────────────────────────────────────────────────────────

@router.get("/rps")
def list_rps(
    mk_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    data = [r for r in read_all("rps") if not r.get("deleted_at")]
    if mk_id:
        data = [r for r in data if r.get("mk_id") == mk_id]
    if status:
        data = [r for r in data if r.get("status") == status]
    if search:
        q = search.lower()
        data = [r for r in data if q in r.get("mk_nama","").lower()
                or q in r.get("dosen_nama","").lower()
                or q in r.get("semester","").lower()]
    data.sort(key=lambda r: r.get("created_at",""), reverse=True)
    items, meta = paginate(data, page, per_page)
    return {"success": True, "data": items, "message": "OK", "meta": meta}


@router.post("/rps")
def create_rps(body: dict):
    for f in ["mk_id", "mk_nama", "semester", "dosen_id", "dosen_nama"]:
        if not body.get(f):
            raise HTTPException(400, f"Field '{f}' wajib diisi")
    pertemuan = body.get("pertemuan") or [
        {"minggu": i, "topik": "", "subtopik": "", "metode": "ceramah",
         "cpmk_ids": [], "assessment": "", "media": "", "durasi": 150}
        for i in range(1, 17)
    ]
    record = {
        "id":           f"rps-{uuid.uuid4().hex[:8]}",
        "mk_id":        body["mk_id"],
        "mk_nama":      body["mk_nama"],
        "mk_kode":      body.get("mk_kode", ""),
        "sks":          int(body.get("sks", 3)),
        "semester":     body["semester"],
        "dosen_id":     body["dosen_id"],
        "dosen_nama":   body["dosen_nama"],
        "status":       body.get("status", "draft"),
        "deskripsi_mk": body.get("deskripsi_mk", ""),
        "tujuan_mk":    body.get("tujuan_mk", ""),
        "referensi":    body.get("referensi", []),
        "pertemuan":    pertemuan,
        "created_at":   _now(),
        "deleted_at":   None,
    }
    insert("rps", record)
    return {"success": True, "data": record, "message": "RPS berhasil dibuat"}


@router.get("/rps/{rps_id}")
def get_rps(rps_id: str):
    rec = find_by_id("rps", rps_id)
    if not rec:
        raise HTTPException(404, "RPS tidak ditemukan")
    return {"success": True, "data": rec, "message": "OK"}


@router.put("/rps/{rps_id}")
def update_rps(rps_id: str, body: dict):
    if not find_by_id("rps", rps_id):
        raise HTTPException(404, "RPS tidak ditemukan")
    updatable = ["mk_id","mk_nama","mk_kode","sks","semester","dosen_id","dosen_nama",
                 "status","deskripsi_mk","tujuan_mk","referensi","pertemuan"]
    changes = {k: body[k] for k in updatable if k in body}
    return {"success": True, "data": update("rps", rps_id, changes), "message": "RPS diperbarui"}


@router.delete("/rps/{rps_id}")
def delete_rps(rps_id: str):
    if not find_by_id("rps", rps_id):
        raise HTTPException(404, "RPS tidak ditemukan")
    soft_delete("rps", rps_id)
    return {"success": True, "data": None, "message": "RPS dihapus"}

# ─── PENILAIAN OBE ────────────────────────────────────────────────────────────

def _hitung_nilai_akhir(cpmk_scores: list) -> float:
    cpmks = {c["id"]: c for c in read_all("cpmk") if not c.get("deleted_at")}
    total_bobot, total_nilai = 0, 0
    for cs in cpmk_scores:
        bobot = cpmks.get(cs.get("cpmk_id"), {}).get("bobot", 0) or 0
        total_bobot += bobot
        total_nilai  += cs.get("nilai", 0) * bobot
        cs["tercapai"] = cs.get("nilai", 0) >= 60
    return round(total_nilai / total_bobot, 2) if total_bobot > 0 else 0


@router.get("/penilaian")
def list_penilaian(
    mk_id: Optional[str] = None,
    mahasiswa_id: Optional[str] = None,
    semester: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    data = [p for p in read_all("penilaian_obe") if not p.get("deleted_at")]
    if mk_id:
        data = [p for p in data if p.get("mk_id") == mk_id]
    if mahasiswa_id:
        data = [p for p in data if p.get("mahasiswa_id") == mahasiswa_id]
    if semester:
        data = [p for p in data if p.get("semester") == semester]
    if search:
        q = search.lower()
        data = [p for p in data if q in p.get("mahasiswa_nama","").lower()
                or q in p.get("mahasiswa_nim","").lower()
                or q in p.get("mk_nama","").lower()]
    data.sort(key=lambda p: p.get("created_at",""), reverse=True)
    items, meta = paginate(data, page, per_page)
    return {"success": True, "data": items, "message": "OK", "meta": meta}


@router.post("/penilaian")
def create_penilaian(body: dict):
    for f in ["mahasiswa_id","mahasiswa_nama","mahasiswa_nim","mk_id","mk_nama","semester","cpmk_scores"]:
        if not body.get(f):
            raise HTTPException(400, f"Field '{f}' wajib diisi")
    scores = body["cpmk_scores"]
    nilai_akhir = _hitung_nilai_akhir(scores)
    record = {
        "id":             f"nobe-{uuid.uuid4().hex[:8]}",
        "mahasiswa_id":   body["mahasiswa_id"],
        "mahasiswa_nama": body["mahasiswa_nama"],
        "mahasiswa_nim":  body["mahasiswa_nim"],
        "mk_id":          body["mk_id"],
        "mk_nama":        body["mk_nama"],
        "semester":       body["semester"],
        "cpmk_scores":    scores,
        "nilai_akhir":    nilai_akhir,
        "created_at":     _now(),
        "deleted_at":     None,
    }
    insert("penilaian_obe", record)
    return {"success": True, "data": record, "message": "Penilaian OBE berhasil disimpan"}


@router.get("/penilaian/{nilai_id}")
def get_penilaian(nilai_id: str):
    rec = find_by_id("penilaian_obe", nilai_id)
    if not rec:
        raise HTTPException(404, "Data penilaian tidak ditemukan")
    return {"success": True, "data": rec, "message": "OK"}


@router.put("/penilaian/{nilai_id}")
def update_penilaian(nilai_id: str, body: dict):
    if not find_by_id("penilaian_obe", nilai_id):
        raise HTTPException(404, "Data penilaian tidak ditemukan")
    changes = {}
    if "cpmk_scores" in body:
        scores = body["cpmk_scores"]
        changes["cpmk_scores"] = scores
        changes["nilai_akhir"] = _hitung_nilai_akhir(scores)
    if "semester" in body:
        changes["semester"] = body["semester"]
    return {"success": True, "data": update("penilaian_obe", nilai_id, changes), "message": "Penilaian OBE diperbarui"}


@router.delete("/penilaian/{nilai_id}")
def delete_penilaian(nilai_id: str):
    if not find_by_id("penilaian_obe", nilai_id):
        raise HTTPException(404, "Data penilaian tidak ditemukan")
    soft_delete("penilaian_obe", nilai_id)
    return {"success": True, "data": None, "message": "Data penilaian dihapus"}
