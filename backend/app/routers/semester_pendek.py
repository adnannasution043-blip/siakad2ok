from fastapi import APIRouter, Query, HTTPException, Header
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.utils.db import read_all, find_by_id, insert, update, soft_delete, paginate
from app.utils.dev import (
    get_user_from_request, check_role,
    get_mahasiswa_for_user, get_dosen_for_user,
)

router = APIRouter(prefix="/semester-pendek", tags=["Semester Pendek"])

ADMIN_KAPRODI = ["super_admin", "admin_akademik", "kaprodi", "staf"]
DOSEN_ADMIN   = ["super_admin", "admin_akademik", "kaprodi", "dosen", "staf"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def _now():
    return datetime.now(timezone.utc).isoformat()

_HURUF_MAP = {"A": 4.0, "B+": 3.5, "B": 3.0, "C+": 2.5, "C": 2.0, "D": 1.0, "E": 0.0}

def _huruf(nilai: float) -> str:
    if nilai >= 85: return "A"
    if nilai >= 80: return "B+"
    if nilai >= 75: return "B"
    if nilai >= 70: return "C+"
    if nilai >= 65: return "C"
    if nilai >= 55: return "D"
    return "E"


# ─── PROGRAM SP ───────────────────────────────────────────────────────────────

@router.get("")
def list_program(
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    data = [p for p in read_all("program_sp") if not p.get("deleted_at")]
    if status:
        data = [p for p in data if p.get("status") == status]
    if search:
        q = search.lower()
        data = [p for p in data if q in p.get("nama", "").lower()
                or q in p.get("tahun_akademik", "").lower()]
    data.sort(key=lambda x: x.get("tanggal_mulai", ""), reverse=True)
    items, meta = paginate(data, page, per_page)
    kelas_all = read_all("kelas_sp")
    peserta_all = read_all("peserta_sp")
    for p in items:
        p["jumlah_kelas"] = sum(1 for k in kelas_all
                                if k.get("program_sp_id") == p["id"] and not k.get("deleted_at"))
        p["jumlah_peserta"] = sum(1 for ps in peserta_all
                                  if ps.get("program_sp_id") == p["id"] and not ps.get("deleted_at"))
    return ok(items, meta=meta)


@router.get("/stats")
def get_stats(authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    programs    = [p for p in read_all("program_sp")  if not p.get("deleted_at")]
    kelas_all   = [k for k in read_all("kelas_sp")    if not k.get("deleted_at")]
    peserta_all = [ps for ps in read_all("peserta_sp") if not ps.get("deleted_at")]
    return ok({
        "total_program":   len(programs),
        "program_aktif":   sum(1 for p in programs if p.get("status") == "aktif"),
        "total_kelas":     len(kelas_all),
        "total_peserta":   len(peserta_all),
        "peserta_selesai": sum(1 for ps in peserta_all if ps.get("nilai_akhir") is not None),
    })


@router.post("")
def create_program(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    nama = body.get("nama", "").strip()
    if not nama:
        raise HTTPException(400, "Nama program wajib diisi")
    now = _now()
    rec = {
        "id": str(uuid.uuid4()),
        "nama": nama,
        "tahun_akademik": body.get("tahun_akademik", "").strip(),
        "tanggal_mulai": body.get("tanggal_mulai", "").strip(),
        "tanggal_selesai": body.get("tanggal_selesai", "").strip(),
        "batas_sks": int(body.get("batas_sks", 9)),
        "min_peserta": int(body.get("min_peserta", 10)),
        "biaya_per_sks": float(body.get("biaya_per_sks", 0)) if body.get("biaya_per_sks") else 0,
        "status": "draft",
        "created_at": now,
        "deleted_at": None,
    }
    insert("program_sp", rec)
    return ok(rec, "Program SP berhasil dibuat")


@router.get("/{sp_id}")
def get_program(sp_id: str, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)
    p = find_by_id("program_sp", sp_id)
    if not p or p.get("deleted_at"):
        raise HTTPException(404, "Program SP tidak ditemukan")
    p["kelas"] = [k for k in read_all("kelas_sp")
                  if k.get("program_sp_id") == sp_id and not k.get("deleted_at")]
    return ok(p)


@router.put("/{sp_id}")
def update_program(sp_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    p = find_by_id("program_sp", sp_id)
    if not p or p.get("deleted_at"):
        raise HTTPException(404, "Program SP tidak ditemukan")
    allowed = ("nama", "tahun_akademik", "tanggal_mulai", "tanggal_selesai",
               "batas_sks", "min_peserta", "biaya_per_sks", "status")
    for k, v in body.items():
        if k in allowed:
            p[k] = v
    update("program_sp", sp_id, p)
    return ok(p, "Program SP diperbarui")


@router.delete("/{sp_id}")
def delete_program(sp_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    p = find_by_id("program_sp", sp_id)
    if not p or p.get("deleted_at"):
        raise HTTPException(404, "Program SP tidak ditemukan")
    if p.get("status") not in ("draft",):
        raise HTTPException(400, "Hanya program berstatus 'draft' yang dapat dihapus")
    soft_delete("program_sp", sp_id)
    return ok(None, "Program SP dihapus")


# ─── KELAS SP ─────────────────────────────────────────────────────────────────

@router.get("/kelas/list")
def list_kelas(
    program_sp_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    get_user_from_request(authorization)
    data = [k for k in read_all("kelas_sp") if not k.get("deleted_at")]
    if program_sp_id:
        data = [k for k in data if k.get("program_sp_id") == program_sp_id]
    if status:
        data = [k for k in data if k.get("status") == status]
    if search:
        q = search.lower()
        data = [k for k in data if q in k.get("mata_kuliah_nama", "").lower()
                or q in k.get("dosen_nama", "").lower()]
    data.sort(key=lambda x: x.get("mata_kuliah_nama", ""))
    items, meta = paginate(data, page, per_page)
    sp_map = {p["id"]: p["nama"] for p in read_all("program_sp") if not p.get("deleted_at")}
    for k in items:
        k["program_nama"] = sp_map.get(k.get("program_sp_id"), "—")
        k["jalan"] = k.get("jumlah_peserta", 0) >= k.get("min_peserta_override",
                           _get_sp_min(k.get("program_sp_id")))
    return ok(items, meta=meta)


def _get_sp_min(sp_id: str) -> int:
    sp = find_by_id("program_sp", sp_id)
    return sp.get("min_peserta", 10) if sp else 10


@router.post("/{sp_id}/kelas")
def create_kelas(sp_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    sp = find_by_id("program_sp", sp_id)
    if not sp or sp.get("deleted_at"):
        raise HTTPException(404, "Program SP tidak ditemukan")
    if sp.get("status") == "selesai":
        raise HTTPException(400, "Program SP sudah selesai")

    mk_id = body.get("mata_kuliah_id", "").strip()
    if not mk_id:
        raise HTTPException(400, "mata_kuliah_id wajib diisi")
    mk = find_by_id("mata_kuliah", mk_id)
    if not mk:
        raise HTTPException(404, "Mata kuliah tidak ditemukan")

    existing = [k for k in read_all("kelas_sp")
                if k.get("program_sp_id") == sp_id
                and k.get("mata_kuliah_id") == mk_id
                and not k.get("deleted_at")]
    if existing:
        raise HTTPException(400, "Mata kuliah sudah ada di program SP ini")

    now = _now()
    rec = {
        "id": str(uuid.uuid4()),
        "program_sp_id": sp_id,
        "mata_kuliah_id": mk_id,
        "mata_kuliah_nama": mk.get("nama", ""),
        "sks": mk.get("sks", 0),
        "dosen_id": body.get("dosen_id", ""),
        "dosen_nama": body.get("dosen_nama", ""),
        "jadwal": body.get("jadwal", ""),
        "ruang": body.get("ruang", ""),
        "kuota": int(body.get("kuota", 30)),
        "jumlah_peserta": 0,
        "status": "aktif",
        "created_at": now,
        "deleted_at": None,
    }
    insert("kelas_sp", rec)
    return ok(rec, "Kelas SP berhasil dibuat")


@router.put("/kelas/{kelas_id}")
def update_kelas(kelas_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    k = find_by_id("kelas_sp", kelas_id)
    if not k or k.get("deleted_at"):
        raise HTTPException(404, "Kelas SP tidak ditemukan")
    allowed = ("dosen_id", "dosen_nama", "jadwal", "ruang", "kuota", "status")
    for key, val in body.items():
        if key in allowed:
            k[key] = val
    update("kelas_sp", kelas_id, k)
    return ok(k, "Kelas SP diperbarui")


@router.delete("/kelas/{kelas_id}")
def delete_kelas(kelas_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN_KAPRODI)
    k = find_by_id("kelas_sp", kelas_id)
    if not k or k.get("deleted_at"):
        raise HTTPException(404, "Kelas SP tidak ditemukan")
    if k.get("jumlah_peserta", 0) > 0:
        raise HTTPException(400, "Tidak dapat menghapus kelas yang sudah ada peserta")
    soft_delete("kelas_sp", kelas_id)
    return ok(None, "Kelas SP dihapus")


# ─── PESERTA SP ───────────────────────────────────────────────────────────────

@router.get("/peserta/list")
def list_peserta(
    program_sp_id: Optional[str] = None,
    kelas_sp_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    data = [ps for ps in read_all("peserta_sp") if not ps.get("deleted_at")]

    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        data = [ps for ps in data if ps.get("mahasiswa_id") == mhs_id]
    else:
        check_role(user, DOSEN_ADMIN)

    if program_sp_id:
        data = [ps for ps in data if ps.get("program_sp_id") == program_sp_id]
    if kelas_sp_id:
        data = [ps for ps in data if ps.get("kelas_sp_id") == kelas_sp_id]
    if search:
        q = search.lower()
        data = [ps for ps in data if q in ps.get("mahasiswa_nama", "").lower()
                or q in ps.get("mahasiswa_nim", "").lower()
                or q in ps.get("mata_kuliah_nama", "").lower()]
    data.sort(key=lambda x: x.get("mahasiswa_nama", ""))
    items, meta = paginate(data, page, per_page)
    return ok(items, meta=meta)


@router.post("/kelas/{kelas_id}/daftar")
def daftar_peserta(kelas_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    kls = find_by_id("kelas_sp", kelas_id)
    if not kls or kls.get("deleted_at"):
        raise HTTPException(404, "Kelas SP tidak ditemukan")

    sp = find_by_id("program_sp", kls["program_sp_id"])
    if not sp or sp.get("status") not in ("aktif", "draft"):
        raise HTTPException(400, "Program SP tidak menerima pendaftaran")

    # Mahasiswa can self-register; admin can register any mahasiswa
    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        if not mhs:
            raise HTTPException(403, "Data mahasiswa tidak ditemukan")
        mahasiswa_id = mhs["id"]
    else:
        check_role(user, ADMIN_KAPRODI)
        mahasiswa_id = body.get("mahasiswa_id", "").strip()
        if not mahasiswa_id:
            raise HTTPException(400, "mahasiswa_id wajib diisi")

    mhs = find_by_id("mahasiswa", mahasiswa_id)
    if not mhs:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")

    # Validate prior grade
    nilai_lama = [n for n in read_all("nilai")
                  if n.get("mahasiswa_id") == mahasiswa_id
                  and (n.get("mata_kuliah_nama") == kls["mata_kuliah_nama"]
                       or n.get("kelas_id") == kls.get("mata_kuliah_id"))
                  and n.get("nilai_huruf") in ("D", "E", "C", "C+")
                  and not n.get("deleted_at")]
    nilai_asal = nilai_lama[0]["nilai_huruf"] if nilai_lama else body.get("nilai_asal", "")
    if not nilai_asal:
        raise HTTPException(400,
            f"Mahasiswa tidak memiliki nilai D/E/C di MK {kls['mata_kuliah_nama']} — tidak berhak mengambil SP")

    existing = [ps for ps in read_all("peserta_sp")
                if ps.get("kelas_sp_id") == kelas_id
                and ps.get("mahasiswa_id") == mahasiswa_id
                and not ps.get("deleted_at")]
    if existing:
        raise HTTPException(400, "Mahasiswa sudah terdaftar di kelas SP ini")

    batas_sks = sp.get("batas_sks", 9)
    total_sks = sum(ps.get("sks", 0) for ps in read_all("peserta_sp")
                    if ps.get("program_sp_id") == kls["program_sp_id"]
                    and ps.get("mahasiswa_id") == mahasiswa_id
                    and not ps.get("deleted_at"))
    if total_sks + kls.get("sks", 0) > batas_sks:
        raise HTTPException(400, f"Total SKS melebihi batas {batas_sks} SKS untuk program SP ini")

    if kls.get("jumlah_peserta", 0) >= kls.get("kuota", 30):
        raise HTTPException(400, "Kuota kelas SP sudah penuh")

    now = _now()
    rec = {
        "id": str(uuid.uuid4()),
        "kelas_sp_id": kelas_id,
        "program_sp_id": kls["program_sp_id"],
        "mahasiswa_id": mahasiswa_id,
        "mahasiswa_nama": mhs.get("nama_lengkap", ""),
        "mahasiswa_nim": mhs.get("nim", ""),
        "mata_kuliah_nama": kls["mata_kuliah_nama"],
        "sks": kls.get("sks", 0),
        "nilai_asal": nilai_asal,
        "nilai_akhir": None,
        "nilai_huruf": None,
        "bobot": None,
        "status": "aktif",
        "tgl_daftar": now,
        "created_at": now,
        "deleted_at": None,
    }
    insert("peserta_sp", rec)
    kls["jumlah_peserta"] = kls.get("jumlah_peserta", 0) + 1
    update("kelas_sp", kelas_id, kls)
    return ok(rec, "Berhasil mendaftar SP")


@router.delete("/peserta/{peserta_id}")
def hapus_peserta(peserta_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    ps = find_by_id("peserta_sp", peserta_id)
    if not ps or ps.get("deleted_at"):
        raise HTTPException(404, "Data peserta tidak ditemukan")

    if user.get("role") == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        if ps.get("mahasiswa_id") != mhs_id:
            raise HTTPException(403, "Akses ditolak")
    else:
        check_role(user, ADMIN_KAPRODI)

    if ps.get("nilai_akhir") is not None:
        raise HTTPException(400, "Tidak dapat menghapus peserta yang sudah memiliki nilai")
    soft_delete("peserta_sp", peserta_id)
    kls = find_by_id("kelas_sp", ps["kelas_sp_id"])
    if kls:
        kls["jumlah_peserta"] = max(0, kls.get("jumlah_peserta", 1) - 1)
        update("kelas_sp", ps["kelas_sp_id"], kls)
    return ok(None, "Peserta dihapus")


@router.post("/peserta/{peserta_id}/nilai")
def input_nilai(peserta_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, DOSEN_ADMIN)
    ps = find_by_id("peserta_sp", peserta_id)
    if not ps or ps.get("deleted_at"):
        raise HTTPException(404, "Data peserta tidak ditemukan")

    # Dosen can only input nilai for kelas they teach
    if user.get("role") == "dosen":
        d = get_dosen_for_user(user)
        did = d["id"] if d else ""
        kls = find_by_id("kelas_sp", ps.get("kelas_sp_id", ""))
        if not kls or kls.get("dosen_id") != did:
            raise HTTPException(403, "Anda bukan pengajar kelas SP ini")

    nilai_raw = body.get("nilai_akhir")
    if nilai_raw is None:
        raise HTTPException(400, "nilai_akhir wajib diisi")
    nilai = float(nilai_raw)
    if not (0 <= nilai <= 100):
        raise HTTPException(400, "Nilai harus antara 0–100")

    huruf = _huruf(nilai)
    bobot = _HURUF_MAP.get(huruf, 0.0)

    nilai_asal_huruf = ps.get("nilai_asal", "")
    if nilai_asal_huruf in ("C", "C+"):
        bobot_asal = _HURUF_MAP.get(nilai_asal_huruf, 2.0)
        if bobot < bobot_asal:
            huruf = nilai_asal_huruf
            bobot = bobot_asal

    ps["nilai_akhir"] = nilai
    ps["nilai_huruf"] = huruf
    ps["bobot"] = bobot
    ps["status"] = "selesai"
    update("peserta_sp", peserta_id, ps)
    return ok(ps, "Nilai SP berhasil diinput")
