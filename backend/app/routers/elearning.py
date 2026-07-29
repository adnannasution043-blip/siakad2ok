from fastapi import APIRouter, Query, HTTPException, Header
from datetime import datetime
from app.utils.db import (
    read_all, find_by_id, insert, update, soft_delete,
    search_rows, paginate,
)
from app.utils.dev import (
    get_user_from_request, check_role,
    get_mahasiswa_for_user, get_dosen_for_user,
)

router = APIRouter(prefix="/elearning", tags=["E-Learning"])

DOSEN_ADMIN = ["super_admin", "admin_akademik", "kaprodi", "dosen", "staf"]
ADMIN_ONLY  = ["super_admin", "admin_akademik", "kaprodi", "staf"]

_SEARCH_K = ["mata_kuliah_nama", "dosen_nama", "tahun_akademik", "deskripsi"]
_SEARCH_M = ["judul", "tipe", "deskripsi"]
_SEARCH_E = ["mahasiswa_nama", "mahasiswa_nim", "mata_kuliah_nama"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}


# ── Stats ─────────────────────────────────────────────────────────────────────
@router.get("/stats")
def get_stats(authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    kursus     = [k for k in read_all("kursus_elearning")     if not k.get("deleted_at")]
    materi     = [m for m in read_all("materi_elearning")     if not m.get("deleted_at")]
    enrollment = [e for e in read_all("enrollment_elearning") if not e.get("deleted_at")]
    return ok({
        "total_kursus":     len(kursus),
        "kursus_published": sum(1 for k in kursus if k.get("status") == "published"),
        "total_materi":     len(materi),
        "total_peserta":    len(enrollment),
        "peserta_selesai":  sum(1 for e in enrollment if e.get("status") == "selesai"),
        "rata_progress": round(
            sum(e.get("progress_persen", 0) for e in enrollment) / len(enrollment), 1
        ) if enrollment else 0,
    })


# ── Kursus List ───────────────────────────────────────────────────────────────
@router.get("/kursus")
def list_kursus(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    status: str = Query(""),
    tahun_akademik: str = Query(""),
    dosen_id: str = Query(""),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    rows = [k for k in read_all("kursus_elearning") if not k.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_K, search)

    if user.get("role") == "mahasiswa":
        # Mahasiswa sees only published kursus they are enrolled in or published ones
        enrollment_all = [e for e in read_all("enrollment_elearning") if not e.get("deleted_at")]
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        enrolled_ids = {e.get("kursus_id") for e in enrollment_all if e.get("mahasiswa_id") == mhs_id}
        rows = [r for r in rows if r.get("status") == "published" or r["id"] in enrolled_ids]
    elif user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        rows = [r for r in rows if r.get("dosen_id") == did]
    # Admin/staff sees all

    if status:
        rows = [r for r in rows if r.get("status") == status]
    if tahun_akademik:
        rows = [r for r in rows if r.get("tahun_akademik") == tahun_akademik]
    if dosen_id and user.get("role") not in ("dosen", "mahasiswa"):
        rows = [r for r in rows if r.get("dosen_id") == dosen_id]

    materi_all     = [m for m in read_all("materi_elearning")     if not m.get("deleted_at")]
    enrollment_all = [e for e in read_all("enrollment_elearning") if not e.get("deleted_at")]
    for k in rows:
        kid = k["id"]
        k["jumlah_materi"]  = sum(1 for m in materi_all     if m.get("kursus_id") == kid)
        k["jumlah_peserta"] = sum(1 for e in enrollment_all if e.get("kursus_id") == kid)

    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)


# ── Kursus CRUD ───────────────────────────────────────────────────────────────
@router.post("/kursus")
def create_kursus(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_ADMIN)
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        if d:
            body.setdefault("dosen_id", d["id"])
            body.setdefault("dosen_nama", d.get("nama_lengkap", ""))
    body.setdefault("status", "draft")
    body.setdefault("jumlah_materi", 0)
    body.setdefault("jumlah_peserta", 0)
    row = insert("kursus_elearning", body)
    return ok(row, "Kursus berhasil dibuat")


@router.get("/kursus/{kursus_id}")
def get_kursus(kursus_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    k = find_by_id("kursus_elearning", kursus_id)
    if not k:
        raise HTTPException(404, "Kursus tidak ditemukan")
    return ok(k)


@router.put("/kursus/{kursus_id}")
def update_kursus(kursus_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_ADMIN)
    k = find_by_id("kursus_elearning", kursus_id)
    if not k:
        raise HTTPException(404, "Kursus tidak ditemukan")
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if k.get("dosen_id") != did:
            raise HTTPException(403, "Anda bukan pengajar kursus ini")
    row = update("kursus_elearning", kursus_id, body)
    return ok(row, "Kursus diperbarui")


@router.delete("/kursus/{kursus_id}")
def delete_kursus(kursus_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_ADMIN)
    k = find_by_id("kursus_elearning", kursus_id)
    if not k:
        raise HTTPException(404, "Kursus tidak ditemukan")
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if k.get("dosen_id") != did:
            raise HTTPException(403, "Anda bukan pengajar kursus ini")
    if k.get("status") == "published":
        raise HTTPException(400, "Kursus yang sudah published tidak dapat dihapus, arsipkan dulu")
    soft_delete("kursus_elearning", kursus_id)
    return ok(None, "Kursus dihapus")


@router.post("/kursus/{kursus_id}/publish")
def publish_kursus(kursus_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_ADMIN)
    k = find_by_id("kursus_elearning", kursus_id)
    if not k:
        raise HTTPException(404, "Kursus tidak ditemukan")
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if k.get("dosen_id") != did:
            raise HTTPException(403, "Anda bukan pengajar kursus ini")
    materi = [m for m in read_all("materi_elearning")
              if not m.get("deleted_at") and m.get("kursus_id") == kursus_id]
    if not materi:
        raise HTTPException(400, "Tambahkan minimal 1 materi sebelum mempublish kursus")
    row = update("kursus_elearning", kursus_id, {"status": "published"})
    return ok(row, "Kursus dipublish")


@router.post("/kursus/{kursus_id}/arsipkan")
def arsipkan_kursus(kursus_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_ADMIN)
    k = find_by_id("kursus_elearning", kursus_id)
    if not k:
        raise HTTPException(404, "Kursus tidak ditemukan")
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if k.get("dosen_id") != did:
            raise HTTPException(403, "Anda bukan pengajar kursus ini")
    row = update("kursus_elearning", kursus_id, {"status": "archived"})
    return ok(row, "Kursus diarsipkan")


# ── Materi ─────────────────────────────────────────────────────────────────────
@router.get("/materi")
def list_materi(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=1000),
    search: str = Query(""),
    kursus_id: str = Query(""),
    tipe: str = Query(""),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    rows = [m for m in read_all("materi_elearning") if not m.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_M, search)

    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        enrollment_all = [e for e in read_all("enrollment_elearning") if not e.get("deleted_at")]
        enrolled_ids = {e.get("kursus_id") for e in enrollment_all if e.get("mahasiswa_id") == mhs_id}
        rows = [r for r in rows if r.get("kursus_id") in enrolled_ids]
    elif user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        own_kursus = {k["id"] for k in read_all("kursus_elearning")
                      if not k.get("deleted_at") and k.get("dosen_id") == did}
        rows = [r for r in rows if r.get("kursus_id") in own_kursus]

    if kursus_id:
        rows = [r for r in rows if r.get("kursus_id") == kursus_id]
    if tipe:
        rows = [r for r in rows if r.get("tipe") == tipe]
    rows.sort(key=lambda x: (x.get("kursus_id", ""), x.get("urutan", 0)))
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)


@router.post("/kursus/{kursus_id}/materi")
def create_materi(kursus_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_ADMIN)
    k = find_by_id("kursus_elearning", kursus_id)
    if not k:
        raise HTTPException(404, "Kursus tidak ditemukan")
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if k.get("dosen_id") != did:
            raise HTTPException(403, "Anda bukan pengajar kursus ini")
    body["kursus_id"] = kursus_id
    body.setdefault("is_published", True)
    existing = [m for m in read_all("materi_elearning")
                if not m.get("deleted_at") and m.get("kursus_id") == kursus_id]
    body.setdefault("urutan", len(existing) + 1)
    row = insert("materi_elearning", body)
    return ok(row, "Materi berhasil ditambahkan")


@router.put("/materi/{materi_id}")
def update_materi(materi_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_ADMIN)
    m = find_by_id("materi_elearning", materi_id)
    if not m:
        raise HTTPException(404, "Materi tidak ditemukan")
    if user.get("role") == "dosen":
        k = find_by_id("kursus_elearning", m.get("kursus_id", ""))
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if not k or k.get("dosen_id") != did:
            raise HTTPException(403, "Anda bukan pengajar kursus ini")
    row = update("materi_elearning", materi_id, body)
    return ok(row, "Materi diperbarui")


@router.delete("/materi/{materi_id}")
def delete_materi(materi_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_ADMIN)
    m = find_by_id("materi_elearning", materi_id)
    if not m:
        raise HTTPException(404, "Materi tidak ditemukan")
    if user.get("role") == "dosen":
        k = find_by_id("kursus_elearning", m.get("kursus_id", ""))
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        if not k or k.get("dosen_id") != did:
            raise HTTPException(403, "Anda bukan pengajar kursus ini")
    soft_delete("materi_elearning", materi_id)
    return ok(None, "Materi dihapus")


# ── Enrollment ─────────────────────────────────────────────────────────────────
@router.get("/enrollment")
def list_enrollment(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    kursus_id: str = Query(""),
    status: str = Query(""),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    rows = [e for e in read_all("enrollment_elearning") if not e.get("deleted_at")]
    rows = search_rows(rows, _SEARCH_E, search)

    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        rows = [r for r in rows if r.get("mahasiswa_id") == mhs_id]
    elif user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        own_kursus = {k["id"] for k in read_all("kursus_elearning")
                      if not k.get("deleted_at") and k.get("dosen_id") == did}
        rows = [r for r in rows if r.get("kursus_id") in own_kursus]
    else:
        check_role(user, ADMIN_ONLY)

    if kursus_id:
        rows = [r for r in rows if r.get("kursus_id") == kursus_id]
    if status:
        rows = [r for r in rows if r.get("status") == status]
    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)


@router.post("/kursus/{kursus_id}/enroll")
def enroll_mahasiswa(kursus_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    k = find_by_id("kursus_elearning", kursus_id)
    if not k:
        raise HTTPException(404, "Kursus tidak ditemukan")
    if k.get("status") != "published":
        raise HTTPException(400, "Hanya kursus published yang dapat diikuti")

    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        if not mhs:
            raise HTTPException(403, "Data mahasiswa tidak ditemukan")
        mhs_id = mhs["id"]
        body["mahasiswa_id"] = mhs_id
        body.setdefault("mahasiswa_nama", mhs.get("nama_lengkap", ""))
        body.setdefault("mahasiswa_nim", mhs.get("nim", ""))
    else:
        check_role(user, ADMIN_ONLY)
        mhs_id = body.get("mahasiswa_id")
        if not mhs_id:
            raise HTTPException(400, "mahasiswa_id wajib diisi")

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
    body.setdefault("tgl_enroll", datetime.now().isoformat())
    row = insert("enrollment_elearning", body)
    return ok(row, "Berhasil mendaftar kursus")


@router.put("/enrollment/{enrollment_id}")
def update_enrollment(enrollment_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    e = find_by_id("enrollment_elearning", enrollment_id)
    if not e:
        raise HTTPException(404, "Enrollment tidak ditemukan")

    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        if e.get("mahasiswa_id") != mhs_id:
            raise HTTPException(403, "Akses ditolak")
        # Mahasiswa can only update progress
        body = {k: v for k, v in body.items() if k in ("progress_persen",)}
    elif user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        k = find_by_id("kursus_elearning", e.get("kursus_id", ""))
        if not k or k.get("dosen_id") != did:
            raise HTTPException(403, "Anda bukan pengajar kursus ini")
    else:
        check_role(user, ADMIN_ONLY)

    if body.get("progress_persen") == 100:
        body["status"] = "selesai"
        body.setdefault("tgl_selesai", datetime.now().isoformat())
    row = update("enrollment_elearning", enrollment_id, body)
    return ok(row, "Progress diperbarui")


@router.delete("/enrollment/{enrollment_id}")
def delete_enrollment(enrollment_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    e = find_by_id("enrollment_elearning", enrollment_id)
    if not e:
        raise HTTPException(404, "Enrollment tidak ditemukan")
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        k = find_by_id("kursus_elearning", e.get("kursus_id", ""))
        if not k or k.get("dosen_id") != did:
            raise HTTPException(403, "Anda bukan pengajar kursus ini")
    else:
        check_role(user, ADMIN_ONLY)
    soft_delete("enrollment_elearning", enrollment_id)
    return ok(None, "Peserta dihapus dari kursus")
