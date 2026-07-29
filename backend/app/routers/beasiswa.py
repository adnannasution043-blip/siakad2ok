from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.utils.db import read_all, find_by_id, insert, update, soft_delete, paginate

router = APIRouter(prefix="/beasiswa", tags=["Beasiswa"])

def _dev_user():
    return {"id": "usr-001", "role": "super_admin", "nama": "Administrator"}

def _now():
    return datetime.now(timezone.utc).isoformat()

# ─── PROGRAM BEASISWA ─────────────────────────────────────────────────────────

@router.get("")
def list_beasiswa(
    status: Optional[str] = None,
    jenis: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
):
    data = [b for b in read_all("beasiswa") if not b.get("deleted_at")]
    if status:
        data = [b for b in data if b.get("status") == status]
    if jenis:
        data = [b for b in data if b.get("jenis") == jenis]
    if search:
        q = search.lower()
        data = [b for b in data if q in b.get("nama", "").lower()]
    data.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items, meta = paginate(data, page, per_page)
    # Enrich each with pendaftar count
    daftar_list = read_all("daftar_beasiswa")
    for b in items:
        b["jumlah_pendaftar"] = sum(1 for d in daftar_list
                                    if d.get("beasiswa_id") == b["id"] and not d.get("deleted_at"))
        b["jumlah_diterima"] = sum(1 for d in daftar_list
                                   if d.get("beasiswa_id") == b["id"]
                                   and d.get("status") == "diterima"
                                   and not d.get("deleted_at"))
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


@router.get("/stats")
def get_stats():
    beasiswa = [b for b in read_all("beasiswa") if not b.get("deleted_at")]
    daftar = [d for d in read_all("daftar_beasiswa") if not d.get("deleted_at")]
    return {
        "success": True,
        "data": {
            "total_program": len(beasiswa),
            "program_buka": sum(1 for b in beasiswa if b.get("status") == "buka"),
            "total_pendaftar": len(daftar),
            "menunggu": sum(1 for d in daftar if d.get("status") == "menunggu"),
            "diterima": sum(1 for d in daftar if d.get("status") == "diterima"),
            "ditolak": sum(1 for d in daftar if d.get("status") == "ditolak"),
        },
        "message": "Berhasil",
        "meta": None,
    }


@router.post("")
def create_beasiswa(body: dict):
    nama = body.get("nama", "").strip()
    if not nama:
        raise HTTPException(400, "Nama beasiswa wajib diisi")
    now = _now()
    rec = {
        "id": str(uuid.uuid4()),
        "nama": nama,
        "jenis": body.get("jenis", "umum"),
        "kuota": int(body.get("kuota", 0)),
        "nilai_min_ipk": float(body.get("nilai_min_ipk", 0)) if body.get("nilai_min_ipk") else None,
        "syarat": body.get("syarat", ""),
        "besaran": float(body.get("besaran", 0)) if body.get("besaran") else None,
        "periode": body.get("periode", ""),
        "status": "buka",
        "created_at": now,
        "deleted_at": None,
    }
    insert("beasiswa", rec)
    return {"success": True, "data": rec, "message": "Program beasiswa berhasil dibuat", "meta": None}


@router.get("/{bsw_id}")
def get_beasiswa(bsw_id: str):
    b = find_by_id("beasiswa", bsw_id)
    if not b or b.get("deleted_at"):
        raise HTTPException(404, "Program beasiswa tidak ditemukan")
    daftar = [d for d in read_all("daftar_beasiswa")
              if d.get("beasiswa_id") == bsw_id and not d.get("deleted_at")]
    b["pendaftar"] = daftar
    return {"success": True, "data": b, "message": "Berhasil", "meta": None}


@router.put("/{bsw_id}")
def update_beasiswa(bsw_id: str, body: dict):
    b = find_by_id("beasiswa", bsw_id)
    if not b or b.get("deleted_at"):
        raise HTTPException(404, "Program beasiswa tidak ditemukan")
    allowed = ("nama", "jenis", "kuota", "nilai_min_ipk", "syarat", "besaran", "periode", "status")
    for k, v in body.items():
        if k in allowed:
            b[k] = v
    update("beasiswa", bsw_id, b)
    return {"success": True, "data": b, "message": "Program beasiswa diperbarui", "meta": None}


@router.delete("/{bsw_id}")
def delete_beasiswa(bsw_id: str):
    b = find_by_id("beasiswa", bsw_id)
    if not b or b.get("deleted_at"):
        raise HTTPException(404, "Program beasiswa tidak ditemukan")
    # Cek belum ada pendaftar diterima
    diterima = [d for d in read_all("daftar_beasiswa")
                if d.get("beasiswa_id") == bsw_id
                and d.get("status") == "diterima"
                and not d.get("deleted_at")]
    if diterima:
        raise HTTPException(400, "Tidak dapat menghapus beasiswa yang sudah ada penerima")
    soft_delete("beasiswa", bsw_id)
    return {"success": True, "data": None, "message": "Program beasiswa dihapus", "meta": None}


# ─── PENDAFTARAN ──────────────────────────────────────────────────────────────

