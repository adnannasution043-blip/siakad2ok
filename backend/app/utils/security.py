import hmac, hashlib, base64, json
from datetime import datetime, timedelta, timezone

SECRET_KEY = "siakad-local-dev-secret-key-ganti-di-production"
ACCESS_EXPIRE_MINUTES = 480
REFRESH_EXPIRE_DAYS = 30

# ── Minimal HS256 JWT (no external deps) ──────────────────────
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + '=' * (pad % 4))

def _make_token(payload: dict) -> str:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body   = _b64url(json.dumps(payload).encode())
    msg    = f"{header}.{body}".encode()
    sig    = _b64url(hmac.new(SECRET_KEY.encode(), msg, hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"

def _verify_token(token: str) -> dict:
    parts = token.split('.')
    if len(parts) != 3:
        raise ValueError("Token tidak valid")
    header, body, sig = parts
    msg = f"{header}.{body}".encode()
    expected = _b64url(hmac.new(SECRET_KEY.encode(), msg, hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        raise ValueError("Signature tidak valid")
    payload = json.loads(_b64url_decode(body))
    exp = payload.get("exp")
    if exp and datetime.now(timezone.utc).timestamp() > exp:
        raise ValueError("Token kedaluwarsa")
    return payload

# ── Password hashing (pure Python fallback) ────────────────────
try:
    import bcrypt as _bcrypt
    def hash_password(p: str) -> str:
        return _bcrypt.hashpw(p.encode(), _bcrypt.gensalt(10)).decode()
    def verify_password(plain: str, hashed: str) -> bool:
        try: return _bcrypt.checkpw(plain.encode(), hashed.encode())
        except Exception: return False
except Exception:
    import hashlib as _hl
    def hash_password(p: str) -> str:
        return 'sha256:' + _hl.sha256(p.encode()).hexdigest()
    def verify_password(plain: str, hashed: str) -> bool:
        if hashed.startswith('sha256:'):
            return hashed == 'sha256:' + _hl.sha256(plain.encode()).hexdigest()
        return False

# ── Public API ─────────────────────────────────────────────────
def create_access_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_EXPIRE_MINUTES)
    return _make_token({"sub": user_id, "type": "access", "exp": int(exp.timestamp())})

def create_refresh_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=REFRESH_EXPIRE_DAYS)
    return _make_token({"sub": user_id, "type": "refresh", "exp": int(exp.timestamp())})

def decode_token(token: str) -> dict:
    return _verify_token(token)
