# ============================================================
# DEV.PY — Auth helper
# DEV_MODE = False → auth JWT divalidasi (production & local)
# ============================================================
DEV_MODE = False

def get_user_from_request(authorization: str):
    from app.utils.security import decode_token
    from app.utils.db import find_one
    from fastapi import HTTPException

    try:
        token = authorization.replace("Bearer ", "").strip()
        payload = decode_token(token)
        user = find_one("users", id=payload["sub"])
        if not user:
            raise HTTPException(401, "User tidak ditemukan")
        if not user.get("is_active", True):
            raise HTTPException(403, "Akun tidak aktif")
        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "Token tidak valid — silakan login ulang")

def check_role(user: dict, allowed_roles: list):
    """Lempar 403 jika user tidak punya role yang diizinkan."""
    from fastapi import HTTPException
    if user.get("role") not in allowed_roles:
        raise HTTPException(403, "Akses ditolak untuk role Anda")
    return True

# ── Entity resolvers ──────────────────────────────────────────

def get_mahasiswa_for_user(user: dict) -> dict | None:
    """Kembalikan record mahasiswa yang terhubung ke user ini."""
    from app.utils.db import find_one
    return find_one("mahasiswa", user_id=user["id"])

def get_dosen_for_user(user: dict) -> dict | None:
    """Kembalikan record dosen yang terhubung ke user ini."""
    from app.utils.db import find_one
    return find_one("dosen", user_id=user["id"])

def get_kelas_ids_untuk_dosen(dosen_id: str) -> set:
    """Kembalikan set kelas_id yang diajar dosen ini."""
    from app.utils.db import read_all
    return {
        k["id"] for k in read_all("kelas")
        if k.get("dosen_id") == dosen_id and not k.get("deleted_at")
    }

# Role-group constants (dipakai di banyak router)
ADMIN_ROLES   = ["super_admin", "admin_akademik", "staf"]
FULL_ACCESS   = ["super_admin", "admin_akademik", "kaprodi", "staf"]
KEU_ROLES     = ["super_admin", "admin_akademik", "admin_keuangan", "staf"]