@router.get("/daftar/list")
def list_pendaftar(
    beasiswa_id: Optional[str] = None,
    status: Optional[str] = None,
    semester: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
):
    data = [d for d in read_all("daftar_beasiswa") if not d.get("deleted_at")]
    if beasiswa_id:
        data = [d for d in data if d.get("beasiswa_id") == beasiswa_id]
    if status:
        data = [d for d in data if d.get("status") == status]
    if semester:
        data = [d for d in data if d.get("semester_akademik") == semester]
    if search:
        q = search.lower()
        data = [d for d in data if q in d.get("mahasiswa_nama", "").lower()
                or q in d.get("mahasiswa_nim", "").lower()
                or q in d.get("beasiswa_nama", "").lower()]
    data.sort(key=lambda x: x.get("tgl_daftar", ""), reverse=True)
    items, meta = paginate(data, page, per_page)
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


@router.post("/{bsw_id}/daftar")
def daftar_beasiswa(bsw_id: str, body: dict):
    bsw = find_by_id("beasiswa", bsw_id)
    if not bsw or bsw.get("deleted_at"):
        raise HTTPException(404, "Program beasiswa tidak ditemukan")
    if bsw.get("status") != "buka":
        raise HTTPException(400, "Program beasiswa sudah ditutup")

    mahasiswa_id = body.get("mahasiswa_id", "").strip()
    if not mahasiswa_id:
        raise HTTPException(400, "mahasiswa_id wajib diisi")

    mhs = find_by_id("mahasiswa", mahasiswa_id)
    if not mhs:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")

    # Cek syarat IPK
    min_ipk = bsw.get("nilai_min_ipk")
    if min_ipk and (mhs.get("ipk") or 0) < min_ipk:
        raise HTTPException(400, f"IPK mahasiswa {mhs.get('ipk',0)} tidak memenuhi minimum {min_ipk}")

    # Cek sudah pernah daftar periode ini
    existing = [d for d in read_all("daftar_beasiswa")
                if d.get("beasiswa_id") == bsw_id
                and d.get("mahasiswa_id") == mahasiswa_id
                and d.get("status") != "ditolak"
                and not d.get("deleted_at")]
    if existing:
        raise HTTPException(400, "Mahasiswa sudah mendaftar beasiswa ini")

    # Cek kuota
    kuota = bsw.get("kuota", 0)
    if kuota > 0:
        diterima = sum(1 for d in read_all("daftar_beasiswa")
                       if d.get("beasiswa_id") == bsw_id
                       and d.get("status") == "diterima"
                       and not d.get("deleted_at"))
        if diterima >= kuota:
            raise HTTPException(400, "Kuota beasiswa sudah penuh")

    semester = body.get("semester_akademik", bsw.get("periode", ""))
    now = _now()
    rec = {
        "id": str(uuid.uuid4()),
        "beasiswa_id": bsw_id,
        "beasiswa_nama": bsw.get("nama", ""),
        "mahasiswa_id": mahasiswa_id,
        "mahasiswa_nama": mhs.get("nama_lengkap", ""),
        "mahasiswa_nim": mhs.get("nim", ""),
        "ipk": mhs.get("ipk", 0),
        "semester_akademik": semester,
        "status": "menunggu",
        "alasan": body.get("alasan", ""),
        "tgl_daftar": now,
        "created_at": now,
        "deleted_at": None,
    }
    insert("daftar_beasiswa", rec)
    return {"success": True, "data": rec, "message": "Pendaftaran beasiswa berhasil", "meta": None}


@router.post("/daftar/{daftar_id}/setujui")
def setujui_pendaftaran(daftar_id: str):
    d = find_by_id("daftar_beasiswa", daftar_id)
    if not d or d.get("deleted_at"):
        raise HTTPException(404, "Data pendaftaran tidak ditemukan")
    if d.get("status") != "menunggu":
        raise HTTPException(400, "Hanya pendaftaran 'menunggu' yang dapat disetujui")

    # Cek kuota ulang
    bsw = find_by_id("beasiswa", d["beasiswa_id"])
    if bsw:
        kuota = bsw.get("kuota", 0)
        if kuota > 0:
            diterima = sum(1 for x in read_all("daftar_beasiswa")
                           if x.get("beasiswa_id") == d["beasiswa_id"]
                           and x.get("status") == "diterima"
                           and not x.get("deleted_at"))
            if diterima >= kuota:
                raise HTTPException(400, "Kuota beasiswa sudah penuh")

    d["status"] = "diterima"
    d["tgl_keputusan"] = _now()
    update("daftar_beasiswa", daftar_id, d)
    return {"success": True, "data": d, "message": "Pendaftaran diterima", "meta": None}


@router.post("/daftar/{daftar_id}/tolak")
def tolak_pendaftaran(daftar_id: str, body: dict):
    d = find_by_id("daftar_beasiswa", daftar_id)
    if not d or d.get("deleted_at"):
        raise HTTPException(404, "Data pendaftaran tidak ditemukan")
    if d.get("status") != "menunggu":
        raise HTTPException(400, "Hanya pendaftaran 'menunggu' yang dapat ditolak")
    alasan = body.get("alasan", "").strip()
    if not alasan:
        raise HTTPException(400, "Alasan penolakan wajib diisi")
    d["status"] = "ditolak"
    d["alasan_keputusan"] = alasan
    d["tgl_keputusan"] = _now()
    update("daftar_beasiswa", daftar_id, d)
    return {"success": True, "data": d, "message": "Pendaftaran ditolak", "meta": None}
