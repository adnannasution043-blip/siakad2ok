from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.utils.db import read_all, find_by_id, insert, update, soft_delete, paginate

router = APIRouter(prefix="/notifikasi", tags=["Notifikasi"])

DEV_USER_ID = "usr-001"

def _now():
    return datetime.now(timezone.utc).isoformat()

# ─── STATS ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats():
    all_notif = [n for n in read_all("notifikasi") if not n.get("deleted_at") and n.get("user_id") == DEV_USER_ID]
    pengumuman = [p for p in read_all("pengumuman") if not p.get("deleted_at")]
    belum_dibaca = len([n for n in all_notif if not n.get("dibaca")])
    sudah_dibaca = len([n for n in all_notif if n.get("dibaca")])
    return {
        "success": True,
        "data": {
            "total": len(all_notif),
            "belum_dibaca": belum_dibaca,
            "sudah_dibaca": sudah_dibaca,
            "pengumuman": len(pengumuman),
        },
        "message": "OK"
    }

# ─── NOTIFIKASI ───────────────────────────────────────────────────────────────

@router.get("")
def list_notifikasi(
    jenis: Optional[str] = None,
    dibaca: Optional[bool] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=1000),
):
    data = [n for n in read_all("notifikasi") if not n.get("deleted_at") and n.get("user_id") == DEV_USER_ID]
    if jenis:
        data = [n for n in data if n.get("jenis") == jenis]
    if dibaca is not None:
        data = [n for n in data if bool(n.get("dibaca")) == dibaca]
    data.sort(key=lambda n: n.get("created_at", ""), reverse=True)
    items, meta = paginate(data, page, per_page)
    return {"success": True, "data": items, "message": "OK", "meta": meta}

@router.post("/{notif_id}/baca")
def tandai_dibaca(notif_id: str):
    rec = find_by_id("notifikasi", notif_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Notifikasi tidak ditemukan")
    updated = update("notifikasi", notif_id, {"dibaca": True})
    return {"success": True, "data": updated, "message": "Notifikasi ditandai dibaca"}

@router.post("/baca-semua")
def tandai_semua_dibaca():
    data = [n for n in read_all("notifikasi") if not n.get("deleted_at") and n.get("user_id") == DEV_USER_ID and not n.get("dibaca")]
    for n in data:
        update("notifikasi", n["id"], {"dibaca": True})
    return {"success": True, "data": None, "message": f"{len(data)} notifikasi ditandai dibaca"}

@router.delete("/{notif_id}")
def hapus_notifikasi(notif_id: str):
    rec = find_by_id("notifikasi", notif_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Notifikasi tidak ditemukan")
    soft_delete("notifikasi", notif_id)
    return {"success": True, "data": None, "message": "Notifikasi dihapus"}

# ─── PENGUMUMAN ───────────────────────────────────────────────────────────────

@router.get("/pengumuman/list")
def list_pengumuman(
    kategori: Optional[str] = None,
    target: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
):
    data = [p for p in read_all("pengumuman") if not p.get("deleted_at")]
    if kategori:
        data = [p for p in data if p.get("kategori") == kategori]
    if target and target != "semua":
        data = [p for p in data if p.get("target") in (target, "semua")]
    data.sort(key=lambda p: (not p.get("penting", False), p.get("published_at", "")), reverse=True)
    items, meta = paginate(data, page, per_page)
    return {"success": True, "data": items, "message": "OK", "meta": meta}

@router.post("/pengumuman")
def create_pengumuman(body: dict):
    required = ["judul", "isi", "kategori"]
    for f in required:
        if not body.get(f):
            raise HTTPException(400, f"Field '{f}' wajib diisi")
    record = {
        "id": f"peng-{uuid.uuid4().hex[:8]}",
        "judul": body["judul"],
        "isi": body["isi"],
        "kategori": body["kategori"],
        "target": body.get("target", "semua"),
        "penting": bool(body.get("penting", False)),
        "published_at": _now(),
        "created_at": _now(),
        "deleted_at": None,
    }
    insert("pengumuman", record)
    return {"success": True, "data": record, "message": "Pengumuman berhasil dipublikasikan"}

@router.put("/pengumuman/{peng_id}")
def update_pengumuman(peng_id: str, body: dict):
    rec = find_by_id("pengumuman", peng_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Pengumuman tidak ditemukan")
    changes = {k: body[k] for k in ["judul", "isi", "kategori", "target", "penting"] if k in body}
    updated = update("pengumuman", peng_id, changes)
    return {"success": True, "data": updated, "message": "Pengumuman berhasil diperbarui"}

@router.delete("/pengumuman/{peng_id}")
def hapus_pengumuman(peng_id: str):
    rec = find_by_id("pengumuman", peng_id)
    if not rec or rec.get("deleted_at"):
        raise HTTPException(404, "Pengumuman tidak ditemukan")
    soft_delete("pengumuman", peng_id)
    return {"success": True, "data": None, "message": "Pengumuman dihapus"}
