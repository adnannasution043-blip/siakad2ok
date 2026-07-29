from fastapi import APIRouter, Query, Header
from typing import Optional
from datetime import datetime, timezone

from app.utils.db import read_all
from app.utils.dev import get_user_from_request, check_role

router = APIRouter(prefix="/laporan", tags=["Laporan & Statistik"])

LAPORAN_ROLES = ["super_admin", "admin_akademik", "admin_keuangan", "kaprodi", "lppm", "staf"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def _now():
    return datetime.now(timezone.utc).isoformat()

def _active(collection: str):
    return [r for r in read_all(collection) if not r.get("deleted_at")]

def _count_by(items: list, field: str) -> dict:
    counts = {}
    for item in items:
        val = item.get(field, "lainnya") or "lainnya"
        counts[val] = counts.get(val, 0) + 1
    return counts


# ─── RINGKASAN UMUM ───────────────────────────────────────────────────────────

@router.get("/ringkasan")
def get_ringkasan(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, LAPORAN_ROLES)
    mahasiswa = _active("mahasiswa")
    dosen = _active("dosen")
    pegawai = _active("pegawai")
    penelitian = _active("penelitian")
    pkm = _active("pkm")
    alumni = _active("alumni")
    tagihan = _active("tagihan")
    ta = _active("tugas_akhir")
    magang = _active("magang")
    beasiswa_daftar = _active("daftar_beasiswa")

    total_tagihan = sum(t.get("jumlah", 0) for t in tagihan)
    lunas = sum(t.get("jumlah", 0) for t in tagihan if t.get("status") == "lunas")

    return ok({
        "mahasiswa": {
            "total": len(mahasiswa),
            "aktif": len([m for m in mahasiswa if m.get("status") == "aktif"]),
            "lulus": len([m for m in mahasiswa if m.get("status") == "lulus"]),
            "cuti":  len([m for m in mahasiswa if m.get("status") == "cuti"]),
            "do":    len([m for m in mahasiswa if m.get("status") == "DO"]),
        },
        "dosen": len(dosen),
        "pegawai": len(pegawai),
        "alumni": len(alumni),
        "penelitian_aktif": len([p for p in penelitian if p.get("status") == "aktif"]),
        "pkm_aktif": len([p for p in pkm if p.get("status") == "aktif"]),
        "ta_berjalan": len([t for t in ta if t.get("status") not in ("selesai", "ditolak")]),
        "magang_aktif": len([m for m in magang if m.get("status") == "aktif"]),
        "beasiswa_aktif": len([b for b in beasiswa_daftar if b.get("status") == "aktif"]),
        "keuangan": {
            "total_tagihan": total_tagihan,
            "terkumpul": lunas,
            "persentase": round((lunas / total_tagihan * 100), 1) if total_tagihan else 0,
        },
    })


# ─── LAPORAN MAHASISWA ────────────────────────────────────────────────────────

@router.get("/mahasiswa")
def laporan_mahasiswa(
    tahun_akademik: Optional[str] = None,
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    check_role(user, LAPORAN_ROLES)
    mahasiswa = _active("mahasiswa")
    prodi_list = _active("program_studi")
    prodi_map = {p["id"]: p.get("nama", p["id"]) for p in prodi_list}

    if user.get("role") == "kaprodi":
        from app.utils.dev import get_dosen_for_user
        dosen = get_dosen_for_user(user)
        if dosen and dosen.get("program_studi_id"):
            mahasiswa = [m for m in mahasiswa if m.get("program_studi_id") == dosen["program_studi_id"]]

    by_status = _count_by(mahasiswa, "status")
    by_prodi_raw = _count_by(mahasiswa, "program_studi_id")
    by_prodi = {prodi_map.get(k, k): v for k, v in by_prodi_raw.items()}
    by_angkatan = _count_by(mahasiswa, "angkatan")
    by_jk = _count_by(mahasiswa, "jenis_kelamin")

    ipk_dist = {"< 2.0": 0, "2.0–2.49": 0, "2.5–2.99": 0, "3.0–3.49": 0, "≥ 3.5": 0}
    for m in mahasiswa:
        ipk = float(m.get("ipk") or 0)
        if ipk < 2.0:      ipk_dist["< 2.0"] += 1
        elif ipk < 2.5:    ipk_dist["2.0–2.49"] += 1
        elif ipk < 3.0:    ipk_dist["2.5–2.99"] += 1
        elif ipk < 3.5:    ipk_dist["3.0–3.49"] += 1
        else:              ipk_dist["≥ 3.5"] += 1

    avg_ipk = round(sum(float(m.get("ipk") or 0) for m in mahasiswa) / len(mahasiswa), 2) if mahasiswa else 0

    return ok({
        "total": len(mahasiswa),
        "by_status": by_status,
        "by_prodi": by_prodi,
        "by_angkatan": dict(sorted(by_angkatan.items())),
        "by_jenis_kelamin": by_jk,
        "ipk_distribution": ipk_dist,
        "rata_rata_ipk": avg_ipk,
    })


# ─── LAPORAN AKADEMIK ─────────────────────────────────────────────────────────

@router.get("/akademik")
def laporan_akademik(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, LAPORAN_ROLES)
    nilai_list = _active("nilai")
    krs_list = _active("krs")
    kelas_list = _active("kelas")
    mk_list = _active("mata_kuliah")
    mk_map = {mk["id"]: mk.get("nama", mk["id"]) for mk in mk_list}

    grade_dist = {"A (85-100)": 0, "B+ (80-84)": 0, "B (75-79)": 0,
                  "C+ (70-74)": 0, "C (65-69)": 0, "D (55-64)": 0, "E (<55)": 0}
    for n in nilai_list:
        v = float(n.get("nilai_akhir") or 0)
        if v >= 85:    grade_dist["A (85-100)"] += 1
        elif v >= 80:  grade_dist["B+ (80-84)"] += 1
        elif v >= 75:  grade_dist["B (75-79)"] += 1
        elif v >= 70:  grade_dist["C+ (70-74)"] += 1
        elif v >= 65:  grade_dist["C (65-69)"] += 1
        elif v >= 55:  grade_dist["D (55-64)"] += 1
        else:          grade_dist["E (<55)"] += 1

    avg_nilai = round(sum(float(n.get("nilai_akhir") or 0) for n in nilai_list) / len(nilai_list), 1) if nilai_list else 0
    by_status_krs = _count_by(krs_list, "status")
    total_sks_krs = sum(int(k.get("sks", 0) or 0) for k in krs_list if k.get("status") == "disetujui")

    kelas_data = []
    for k in kelas_list[:10]:
        kelas_data.append({
            "kode": k.get("kode_kelas", ""),
            "mata_kuliah": mk_map.get(k.get("mata_kuliah_id", ""), ""),
            "kapasitas": k.get("kapasitas", 0),
            "terisi": k.get("jumlah_mahasiswa", 0),
        })

    return ok({
        "nilai": {"total": len(nilai_list), "rata_rata": avg_nilai, "distribusi": grade_dist},
        "krs": {"total": len(krs_list), "by_status": by_status_krs, "total_sks_disetujui": total_sks_krs},
        "kelas": {"total": len(kelas_list), "data": kelas_data},
    })


# ─── LAPORAN KEUANGAN ─────────────────────────────────────────────────────────

@router.get("/keuangan")
def laporan_keuangan(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, LAPORAN_ROLES)
    tagihan_list = _active("tagihan")
    pembayaran_list = _active("pembayaran")

    by_status = _count_by(tagihan_list, "status")
    by_jenis = _count_by(tagihan_list, "jenis")
    total_tagihan = sum(t.get("jumlah", 0) for t in tagihan_list)
    total_lunas = sum(t.get("jumlah", 0) for t in tagihan_list if t.get("status") == "lunas")
    total_belum = sum(t.get("jumlah", 0) for t in tagihan_list if t.get("status") == "belum_lunas")
    total_cicilan = sum(t.get("jumlah", 0) for t in tagihan_list if t.get("status") == "cicilan")
    by_metode = _count_by([p for p in pembayaran_list if p.get("status") in ("sukses", "berhasil")], "metode")

    by_semester = {}
    for t in tagihan_list:
        sem = t.get("semester_akademik", "")
        if sem:
            if sem not in by_semester:
                by_semester[sem] = {"total": 0, "lunas": 0, "count": 0}
            by_semester[sem]["total"] += t.get("jumlah", 0)
            by_semester[sem]["count"] += 1
            if t.get("status") == "lunas":
                by_semester[sem]["lunas"] += t.get("jumlah", 0)
    top_semester = dict(sorted(by_semester.items(), reverse=True)[:6])

    return ok({
        "total_tagihan": total_tagihan,
        "total_lunas": total_lunas,
        "total_belum_lunas": total_belum,
        "total_cicilan": total_cicilan,
        "persentase_lunas": round(total_lunas / total_tagihan * 100, 1) if total_tagihan else 0,
        "by_status": by_status,
        "by_jenis": by_jenis,
        "by_metode_pembayaran": by_metode,
        "by_semester": top_semester,
        "jumlah_tagihan": len(tagihan_list),
        "jumlah_pembayaran": len(pembayaran_list),
    })


# ─── LAPORAN PENELITIAN & PKM ────────────────────────────────────────────────

@router.get("/riset")
def laporan_riset(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, LAPORAN_ROLES)
    penelitian = _active("penelitian")
    pkm = _active("pkm")
    luaran_pen = _active("luaran_penelitian")
    luaran_pkm = _active("luaran_pkm")

    return ok({
        "penelitian": {
            "total": len(penelitian),
            "by_status": _count_by(penelitian, "status"),
            "by_skema": _count_by(penelitian, "skema"),
            "total_dana": sum(p.get("dana", 0) or 0 for p in penelitian),
            "luaran": len(luaran_pen),
            "luaran_by_jenis": _count_by(luaran_pen, "jenis"),
            "luaran_by_validasi": _count_by(luaran_pen, "status_validasi"),
        },
        "pkm": {
            "total": len(pkm),
            "by_status": _count_by(pkm, "status"),
            "by_skema": _count_by(pkm, "skema"),
            "total_dana": sum(p.get("dana", 0) or 0 for p in pkm),
            "luaran": len(luaran_pkm),
            "luaran_by_jenis": _count_by(luaran_pkm, "jenis"),
        },
    })


# ─── LAPORAN SDM ─────────────────────────────────────────────────────────────

@router.get("/sdm")
def laporan_sdm(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, LAPORAN_ROLES)
    dosen = _active("dosen")
    pegawai = _active("pegawai")
    akreditasi_prodi = _active("akreditasi_prodi")

    total_gaji = sum(float(p.get("gaji", 0) or 0) + float(p.get("tunjangan", 0) or 0) for p in pegawai)

    akan_berakhir = 0
    now_dt = datetime.now(timezone.utc)
    for a in akreditasi_prodi:
        tgl = a.get("tgl_berakhir")
        if tgl:
            try:
                from datetime import date
                end = date.fromisoformat(tgl)
                today = now_dt.date()
                if 0 < (end - today).days <= 180:
                    akan_berakhir += 1
            except Exception:
                pass

    return ok({
        "dosen": {
            "total": len(dosen),
            "by_jabatan": _count_by(dosen, "jabatan_fungsional"),
            "by_pendidikan": _count_by(dosen, "pendidikan_terakhir"),
        },
        "pegawai": {
            "total": len(pegawai),
            "by_status": _count_by(pegawai, "status"),
            "by_unit": _count_by(pegawai, "unit_kerja"),
            "total_gaji_per_bulan": total_gaji,
        },
        "akreditasi": {
            "total_prodi": len(akreditasi_prodi),
            "by_peringkat": _count_by(akreditasi_prodi, "peringkat"),
            "akan_berakhir_180_hari": akan_berakhir,
        },
    })


# ─── LAPORAN KEMAHASISWAAN ───────────────────────────────────────────────────

@router.get("/kemahasiswaan")
def laporan_kemahasiswaan(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, LAPORAN_ROLES)
    ta = _active("tugas_akhir")
    magang = _active("magang")
    beasiswa = _active("daftar_beasiswa")
    ukm_anggota = _active("anggota_ukm")
    alumni = _active("alumni")
    pmb = _active("pendaftar_pmb")
    surat = _active("pengajuan_surat")

    pmb_diterima = len([p for p in pmb if p.get("status") == "diterima"])
    alumni_bekerja = len([a for a in alumni if a.get("instansi")])

    return ok({
        "ta":      {"total": len(ta), "by_status": _count_by(ta, "status")},
        "magang":  {"total": len(magang), "by_status": _count_by(magang, "status")},
        "beasiswa": {"total_pendaftar": len(beasiswa), "by_status": _count_by(beasiswa, "status")},
        "ukm":     {"total_anggota": len(ukm_anggota)},
        "alumni": {
            "total": len(alumni),
            "sudah_bekerja": alumni_bekerja,
            "belum_bekerja": len(alumni) - alumni_bekerja,
            "rasio_bekerja": round(alumni_bekerja / len(alumni) * 100, 1) if alumni else 0,
        },
        "pmb": {
            "total_pendaftar": len(pmb),
            "diterima": pmb_diterima,
            "by_gelombang": _count_by(pmb, "gelombang_id"),
        },
        "surat": {
            "total": len(surat),
            "by_jenis": _count_by(surat, "jenis_surat"),
            "by_status": _count_by(surat, "status"),
        },
    })
