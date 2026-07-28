# SIAKAD — Sistem Informasi Akademik
> File ini adalah konteks utama proyek. Baca seluruhnya sebelum menulis kode apapun.

---

## Identitas Proyek

**Nama sistem:** SIAKAD (Sistem Informasi Akademik)
**Tujuan:** Platform terpadu pengelolaan seluruh proses akademik perguruan tinggi
**Skala:** Enterprise — 30 modul, ±232 halaman/view
**Developer:** Adnan (adnannasution / adnan1313)

---

## Stack Teknologi — WAJIB DIIKUTI

### Backend
- **Framework:** FastAPI (Python 3.11+) — async/await, bukan Flask
- **Database:** PostgreSQL 15 + pgvector
- **Cache:** Redis 7
- **Task queue:** Celery + Redis
- **Auth:** JWT (access token 15 menit + refresh token 30 hari, httpOnly cookie)
- **ORM:** SQLAlchemy 2.0 async (`AsyncSession`)
- **Migrations:** Alembic
- **Validation:** Pydantic v2
- **File storage:** Cloudflare R2 (S3-compatible, pakai `boto3`)
- **Email:** SendGrid
- **WhatsApp notif:** Fonnte API
- **PDF generate:** WeasyPrint (server-side)
- **Excel:** openpyxl

### Frontend Web
- **Framework:** Next.js 14 App Router + TypeScript (strict mode)
- **State:** Zustand + TanStack Query v5
- **UI:** shadcn/ui + Tailwind CSS
- **Form:** React Hook Form + Zod
- **Charts:** Recharts
- **HTTP client:** Axios (instance terpusat di `lib/api.ts`)

### Mobile
- **Framework:** React Native + Expo SDK 51
- **Navigation:** Expo Router (file-based)
- **Push notif:** Expo Notifications + FCM
- **QR Scanner:** expo-barcode-scanner
- **Offline:** expo-sqlite + MMKV

### Infrastructure
- **Deploy backend:** Railway
- **Deploy frontend:** Vercel
- **Deploy mobile:** Expo EAS Build
- **CDN:** Cloudflare
- **Monitoring:** Sentry

---

## Struktur Folder Backend — IKUTI PERSIS INI

```
siakad-backend/
├── app/
│   ├── main.py
│   ├── config.py              # Settings via pydantic-settings, baca dari .env
│   ├── database.py            # AsyncEngine + AsyncSession
│   ├── redis.py
│   │
│   ├── models/                # SQLAlchemy ORM models (1 file per domain)
│   │   ├── __init__.py        # import semua model di sini
│   │   ├── user.py
│   │   ├── mahasiswa.py
│   │   ├── dosen.py
│   │   ├── pegawai.py
│   │   ├── akademik.py        # program_studi, mata_kuliah, kelas, jadwal
│   │   ├── krs.py
│   │   ├── nilai.py
│   │   ├── presensi.py
│   │   ├── keuangan.py
│   │   ├── ujian.py
│   │   ├── ta.py
│   │   ├── magang.py
│   │   ├── pmb.py
│   │   ├── penelitian.py
│   │   ├── pkm.py
│   │   ├── aset.py
│   │   ├── akreditasi.py
│   │   ├── surat.py
│   │   ├── perpustakaan.py
│   │   ├── beasiswa.py
│   │   ├── ukm.py
│   │   └── elearning.py
│   │
│   ├── schemas/               # Pydantic v2 schemas (request + response)
│   │   ├── common.py          # ResponseEnvelope, PaginationMeta, dll
│   │   └── [domain].py        # 1 file per domain, sama dengan models
│   │
│   ├── routers/               # FastAPI APIRouter (1 file per domain)
│   │   ├── auth.py
│   │   ├── mahasiswa.py
│   │   ├── dosen.py
│   │   └── [domain].py
│   │
│   ├── services/              # Business logic — SEMUA logik ada di sini
│   │   ├── auth_service.py
│   │   ├── krs_service.py
│   │   ├── nilai_service.py
│   │   ├── presensi_service.py
│   │   ├── tagihan_service.py
│   │   ├── notif_service.py
│   │   └── [domain]_service.py
│   │
│   ├── dependencies/
│   │   ├── auth.py            # get_current_user(), require_role()
│   │   └── db.py              # get_db() → AsyncSession
│   │
│   ├── tasks/                 # Celery tasks
│   │   ├── laporan.py
│   │   ├── notifikasi.py
│   │   └── tagihan.py
│   │
│   └── utils/
│       ├── pdf.py
│       ├── excel.py
│       ├── qr.py
│       ├── storage.py         # R2/MinIO helpers
│       └── nim_generator.py
│
├── migrations/
│   └── versions/
├── tests/
│   ├── conftest.py
│   └── test_[domain].py
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── alembic.ini
```

