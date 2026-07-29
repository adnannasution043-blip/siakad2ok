from fastapi import APIRouter, Query, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.utils.db import read_all, find_by_id, insert, update, soft_delete, search_rows, paginate
from app.utils.dev import (
    get_user_from_request, check_role,
    get_mahasiswa_for_user, get_dosen_for_user, get_kelas_ids_untuk_dosen,
)

def _calc_ip(rows: list) -> dict:
    total_sks   = sum(r.get("sks", 0) for r in rows)
    sks_lulus   = sum(r.get("sks", 0) for r in rows if r.get("nilai_huruf") not in ("E",))
    mutu        = sum(r.get("bobot", 0) * r.get("sks", 0) for r in rows)
    ip          = round(mutu / total_sks, 2) if total_sks else 0.0
    return {"ip": ip, "total_sks": total_sks, "sks_lulus": sks_lulus}

router = APIRouter(prefix="/nilai", tags=["Nilai"])

ADMIN = ["super_admin", "admin_akademik"]
DOSEN = ["super_admin", "admin_akademik", "kaprodi", "dosen", "staf"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def _to_huruf(nilai: float) -> tuple[str, float]:
    if nilai >= 85: return "A",  4.0
    if nilai >= 80: return "B+", 3.5
    if nilai >= 75: return "B",  3.0
    if nilai >= 70: return "C+", 2.5
    if nilai >= 65: return "C",  2.0
    if nilai >= 55: return "D",  1.0
    return "E", 0.0

def _calc_akhir(uts, uas, tugas,
                bobot_uts=0.35, bobot_uas=0.45, bobot_tugas=0.20) -> float:
    return round(uts * bobot_uts + uas * bobot_uas + tugas * bobot_tugas, 2)

def _scope_rows_nilai(rows: list, user: dict) -> list:
    """Filter baris nilai sesuai hak akses role."""
    role = user.get("role")
    if role in ("super_admin", "admin_akademik", "kaprodi", "staf"):
        return rows
    if role == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        return [r for r in rows if r.get("mahasiswa_id") == mhs_id]
    if role == "dosen":
        dosen = get_dosen_for_user(user)
        if not dosen:
            return []
        kelas_ids = get_kelas_ids_untuk_dosen(dosen["id"])
        return [r for r in rows if r.get("kelas_id") in kelas_ids]
    return []

def _assert_dosen_owns_kelas(user: dict, kelas_id: str):
    """Raise 403 jika dosen bukan pengampu kelas ini."""
    if user.get("role") == "dosen":
        dosen = get_dosen_for_user(user)
        if not dosen:
            raise HTTPException(403, "Data dosen tidak ditemukan")
        kelas = find_by_id("kelas", kelas_id)
        if not kelas or kelas.get("dosen_id") != dosen["id"]:
            raise HTTPException(403, "Anda bukan dosen pengampu kelas ini")

# ── GET list ───────────────────────────────────────────────────
@router.get("")
def list_nilai(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    semester_akademik: str = Query(""),
    nilai_huruf: str = Query(""),
    mahasiswa_id: str = Query(""),
    kelas_id: str = Query(""),
    dosen_id: str = Query(""),
    locked: str = Query(""),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    rows = [n for n in read_all("nilai") if not n.get("deleted_at")]
    rows = _scope_rows_nilai(rows, user)
    rows = search_rows(rows, ["mata_kuliah_nama", "semester_akademik",
                               "input_oleh_nama", "mahasiswa_nim", "mahasiswa_nama"], search)
    if semester_akademik:
        rows = [r for r in rows if r.get("semester_akademik") == semester_akademik]
    if nilai_huruf:
        rows = [r for r in rows if r.get("nilai_huruf") == nilai_huruf]
    if mahasiswa_id:
        if user.get("role") == "mahasiswa":
            mhs = get_mahasiswa_for_user(user)
            if not mhs or mhs["id"] != mahasiswa_id:
                raise HTTPException(403, "Akses ditolak")
        rows = [r for r in rows if r.get("mahasiswa_id") == mahasiswa_id]
    if kelas_id:
        rows = [r for r in rows if r.get("kelas_id") == kelas_id]
    if dosen_id:
        rows = [r for r in rows if r.get("input_oleh") == dosen_id]
    if locked == "true":
        rows = [r for r in rows if r.get("locked")]
    elif locked == "false":
        rows = [r for r in rows if not r.get("locked")]
    rows.sort(key=lambda r: r.get("updated_at", ""), reverse=True)
    items, meta = paginate(rows, page, per_page)
    return ok(items, meta=meta)

# ── GET semesters ──────────────────────────────────────────────
@router.get("/semesters")
def list_semesters(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    rows = [n for n in read_all("nilai") if not n.get("deleted_at")]
    rows = _scope_rows_nilai(rows, user)
    semesters = sorted(set(r.get("semester_akademik", "") for r in rows if r.get("semester_akademik")), reverse=True)
    return ok(semesters)

# ── GET rekap ──────────────────────────────────────────────────
@router.get("/rekap")
def rekap_nilai(
    semester_akademik: str = Query(""),
    kelas_id: str = Query(""),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    rows = [n for n in read_all("nilai") if not n.get("deleted_at")]
    rows = _scope_rows_nilai(rows, user)
    if semester_akademik:
        rows = [r for r in rows if r.get("semester_akademik") == semester_akademik]
    if kelas_id:
        rows = [r for r in rows if r.get("kelas_id") == kelas_id]

    distribusi: dict[str, int] = {}
    for n in rows:
        huruf = n.get("nilai_huruf") or "?"
        distribusi[huruf] = distribusi.get(huruf, 0) + 1

    return ok({
        "total": len(rows),
        "terkunci": sum(1 for n in rows if n.get("locked")),
        "draft": sum(1 for n in rows if not n.get("locked")),
        "distribusi_huruf": distribusi,
        "rata_rata": round(sum(n.get("nilai_akhir", 0) for n in rows) / len(rows), 2) if rows else 0,
    })

# ── GET KHS (per semester) ─────────────────────────────────────
@router.get("/khs")
def get_khs(
    mahasiswa_id: str = Query(...),
    semester_akademik: str = Query(...),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)

    # Mahasiswa hanya bisa lihat KHS dirinya sendiri
    if user.get("role") == "mahasiswa":
        mhs_own = get_mahasiswa_for_user(user)
        if not mhs_own or mhs_own["id"] != mahasiswa_id:
            raise HTTPException(403, "Akses ditolak")

    mhs = find_by_id("mahasiswa", mahasiswa_id)
    if not mhs:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")

    rows = [n for n in read_all("nilai")
            if not n.get("deleted_at")
            and n.get("mahasiswa_id") == mahasiswa_id
            and n.get("semester_akademik") == semester_akademik]
    rows.sort(key=lambda r: r.get("mata_kuliah_nama", ""))
    ip_data = _calc_ip(rows)

    return ok({
        "mahasiswa": mhs,
        "semester_akademik": semester_akademik,
        "nilai": rows,
        **ip_data,
    })

# ── GET Transkrip (semua semester) ─────────────────────────────
@router.get("/transkrip")
def get_transkrip(
    mahasiswa_id: str = Query(...),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)

    # Mahasiswa hanya bisa lihat transkrip dirinya sendiri
    if user.get("role") == "mahasiswa":
        mhs_own = get_mahasiswa_for_user(user)
        if not mhs_own or mhs_own["id"] != mahasiswa_id:
            raise HTTPException(403, "Akses ditolak")

    mhs = find_by_id("mahasiswa", mahasiswa_id)
    if not mhs:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")

    all_rows = [n for n in read_all("nilai")
                if not n.get("deleted_at")
                and n.get("mahasiswa_id") == mahasiswa_id]

    semesters_list = sorted(set(n.get("semester_akademik", "") for n in all_rows))
    semesters_data = []
    for sem in semesters_list:
        sem_rows = sorted([n for n in all_rows if n.get("semester_akademik") == sem],
                          key=lambda r: r.get("mata_kuliah_nama", ""))
        ip_data = _calc_ip(sem_rows)
        semesters_data.append({"semester_akademik": sem, "nilai": sem_rows, **ip_data})

    all_ip = _calc_ip(all_rows)
    return ok({
        "mahasiswa": mhs,
        "semesters": semesters_data,
        "ipk": all_ip["ip"],
        "total_sks_tempuh": all_ip["total_sks"],
        "total_sks_lulus": all_ip["sks_lulus"],
    })

# ── GET detail ─────────────────────────────────────────────────
@router.get("/{nilai_id}")
def get_nilai(nilai_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    n = find_by_id("nilai", nilai_id)
    if not n or n.get("deleted_at"):
        raise HTTPException(404, "Nilai tidak ditemukan")

    role = user.get("role")
    if role == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        if not mhs or n.get("mahasiswa_id") != mhs["id"]:
            raise HTTPException(403, "Akses ditolak")
    elif role == "dosen":
        dosen = get_dosen_for_user(user)
        if dosen:
            kelas_ids = get_kelas_ids_untuk_dosen(dosen["id"])
            if n.get("kelas_id") not in kelas_ids:
                raise HTTPException(403, "Akses ditolak")
        else:
            raise HTTPException(403, "Akses ditolak")

    return ok(n)

# ── POST input nilai ───────────────────────────────────────────
class NilaiInput(BaseModel):
    krs_id: str
    nilai_uts: float
    nilai_uas: float
    nilai_tugas: float
    bobot_uts: float = 0.35
    bobot_uas: float = 0.45
    bobot_tugas: float = 0.20

@router.post("")
def input_nilai(body: NilaiInput, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN)

    krs = find_by_id("krs", body.krs_id)
    if not krs or krs.get("deleted_at"):
        raise HTTPException(404, "KRS tidak ditemukan")
    if krs.get("status") != "disetujui":
        raise HTTPException(400, f"KRS berstatus '{krs.get('status')}' — nilai hanya bisa diinput untuk KRS yang disetujui")

    # Dosen hanya bisa input nilai untuk kelas yang diampu
    _assert_dosen_owns_kelas(user, krs.get("kelas_id", ""))

    for field, val in [("UTS", body.nilai_uts), ("UAS", body.nilai_uas), ("Tugas", body.nilai_tugas)]:
        if not (0 <= val <= 100):
            raise HTTPException(400, f"Nilai {field} harus antara 0–100")

    if abs(body.bobot_uts + body.bobot_uas + body.bobot_tugas - 1.0) > 0.001:
        raise HTTPException(400, "Total bobot harus 1.0 (100%)")

    all_nilai = read_all("nilai")
    existing = next((n for n in all_nilai
                     if n.get("krs_id") == body.krs_id and not n.get("deleted_at")), None)
    if existing:
        if existing.get("locked"):
            raise HTTPException(400, "Nilai sudah dikunci — gunakan alur koreksi untuk mengubah")
        akhir = _calc_akhir(body.nilai_uts, body.nilai_uas, body.nilai_tugas,
                             body.bobot_uts, body.bobot_uas, body.bobot_tugas)
        huruf, bobot = _to_huruf(akhir)
        updated = update("nilai", existing["id"], {
            "nilai_uts":   body.nilai_uts,
            "nilai_uas":   body.nilai_uas,
            "nilai_tugas": body.nilai_tugas,
            "nilai_akhir": akhir,
            "nilai_huruf": huruf,
            "bobot":       bobot,
            "input_oleh":       user.get("id", ""),
            "input_oleh_nama":  user.get("nama", ""),
        })
        return ok(updated, "Nilai berhasil diperbarui")

    kelas = find_by_id("kelas", krs.get("kelas_id", ""))
    akhir = _calc_akhir(body.nilai_uts, body.nilai_uas, body.nilai_tugas,
                        body.bobot_uts, body.bobot_uas, body.bobot_tugas)
    huruf, bobot = _to_huruf(akhir)

    data = insert("nilai", {
        "krs_id":          body.krs_id,
        "mahasiswa_id":    krs.get("mahasiswa_id", ""),
        "mahasiswa_nim":   krs.get("mahasiswa_nim", ""),
        "mahasiswa_nama":  krs.get("mahasiswa_nama", ""),
        "kelas_id":        krs.get("kelas_id", ""),
        "mata_kuliah_nama": krs.get("mata_kuliah_nama", ""),
        "mata_kuliah_kode": krs.get("mata_kuliah_kode", ""),
        "semester_akademik": krs.get("semester_akademik", ""),
        "sks":             krs.get("sks", 0),
        "nilai_uts":       body.nilai_uts,
        "nilai_uas":       body.nilai_uas,
        "nilai_tugas":     body.nilai_tugas,
        "nilai_akhir":     akhir,
        "nilai_huruf":     huruf,
        "bobot":           bobot,
        "input_oleh":      user.get("id", ""),
        "input_oleh_nama": user.get("nama", ""),
        "locked":          False,
        "riwayat_koreksi": [],
    })
    return ok(data, "Nilai berhasil diinput")

# ── PUT update nilai (draft only) ─────────────────────────────
class NilaiUpdate(BaseModel):
    nilai_uts: Optional[float] = None
    nilai_uas: Optional[float] = None
    nilai_tugas: Optional[float] = None
    bobot_uts: float = 0.35
    bobot_uas: float = 0.45
    bobot_tugas: float = 0.20

@router.put("/{nilai_id}")
def update_nilai(nilai_id: str, body: NilaiUpdate, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN)

    n = find_by_id("nilai", nilai_id)
    if not n or n.get("deleted_at"):
        raise HTTPException(404, "Nilai tidak ditemukan")
    if n.get("locked"):
        raise HTTPException(400, "Nilai sudah dikunci — gunakan alur koreksi untuk mengubah")

    _assert_dosen_owns_kelas(user, n.get("kelas_id", ""))

    uts   = body.nilai_uts   if body.nilai_uts   is not None else n.get("nilai_uts", 0)
    uas   = body.nilai_uas   if body.nilai_uas   is not None else n.get("nilai_uas", 0)
    tugas = body.nilai_tugas if body.nilai_tugas is not None else n.get("nilai_tugas", 0)

    for field, val in [("UTS", uts), ("UAS", uas), ("Tugas", tugas)]:
        if not (0 <= val <= 100):
            raise HTTPException(400, f"Nilai {field} harus antara 0–100")

    akhir = _calc_akhir(uts, uas, tugas, body.bobot_uts, body.bobot_uas, body.bobot_tugas)
    huruf, bobot = _to_huruf(akhir)
    updated = update("nilai", nilai_id, {
        "nilai_uts": uts, "nilai_uas": uas, "nilai_tugas": tugas,
        "nilai_akhir": akhir, "nilai_huruf": huruf, "bobot": bobot,
        "input_oleh": user.get("id", ""), "input_oleh_nama": user.get("nama", ""),
    })
    return ok(updated, "Nilai berhasil diperbarui")

# ── POST kunci nilai ───────────────────────────────────────────
@router.post("/{nilai_id}/kunci")
def kunci_nilai(nilai_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN)
    n = find_by_id("nilai", nilai_id)
    if not n or n.get("deleted_at"):
        raise HTTPException(404, "Nilai tidak ditemukan")
    if n.get("locked"):
        raise HTTPException(400, "Nilai sudah terkunci")

    _assert_dosen_owns_kelas(user, n.get("kelas_id", ""))

    updated = update("nilai", nilai_id, {
        "locked": True,
        "locked_at": now_iso(),
        "locked_oleh": user.get("id", ""),
        "locked_oleh_nama": user.get("nama", ""),
    })
    return ok(updated, "Nilai berhasil dikunci")

# ── POST kunci massal (per kelas) ──────────────────────────────
class KunciMassalBody(BaseModel):
    kelas_id: str
    semester_akademik: str = ""

@router.post("/kunci-massal")
def kunci_massal(body: KunciMassalBody, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN)

    _assert_dosen_owns_kelas(user, body.kelas_id)

    rows = [n for n in read_all("nilai")
            if not n.get("deleted_at")
            and n.get("kelas_id") == body.kelas_id
            and not n.get("locked")]
    if body.semester_akademik:
        rows = [r for r in rows if r.get("semester_akademik") == body.semester_akademik]
    count = 0
    for n in rows:
        update("nilai", n["id"], {
            "locked": True,
            "locked_at": now_iso(),
            "locked_oleh": user.get("id", ""),
            "locked_oleh_nama": user.get("nama", ""),
        })
        count += 1
    return ok({"dikunci": count}, f"{count} nilai berhasil dikunci")

# ── POST koreksi (buka kunci) ──────────────────────────────────
class KoreksiBody(BaseModel):
    alasan: str

@router.post("/{nilai_id}/koreksi")
def koreksi_nilai(nilai_id: str, body: KoreksiBody, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ["super_admin", "admin_akademik", "kaprodi"])
    if not body.alasan.strip():
        raise HTTPException(400, "Alasan koreksi wajib diisi")
    n = find_by_id("nilai", nilai_id)
    if not n or n.get("deleted_at"):
        raise HTTPException(404, "Nilai tidak ditemukan")
    if not n.get("locked"):
        raise HTTPException(400, "Nilai belum terkunci, bisa langsung diedit")

    riwayat = n.get("riwayat_koreksi") or []
    riwayat.append({
        "dibuka_oleh": user.get("id", ""),
        "dibuka_oleh_nama": user.get("nama", ""),
        "alasan": body.alasan,
        "at": now_iso(),
    })
    updated = update("nilai", nilai_id, {
        "locked": False,
        "locked_at": None,
        "locked_oleh": None,
        "locked_oleh_nama": None,
        "riwayat_koreksi": riwayat,
    })
    return ok(updated, "Nilai berhasil dibuka untuk koreksi")

# ── DELETE (admin only) ────────────────────────────────────────
@router.delete("/{nilai_id}")
def delete_nilai(nilai_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ["super_admin"])
    n = find_by_id("nilai", nilai_id)
    if not n:
        raise HTTPException(404, "Nilai tidak ditemukan")
    soft_delete("nilai", nilai_id)
    return ok(message="Nilai dihapus")
