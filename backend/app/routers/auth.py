from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from app.utils.db import find_one
from app.utils.security import verify_password, create_access_token, create_refresh_token, decode_token

router = APIRouter(prefix="/auth", tags=["Auth"])

def ok(data=None, message="Berhasil"):
    return {"success": True, "data": data, "message": message}

def _get_entity_id(user: dict):
    """Return the mahasiswa.id or dosen.id linked to this user, or None."""
    role = user.get("role")
    uid = user.get("id")
    if role == "mahasiswa":
        rec = find_one("mahasiswa", user_id=uid)
        return rec["id"] if rec else None
    if role == "dosen":
        rec = find_one("dosen", user_id=uid)
        return rec["id"] if rec else None
    return None

def _user_payload(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "nama": user.get("nama", ""),
        "role": user["role"],
        "foto_url": user.get("foto_url"),
        "entity_id": _get_entity_id(user),
    }

class LoginReq(BaseModel):
    email: EmailStr
    password: str

class RefreshReq(BaseModel):
    refresh_token: str

@router.post("/login")
def login(body: LoginReq):
    user = find_one("users", email=body.email)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Email atau password salah")
    if not user.get("is_active", True):
        raise HTTPException(403, "Akun tidak aktif")

    return ok({
        "access_token": create_access_token(user["id"]),
        "refresh_token": create_refresh_token(user["id"]),
        "token_type": "bearer",
        "user": _user_payload(user),
    }, "Login berhasil")

@router.post("/refresh")
def refresh(body: RefreshReq):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Token tidak valid")
        user = find_one("users", id=payload["sub"])
        if not user:
            raise HTTPException(401, "User tidak ditemukan")
        return ok({
            "access_token": create_access_token(user["id"]),
            "refresh_token": create_refresh_token(user["id"]),
            "token_type": "bearer",
        })
    except Exception as e:
        raise HTTPException(401, str(e))

@router.get("/me")
def me(authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "")
        payload = decode_token(token)
        user = find_one("users", id=payload["sub"])
        if not user:
            raise HTTPException(401, "User tidak ditemukan")
        return ok(_user_payload(user))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "Token tidak valid")

@router.post("/logout")
def logout():
    return ok(message="Logout berhasil")
