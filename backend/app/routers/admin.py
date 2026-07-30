from fastapi import APIRouter, HTTPException
from fastapi.params import Header
from pydantic import BaseModel
from app.utils.db import DATABASE_URL, DATA_DIR, write_all, read_all
from app.utils.dev import get_user_from_request, check_role

router = APIRouter(prefix="/admin", tags=["Admin"])

# Tables that survive a "clean" reset — the bare minimum master data
MASTER_TABLES = {
    "users", "program_studi", "mata_kuliah", "ruang", "template_surat",
}

# All known tables
ALL_TABLES = [
    "akreditasi_dokumen", "akreditasi_prodi", "alumni", "anggota_ukm",
    "aset", "beasiswa", "berita_acara_ujian", "bimbingan_ta",
    "cpl", "cpmk", "daftar_beasiswa", "dosen", "enrollment_elearning",
    "gelombang_pmb", "jadwal_ujian", "kartu_ujian", "kegiatan_ukm",
    "kelas", "kelas_sp", "koleksi_perpustakaan", "krs", "kunjungan_klinik",
    "kursus_elearning", "luaran_penelitian", "luaran_pkm", "magang",
    "mahasiswa", "mata_kuliah", "materi_elearning", "nilai", "notifikasi",
    "pegawai", "pembayaran", "peminjaman_perpustakaan", "pendaftar_pmb",
    "penelitian", "pengajuan_surat", "pengumuman", "penilaian_obe",
    "peserta_sp", "pkm", "presensi", "program_sp", "program_studi",
    "rps", "ruang", "sesi_kuliah", "sidang_ta", "tagihan",
    "template_surat", "tugas_akhir", "ukm", "users", "yudisium",
    "kalender_akademik", "registrasi_semester",
]

TRANSACTIONAL_TABLES = [t for t in ALL_TABLES if t not in MASTER_TABLES]


def ok(data=None, message="Berhasil"):
    return {"success": True, "data": data, "message": message}


class ResetRequest(BaseModel):
    mode: str        # "demo" | "clean"
    confirm: str     # must be "HAPUS SEMUA DATA"


@router.post("/reset-data")
def reset_data(body: ResetRequest, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ["super_admin"])

    if body.confirm != "HAPUS SEMUA DATA":
        raise HTTPException(400, "Konfirmasi tidak sesuai")
    if body.mode not in ("demo", "clean"):
        raise HTTPException(400, "Mode tidak valid")

    if DATABASE_URL:
        _reset_postgres(body.mode)
    else:
        _reset_json(body.mode)
    label = "demo" if body.mode == "demo" else "data transaksi"
    return ok(message=f"Reset {label} berhasil. Silakan muat ulang halaman.")


def _reset_postgres(mode: str):
    from app.utils.db import _conn, seed_from_json, reseed_users, reseed_tables  # noqa: F401
    with _conn() as conn:
        with conn.cursor() as cur:
            if mode == "demo":
                cur.execute("DELETE FROM store")
            else:
                placeholders = ",".join(["%s"] * len(TRANSACTIONAL_TABLES))
                cur.execute(
                    f"DELETE FROM store WHERE table_name IN ({placeholders})",
                    TRANSACTIONAL_TABLES,
                )
    if mode == "demo":
        seed_from_json()
        reseed_users()
        reseed_tables(["cpl", "cpmk", "rps", "penilaian_obe",
                       "berita_acara_ujian", "kelas", "krs", "nilai"])  # force upsert corrected data


def _reset_json(mode: str):
    tables_to_clear = ALL_TABLES if mode == "demo" else TRANSACTIONAL_TABLES
    for table in tables_to_clear:
        write_all(table, [])


@router.get("/stats")
def get_stats(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ["super_admin", "admin_akademik"])
    stats = {}
    for table in ALL_TABLES:
        rows = [r for r in read_all(table) if not r.get("deleted_at")]
        stats[table] = len(rows)
    return ok(stats)