---

## Struktur Folder Frontend Web — IKUTI PERSIS INI

```
siakad-web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── lupa-password/page.tsx
│   │   └── reset-password/page.tsx
│   │
│   └── (dashboard)/
│       ├── layout.tsx
│       ├── page.tsx                    # redirect ke dashboard sesuai role
│       ├── mahasiswa/
│       │   ├── page.tsx                # list mahasiswa
│       │   ├── [id]/page.tsx           # detail mahasiswa
│       │   └── tambah/page.tsx
│       ├── akademik/
│       │   ├── krs/page.tsx
│       │   ├── nilai/page.tsx
│       │   ├── jadwal/page.tsx
│       │   └── mata-kuliah/page.tsx
│       ├── keuangan/
│       ├── presensi/
│       ├── ujian/
│       ├── ta/
│       ├── magang/
│       ├── pmb/
│       ├── penelitian/
│       ├── pkm/
│       ├── perpustakaan/
│       ├── beasiswa/
│       ├── ukm/
│       ├── surat/
│       ├── aset/
│       ├── kepegawaian/
│       ├── akreditasi/
│       ├── laporan/
│       └── pengaturan/
│
├── components/
│   ├── ui/                             # shadcn/ui — JANGAN MODIFIKASI
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Breadcrumb.tsx
│   └── [domain]/                       # komponen spesifik per domain
│
├── lib/
│   ├── api.ts                          # Axios instance
│   ├── auth.ts
│   ├── utils.ts
│   └── validations/                    # Zod schemas
│
├── hooks/                              # React Query hooks
│   └── use[Domain].ts
│
├── store/                              # Zustand
│   ├── auth.store.ts
│   └── ui.store.ts
│
└── types/                              # TypeScript types/interfaces
    └── index.ts
```

---

## Konvensi Kode — WAJIB KONSISTEN

### Python (Backend)

```python
# Penamaan
# - file: snake_case (krs_service.py)
# - class: PascalCase (KRSService)
# - fungsi/variabel: snake_case
# - konstanta: UPPER_SNAKE_CASE

# Model SQLAlchemy — selalu gunakan UUID sebagai PK
import uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

class Mahasiswa(Base):
    __tablename__ = "mahasiswa"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # ... kolom lain

# Schema Pydantic — selalu ada BaseSchema, CreateSchema, UpdateSchema, ResponseSchema
class MahasiswaBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class MahasiswaCreate(MahasiswaBase): ...
class MahasiswaUpdate(MahasiswaBase): ...
class MahasiswaResponse(MahasiswaBase):
    id: uuid.UUID
    created_at: datetime

# Response envelope — SELALU pakai ini, jangan return raw dict
class ResponseEnvelope(BaseModel, Generic[T]):
    success: bool
    data: T | None
    message: str
    meta: dict | None = None  # untuk pagination

# Router — prefix dan tag selalu didefinisikan
router = APIRouter(prefix="/mahasiswa", tags=["Mahasiswa"])

# Dependency injection — selalu pakai Depends
@router.get("/{id}", response_model=ResponseEnvelope[MahasiswaResponse])
async def get_mahasiswa(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ...

# Service — semua logic bisnis di sini, bukan di router
class KRSService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def ajukan_krs(self, mahasiswa_id: uuid.UUID, kelas_ids: list[uuid.UUID]):
        # validasi prasyarat, bentrok jadwal, batas SKS, dll
        ...
```

### TypeScript (Frontend)

```typescript
// Penamaan
// - file komponen: PascalCase (MahasiswaTable.tsx)
// - file hooks/utils: camelCase (useMahasiswa.ts)
// - interface/type: PascalCase
// - variabel/fungsi: camelCase

// Semua API call lewat React Query — JANGAN fetch langsung di komponen
export function useMahasiswa(params: MahasiswaParams) {
  return useQuery({
    queryKey: ['mahasiswa', params],
    queryFn: () => mahasiswaApi.getList(params),
  })
}

// Axios instance terpusat — JANGAN buat instance baru
// lib/api.ts sudah handle: base URL, auth header, refresh token, error toast

// Zod untuk validasi form — SELALU validasi di client juga
const mahasiswaSchema = z.object({
  nama: z.string().min(3, 'Nama minimal 3 karakter'),
  nim: z.string().regex(/^\d{10}$/, 'NIM harus 10 digit'),
})

// Komponen — gunakan shadcn/ui, jangan buat UI dari scratch
// Selalu ada loading state, error state, dan empty state
```

