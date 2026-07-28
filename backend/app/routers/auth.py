from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from app.utils.db import find_one
from app.utils.security import verify_password, create_access_token, create_refresh_token, decode_token

router = APIRouter(prefix="/auth", tags=["Auth"])

def ok(data=None, message="Berhasil"):
    return {"success": True, "data": data, "message": message}

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
        "user": {
            "id": user["id"],
            "email": user["email"],
            "nama": user.get("nama", ""),
            "role": user["role"],
            "foto_url": user.get("foto_url"),
        }
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
        return ok({
            "id": user["id"],
            "email": user["email"],
            "nama": user.get("nama", ""),
            "role": user["role"],
            "foto_url": user.get("foto_url"),
        })
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "Token tidak valid")

@router.post("/logout")
def logout():
    return ok(message="Logout berhasil")
