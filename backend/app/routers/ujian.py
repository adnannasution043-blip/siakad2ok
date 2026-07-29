from fastapi import APIRouter, Query, Header, HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.utils.db import read_all, find_by_id, insert, update, soft_delete, paginate
from app.utils.dev import (
    get_user_from_request, check_role,
    get_mahasiswa_for_user, get_dosen_for_user, get_kelas_ids_untuk_dosen,
)

router = APIRouter(prefix="/ujian", tags=["Ujian"])

ADMIN = ["super_admin", "admin_akademik", "staf"]
ADMIN_KAPRODI = ["super_admin", "admin_akademik", "kaprodi", "staf"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def _now():
    return datetime.now(timezone.utc).isoformat()

def _enrich_jadwal(j: dict) -> dict:
    kelas_list = read_all("kelas")
    k = next((x for x in kelas_list if x["id"] == j.get("kelas_id")), {})
    if k and not j.get("mata_kuliah_nama"):
        j["mata_kuliah_nama"] = k.get("mata_kuliah_nama", "")
        j["mata_kuliah_kode"] = k.get("mata_kuliah_kode", "")
        j["dosen_nama"] = k.get("dosen_nama", "")
    return j

def _pct_hadir(kelas_id: str, mahasiswa_id: str) -> float:
    sesi_list = [s for s in read_all("sesi_kuliah")
                 if s.get("kelas_id") == kelas_id
                 and not s.get("deleted_at")
                 and s.get("status") == "selesai"]
    if not sesi_list:
        return 100.0
    sesi_ids = {s["id"] for s in sesi_list}
    presensi = [p for p in read_all("presensi")
                if p.get("sesi_id") in sesi_ids
                and p.get("mahasiswa_id") == mahasiswa_id
                and not p.get("deleted_at")
                and p.get("status") in ("hadir", "izin", "sakit")]
    return round(len(presensi) / len(sesi_list) * 100, 1)

def _spp_lunas(mahasiswa_id: str, semester: str) -> bool:
    tagihan = [t for t in read_all("tagihan")
               if t.get("mahasiswa_id") == mahasiswa_id
               and t.get("semester_akademik") == semester
               and t.get("jenis") == "SPP"
               and not t.get("deleted_at")]
    if not tagihan:
        return False
    return any(t["status"] == "lunas" for t in tagihan)

def _kelas_ids_for_user(user: dict) -> set | None:
    """Return allowed kelas_ids or None for unrestricted."""
    role = user.get("role")
    if role in ADMIN:
        return None
    if role == "kaprodi":
        dosen = get_dosen_for_user(user)
        if dosen and dosen.get("prodi_id"):
            return {k["id"] for k in read_all("kelas")
                    if k.get("program_studi_id") == dosen["prodi_id"] and not k.get("deleted_at")}
        return None
    if role == "dosen":
        dosen = get_dosen_for_user(user)
        return get_kelas_ids_untuk_dosen(dosen["id"]) if dosen else set()
    if role == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        if mhs:
            return {k.get("kelas_id") for k in read_all("krs")
                    if k.get("mahasiswa_id") == mhs["id"] and k.get("status") == "disetujui"
                    and not k.get("deleted_at")}
        return set()
    return set()

# ─── JADWAL UJIAN ────────────────────────────────────────────────────────────

@router.get("/jadwal")
def list_jadwal(
    semester: Optional[str] = None,
    jenis: Optional[str] = None,
    kelas_id: Optional[str] = None,
    program_studi_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    jadwal = [j for j in read_all("jadwal_ujian") if not j.get("deleted_at")]

    allowed_kelas = _kelas_ids_for_user(user)
    if allowed_kelas is not None:
        jadwal = [j for j in jadwal if j.get("kelas_id") in allowed_kelas]

    if semester:
        jadwal = [j for j in jadwal if j.get("semester_akademik") == semester]
    if jenis:
        jadwal = [j for j in jadwal if j.get("jenis") == jenis]
    if kelas_id:
        jadwal = [j for j in jadwal if j.get("kelas_id") == kelas_id]
    if program_studi_id:
        jadwal = [j for j in jadwal if j.get("program_studi_id") == program_studi_id]
    if status:
        jadwal = [j for j in jadwal if j.get("status") == status]
    if search:
        q = search.lower()
        jadwal = [j for j in jadwal if q in j.get("mata_kuliah_nama", "").lower()
                  or q in j.get("dosen_nama", "").lower()
                  or q in j.get("ruang_nama", "").lower()]
    jadwal.sort(key=lambda x: (x.get("tanggal", ""), x.get("jam_mulai", "")))
    items, meta = paginate(jadwal, page, per_page)
    return ok(items, meta=meta)


@router.post("/jadwal")
def create_jadwal(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)

    kelas_id = body.get("kelas_id", "").strip()
    jenis = body.get("jenis", "").strip()
    tanggal = body.get("tanggal", "").strip()
    jam_mulai = body.get("jam_mulai", "").strip()
    jam_selesai = body.get("jam_selesai", "").strip()
    ruang_id = body.get("ruang_id", "").strip()

    if not all([kelas_id, jenis, tanggal, jam_mulai, jam_selesai]):
        raise HTTPException(400, "kelas_id, jenis, tanggal, jam_mulai, jam_selesai wajib diisi")
    if jenis not in ("UTS", "UAS", "Susulan"):
        raise HTTPException(400, "jenis harus UTS, UAS, atau Susulan")

    kelas = find_by_id("kelas", kelas_id)
    if not kelas:
        raise HTTPException(404, "Kelas tidak ditemukan")

    existing = [j for j in read_all("jadwal_ujian")
                if j.get("kelas_id") == kelas_id
                and j.get("jenis") == jenis
                and not j.get("deleted_at")]
    if existing and jenis != "Susulan":
        raise HTTPException(400, f"Jadwal {jenis} untuk kelas ini sudah ada")

    ruang_nama = ""
    if ruang_id:
        ruang = find_by_id("ruang", ruang_id)
        ruang_nama = ruang["nama"] if ruang else ""

    now = _now()
    rec = {
        "id": str(uuid.uuid4()),
        "kelas_id": kelas_id,
        "mata_kuliah_nama": kelas.get("mata_kuliah_nama", ""),
        "mata_kuliah_kode": kelas.get("mata_kuliah_kode", ""),
        "dosen_id": kelas.get("dosen_id", ""),
        "dosen_nama": kelas.get("dosen_nama", ""),
        "program_studi_id": kelas.get("program_studi_id", ""),
        "semester_akademik": kelas.get("semester_akademik", ""),
        "jenis": jenis,
        "tanggal": tanggal,
        "jam_mulai": jam_mulai,
        "jam_selesai": jam_selesai,
        "ruang_id": ruang_id,
        "ruang_nama": ruang_nama,
        "pengawas": body.get("pengawas", []),
        "status": "dijadwalkan",
        "catatan": body.get("catatan"),
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    insert("jadwal_ujian", rec)
    return ok(rec, "Jadwal ujian berhasil dibuat")


@router.get("/jadwal/{jadwal_id}")
def get_jadwal(jadwal_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    j = find_by_id("jadwal_ujian", jadwal_id)
    if not j or j.get("deleted_at"):
        raise HTTPException(404, "Jadwal ujian tidak ditemukan")
    allowed_kelas = _kelas_ids_for_user(user)
    if allowed_kelas is not None and j.get("kelas_id") not in allowed_kelas:
        raise HTTPException(403, "Akses ditolak")
    return ok(j)


@router.put("/jadwal/{jadwal_id}")
def update_jadwal(jadwal_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    j = find_by_id("jadwal_ujian", jadwal_id)
    if not j or j.get("deleted_at"):
        raise HTTPException(404, "Jadwal ujian tidak ditemukan")
    if j.get("status") == "selesai":
        raise HTTPException(400, "Jadwal yang sudah selesai tidak dapat diubah")

    allowed = ("tanggal", "jam_mulai", "jam_selesai", "ruang_id", "ruang_nama",
               "pengawas", "status", "catatan")
    for k, v in body.items():
        if k in allowed:
            j[k] = v

    if "ruang_id" in body and body["ruang_id"]:
        ruang = find_by_id("ruang", body["ruang_id"])
        if ruang:
            j["ruang_nama"] = ruang["nama"]

    j["updated_at"] = _now()
    update("jadwal_ujian", jadwal_id, j)
    return ok(j, "Jadwal berhasil diperbarui")


@router.delete("/jadwal/{jadwal_id}")
def delete_jadwal(jadwal_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    j = find_by_id("jadwal_ujian", jadwal_id)
    if not j or j.get("deleted_at"):
        raise HTTPException(404, "Jadwal ujian tidak ditemukan")
    if j.get("status") == "selesai":
        raise HTTPException(400, "Jadwal yang sudah selesai tidak dapat dihapus")
    soft_delete("jadwal_ujian", jadwal_id)
    return ok(None, "Jadwal dihapus")


# ─── KARTU UJIAN ─────────────────────────────────────────────────────────────

@router.get("/kartu")
def list_kartu(
    semester: Optional[str] = None,
    jenis: Optional[str] = None,
    mahasiswa_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    kartu = [k for k in read_all("kartu_ujian") if not k.get("deleted_at")]

    role = user.get("role")
    if role == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        if mahasiswa_id and mahasiswa_id != mhs_id:
            raise HTTPException(403, "Akses ditolak")
        kartu = [k for k in kartu if k.get("mahasiswa_id") == mhs_id]
    elif role == "kaprodi":
        dosen = get_dosen_for_user(user)
        if dosen and dosen.get("prodi_id"):
            kartu = [k for k in kartu if k.get("program_studi_id") == dosen["prodi_id"]]

    if semester:
        kartu = [k for k in kartu if k.get("semester_akademik") == semester]
    if jenis:
        kartu = [k for k in kartu if k.get("jenis") == jenis]
    if mahasiswa_id and role != "mahasiswa":
        kartu = [k for k in kartu if k.get("mahasiswa_id") == mahasiswa_id]
    if status:
        kartu = [k for k in kartu if k.get("status") == status]
    if search:
        q = search.lower()
        kartu = [k for k in kartu if q in k.get("mahasiswa_nama", "").lower()
                 or q in k.get("mahasiswa_nim", "").lower()]
    kartu.sort(key=lambda x: x.get("generated_at", ""), reverse=True)
    items, meta = paginate(kartu, page, per_page)
    return ok(items, meta=meta)


@router.post("/kartu/generate")
def generate_kartu(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)

    semester = body.get("semester_akademik", "").strip()
    jenis = body.get("jenis", "").strip()
    if not semester or not jenis:
        raise HTTPException(400, "semester_akademik dan jenis wajib diisi")
    if jenis not in ("UTS", "UAS"):
        raise HTTPException(400, "jenis harus UTS atau UAS")

    now = _now()

    mahasiswa_list = [m for m in read_all("mahasiswa")
                      if m.get("status") == "aktif" and not m.get("deleted_at")]

    krs_list = read_all("krs")
    kelas_list = read_all("kelas")

    dibuat = 0
    diperbarui = 0
    existing_kartu = read_all("kartu_ujian")

    for mhs in mahasiswa_list:
        mhs_id = mhs["id"]

        krs_mhs = [k for k in krs_list
                   if k.get("mahasiswa_id") == mhs_id
                   and k.get("semester_akademik") == semester
                   and k.get("status") == "disetujui"
                   and not k.get("deleted_at")]
        if not krs_mhs:
            continue

        kendala = []

        if not _spp_lunas(mhs_id, semester):
            kendala.append({
                "isu": "spp_belum_lunas",
                "keterangan": "SPP semester ini belum lunas"
            })

        for kr in krs_mhs:
            kelas_id = kr.get("kelas_id")
            if not kelas_id:
                continue
            kelas = next((k for k in kelas_list if k["id"] == kelas_id), None)
            if not kelas:
                continue
            pct = _pct_hadir(kelas_id, mhs_id)
            if pct < 75:
                kendala.append({
                    "isu": "presensi_kurang",
                    "kelas_id": kelas_id,
                    "mata_kuliah_nama": kelas.get("mata_kuliah_nama", ""),
                    "mata_kuliah_kode": kelas.get("mata_kuliah_kode", ""),
                    "persen_hadir": pct,
                    "keterangan": f"Kehadiran {pct}% (min 75%)"
                })

        status_kartu = "layak" if not kendala else "tidak_layak"

        existing = next((k for k in existing_kartu
                         if k.get("mahasiswa_id") == mhs_id
                         and k.get("semester_akademik") == semester
                         and k.get("jenis") == jenis
                         and not k.get("deleted_at")), None)

        rec = {
            "mahasiswa_id": mhs_id,
            "mahasiswa_nama": mhs.get("nama_lengkap", ""),
            "mahasiswa_nim": mhs.get("nim", ""),
            "program_studi_id": mhs.get("program_studi_id", ""),
            "semester_akademik": semester,
            "jenis": jenis,
            "status": status_kartu,
            "kendala": kendala,
            "generated_at": now,
            "generated_by": user["id"],
            "generated_by_nama": user.get("nama", ""),
            "deleted_at": None,
        }

        if existing:
            rec["id"] = existing["id"]
            rec["created_at"] = existing.get("created_at", now)
            rec["updated_at"] = now
            update("kartu_ujian", existing["id"], rec)
            diperbarui += 1
        else:
            rec["id"] = str(uuid.uuid4())
            rec["created_at"] = now
            rec["updated_at"] = now
            insert("kartu_ujian", rec)
            dibuat += 1

    return ok(
        {"dibuat": dibuat, "diperbarui": diperbarui},
        f"Generate selesai: {dibuat} kartu baru, {diperbarui} diperbarui"
    )


@router.get("/kartu/{kartu_id}")
def get_kartu(kartu_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    k = find_by_id("kartu_ujian", kartu_id)
    if not k or k.get("deleted_at"):
        raise HTTPException(404, "Kartu ujian tidak ditemukan")

    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        if not mhs or k.get("mahasiswa_id") != mhs["id"]:
            raise HTTPException(403, "Akses ditolak")

    krs_list = [kr for kr in read_all("krs")
                if kr.get("mahasiswa_id") == k.get("mahasiswa_id")
                and kr.get("semester_akademik") == k.get("semester_akademik")
                and kr.get("status") == "disetujui"]
    jadwal_list = read_all("jadwal_ujian")
    mata_kuliah_ujian = []
    for kr in krs_list:
        kelas_id = kr.get("kelas_id")
        jadwal = next((j for j in jadwal_list
                       if j.get("kelas_id") == kelas_id
                       and j.get("jenis") == k.get("jenis")
                       and not j.get("deleted_at")), None)
        if jadwal:
            mata_kuliah_ujian.append({
                "kelas_id": kelas_id,
                "mata_kuliah_nama": jadwal.get("mata_kuliah_nama", ""),
                "mata_kuliah_kode": jadwal.get("mata_kuliah_kode", ""),
                "tanggal": jadwal.get("tanggal", ""),
                "jam_mulai": jadwal.get("jam_mulai", ""),
                "jam_selesai": jadwal.get("jam_selesai", ""),
                "ruang_nama": jadwal.get("ruang_nama", ""),
            })
    k["mata_kuliah_ujian"] = sorted(mata_kuliah_ujian, key=lambda x: x.get("tanggal", ""))
    return ok(k)


# ─── BERITA ACARA UJIAN ───────────────────────────────────────────────────────

@router.get("/berita-acara")
def list_berita_acara(
    semester: Optional[str] = None,
    jenis: Optional[str] = None,
    jadwal_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    ba = [b for b in read_all("berita_acara_ujian") if not b.get("deleted_at")]

    if user.get("role") == "dosen":
        dosen = get_dosen_for_user(user)
        kelas_ids = get_kelas_ids_untuk_dosen(dosen["id"]) if dosen else set()
        jadwal_ids = {j["id"] for j in read_all("jadwal_ujian")
                      if j.get("kelas_id") in kelas_ids and not j.get("deleted_at")}
        ba = [b for b in ba if b.get("jadwal_ujian_id") in jadwal_ids]

    if semester:
        ba = [b for b in ba if b.get("semester_akademik") == semester]
    if jenis:
        ba = [b for b in ba if b.get("jenis") == jenis]
    if jadwal_id:
        ba = [b for b in ba if b.get("jadwal_ujian_id") == jadwal_id]
    if status:
        ba = [b for b in ba if b.get("status") == status]
    ba.sort(key=lambda x: x.get("tanggal", ""), reverse=True)
    items, meta = paginate(ba, page, per_page)
    return ok(items, meta=meta)


@router.post("/berita-acara")
def create_berita_acara(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI + ["dosen"])

    jadwal_id = body.get("jadwal_ujian_id", "").strip()
    if not jadwal_id:
        raise HTTPException(400, "jadwal_ujian_id wajib diisi")

    jadwal = find_by_id("jadwal_ujian", jadwal_id)
    if not jadwal or jadwal.get("deleted_at"):
        raise HTTPException(404, "Jadwal ujian tidak ditemukan")

    if user.get("role") == "dosen":
        dosen = get_dosen_for_user(user)
        if not dosen or jadwal.get("dosen_id") != dosen["id"]:
            raise HTTPException(403, "Hanya dosen pengampu yang dapat membuat berita acara")

    existing = [b for b in read_all("berita_acara_ujian")
                if b.get("jadwal_ujian_id") == jadwal_id and not b.get("deleted_at")]
    if existing:
        raise HTTPException(400, "Berita acara untuk jadwal ini sudah ada")

    now = _now()
    rec = {
        "id": str(uuid.uuid4()),
        "jadwal_ujian_id": jadwal_id,
        "mata_kuliah_nama": jadwal.get("mata_kuliah_nama", ""),
        "mata_kuliah_kode": jadwal.get("mata_kuliah_kode", ""),
        "semester_akademik": jadwal.get("semester_akademik", ""),
        "jenis": jadwal.get("jenis", ""),
        "tanggal": jadwal.get("tanggal", ""),
        "jam_mulai": jadwal.get("jam_mulai", ""),
        "jam_selesai": jadwal.get("jam_selesai", ""),
        "ruang_nama": jadwal.get("ruang_nama", ""),
        "pengawas1": body.get("pengawas1", ""),
        "pengawas2": body.get("pengawas2", ""),
        "jumlah_peserta_terdaftar": body.get("jumlah_peserta_terdaftar", 0),
        "jumlah_hadir": body.get("jumlah_hadir", 0),
        "jumlah_tidak_hadir": body.get("jumlah_tidak_hadir", 0),
        "catatan": body.get("catatan", ""),
        "status": "draft",
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    insert("berita_acara_ujian", rec)
    return ok(rec, "Berita acara berhasil dibuat")


@router.get("/berita-acara/{ba_id}")
def get_berita_acara(ba_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    ba = find_by_id("berita_acara_ujian", ba_id)
    if not ba or ba.get("deleted_at"):
        raise HTTPException(404, "Berita acara tidak ditemukan")
    return ok(ba)


@router.put("/berita-acara/{ba_id}")
def update_berita_acara(ba_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI + ["dosen"])
    ba = find_by_id("berita_acara_ujian", ba_id)
    if not ba or ba.get("deleted_at"):
        raise HTTPException(404, "Berita acara tidak ditemukan")
    if ba.get("status") == "selesai":
        raise HTTPException(400, "Berita acara yang sudah selesai tidak dapat diubah")

    if user.get("role") == "dosen":
        jadwal = find_by_id("jadwal_ujian", ba.get("jadwal_ujian_id", ""))
        dosen = get_dosen_for_user(user)
        if not dosen or not jadwal or jadwal.get("dosen_id") != dosen["id"]:
            raise HTTPException(403, "Akses ditolak")

    allowed = ("pengawas1", "pengawas2", "jumlah_peserta_terdaftar",
               "jumlah_hadir", "jumlah_tidak_hadir", "catatan", "status")
    for k, v in body.items():
        if k in allowed:
            ba[k] = v
    ba["updated_at"] = _now()
    update("berita_acara_ujian", ba_id, ba)
    return ok(ba, "Berita acara berhasil diperbarui")


# ─── RINGKASAN / STATS ────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(semester: Optional[str] = None, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    jadwal = [j for j in read_all("jadwal_ujian") if not j.get("deleted_at")]
    kartu = [k for k in read_all("kartu_ujian") if not k.get("deleted_at")]
    ba = [b for b in read_all("berita_acara_ujian") if not b.get("deleted_at")]

    allowed_kelas = _kelas_ids_for_user(user)
    if allowed_kelas is not None:
        jadwal = [j for j in jadwal if j.get("kelas_id") in allowed_kelas]

    role = user.get("role")
    if role == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        kartu = [k for k in kartu if k.get("mahasiswa_id") == mhs_id]

    if semester:
        jadwal = [j for j in jadwal if j.get("semester_akademik") == semester]
        kartu = [k for k in kartu if k.get("semester_akademik") == semester]
        ba = [b for b in ba if b.get("semester_akademik") == semester]

    return ok({
        "total_jadwal": len(jadwal),
        "jadwal_uts": sum(1 for j in jadwal if j.get("jenis") == "UTS"),
        "jadwal_uas": sum(1 for j in jadwal if j.get("jenis") == "UAS"),
        "jadwal_dijadwalkan": sum(1 for j in jadwal if j.get("status") == "dijadwalkan"),
        "jadwal_selesai": sum(1 for j in jadwal if j.get("status") == "selesai"),
        "total_kartu": len(kartu),
        "kartu_layak": sum(1 for k in kartu if k.get("status") == "layak"),
        "kartu_tidak_layak": sum(1 for k in kartu if k.get("status") == "tidak_layak"),
        "total_berita_acara": len(ba),
        "ba_draft": sum(1 for b in ba if b.get("status") == "draft"),
        "ba_selesai": sum(1 for b in ba if b.get("status") == "selesai"),
    })
