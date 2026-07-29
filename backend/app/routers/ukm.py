from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.utils.db import read_all, find_by_id, insert, update, soft_delete, paginate

router = APIRouter(prefix="/ukm", tags=["UKM / Organisasi"])

def _now():
    return datetime.now(timezone.utc).isoformat()

# ─── UKM ─────────────────────────────────────────────────────────────────────

@router.get("")
def list_ukm(
    kategori: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
):
    data = [u for u in read_all("ukm") if not u.get("deleted_at")]
    if kategori:
        data = [u for u in data if u.get("kategori") == kategori]
    if status:
        data = [u for u in data if u.get("status") == status]
    if search:
        q = search.lower()
        data = [u for u in data if q in u.get("nama", "").lower()
                or q in u.get("singkatan", "").lower()]
    data.sort(key=lambda x: x.get("nama", ""))
    items, meta = paginate(data, page, per_page)
    anggota_all = read_all("anggota_ukm")
    for u in items:
        u["jumlah_anggota"] = sum(1 for a in anggota_all
                                  if a.get("ukm_id") == u["id"] and not a.get("deleted_at"))
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


@router.get("/stats")
def get_stats():
    ukm_list = [u for u in read_all("ukm") if not u.get("deleted_at")]
    anggota_all = [a for a in read_all("anggota_ukm") if not a.get("deleted_at")]
    kegiatan_all = [k for k in read_all("kegiatan_ukm") if not k.get("deleted_at")]

    kat_count = {}
    for u in ukm_list:
        kat = u.get("kategori", "lainnya")
        kat_count[kat] = kat_count.get(kat, 0) + 1

    return {
        "success": True,
        "data": {
            "total_ukm": len(ukm_list),
            "ukm_aktif": sum(1 for u in ukm_list if u.get("status") == "aktif"),
            "total_anggota": len(anggota_all),
            "total_kegiatan": len(kegiatan_all),
            "kegiatan_selesai": sum(1 for k in kegiatan_all if k.get("status") == "selesai"),
            "per_kategori": [{"kategori": k, "jumlah": v} for k, v in sorted(kat_count.items())],
        },
        "message": "Berhasil",
        "meta": None,
    }


@router.post("")
def create_ukm(body: dict):
    nama = body.get("nama", "").strip()
    if not nama:
        raise HTTPException(400, "Nama UKM wajib diisi")
    now = _now()
    rec = {
        "id": str(uuid.uuid4()),
        "nama": nama,
        "singkatan": body.get("singkatan", "").strip().upper(),
        "kategori": body.get("kategori", "penalaran"),
        "deskripsi": body.get("deskripsi", ""),
        "ketua_nama": body.get("ketua_nama", ""),
        "pembina_nama": body.get("pembina_nama", ""),
        "tahun_berdiri": int(body.get("tahun_berdiri", 0)) if body.get("tahun_berdiri") else None,
        "status": "aktif",
        "created_at": now,
        "deleted_at": None,
    }
    insert("ukm", rec)
    return {"success": True, "data": rec, "message": "UKM berhasil dibuat", "meta": None}


@router.get("/{ukm_id}")
def get_ukm(ukm_id: str):
    u = find_by_id("ukm", ukm_id)
    if not u or u.get("deleted_at"):
        raise HTTPException(404, "UKM tidak ditemukan")
    anggota = [a for a in read_all("anggota_ukm")
               if a.get("ukm_id") == ukm_id and not a.get("deleted_at")]
    kegiatan = [k for k in read_all("kegiatan_ukm")
                if k.get("ukm_id") == ukm_id and not k.get("deleted_at")]
    u["anggota"] = anggota
    u["kegiatan"] = kegiatan
    return {"success": True, "data": u, "message": "Berhasil", "meta": None}


