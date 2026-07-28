from fastapi import APIRouter, Header
from app.utils.db import read_all
from app.utils.dev import get_user_from_request
from datetime import datetime

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

def ok(data=None, message="Berhasil"):
    return {"success": True, "data": data, "message": message}

@router.get("/stats")
def stats(authorization: str = Header(default="dev")):
    get_user_from_request(authorization)

    mhs_all = [m for m in read_all("mahasiswa") if not m.get("deleted_at")]
    dosen_all = [d for d in read_all("dosen") if not d.get("deleted_at")]
    prodi_all = [p for p in read_all("program_studi") if p.get("is_active") and not p.get("deleted_at")]
    krs_all = [k for k in read_all("krs") if not k.get("deleted_at")]
    tagihan_all = [t for t in read_all("tagihan") if not t.get("deleted_at")]
    nilai_all = [n for n in read_all("nilai") if not n.get("deleted_at")]

    tahun_ini = datetime.now().year

    return ok({
        "total_mahasiswa": len(mhs_all),
        "mahasiswa_aktif": sum(1 for m in mhs_all if m.get("status") == "aktif"),
        "mahasiswa_cuti": sum(1 for m in mhs_all if m.get("status") == "cuti"),
        "mahasiswa_lulus": sum(1 for m in mhs_all if m.get("status") == "lulus"),
        "mahasiswa_baru": sum(1 for m in mhs_all if m.get("angkatan") == tahun_ini),
        "total_dosen": len(dosen_all),
        "total_prodi": len(prodi_all),
        "total_krs": len(krs_all),
        "krs_disetujui": sum(1 for k in krs_all if k.get("status") == "disetujui"),
        "total_tagihan": len(tagihan_all),
        "tagihan_lunas": sum(1 for t in tagihan_all if t.get("status") == "lunas"),
        "tagihan_belum_lunas": sum(1 for t in tagihan_all if t.get("status") == "belum_lunas"),
        "tagihan_cicilan": sum(1 for t in tagihan_all if t.get("status") == "cicilan"),
        "total_nilai": len(nilai_all),
        "nilai_terkunci": sum(1 for n in nilai_all if n.get("locked")),
    })

@router.get("/aktivitas")
def aktivitas(limit: int = 10, authorization: str = Header(default="dev")):
    get_user_from_request(authorization)

    activities = []

    # Mahasiswa terbaru
    mhs_all = sorted(
        [m for m in read_all("mahasiswa") if not m.get("deleted_at")],
        key=lambda x: x.get("created_at", ""), reverse=True
    )[:3]
    for m in mhs_all:
        activities.append({
            "type": "mahasiswa",
            "icon": "user-plus",
            "text": f"Mahasiswa baru: {m['nama_lengkap']}",
            "sub": m.get("nim", ""),
            "time": m.get("created_at", ""),
        })

    # KRS terbaru
    krs_recent = sorted(
        [k for k in read_all("krs") if not k.get("deleted_at")],
        key=lambda x: x.get("created_at", ""), reverse=True
    )[:3]
    for k in krs_recent:
        activities.append({
            "type": "krs",
            "icon": "file-text",
            "text": f"KRS: {k.get('mahasiswa_nama','')} — {k.get('mata_kuliah_nama','')}",
            "sub": k.get("semester_akademik", ""),
            "time": k.get("created_at", ""),
        })

    # Nilai terbaru
    nilai_recent = sorted(
        [n for n in read_all("nilai") if not n.get("deleted_at")],
        key=lambda x: x.get("updated_at", ""), reverse=True
    )[:3]
    for n in nilai_recent:
        activities.append({
            "type": "nilai",
            "icon": "bar-chart",
            "text": f"Nilai diinput: {n.get('mata_kuliah_nama','')}",
            "sub": n.get("semester_akademik", ""),
            "time": n.get("updated_at", ""),
        })

    activities.sort(key=lambda x: x.get("time", ""), reverse=True)
    return ok(activities[:limit])
