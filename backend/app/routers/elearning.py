from fastapi import APIRouter, Query, HTTPException
from app.utils.db import (
    read_all, find_by_id, insert, update, soft_delete,
    search_rows, paginate,
)

router = APIRouter(prefix="/elearning", tags=["E-Learning"])

_SEARCH_K = ["mata_kuliah_nama", "dosen_nama", "tahun_akademik", "deskripsi"]
_SEARCH_M = ["judul", "tipe", "deskripsi"]
_SEARCH_E = ["mahasiswa_nama", "mahasiswa_nim", "mata_kuliah_nama"]


# ── Stats ─────────────────────────────────────────────────────────────────────
@router.get("/stats")
def get_stats():
    kursus     = [k for k in read_all("kursus_elearning")     if not k.get("deleted_at")]
    materi     = [m for m in read_all("materi_elearning")     if not m.get("deleted_at")]
    enrollment = [e for e in read_all("enrollment_elearning") if not e.get("deleted_at")]
    return {
        "success": True,
        "data": {
            "total_kursus":    len(kursus),
            "kursus_published": sum(1 for k in kursus if k.get("status") == "published"),
            "total_materi":    len(materi),
            "total_peserta":   len(enrollment),
            "peserta_selesai": sum(1 for e in enrollment if e.get("status") == "selesai"),
            "rata_progress":   round(
                sum(e.get("progress_persen", 0) for e in enrollment) / len(enrollment), 1
            ) if enrollment else 0,
        },
        "message": "Berhasil",
        "meta": None,
    }


# ── Kursus List ───────────────────────────────────────────────────────────────
@router.get("/kursus")
def list_kursus(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    status: str = Query(""),
    tahun_akademik: str = Query(""),
    dosen_id: str = Query(""),
):
    rows = [k for k in read_all("kursus_elearning") if not k.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_K, search)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if tahun_akademik:
        rows = [r for r in rows if r.get("tahun_akademik") == tahun_akademik]
    if dosen_id:
        rows = [r for r in rows if r.get("dosen_id") == dosen_id]

    # Enrich live counts
    materi_all     = [m for m in read_all("materi_elearning")     if not m.get("deleted_at")]
    enrollment_all = [e for e in read_all("enrollment_elearning") if not e.get("deleted_at")]
    for k in rows:
        kid = k["id"]
        k["jumlah_materi"]  = sum(1 for m in materi_all     if m.get("kursus_id") == kid)
        k["jumlah_peserta"] = sum(1 for e in enrollment_all if e.get("kursus_id") == kid)

    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


# ── Kursus CRUD ───────────────────────────────────────────────────────────────
@router.post("/kursus")
def create_kursus(body: dict):
    body.setdefault("status", "draft")
    body.setdefault("jumlah_materi", 0)
    body.setdefault("jumlah_peserta", 0)
    row = insert("kursus_elearning", body)
    return {"success": True, "data": row, "message": "Kursus berhasil dibuat", "meta": None}


@router.get("/kursus/{kursus_id}")
def get_kursus(kursus_id: str):
    k = find_by_id("kursus_elearning", kursus_id)
    if not k:
        raise HTTPException(404, "Kursus tidak ditemukan")
    return {"success": True, "data": k, "message": "Berhasil", "meta": None}


@router.put("/kursus/{kursus_id}")
def update_kursus(kursus_id: str, body: dict):
    k = find_by_id("kursus_elearning", kursus_id)
    if not k:
        raise HTTPException(404, "Kursus tidak ditemukan")
    row = update("kursus_elearning", kursus_id, body)
    return {"success": True, "data": row, "message": "Kursus diperbarui", "meta": None}


@router.delete("/kursus/{kursus_id}")
def delete_kursus(kursus_id: str):
    k = find_by_id("kursus_elearning", kursus_id)
    if not k:
        raise HTTPException(404, "Kursus tidak ditemukan")
    if k.get("status") == "published":
        raise HTTPException(400, "Kursus yang sudah published tidak dapat dihapus, arsipkan dulu")
    soft_delete("kursus_elearning", kursus_id)
    return {"success": True, "data": None, "message": "Kursus dihapus", "meta": None}


@router.post("/kursus/{kursus_id}/publish")
def publish_kursus(kursus_id: str):
    k = find_by_id("kursus_elearning", kursus_id)
    if not k:
        raise HTTPException(404, "Kursus tidak ditemukan")
    materi = [m for m in read_all("materi_elearning")
              if not m.get("deleted_at") and m.get("kursus_id") == kursus_id]
    if not materi:
        raise HTTPException(400, "Tambahkan minimal 1 materi sebelum mempublish kursus")
    row = update("kursus_elearning", kursus_id, {"status": "published"})
    return {"success": True, "data": row, "message": "Kursus dipublish", "meta": None}


