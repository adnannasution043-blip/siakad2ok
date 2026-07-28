from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.utils.db import read_all, find_by_id, insert, update, soft_delete, paginate

router = APIRouter(prefix="/ta", tags=["Tugas Akhir"])

STATUS_FLOW = ["pengajuan", "approved", "seminar_proposal", "bimbingan", "penulisan", "sidang", "revisi", "selesai"]

def _dev_user():
    return {"id": "usr-001", "role": "super_admin", "nama": "Administrator"}

def _now():
    return datetime.now(timezone.utc).isoformat()

def _enrich_ta(ta: dict) -> dict:
    sidang_list = read_all("sidang_ta")
    ta["sidang"] = next((s for s in sidang_list
                         if s.get("ta_id") == ta["id"] and not s.get("deleted_at")), None)
    bimb = [b for b in read_all("bimbingan_ta")
            if b.get("ta_id") == ta["id"] and not b.get("deleted_at")]
    ta["jumlah_bimbingan"] = len(bimb)
    return ta

# ─── TUGAS AKHIR ─────────────────────────────────────────────────────────────

@router.get("")
def list_ta(
    status: Optional[str] = None,
    mahasiswa_id: Optional[str] = None,
    pembimbing_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    ta = [t for t in read_all("tugas_akhir") if not t.get("deleted_at")]
    if status:
        ta = [t for t in ta if t.get("status") == status]
    if mahasiswa_id:
        ta = [t for t in ta if t.get("mahasiswa_id") == mahasiswa_id]
    if pembimbing_id:
        ta = [t for t in ta if t.get("pembimbing1_id") == pembimbing_id
              or t.get("pembimbing2_id") == pembimbing_id]
    if search:
        q = search.lower()
        ta = [t for t in ta if q in t.get("judul", "").lower()
              or q in t.get("mahasiswa_nama", "").lower()
              or q in t.get("mahasiswa_nim", "").lower()]
    ta.sort(key=lambda x: x.get("tgl_pengajuan", ""), reverse=True)
    items, meta = paginate(ta, page, per_page)
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


@router.post("")
def ajukan_ta(body: dict):
    mahasiswa_id = body.get("mahasiswa_id", "").strip()
    judul = body.get("judul", "").strip()
    if not mahasiswa_id or not judul:
        raise HTTPException(400, "mahasiswa_id dan judul wajib diisi")

    mhs = find_by_id("mahasiswa", mahasiswa_id)
    if not mhs:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")

    # Cek sudah ada TA aktif
    existing = [t for t in read_all("tugas_akhir")
                if t.get("mahasiswa_id") == mahasiswa_id
                and t.get("status") not in ("selesai",)
                and not t.get("deleted_at")]
    if existing:
        raise HTTPException(400, "Mahasiswa ini sudah memiliki TA yang sedang berjalan")

    # Resolve pembimbing
    pb1 = find_by_id("dosen", body.get("pembimbing1_id", "")) if body.get("pembimbing1_id") else None
    pb2 = find_by_id("dosen", body.get("pembimbing2_id", "")) if body.get("pembimbing2_id") else None

    now = _now()
    rec = {
        "id": str(uuid.uuid4()),
        "mahasiswa_id": mahasiswa_id,
        "mahasiswa_nama": mhs.get("nama_lengkap", ""),
        "mahasiswa_nim": mhs.get("nim", ""),
        "program_studi_id": mhs.get("program_studi_id", ""),
        "judul": judul,
        "bidang": body.get("bidang", ""),
        "latar_belakang": body.get("latar_belakang", ""),
        "status": "pengajuan",
        "pembimbing1_id": pb1["id"] if pb1 else None,
        "pembimbing1_nama": pb1["nama_lengkap"] if pb1 else None,
        "pembimbing2_id": pb2["id"] if pb2 else None,
        "pembimbing2_nama": pb2["nama_lengkap"] if pb2 else None,
        "nilai_sidang": None,
        "tgl_pengajuan": now,
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    insert("tugas_akhir", rec)
    return {"success": True, "data": rec, "message": "Pengajuan TA berhasil disubmit", "meta": None}


@router.get("/{ta_id}")
def get_ta(ta_id: str):
    ta = find_by_id("tugas_akhir", ta_id)
    if not ta or ta.get("deleted_at"):
        raise HTTPException(404, "TA tidak ditemukan")
    return {"success": True, "data": _enrich_ta(ta), "message": "Berhasil", "meta": None}


@router.put("/{ta_id}")
def update_ta(ta_id: str, body: dict):
    ta = find_by_id("tugas_akhir", ta_id)
    if not ta or ta.get("deleted_at"):
        raise HTTPException(404, "TA tidak ditemukan")
    if ta.get("status") == "selesai":
        raise HTTPException(400, "TA yang sudah selesai tidak dapat diubah")

    allowed = ("judul", "bidang", "latar_belakang")
    for k, v in body.items():
        if k in allowed:
            ta[k] = v

    if body.get("pembimbing1_id"):
        pb1 = find_by_id("dosen", body["pembimbing1_id"])
        if pb1:
            ta["pembimbing1_id"] = pb1["id"]
            ta["pembimbing1_nama"] = pb1["nama_lengkap"]
    if body.get("pembimbing2_id"):
        pb2 = find_by_id("dosen", body["pembimbing2_id"])
        if pb2:
            ta["pembimbing2_id"] = pb2["id"]
            ta["pembimbing2_nama"] = pb2["nama_lengkap"]

    ta["updated_at"] = _now()
    update("tugas_akhir", ta_id, ta)
    return {"success": True, "data": ta, "message": "TA berhasil diperbarui", "meta": None}


@router.post("/{ta_id}/setujui")
def setujui_ta(ta_id: str):
    ta = find_by_id("tugas_akhir", ta_id)
    if not ta or ta.get("deleted_at"):
        raise HTTPException(404, "TA tidak ditemukan")
    if ta.get("status") != "pengajuan":
        raise HTTPException(400, "Hanya TA berstatus 'pengajuan' yang dapat disetujui")
    ta["status"] = "approved"
    ta["updated_at"] = _now()
    update("tugas_akhir", ta_id, ta)
    return {"success": True, "data": ta, "message": "Pengajuan TA disetujui", "meta": None}


@router.post("/{ta_id}/tolak")
def tolak_ta(ta_id: str, body: dict):
    ta = find_by_id("tugas_akhir", ta_id)
    if not ta or ta.get("deleted_at"):
        raise HTTPException(404, "TA tidak ditemukan")
    if ta.get("status") != "pengajuan":
        raise HTTPException(400, "Hanya TA berstatus 'pengajuan' yang dapat ditolak")
    alasan = body.get("alasan", "").strip()
    if not alasan:
        raise HTTPException(400, "Alasan penolakan wajib diisi")
    soft_delete("tugas_akhir", ta_id)
    return {"success": True, "data": None, "message": f"Pengajuan TA ditolak: {alasan}", "meta": None}


@router.post("/{ta_id}/status")
def update_status_ta(ta_id: str, body: dict):
    ta = find_by_id("tugas_akhir", ta_id)
    if not ta or ta.get("deleted_at"):
        raise HTTPException(404, "TA tidak ditemukan")
    new_status = body.get("status", "").strip()
    if new_status not in STATUS_FLOW:
        raise HTTPException(400, f"Status tidak valid. Pilihan: {', '.join(STATUS_FLOW)}")
    ta["status"] = new_status
    if new_status == "selesai" and body.get("nilai_sidang"):
        ta["nilai_sidang"] = body["nilai_sidang"]
    ta["updated_at"] = _now()
    update("tugas_akhir", ta_id, ta)
    return {"success": True, "data": ta, "message": f"Status TA diubah ke '{new_status}'", "meta": None}


# ─── BIMBINGAN ────────────────────────────────────────────────────────────────

@router.get("/{ta_id}/bimbingan")
def list_bimbingan(ta_id: str):
    ta = find_by_id("tugas_akhir", ta_id)
    if not ta or ta.get("deleted_at"):
        raise HTTPException(404, "TA tidak ditemukan")
    bimb = [b for b in read_all("bimbingan_ta")
            if b.get("ta_id") == ta_id and not b.get("deleted_at")]
    bimb.sort(key=lambda x: x.get("tanggal", ""))
    return {"success": True, "data": bimb, "message": "Berhasil", "meta": {"total": len(bimb)}}


@router.post("/{ta_id}/bimbingan")
def tambah_bimbingan(ta_id: str, body: dict):
    ta = find_by_id("tugas_akhir", ta_id)
    if not ta or ta.get("deleted_at"):
        raise HTTPException(404, "TA tidak ditemukan")
    topik = body.get("topik", "").strip()
    tanggal = body.get("tanggal", "").strip()
    if not topik or not tanggal:
        raise HTTPException(400, "topik dan tanggal wajib diisi")

    existing = [b for b in read_all("bimbingan_ta")
                if b.get("ta_id") == ta_id and not b.get("deleted_at")]
    ke = len(existing) + 1

    user = _dev_user()
    dosen = find_by_id("dosen", body.get("dosen_id", ta.get("pembimbing1_id", "")))
    now = _now()
    rec = {
        "id": str(uuid.uuid4()),
        "ta_id": ta_id,
        "mahasiswa_id": ta["mahasiswa_id"],
        "mahasiswa_nama": ta["mahasiswa_nama"],
        "mahasiswa_nim": ta["mahasiswa_nim"],
        "dosen_id": dosen["id"] if dosen else ta.get("pembimbing1_id"),
        "dosen_nama": dosen["nama_lengkap"] if dosen else ta.get("pembimbing1_nama"),
        "ke": ke,
        "tanggal": tanggal,
        "topik": topik,
        "catatan_dosen": body.get("catatan_dosen", ""),
        "status": "menunggu",
        "created_at": now,
        "deleted_at": None,
    }
    insert("bimbingan_ta", rec)
    return {"success": True, "data": rec, "message": "Log bimbingan ditambahkan", "meta": None}


@router.put("/bimbingan/{bimb_id}")
def update_bimbingan(bimb_id: str, body: dict):
    bimb = find_by_id("bimbingan_ta", bimb_id)
    if not bimb or bimb.get("deleted_at"):
        raise HTTPException(404, "Log bimbingan tidak ditemukan")
    for k in ("catatan_dosen", "status"):
        if k in body:
            bimb[k] = body[k]
    update("bimbingan_ta", bimb_id, bimb)
    return {"success": True, "data": bimb, "message": "Bimbingan diperbarui", "meta": None}


# ─── SIDANG ───────────────────────────────────────────────────────────────────

@router.get("/sidang/list")
def list_sidang(
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    sidang = [s for s in read_all("sidang_ta") if not s.get("deleted_at")]
    if status:
        sidang = [s for s in sidang if s.get("status") == status]
    if search:
        q = search.lower()
        sidang = [s for s in sidang if q in s.get("mahasiswa_nama", "").lower()
                  or q in s.get("judul", "").lower()
                  or q in s.get("mahasiswa_nim", "").lower()]
    sidang.sort(key=lambda x: x.get("tanggal", ""), reverse=True)
    items, meta = paginate(sidang, page, per_page)
    return {"success": True, "data": items, "message": "Berhasil", "meta": meta}


@router.post("/{ta_id}/sidang")
def jadwalkan_sidang(ta_id: str, body: dict):
    ta = find_by_id("tugas_akhir", ta_id)
    if not ta or ta.get("deleted_at"):
        raise HTTPException(404, "TA tidak ditemukan")
    if ta.get("status") not in ("penulisan", "bimbingan", "sidang"):
        raise HTTPException(400, "TA belum siap untuk dijadwalkan sidang")

    # Cek belum ada sidang aktif
    existing = [s for s in read_all("sidang_ta")
                if s.get("ta_id") == ta_id and not s.get("deleted_at")
                and s.get("status") != "dibatalkan"]
    if existing:
        raise HTTPException(400, "Jadwal sidang untuk TA ini sudah ada")

    tanggal = body.get("tanggal", "").strip()
    if not tanggal:
        raise HTTPException(400, "tanggal sidang wajib diisi")

    now = _now()
    rec = {
        "id": str(uuid.uuid4()),
        "ta_id": ta_id,
        "mahasiswa_id": ta["mahasiswa_id"],
        "mahasiswa_nama": ta["mahasiswa_nama"],
        "mahasiswa_nim": ta["mahasiswa_nim"],
        "judul": ta["judul"],
        "tanggal": tanggal,
        "jam_mulai": body.get("jam_mulai", "09:00"),
        "jam_selesai": body.get("jam_selesai", "11:00"),
        "ruang": body.get("ruang", ""),
        "penguji1": body.get("penguji1", ta.get("pembimbing1_nama", "")),
        "penguji2": body.get("penguji2", ""),
        "penguji3": body.get("penguji3", ""),
        "nilai_sidang": None,
        "hasil": None,
        "catatan": None,
        "status": "terjadwal",
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    insert("sidang_ta", rec)

    # Update status TA
    ta["status"] = "sidang"
    ta["updated_at"] = now
    update("tugas_akhir", ta_id, ta)

    return {"success": True, "data": rec, "message": "Sidang berhasil dijadwalkan", "meta": None}


@router.put("/sidang/{sidang_id}")
def update_sidang(sidang_id: str, body: dict):
    sidang = find_by_id("sidang_ta", sidang_id)
    if not sidang or sidang.get("deleted_at"):
        raise HTTPException(404, "Data sidang tidak ditemukan")

    for k in ("tanggal", "jam_mulai", "jam_selesai", "ruang",
              "penguji1", "penguji2", "penguji3", "catatan"):
        if k in body:
            sidang[k] = body[k]

    # Input nilai dan hasil
    if "nilai_sidang" in body and body["nilai_sidang"] is not None:
        nilai = float(body["nilai_sidang"])
        hasil = body.get("hasil", "lulus" if nilai >= 70 else "tidak_lulus")
        sidang["nilai_sidang"] = nilai
        sidang["hasil"] = hasil
        sidang["status"] = "selesai"

        # Update TA record
        ta = find_by_id("tugas_akhir", sidang["ta_id"])
        if ta:
            ta["nilai_sidang"] = nilai
            ta["status"] = "selesai" if hasil == "lulus" else "revisi"
            ta["updated_at"] = _now()
            update("tugas_akhir", ta["id"], ta)

    sidang["updated_at"] = _now()
    update("sidang_ta", sidang_id, sidang)
    return {"success": True, "data": sidang, "message": "Data sidang diperbarui", "meta": None}


# ─── STATS ───────────────────────────────────────────────────────────────────

@router.get("/stats/ringkasan")
def get_stats():
    ta = [t for t in read_all("tugas_akhir") if not t.get("deleted_at")]
    sidang = [s for s in read_all("sidang_ta") if not s.get("deleted_at")]
    bimb = [b for b in read_all("bimbingan_ta") if not b.get("deleted_at")]

    by_status = {}
    for t in ta:
        s = t.get("status", "lainnya")
        by_status[s] = by_status.get(s, 0) + 1

    nilai_list = [t["nilai_sidang"] for t in ta if t.get("nilai_sidang")]

    return {
        "success": True,
        "data": {
            "total_ta": len(ta),
            "by_status": by_status,
            "total_sidang": len(sidang),
            "sidang_terjadwal": sum(1 for s in sidang if s.get("status") == "terjadwal"),
            "sidang_selesai": sum(1 for s in sidang if s.get("status") == "selesai"),
            "total_bimbingan": len(bimb),
            "rata_nilai": round(sum(nilai_list) / len(nilai_list), 2) if nilai_list else None,
        },
        "message": "Berhasil",
        "meta": None,
    }
