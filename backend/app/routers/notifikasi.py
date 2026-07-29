from fastapi import APIRouter, Query, Header, HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.utils.db import read_all, find_by_id, insert, update, soft_delete, paginate
from app.utils.dev import get_user_from_request, check_role

router = APIRouter(prefix="/notifikasi", tags=["Notifikasi"])

ADMIN = ["super_admin", "admin_akademik", "staf"]

def ok(data=None, message="Berhasil", meta=None):
    return {"success": True, "data": data, "message": message, "meta": meta}

def _now():
    return datetime.now(timezone.utc).isoformat()


# ─── STATS ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    user_id = user["id"]
    all_notif = [n for n in read_all("notifikasi") if not n.get("deleted_at") and n.get("user_id") == user_id]
    pengumuman = [p for p in read_all("pengumuman") if not p.get("deleted_at")]
    return ok({
        "total": len(all_notif),
        "belum_dibaca": len([n for n in all_notif if not n.get("dibaca")]),
        "sudah_dibaca": len([n for n in all_notif if n.get("dibaca")]),
        "pengumuman": len(pengumuman),
    })


# ─── NOTIFIKASI ───────────────────────────────────────────────────────────────

@router.get("")
def list_notifikasi(
    jenis: Optional[str] = None,
    dibaca: Optional[bool] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    user_id = user["id"]
    data = [n for n in read_all("notifikasi") if not n.get("deleted_at") and n.get("user_id") == user_id]
    if jenis:
        data = [n for n in data if n.get("jenis") == jenis]
    if dibaca is not None:
        data = [n for n in data if bool(n.get("dibaca")) == dibaca]
    data.sort(key=lambda n: n.get("created_at", ""), reverse=True)
    items, meta = paginate(data, page, per_page)
    return ok(items, meta=meta)


@router.post("/{notif_id}/baca")
def tandai_dibaca(notif_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    rec = find_by_id("notifikasi", notif_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Notifikasi tidak ditemukan")
    if rec.get("user_id") != user["id"]:
        raise HTTPException(403, "Akses ditolak")
    updated = update("notifikasi", notif_id, {"dibaca": True})
    return ok(updated, "Notifikasi ditandai dibaca")


@router.post("/baca-semua")
def tandai_semua_dibaca(authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    user_id = user["id"]
    data = [n for n in read_all("notifikasi")
            if not n.get("deleted_at") and n.get("user_id") == user_id and not n.get("dibaca")]
    for n in data:
        update("notifikasi", n["id"], {"dibaca": True})
    return ok(None, f"{len(data)} notifikasi ditandai dibaca")


@router.delete("/{notif_id}")
def hapus_notifikasi(notif_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    rec = find_by_id("notifikasi", notif_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Notifikasi tidak ditemukan")
    if rec.get("user_id") != user["id"]:
        raise HTTPException(403, "Akses ditolak")
    soft_delete("notifikasi", notif_id)
    return ok(None, "Notifikasi dihapus")


# ─── PENGUMUMAN ───────────────────────────────────────────────────────────────

@router.get("/pengumuman/list")
def list_pengumuman(
    kategori: Optional[str] = None,
    target: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    authorization: str = Header(default="dev"),
):
    user = get_user_from_request(authorization)
    data = [p for p in read_all("pengumuman") if not p.get("deleted_at")]
    role = user.get("role", "")
    if role not in ("super_admin", "admin_akademik", "staf"):
        # Non-admin only sees pengumuman targeted at them or "semua"
        data = [p for p in data if p.get("target") in (role, "semua")]
    if kategori:
        data = [p for p in data if p.get("kategori") == kategori]
    if target and target != "semua":
        data = [p for p in data if p.get("target") in (target, "semua")]
    data.sort(key=lambda p: (not p.get("penting", False), p.get("published_at", "")), reverse=True)
    items, meta = paginate(data, page, per_page)
    return ok(items, meta=meta)


@router.post("/pengumuman")
def create_pengumuman(body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    required = ["judul", "isi", "kategori"]
    for f in required:
        if not body.get(f):
            raise HTTPException(400, f"Field '{f}' wajib diisi")
    now = _now()
    record = {
        "id": f"peng-{uuid.uuid4().hex[:8]}",
        "judul": body["judul"],
        "isi": body["isi"],
        "kategori": body["kategori"],
        "target": body.get("target", "semua"),
        "penting": bool(body.get("penting", False)),
        "published_at": now,
        "created_at": now,
        "deleted_at": None,
    }
    insert("pengumuman", record)
    return ok(record, "Pengumuman berhasil dipublikasikan")


@router.put("/pengumuman/{peng_id}")
def update_pengumuman(peng_id: str, body: dict, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    rec = find_by_id("pengumuman", peng_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Pengumuman tidak ditemukan")
    changes = {k: body[k] for k in ["judul", "isi", "kategori", "target", "penting"] if k in body}
    updated = update("pengumuman", peng_id, changes)
    return ok(updated, "Pengumuman berhasil diperbarui")


@router.delete("/pengumuman/{peng_id}")
def hapus_pengumuman(peng_id: str, authorization: str = Header(default="dev")):
    user = get_user_from_request(authorization)
    check_role(user, ADMIN)
    rec = find_by_id("pengumuman", peng_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Pengumuman tidak ditemukan")
    soft_delete("pengumuman", peng_id)
    return ok(None, "Pengumuman dihapus")