---

## Database — Aturan Penting

### Konvensi Tabel
- Semua PK: `UUID` (bukan integer)
- Semua tabel punya: `id`, `created_at`, `updated_at`
- Soft delete: gunakan `deleted_at TIMESTAMP NULL` (bukan hapus fisik)
- Nama tabel: `snake_case` plural (`mata_kuliah`, `program_studi`)
- FK: nama kolom = `[tabel_referensi]_id` (mis: `mahasiswa_id`, `dosen_id`)

### Audit Trail
Setiap operasi tulis (CREATE/UPDATE/DELETE) pada tabel penting wajib insert ke `audit_logs`:
```python
# tabel penting yang di-audit:
# mahasiswa, dosen, pegawai, nilai, krs, tagihan, pembayaran,
# kontrak_penelitian, aset, surat_keluar, user (perubahan password/role)
```

### Enum — selalu definisikan di Python dan DB
```python
class StatusMahasiswa(str, enum.Enum):
    AKTIF = "aktif"
    CUTI = "cuti"
    NON_AKTIF = "non_aktif"
    DO = "DO"
    LULUS = "lulus"
```

---

## Autentikasi & Otorisasi

### Role yang ada (RBAC)
```python
class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN_AKADEMIK = "admin_akademik"
    ADMIN_KEUANGAN = "admin_keuangan"
    ADMIN_SDM = "admin_sdm"
    ADMIN_ASET = "admin_aset"
    ADMIN_PERPUSTAKAAN = "admin_perpustakaan"
    ADMIN_PMB = "admin_pmb"
    LPPM = "lppm"
    KAPRODI = "kaprodi"
    DOSEN = "dosen"
    STAF = "staf"
    MAHASISWA = "mahasiswa"
    ORANG_TUA = "orang_tua"
    ALUMNI = "alumni"
```

### Cara pakai di router
```python
from app.dependencies.auth import require_role

@router.post("/", dependencies=[Depends(require_role(["admin_akademik", "super_admin"]))])
async def create_mahasiswa(...): ...

# Atau untuk cek owner (mahasiswa hanya bisa akses data sendiri)
@router.get("/{id}")
async def get_mahasiswa(id: UUID, current_user: User = Depends(get_current_user)):
    if current_user.role == "mahasiswa" and current_user.mahasiswa.id != id:
        raise HTTPException(403, "Akses ditolak")
```

---

## API Design Rules

### URL Convention
```
GET    /api/v1/mahasiswa              # list + filter + pagination
POST   /api/v1/mahasiswa              # create
GET    /api/v1/mahasiswa/{id}         # detail
PUT    /api/v1/mahasiswa/{id}         # update (full)
PATCH  /api/v1/mahasiswa/{id}         # update (partial)
DELETE /api/v1/mahasiswa/{id}         # soft delete

# Sub-resource
GET    /api/v1/mahasiswa/{id}/krs
GET    /api/v1/mahasiswa/{id}/nilai
GET    /api/v1/mahasiswa/{id}/tagihan

# Aksi khusus (gunakan verb)
POST   /api/v1/krs/{id}/setujui
POST   /api/v1/krs/{id}/batalkan
POST   /api/v1/nilai/{id}/kunci
POST   /api/v1/tagihan/generate-massal
```

