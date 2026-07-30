from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
import os
from app.routers import auth, mahasiswa, dashboard, dosen, krs, nilai, keuangan, presensi, program_studi, mata_kuliah, ruang, kelas, ujian, ta, magang, beasiswa, ukm, semester_pendek, pmb, surat, elearning, penelitian, pkm, aset, kepegawaian, akreditasi, alumni, laporan, notifikasi, klinik, perpustakaan, obe, users, admin, registrasi_semester, kalender

# Path ke folder frontend (relatif dari backend/)
FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend"

app = FastAPI(
    title="SIAKAD Local",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

@app.on_event("startup")
def on_startup():
    if os.getenv("DATABASE_URL"):
        from app.utils.db import init_db, seed_from_json, reseed_users, reseed_tables
        init_db()
        seed_from_json()
        reseed_users()  # always sync user records from JSON (passwords/roles)
        reseed_tables(['cpl', 'cpmk', 'rps', 'penilaian_obe', 'berita_acara_ujian', 'kelas', 'krs', 'nilai'])  # sync corrected data

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global error handler
@app.exception_handler(Exception)
async def global_handler(req, exc):
    return JSONResponse(
        status_code=500,
        content={"success": False, "data": None, "message": str(exc)}
    )

# API Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(mahasiswa.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(dosen.router, prefix="/api/v1")
app.include_router(krs.router, prefix="/api/v1")
app.include_router(nilai.router, prefix="/api/v1")
app.include_router(keuangan.router, prefix="/api/v1")
app.include_router(presensi.router, prefix="/api/v1")
app.include_router(program_studi.router, prefix="/api/v1")
app.include_router(mata_kuliah.router, prefix="/api/v1")
app.include_router(ruang.router, prefix="/api/v1")
app.include_router(kelas.router, prefix="/api/v1")
app.include_router(ujian.router, prefix="/api/v1")
app.include_router(ta.router, prefix="/api/v1")
app.include_router(magang.router, prefix="/api/v1")
app.include_router(beasiswa.router, prefix="/api/v1")
app.include_router(ukm.router, prefix="/api/v1")
app.include_router(semester_pendek.router, prefix="/api/v1")
app.include_router(pmb.router, prefix="/api/v1")
app.include_router(surat.router, prefix="/api/v1")
app.include_router(elearning.router, prefix="/api/v1")
app.include_router(penelitian.router, prefix="/api/v1")
app.include_router(pkm.router, prefix="/api/v1")
app.include_router(aset.router, prefix="/api/v1")
app.include_router(kepegawaian.router, prefix="/api/v1")
app.include_router(akreditasi.router, prefix="/api/v1")
app.include_router(alumni.router, prefix="/api/v1")
app.include_router(laporan.router, prefix="/api/v1")
app.include_router(notifikasi.router, prefix="/api/v1")
app.include_router(klinik.router, prefix="/api/v1")
app.include_router(perpustakaan.router, prefix="/api/v1")
app.include_router(obe.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(registrasi_semester.router, prefix="/api/v1")
app.include_router(kalender.router, prefix="/api/v1")

# Health check
@app.get("/api/health")
def health():
    return {"status": "ok", "mode": "json-local", "frontend": FRONTEND_DIR.exists()}

# ── Static files ──────────────────────────────────────────
# Serve JS, CSS, assets
if FRONTEND_DIR.exists():
    app.mount("/js", StaticFiles(directory=FRONTEND_DIR / "js"), name="js")
    if (FRONTEND_DIR / "css").exists():
        app.mount("/css", StaticFiles(directory=FRONTEND_DIR / "css"), name="css")
    if (FRONTEND_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

# Serve index.html untuk semua route non-API (SPA fallback)
@app.get("/")
@app.get("/{full_path:path}")
async def serve_spa(full_path: str = ""):
    # Jangan intercept /api routes
    if full_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"message": "Not found"})
    index = FRONTEND_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse(
        status_code=404,
        content={"message": f"Frontend tidak ditemukan di {FRONTEND_DIR}"}
    )
