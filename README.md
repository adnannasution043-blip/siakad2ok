# SIAKAD Local — JSON Mode

Satu server untuk backend (FastAPI) sekaligus serve frontend (HTML/JS).
Data disimpan di file JSON — tidak perlu PostgreSQL, Redis, atau database apapun.

## Struktur Folder

```
siakad-local-json/
├── backend/
│   ├── app/
│   │   ├── main.py          ← entry point, serve API + frontend
│   │   ├── routers/         ← endpoint per modul
│   │   └── utils/
│   │       ├── db.py        ← JSON "database" engine
│   │       └── security.py  ← JWT + bcrypt
│   ├── data/                ← semua file JSON (database)
│   │   ├── users.json
│   │   ├── mahasiswa.json
│   │   └── ...
│   ├── requirements.txt
│   └── run.sh
├── frontend/
│   ├── index.html           ← SPA utama
│   └── js/
│       ├── core/            ← api.js, auth.js, router.js, ui.js
│       └── modules/         ← dashboard.js, mahasiswa.js, dst
└── README.md
```

## Cara Jalankan

```bash
cd backend
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

Buka browser: **http://localhost:8000**

API docs: http://localhost:8000/api/docs

## Akun Login (password semua: `secret`)

| Email | Role |
|---|---|
| admin@siakad.ac.id | Super Admin |
| akademik@siakad.ac.id | Admin Akademik |
| keuangan@siakad.ac.id | Admin Keuangan |
| kaprodi@siakad.ac.id | Kaprodi |
| dosen1@siakad.ac.id | Dosen |
| ahmad1@mhs.ac.id | Mahasiswa |

## Data Dummy yang Tersedia

| Data | Jumlah |
|---|---|
| Mahasiswa | 422 |
| Dosen | 15 |
| Program Studi | 6 |
| Mata Kuliah | 22 |
| Kelas (semester aktif) | 18 |
| KRS | 496 |
| Nilai | 250 |
| Tagihan SPP | 690 |
| Presensi | 2.124 |
| Tugas Akhir | 35 |
| Magang | 20 |
| Buku Perpustakaan | 20 |

## Deploy ke Railway (Opsi A — 1 Service)

1. Push folder `backend/` ke GitHub (sertakan folder `frontend/` di dalamnya)
2. Buat service baru di Railway → connect repo
3. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Done — Railway otomatis serve API + frontend dari 1 URL

## Nanti Migrasi ke PostgreSQL

Cukup ganti `backend/app/utils/db.py` dengan SQLAlchemy.
Semua router tidak perlu diubah.
"# siakadlocal" 
"# siakadlocal2" 
"# siakadlocal2" 