### Response Format — SELALU pakai envelope ini
```json
{
  "success": true,
  "data": { ... },
  "message": "Berhasil",
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

### Error Format
```json
{
  "success": false,
  "data": null,
  "message": "NIM sudah terdaftar",
  "errors": [
    { "field": "nim", "message": "NIM sudah digunakan" }
  ]
}
```

### Query Params Standar untuk List
```
?page=1&per_page=20          # pagination
?search=keyword              # full-text search
?sort=nama&order=asc         # sorting
?status=aktif                # filter spesifik per domain
?prodi_id=uuid               # filter relasi
?from=2024-01-01&to=2024-12-31  # filter tanggal
```

---

## 30 Modul Sistem

Berikut daftar lengkap modul. Setiap modul punya folder sendiri di `routers/`, `services/`, `models/`, `schemas/`:

| # | Modul | Prefix API | Aktor Utama |
|---|-------|-----------|-------------|
| 1 | Autentikasi | `/auth` | Semua |
| 2 | Dashboard | `/dashboard` | Semua (per role) |
| 3 | Mahasiswa | `/mahasiswa` | Admin Akademik, Staf |
| 4 | Dosen | `/dosen` | Admin Akademik, SDM |
| 5 | Master Data Akademik | `/master` | Admin Akademik |
| 6 | Kelas & Jadwal | `/kelas`, `/jadwal` | Admin Akademik |
| 7 | KRS | `/krs` | Mahasiswa, Dosen Wali |
| 8 | Penilaian | `/nilai` | Dosen, Kaprodi |
| 9 | Presensi | `/presensi` | Dosen, Mahasiswa |
| 10 | Keuangan | `/keuangan` | Admin Keuangan |
| 11 | Perpustakaan | `/perpustakaan` | Admin Perpustakaan |
| 12 | Beasiswa | `/beasiswa` | Admin Kemahasiswaan |
| 13 | Tugas Akhir | `/ta` | Mahasiswa, Dosen |
| 14 | Alumni & Yudisium | `/alumni`, `/yudisium` | Admin Akademik |
| 15 | Laporan & Statistik | `/laporan` | Semua (per role) |
| 16 | Notifikasi | `/notifikasi` | Semua |
| 17 | Pengaturan Sistem | `/pengaturan` | Super Admin |
| 18 | Magang / PKL | `/magang` | Mahasiswa, Dosen |
| 19 | PMB | `/pmb` | Admin PMB, Calon |
| 20 | Semester Pendek | `/semester-pendek` | Admin Akademik |
| 21 | Ujian (UTS/UAS) | `/ujian` | Admin, Dosen, Mahasiswa |
| 22 | Surat Menyurat | `/surat` | Admin, Mahasiswa |
| 23 | Klinik / Kesehatan | `/klinik` | Nakes, Mahasiswa |
| 24 | UKM / Organisasi | `/ukm` | Admin Kemahasiswaan |
| 25 | E-Learning | `/elearning` | Dosen, Mahasiswa |
| 26 | Penelitian | `/penelitian` | Dosen, LPPM |
| 27 | Pengabdian Masyarakat | `/pkm` | Dosen, LPPM |
| 28 | Aset & Inventaris | `/aset` | Admin Aset |
| 29 | Kepegawaian | `/kepegawaian` | Admin SDM |
| 30 | Akreditasi | `/akreditasi` | GPM, Kaprodi |

---

## Aturan Bisnis Kritis — JANGAN SAMPAI SALAH

```
KRS:
- Mahasiswa hanya bisa ajukan KRS jika SPP semester berjalan LUNAS
- Maks SKS: 24 (IPK >= 3.0), 21 (IPK 2.5-2.99), 18 (IPK < 2.5)
- Validasi prasyarat MK wajib dicek sebelum boleh pilih
- Validasi bentrok jadwal wajib dicek real-time
- KRS hanya bisa diubah dalam periode yang dibuka admin

NILAI:
- Nilai akhir = (UTS × bobot_uts) + (UAS × bobot_uas) + (Tugas × bobot_tugas)
- Konversi: A=4.0(85-100), B+=3.5(80-84), B=3.0(75-79),
            C+=2.5(70-74), C=2.0(65-69), D=1.0(55-64), E=0(0-54)
- Nilai yang sudah dikunci tidak bisa diubah langsung — wajib lewat alur koreksi
- IPK = Σ(bobot × SKS) / Σ(SKS lulus), recalculate setiap ada nilai baru

PRESENSI:
- QR token valid 15 menit + validasi radius GPS 200m dari koordinat ruang
- Mahasiswa tidak boleh ujian jika presensi < 75% per MK
- Warning otomatis ke mahasiswa + orang tua jika absen > 25%

KEUANGAN:
- Blokir KRS jika ada tunggakan SPP
- Blokir kartu ujian jika ada tunggakan SPP
- Webhook payment gateway harus idempotent (cek duplikasi via kode_transaksi)

SEMESTER PENDEK:
- Hanya bisa ambil MK dengan nilai D, E, atau C (tergantung kebijakan prodi)
- Maks 9 SKS di SP
- MK SP jalan jika peserta >= minimum (default 10, bisa setting per prodi)
- Nilai SP: replace nilai lama (untuk D/E) atau ambil terbaik (untuk C)

PENELITIAN/PkM:
- Satu dosen maks 1 penelitian aktif sebagai ketua per periode (per skema)
- Pencairan dana termin 2 hanya setelah laporan kemajuan 70% approved
- Luaran wajib divalidasi LPPM sebelum dihitung sebagai capaian
```

---

## Environment Variables

```bash
# .env.example

# App
APP_NAME=SIAKAD
APP_ENV=development  # development | staging | production
SECRET_KEY=           # min 64 chars random
DEBUG=true

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/siakad
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=40

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# Storage (Cloudflare R2)
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=siakad-files
R2_ENDPOINT_URL=
R2_PUBLIC_URL=