@router.put("/{ukm_id}")
def update_ukm(ukm_id: str, body: dict):
    u = find_by_id("ukm", ukm_id)
    if not u or u.get("deleted_at"):
        raise HTTPException(404, "UKM tidak ditemukan")
    allowed = ("nama", "singkatan", "kategori", "deskripsi", "ketua_nama",
               "pembina_nama", "tahun_berdiri", "status")
    for k, v in body.items():
        if k in allowed:
            u[k] = v
    update("ukm", ukm_id, u)
    return {"success": True, "data": u, "message": "UKM diperbarui", "meta": None}


@router.delete("/{ukm_id}")
def delete_ukm(ukm_id: str):
    u = find_by_id("ukm", ukm_id)
    if not u or u.get("deleted_at"):
        raise HTTPException(404, "UKM tidak ditemukan")
    aktif = [a for a in read_all("anggota_ukm")
             if a.get("ukm_id") == ukm_id and not a.get("deleted_at")]
    if aktif:
        raise HTTPException(400, "Tidak dapat menghapus UKM yang masih memiliki anggota aktif")
    soft_delete("ukm", ukm_id)
    return {"success": True, "data": None, "message": "UKM dihapus", "meta": None}


# ─── ANGGOTA ──────────────────────────────────────────────────────────────────

@router.get("/anggota/list")
def list_anggota(
    ukm_id: Optional[str] = None,
    jabatan: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
):
    data = [a for a in read_all("anggota_ukm") if not a.get("deleted_at")]
    if ukm_id:
        data = [a for a in data if a.get("ukm_id") == ukm_id]
    if jabatan:
        data = [a for a in data if a.get("jabatan") == jabatan]
    if status:
        data = [a for a in data if a.get("status") == status]
    if search:
        q = search.lower()
        data = [a for a in data if q in a.get("mahasiswa_nama", "").lower()
                or q in a.get("mahasiswa_nim", "").lower()]
    data.sort(key=lambda x: x.get("mahasiswa_nama", ""))
    items, meta = paginate(data, page, per_page)
    # Enrich with ukm nama
    ukm_map = {u["id"]: u["nama"] for u in read_all("ukm") if not u.get("deleted_at")}
    for a in items:
        a["ukm_nama"] = ukm_map.get(a.get("ukm_id"), "—")
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


@router.post("/{ukm_id}/daftar")
def daftar_anggota(ukm_id: str, body: dict):
    u = find_by_id("ukm", ukm_id)
    if not u or u.get("deleted_at"):
        raise HTTPException(404, "UKM tidak ditemukan")
    if u.get("status") != "aktif":
        raise HTTPException(400, "UKM sedang tidak aktif")

    mahasiswa_id = body.get("mahasiswa_id", "").strip()
    if not mahasiswa_id:
        raise HTTPException(400, "mahasiswa_id wajib diisi")

    mhs = find_by_id("mahasiswa", mahasiswa_id)
    if not mhs:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")

    existing = [a for a in read_all("anggota_ukm")
                if a.get("ukm_id") == ukm_id
                and a.get("mahasiswa_id") == mahasiswa_id
                and not a.get("deleted_at")]
    if existing:
        raise HTTPException(400, "Mahasiswa sudah terdaftar di UKM ini")

    now = _now()
    rec = {
        "id": str(uuid.uuid4()),
        "ukm_id": ukm_id,
        "mahasiswa_id": mahasiswa_id,
        "mahasiswa_nama": mhs.get("nama_lengkap", ""),
        "mahasiswa_nim": mhs.get("nim", ""),
        "jabatan": body.get("jabatan", "Anggota"),
        "semester_aktif": body.get("semester_aktif", ""),
        "status": "aktif",
        "tgl_bergabung": now,
        "created_at": now,
        "deleted_at": None,
    }
    insert("anggota_ukm", rec)
    return {"success": True, "data": rec, "message": "Anggota berhasil didaftarkan", "meta": None}


