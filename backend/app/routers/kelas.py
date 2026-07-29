from fastapi import APIRouter, Query, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate
from app.utils.dev import get_user_from_request, check_role

router = APIRouter(prefix="/kelas", tags=["Kelas & Jadwal"])

ADMIN = ["super_admin", "admin_akademik"]
HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def enrich(k):
    mk    = find_by_id("mata_kuliah", k.get("mata_kuliah_id", ""))
    dosen = find_by_id("dosen", k.get("dosen_id", ""))
    ruang = find_by_id("ruang", k.get("ruang_id", ""))
    prodi = find_by_id("program_studi", k.get("program_studi_id", ""))
    peserta = sum(1 for r in read_all("krs")
                  if r.get("kelas_id") == k["id"] and r.get("status") != "dibatalkan" and not r.get("deleted_at"))
    return {
        **k,
        "mata_kuliah": mk,
        "dosen": dosen,
        "ruang": ruang,
        "program_studi": prodi,
        "jumlah_peserta": peserta,
    }

def _time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)

def _check_conflict(hari, jam_mulai, jam_selesai, ruang_id, dosen_id, exclude_id=None):
    """Return list of conflicting kelas descriptions."""
    start = _time_to_minutes(jam_mulai)
    end   = _time_to_minutes(jam_selesai)
    conflicts = []
    for k in read_all("kelas"):
        if k.get("deleted_at") or k.get("id") == exclude_id:
            continue
        if k.get("hari") != hari:
            continue
        k_start = _time_to_minutes(k.get("jam_mulai", "00:00"))
        k_end   = _time_to_minutes(k.get("jam_selesai", "00:00"))
        overlap = start < k_end and end > k_start
        if not overlap:
            continue
        label = f"{k.get('mata_kuliah_kode','')} {k.get('kode_kelas','')} ({k.get('jam_mulai','')}–{k.get('jam_selesai','')})"
        if k.get("ruang_id") == ruang_id:
            conflicts.append(f"Bentrok ruang: {label}")
        if k.get("dosen_id") == dosen_id:
            conflicts.append(f"Bentrok jadwal dosen: {label}")
    return conflicts