# Email (SendGrid)
SENDGRID_API_KEY=
EMAIL_FROM=noreply@kampus.ac.id
EMAIL_FROM_NAME=SIAKAD Kampus

# WhatsApp (Fonnte)
FONNTE_API_KEY=
FONNTE_DEVICE_ID=

# Payment Gateway (Midtrans)
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false

# Sentry
SENTRY_DSN=

# CORS
CORS_ORIGINS=http://localhost:3000,https://siakad.kampus.ac.id

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
```

---

## Urutan Pengembangan yang Disarankan

Ikuti urutan ini agar setiap fase bisa langsung di-demo:

```
Fase 0 — Foundation (1 minggu)
  ✓ Setup repo, Railway, env
  ✓ Database + Alembic migration
  ✓ Base model (User, audit_log)
  ✓ Auth (login, refresh, logout)
  ✓ Middleware (CORS, rate limit, logging)
  ✓ Response envelope standar

Fase 1 — Master Data (2 minggu)
  ✓ Program studi, mata kuliah, ruang
  ✓ Mahasiswa CRUD + import Excel
  ✓ Dosen CRUD
  ✓ Kalender akademik

Fase 2 — Akademik Core (3 minggu)
  ✓ Kelas & jadwal (+ cek bentrok)
  ✓ KRS (ajukan, approve, batalkan)
  ✓ Penilaian (input, kunci, koreksi)
  ✓ KHS + Transkrip (generate PDF)

Fase 3 — Operasional (2 minggu)
  ✓ Presensi QR
  ✓ Ujian (jadwal, kartu, berita acara)
  ✓ Keuangan (tagihan, pembayaran, webhook)

Fase 4 — Kemahasiswaan (3 minggu)
  ✓ Tugas Akhir
  ✓ Magang/PKL
  ✓ Beasiswa
  ✓ UKM

Fase 5 — Layanan (2 minggu)
  ✓ Surat menyurat
  ✓ Perpustakaan
  ✓ E-Learning
  ✓ Semester Pendek
  ✓ PMB

Fase 6 — SDM & Aset (2 minggu)
  ✓ Kepegawaian + Payroll
  ✓ Aset & Inventaris
  ✓ Klinik

Fase 7 — Riset & Mutu (2 minggu)
  ✓ Penelitian
  ✓ Pengabdian Masyarakat + KKN
  ✓ Akreditasi + IKU

Fase 8 — Laporan & Dashboard (2 minggu)
  ✓ Dashboard per role
  ✓ Semua laporan + export

Fase 9 — Mobile App (4 minggu)
  ✓ React Native Expo
  ✓ Fitur: jadwal, KRS, nilai, presensi QR, tagihan, notif

Fase 10 — Notifikasi & Integrasi (2 minggu)
  ✓ Email, WhatsApp, Push Notif
  ✓ PDDIKTI Feeder sync

Fase 11 — Testing & Hardening (3 minggu)
  ✓ Unit test, integration test
  ✓ Security audit
  ✓ Performance optimization

Fase 12 — Go-live (2 minggu)
  ✓ Migrasi data lama
  ✓ Training user
  ✓ Soft launch → full launch
```

---

## Hal yang JANGAN Dilakukan

```
✗ Jangan pakai integer sebagai PK — selalu UUID
✗ Jangan hard delete — selalu soft delete (deleted_at)
✗ Jangan taruh business logic di router — semua ke service
✗ Jangan query langsung di router — lewat service
✗ Jangan return raw dict — selalu pakai ResponseEnvelope
✗ Jangan commit migration yang belum di-review
✗ Jangan hardcode nilai konfigurasi — selalu dari .env
✗ Jangan skip validasi di backend meski sudah ada di frontend
✗ Jangan lupa audit_log untuk operasi sensitif
✗ Jangan pakai sync SQLAlchemy — selalu async
✗ Jangan buat komponen UI dari scratch jika sudah ada di shadcn/ui
✗ Jangan fetch API langsung di komponen — selalu lewat React Query hooks
```

---

## Referensi Cepat

```bash
# Jalankan backend dev
uvicorn app.main:app --reload --port 8000

# Buat migration baru
alembic revision --autogenerate -m "add tabel mahasiswa"

# Jalankan migration
alembic upgrade head

# Jalankan Celery worker
celery -A app.tasks worker --loglevel=info

# Jalankan frontend dev
cd siakad-web && npm run dev

# Build mobile
cd siakad-mobile && eas build --platform android --profile preview
```

---

*Dokumen ini adalah sumber kebenaran tunggal untuk proyek SIAKAD.*
*Update file ini setiap ada perubahan arsitektur atau keputusan teknis baru.*
*Terakhir diperbarui: 2025*