@router.put("/anggota/{anggota_id}")
def update_anggota(anggota_id: str, body: dict):
    a = find_by_id("anggota_ukm", anggota_id)
    if not a or a.get("deleted_at"):
        raise HTTPException(404, "Data anggota tidak ditemukan")
    for k in ("jabatan", "status", "semester_aktif"):
        if k in body:
            a[k] = body[k]
    update("anggota_ukm", anggota_id, a)
    return {"success": True, "data": a, "message": "Data anggota diperbarui", "meta": None}


@router.delete("/anggota/{anggota_id}")
def hapus_anggota(anggota_id: str):
    a = find_by_id("anggota_ukm", anggota_id)
    if not a or a.get("deleted_at"):
        raise HTTPException(404, "Data anggota tidak ditemukan")
    soft_delete("anggota_ukm", anggota_id)
    return {"success": True, "data": None, "message": "Anggota dihapus dari UKM", "meta": None}


# ─── KEGIATAN ─────────────────────────────────────────────────────────────────

@router.get("/kegiatan/list")
def list_kegiatan(
    ukm_id: Optional[str] = None,
    jenis: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
):
    data = [k for k in read_all("kegiatan_ukm") if not k.get("deleted_at")]
    if ukm_id:
        data = [k for k in data if k.get("ukm_id") == ukm_id]
    if jenis:
        data = [k for k in data if k.get("jenis") == jenis]
    if status:
        data = [k for k in data if k.get("status") == status]
    if search:
        q = search.lower()
        data = [k for k in data if q in k.get("nama", "").lower()]
    data.sort(key=lambda x: x.get("tanggal", ""), reverse=True)
    items, meta = paginate(data, page, per_page)
    ukm_map = {u["id"]: u["nama"] for u in read_all("ukm") if not u.get("deleted_at")}
    for k in items:
        k["ukm_nama"] = ukm_map.get(k.get("ukm_id"), "—")
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


@router.post("/{ukm_id}/kegiatan")
def create_kegiatan(ukm_id: str, body: dict):
    u = find_by_id("ukm", ukm_id)
    if not u or u.get("deleted_at"):
        raise HTTPException(404, "UKM tidak ditemukan")
    nama = body.get("nama", "").strip()
    tanggal = body.get("tanggal", "").strip()
    if not nama or not tanggal:
        raise HTTPException(400, "Nama dan tanggal kegiatan wajib diisi")
    now = _now()
    rec = {
        "id": str(uuid.uuid4()),
        "ukm_id": ukm_id,
        "nama": nama,
        "jenis": body.get("jenis", "latihan"),
        "tanggal": tanggal,
        "lokasi": body.get("lokasi", ""),
        "deskripsi": body.get("deskripsi", ""),
        "peserta_target": int(body.get("peserta_target", 0)) if body.get("peserta_target") else 0,
        "peserta_hadir": 0,
        "status": "akan_datang",
        "created_at": now,
        "deleted_at": None,
    }
    insert("kegiatan_ukm", rec)
    return {"success": True, "data": rec, "message": "Kegiatan berhasil dibuat", "meta": None}


@router.put("/kegiatan/{kegiatan_id}")
def update_kegiatan(kegiatan_id: str, body: dict):
    k = find_by_id("kegiatan_ukm", kegiatan_id)
    if not k or k.get("deleted_at"):
        raise HTTPException(404, "Kegiatan tidak ditemukan")
    allowed = ("nama", "jenis", "tanggal", "lokasi", "deskripsi",
               "peserta_target", "peserta_hadir", "status")
    for key, val in body.items():
        if key in allowed:
            k[key] = val
    update("kegiatan_ukm", kegiatan_id, k)
    return {"success": True, "data": k, "message": "Kegiatan diperbarui", "meta": None}


@router.delete("/kegiatan/{kegiatan_id}")
def delete_kegiatan(kegiatan_id: str):
    k = find_by_id("kegiatan_ukm", kegiatan_id)
    if not k or k.get("deleted_at"):
        raise HTTPException(404, "Kegiatan tidak ditemukan")
    soft_delete("kegiatan_ukm", kegiatan_id)
    return {"success": True, "data": None, "message": "Kegiatan dihapus", "meta": None}
