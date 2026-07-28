# ============================================================
# DEV.PY — Dev mode helper
# Set DEV_MODE = False kalau sudah mau pakai auth beneran
# ============================================================
DEV_MODE = True

DEV_USER = {
    "id": "usr-001",
    "email": "admin@siakad.ac.id",
    "nama": "Administrator",
    "role": "super_admin",
    "is_active": True,
}

def get_user_from_request(authorization: str):
    """
    Dev mode: return dummy user langsung tanpa validasi token.
    Production mode: validasi JWT dari header Authorization.
    """
    if DEV_MODE:
        return DEV_USER

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
        raise HTTPException(401, "Token tidak valid")

def check_role(user: dict, allowed_roles: list):
    """Cek apakah user punya role yang diizinkan. Di dev mode selalu lolos."""
    if DEV_MODE:
        return True
    from fastapi import HTTPException
    if user.get("role") not in allowed_roles:
        raise HTTPException(403, "Akses ditolak")
    return True