@router.get("")
def list_kelas(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    semester_akademik: str = Query(""),
    prodi_id: str = Query(""),
    dosen_id: str = Query(""),
    hari: str = Query(""),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    rows = [k for k in read_all("kelas") if not k.get("deleted_at")]
    rows = search_rows(rows, ["mata_kuliah_nama", "mata_kuliah_kode", "dosen_nama", "kode_kelas"], search)
    if semester_akademik:
        rows = [r for r in rows if r.get("semester_akademik") == semester_akademik]
    if prodi_id:
        rows = [r for r in rows if r.get("program_studi_id") == prodi_id]
    if dosen_id:
        rows = [r for r in rows if r.get("dosen_id") == dosen_id]
    if hari:
        rows = [r for r in rows if r.get("hari") == hari]
    rows.sort(key=lambda r: (r.get("hari", ""), r.get("jam_mulai", ""), r.get("mata_kuliah_kode", "")))
    items, meta = paginate(rows, page, per_page)
    return ok([enrich(k) for k in items], meta=meta)

@router.get("/semesters")
def list_semesters(authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    rows = [k for k in read_all("kelas") if not k.get("deleted_at")]
    sems = sorted(set(k.get("semester_akademik", "") for k in rows if k.get("semester_akademik")), reverse=True)
    return ok(sems)

@router.get("/jadwal")
def jadwal_view(
    semester_akademik: str = Query(""),
    prodi_id: str = Query(""),
    dosen_id: str = Query(""),
    authorization: str = Header(default="dev"),
):
    """Return kelas grouped by hari for weekly schedule view."""
    get_user_from_request(authorization)
    rows = [k for k in read_all("kelas") if not k.get("deleted_at")]
    if semester_akademik:
        rows = [r for r in rows if r.get("semester_akademik") == semester_akademik]
    if prodi_id:
        rows = [r for r in rows if r.get("program_studi_id") == prodi_id]
    if dosen_id:
        rows = [r for r in rows if r.get("dosen_id") == dosen_id]
    grouped = {h: [] for h in HARI}
    for k in sorted(rows, key=lambda r: r.get("jam_mulai", "")):
        h = k.get("hari", "")
        if h in grouped:
            grouped[h].append(k)
    return ok(grouped)

@router.get("/{kelas_id}")
def get_kelas(kelas_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    k = find_by_id("kelas", kelas_id)
    if not k or k.get("deleted_at"):
        raise HTTPException(404, "Kelas tidak ditemukan")
    return ok(enrich(k))

class KelasCreate(BaseModel):
    mata_kuliah_id: str
    dosen_id: str
    ruang_id: str
    semester_akademik: str
    kode_kelas: str = "A"
    kapasitas: int = 35
    jumlah_pertemuan: int = 16
    hari: str
    jam_mulai: str
    jam_selesai: str

@router.post("")
def create_kelas(body: KelasCreate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)

    mk    = find_by_id("mata_kuliah", body.mata_kuliah_id)
    dosen = find_by_id("dosen", body.dosen_id)
    ruang = find_by_id("ruang", body.ruang_id)
    if not mk:    raise HTTPException(404, "Mata kuliah tidak ditemukan")
    if not dosen: raise HTTPException(404, "Dosen tidak ditemukan")
    if not ruang: raise HTTPException(404, "Ruang tidak ditemukan")
    if body.hari not in HARI:
        raise HTTPException(400, f"Hari tidak valid. Pilihan: {', '.join(HARI)}")
    if body.kapasitas > ruang.get("kapasitas", 9999):
        raise HTTPException(400, f"Kapasitas kelas ({body.kapasitas}) melebihi kapasitas ruang ({ruang['kapasitas']})")

    conflicts = _check_conflict(body.hari, body.jam_mulai, body.jam_selesai, body.ruang_id, body.dosen_id)
    if conflicts:
        raise HTTPException(409, "; ".join(conflicts))

    # Check duplicate kelas (same MK + kode_kelas + semester)
    all_kelas = read_all("kelas")
    if any(k.get("mata_kuliah_id") == body.mata_kuliah_id
           and k.get("kode_kelas") == body.kode_kelas.upper()
           and k.get("semester_akademik") == body.semester_akademik
           and not k.get("deleted_at") for k in all_kelas):
        raise HTTPException(400, f"Kelas {mk.get('kode_mk')} {body.kode_kelas.upper()} sudah ada di semester ini")

    prodi_id = mk.get("program_studi_id", "")
    data = insert("kelas", {
        "mata_kuliah_id":    body.mata_kuliah_id,
        "mata_kuliah_nama":  mk.get("nama", ""),
        "mata_kuliah_kode":  mk.get("kode_mk", ""),
        "sks":               mk.get("sks", 0),
        "dosen_id":          body.dosen_id,
        "dosen_nama":        dosen.get("nama_lengkap", ""),
        "semester_akademik": body.semester_akademik,
        "kode_kelas":        body.kode_kelas.upper(),
        "kapasitas":         body.kapasitas,
        "jumlah_pertemuan":  body.jumlah_pertemuan,
        "pertemuan_ke":      0,
        "ruang_id":          body.ruang_id,
        "ruang_nama":        ruang.get("nama", ""),
        "hari":              body.hari,
        "jam_mulai":         body.jam_mulai,
        "jam_selesai":       body.jam_selesai,
        "program_studi_id":  prodi_id,
    })
    return ok(enrich(data), "Kelas berhasil dibuat")

class KelasUpdate(BaseModel):
    dosen_id: Optional[str] = None
    ruang_id: Optional[str] = None
    kapasitas: Optional[int] = None
    jumlah_pertemuan: Optional[int] = None
    hari: Optional[str] = None
    jam_mulai: Optional[str] = None
    jam_selesai: Optional[str] = None

@router.put("/{kelas_id}")
def update_kelas(kelas_id: str, body: KelasUpdate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    k = find_by_id("kelas", kelas_id)
    if not k or k.get("deleted_at"):
        raise HTTPException(404, "Kelas tidak ditemukan")

    updates = {key: val for key, val in body.model_dump().items() if val is not None}

    new_hari      = updates.get("hari", k.get("hari"))
    new_jam_mulai = updates.get("jam_mulai", k.get("jam_mulai"))
    new_jam_selesai = updates.get("jam_selesai", k.get("jam_selesai"))
    new_ruang_id  = updates.get("ruang_id", k.get("ruang_id"))
    new_dosen_id  = updates.get("dosen_id", k.get("dosen_id"))

    if "ruang_id" in updates:
        ruang = find_by_id("ruang", updates["ruang_id"])
        if not ruang: raise HTTPException(404, "Ruang tidak ditemukan")
        updates["ruang_nama"] = ruang.get("nama", "")
        cap = updates.get("kapasitas", k.get("kapasitas", 0))
        if cap > ruang.get("kapasitas", 9999):
            raise HTTPException(400, f"Kapasitas melebihi kapasitas ruang ({ruang['kapasitas']})")
    if "dosen_id" in updates:
        dosen = find_by_id("dosen", updates["dosen_id"])
        if not dosen: raise HTTPException(404, "Dosen tidak ditemukan")
        updates["dosen_nama"] = dosen.get("nama_lengkap", "")

    conflicts = _check_conflict(new_hari, new_jam_mulai, new_jam_selesai, new_ruang_id, new_dosen_id, exclude_id=kelas_id)
    if conflicts:
        raise HTTPException(409, "; ".join(conflicts))

    updated = update("kelas", kelas_id, updates)
    return ok(enrich(updated), "Kelas berhasil diperbarui")

@router.delete("/{kelas_id}")
def delete_kelas(kelas_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    k = find_by_id("kelas", kelas_id)
    if not k or k.get("deleted_at"):
        raise HTTPException(404, "Kelas tidak ditemukan")
    peserta = sum(1 for r in read_all("krs")
                  if r.get("kelas_id") == kelas_id and r.get("status") != "dibatalkan" and not r.get("deleted_at"))
    if peserta > 0:
        raise HTTPException(400, f"Tidak dapat dihapus — ada {peserta} mahasiswa terdaftar di kelas ini")
    soft_delete("kelas", kelas_id)
    return ok(message="Kelas berhasil dihapus")
