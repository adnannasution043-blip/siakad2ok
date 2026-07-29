from fastapi import APIRouter, Header
from app.utils.db import read_all, find_by_id
from app.utils.dev import (
    get_user_from_request,
    get_mahasiswa_for_user, get_dosen_for_user, get_kelas_ids_untuk_dosen,
)
from datetime import datetime

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

def ok(data=None, message="Berhasil"):
    return {"success": True, "data": data, "message": message}

@router.get("/stats")
def stats(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    role = user.get("role")
    tahun_ini = datetime.now().year

    if role == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        krs_mhs  = [k for k in read_all("krs")    if not k.get("deleted_at") and k.get("mahasiswa_id") == mhs_id]
        nilai_mhs= [n for n in read_all("nilai")  if not n.get("deleted_at") and n.get("mahasiswa_id") == mhs_id]
        tagihan  = [t for t in read_all("tagihan") if not t.get("deleted_at") and t.get("mahasiswa_id") == mhs_id]
        return ok({
            "total_krs":          len(krs_mhs),
            "krs_disetujui":      sum(1 for k in krs_mhs  if k.get("status") == "disetujui"),
            "krs_pending":        sum(1 for k in krs_mhs  if k.get("status") == "pending"),
            "total_nilai":        len(nilai_mhs),
            "total_tagihan":      len(tagihan),
            "tagihan_lunas":      sum(1 for t in tagihan if t.get("status") == "lunas"),
            "tagihan_belum_lunas":sum(1 for t in tagihan if t.get("status") == "belum_lunas"),
            "ipk":                mhs.get("ipk", 0) if mhs else 0,
            "semester_aktif":     mhs.get("semester_aktif", 0) if mhs else 0,
        })

    if role == "dosen":
        dosen = get_dosen_for_user(user)
        if not dosen:
            return ok({})
        kelas_ids = get_kelas_ids_untuk_dosen(dosen["id"])
        krs_all   = [k for k in read_all("krs")   if not k.get("deleted_at")]
        nilai_all = [n for n in read_all("nilai")  if not n.get("deleted_at")]
        # Mahasiswa bimbingan (dosen wali)
        mhs_bimbingan_ids = {k["mahasiswa_id"] for k in krs_all if k.get("dosen_wali_id") == dosen["id"]}
        return ok({
            "total_kelas_diampu":   len(kelas_ids),
            "total_mahasiswa_bimbingan": len(mhs_bimbingan_ids),
            "krs_pending_bimbingan": sum(
                1 for k in krs_all
                if k.get("dosen_wali_id") == dosen["id"] and k.get("status") == "pending"
            ),
            "total_nilai_belum_dikunci": sum(
                1 for n in nilai_all
                if n.get("kelas_id") in kelas_ids and not n.get("locked")
            ),
        })

    if role == "kaprodi":
        dosen = get_dosen_for_user(user)
        prodi_id = dosen.get("prodi_id") if dosen else None
        mhs_all   = [m for m in read_all("mahasiswa")    if not m.get("deleted_at")]
        dosen_all = [d for d in read_all("dosen")        if not d.get("deleted_at")]
        if prodi_id:
            mhs_all   = [m for m in mhs_all   if m.get("program_studi_id") == prodi_id]
            dosen_all = [d for d in dosen_all if d.get("prodi_id") == prodi_id]
        return ok({
            "total_mahasiswa": len(mhs_all),
            "mahasiswa_aktif": sum(1 for m in mhs_all if m.get("status") == "aktif"),
            "total_dosen":     len(dosen_all),
        })

    # Admin / super_admin / staf — tampilkan statistik lengkap
    mhs_all   = [m for m in read_all("mahasiswa")     if not m.get("deleted_at")]
    dosen_all = [d for d in read_all("dosen")         if not d.get("deleted_at")]
    prodi_all = [p for p in read_all("program_studi") if p.get("is_active") and not p.get("deleted_at")]
    krs_all   = [k for k in read_all("krs")           if not k.get("deleted_at")]
    tagihan_all=[t for t in read_all("tagihan")       if not t.get("deleted_at")]
    nilai_all = [n for n in read_all("nilai")         if not n.get("deleted_at")]

    return ok({
        "total_mahasiswa":     len(mhs_all),
        "mahasiswa_aktif":     sum(1 for m in mhs_all if m.get("status") == "aktif"),
        "mahasiswa_cuti":      sum(1 for m in mhs_all if m.get("status") == "cuti"),
        "mahasiswa_lulus":     sum(1 for m in mhs_all if m.get("status") == "lulus"),
        "mahasiswa_baru":      sum(1 for m in mhs_all if m.get("angkatan") == tahun_ini),
        "total_dosen":         len(dosen_all),
        "total_prodi":         len(prodi_all),
        "total_krs":           len(krs_all),
        "krs_disetujui":       sum(1 for k in krs_all if k.get("status") == "disetujui"),
        "total_tagihan":       len(tagihan_all),
        "tagihan_lunas":       sum(1 for t in tagihan_all if t.get("status") == "lunas"),
        "tagihan_belum_lunas": sum(1 for t in tagihan_all if t.get("status") == "belum_lunas"),
        "tagihan_cicilan":     sum(1 for t in tagihan_all if t.get("status") == "cicilan"),
        "total_nilai":         len(nilai_all),
        "nilai_terkunci":      sum(1 for n in nilai_all if n.get("locked")),
    })

@router.get("/aktivitas")
def aktivitas(limit: int = 10, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    role = user.get("role")
    activities = []

    if role == "mahasiswa":
        mhs = get_mahasiswa_for_user(user)
        mhs_id = mhs["id"] if mhs else ""
        krs_recent = sorted(
            [k for k in read_all("krs") if not k.get("deleted_at") and k.get("mahasiswa_id") == mhs_id],
            key=lambda x: x.get("created_at", ""), reverse=True
        )[:5]
        for k in krs_recent:
            activities.append({
                "type": "krs", "icon": "file-text",
                "text": f"KRS: {k.get('mata_kuliah_nama','')}",
                "sub": k.get("status", ""), "time": k.get("created_at", ""),
            })
        nilai_recent = sorted(
            [n for n in read_all("nilai") if not n.get("deleted_at") and n.get("mahasiswa_id") == mhs_id],
            key=lambda x: x.get("updated_at", ""), reverse=True
        )[:5]
        for n in nilai_recent:
            activities.append({
                "type": "nilai", "icon": "bar-chart",
                "text": f"Nilai: {n.get('mata_kuliah_nama','')} — {n.get('nilai_huruf','')}",
                "sub": n.get("semester_akademik", ""), "time": n.get("updated_at", ""),
            })
    elif role == "dosen":
        dosen = get_dosen_for_user(user)
        if dosen:
            kelas_ids = get_kelas_ids_untuk_dosen(dosen["id"])
            krs_pending = sorted(
                [k for k in read_all("krs")
                 if not k.get("deleted_at") and k.get("dosen_wali_id") == dosen["id"] and k.get("status") == "pending"],
                key=lambda x: x.get("created_at", ""), reverse=True
            )[:5]
            for k in krs_pending:
                activities.append({
                    "type": "krs", "icon": "file-text",
                    "text": f"KRS menunggu: {k.get('mahasiswa_nama','')} — {k.get('mata_kuliah_nama','')}",
                    "sub": k.get("semester_akademik", ""), "time": k.get("created_at", ""),
                })
    else:
        # Admin: tampilkan semua aktivitas terbaru
        mhs_all = sorted(
            [m for m in read_all("mahasiswa") if not m.get("deleted_at")],
            key=lambda x: x.get("created_at", ""), reverse=True
        )[:3]
        for m in mhs_all:
            activities.append({
                "type": "mahasiswa", "icon": "user-plus",
                "text": f"Mahasiswa baru: {m['nama_lengkap']}",
                "sub": m.get("nim", ""), "time": m.get("created_at", ""),
            })
        krs_recent = sorted(
            [k for k in read_all("krs") if not k.get("deleted_at")],
            key=lambda x: x.get("created_at", ""), reverse=True
        )[:3]
        for k in krs_recent:
            activities.append({
                "type": "krs", "icon": "file-text",
                "text": f"KRS: {k.get('mahasiswa_nama','')} — {k.get('mata_kuliah_nama','')}",
                "sub": k.get("semester_akademik", ""), "time": k.get("created_at", ""),
            })
        nilai_recent = sorted(
            [n for n in read_all("nilai") if not n.get("deleted_at")],
            key=lambda x: x.get("updated_at", ""), reverse=True
        )[:3]
        for n in nilai_recent:
            activities.append({
                "type": "nilai", "icon": "bar-chart",
                "text": f"Nilai diinput: {n.get('mata_kuliah_nama','')}",
                "sub": n.get("semester_akademik", ""), "time": n.get("updated_at", ""),
            })

    activities.sort(key=lambda x: x.get("time", ""), reverse=True)
    return ok(activities[:limit])
