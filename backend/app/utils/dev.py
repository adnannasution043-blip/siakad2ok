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