@router.post("/kursus/{kursus_id}/arsipkan")
def arsipkan_kursus(kursus_id: str):
    k = find_by_id("kursus_elearning", kursus_id)
    if not k:
        raise HTTPException(404, "Kursus tidak ditemukan")
    row = update("kursus_elearning", kursus_id, {"status": "archived"})
    return {"success": True, "data": row, "message": "Kursus diarsipkan", "meta": None}


# ── Materi ─────────────────────────────────────────────────────────────────────
@router.get("/materi")
def list_materi(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=1000),
    search: str = Query(""),
    kursus_id: str = Query(""),
    tipe: str = Query(""),
):
    rows = [m for m in read_all("materi_elearning") if not m.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_M, search)
    if kursus_id:
        rows = [r for r in rows if r.get("kursus_id") == kursus_id]
    if tipe:
        rows = [r for r in rows if r.get("tipe") == tipe]
    rows.sort(key=lambda x: (x.get("kursus_id",""), x.get("urutan", 0)))
    items, meta = paginate(rows, page, per_page)
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


@router.post("/kursus/{kursus_id}/materi")
def create_materi(kursus_id: str, body: dict):
    k = find_by_id("kursus_elearning", kursus_id)
    if not k:
        raise HTTPException(404, "Kursus tidak ditemukan")
    body["kursus_id"] = kursus_id
    body.setdefault("is_published", True)
    # Auto urutan
    existing = [m for m in read_all("materi_elearning")
                if not m.get("deleted_at") and m.get("kursus_id") == kursus_id]
    body.setdefault("urutan", len(existing) + 1)
    row = insert("materi_elearning", body)
    return {"success": True, "data": row, "message": "Materi berhasil ditambahkan", "meta": None}


@router.put("/materi/{materi_id}")
def update_materi(materi_id: str, body: dict):
    m = find_by_id("materi_elearning", materi_id)
    if not m:
        raise HTTPException(404, "Materi tidak ditemukan")
    row = update("materi_elearning", materi_id, body)
    return {"success": True, "data": row, "message": "Materi diperbarui", "meta": None}


@router.delete("/materi/{materi_id}")
def delete_materi(materi_id: str):
    m = find_by_id("materi_elearning", materi_id)
    if not m:
        raise HTTPException(404, "Materi tidak ditemukan")
    soft_delete("materi_elearning", materi_id)
    return {"success": True, "data": None, "message": "Materi dihapus", "meta": None}


# ── Enrollment ─────────────────────────────────────────────────────────────────
@router.get("/enrollment")
def list_enrollment(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    kursus_id: str = Query(""),
    status: str = Query(""),
):
    rows = [e for e in read_all("enrollment_elearning") if not e.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_E, search)
    if kursus_id:
        rows = [r for r in rows if r.get("kursus_id") == kursus_id]
    if status:
        rows = [r for r in rows if r.get("status") == status]
    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


@router.post("/kursus/{kursus_id}/enroll")
def enroll_mahasiswa(kursus_id: str, body: dict):
    k = find_by_id("kursus_elearning", kursus_id)
    if not k:
        raise HTTPException(404, "Kursus tidak ditemukan")
    if k.get("status") != "published":
        raise HTTPException(400, "Hanya kursus published yang dapat diikuti")
    mhs_id = body.get("mahasiswa_id")
    # Check duplicate
    existing = [e for e in read_all("enrollment_elearning")
                if not e.get("deleted_at") and
                e.get("kursus_id") == kursus_id and
                e.get("mahasiswa_id") == mhs_id]
    if existing:
        raise HTTPException(400, "Mahasiswa sudah terdaftar di kursus ini")
    body["kursus_id"] = kursus_id
    body["mata_kuliah_nama"] = k.get("mata_kuliah_nama", "")
    body.setdefault("progress_persen", 0)
    body.setdefault("status", "aktif")
    from datetime import datetime
    body.setdefault("tgl_enroll", datetime.now().isoformat())
    row = insert("enrollment_elearning", body)
    return {"success": True, "data": row, "message": "Berhasil mendaftar kursus", "meta": None}


@router.put("/enrollment/{enrollment_id}")
def update_enrollment(enrollment_id: str, body: dict):
    e = find_by_id("enrollment_elearning", enrollment_id)
    if not e:
        raise HTTPException(404, "Enrollment tidak ditemukan")
    # Auto set selesai if progress 100
    if body.get("progress_persen") == 100:
        body["status"] = "selesai"
        from datetime import datetime
        body.setdefault("tgl_selesai", datetime.now().isoformat())
    row = update("enrollment_elearning", enrollment_id, body)
    return {"success": True, "data": row, "message": "Progress diperbarui", "meta": None}


@router.delete("/enrollment/{enrollment_id}")
def delete_enrollment(enrollment_id: str):
    e = find_by_id("enrollment_elearning", enrollment_id)
    if not e:
        raise HTTPException(404, "Enrollment tidak ditemukan")
    soft_delete("enrollment_elearning", enrollment_id)
    return {"success": True, "data": None, "message": "Peserta dihapus dari kursus", "meta": None}
