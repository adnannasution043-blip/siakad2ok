"""
Database utility — PostgreSQL backend (drop-in replacement for JSON file version).

All functions have the same signature as the JSON version so existing routers
require zero changes. Data is stored in a single `store` table with a JSONB
`data` column, allowing schema-free persistence.

Falls back to JSON-file mode when DATABASE_URL is not set (for local dev without
a Postgres instance).
"""
import json, uuid, math, os
from datetime import datetime
from pathlib import Path
from contextlib import contextmanager

DATABASE_URL = os.getenv("DATABASE_URL", "")

# ── Postgres helpers ───────────────────────────────────────────────────────────

_pool = None

def _get_pool():
    global _pool
    if _pool is None:
        import psycopg2.pool
        url = DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        _pool = psycopg2.pool.ThreadedConnectionPool(1, 20, url)
    return _pool

@contextmanager
def _conn():
    pool = _get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def init_db():
    """Create the store table if it does not exist."""
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS store (
                    table_name  TEXT NOT NULL,
                    record_id   TEXT NOT NULL,
                    data        JSONB NOT NULL DEFAULT '{}',
                    PRIMARY KEY (table_name, record_id)
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_store_table
                ON store(table_name)
            """)


def seed_from_json():
    """Seed each table from local JSON files if that specific table is empty."""
    data_dir = Path(__file__).parent.parent.parent / "data"
    if not data_dir.exists():
        return

    with _conn() as conn:
        with conn.cursor() as cur:
            for json_file in sorted(data_dir.glob("*.json")):
                table = json_file.stem
                try:
                    records = json.loads(json_file.read_text(encoding="utf-8"))
                    if not isinstance(records, list) or not records:
                        continue
                    # Check per-table so new tables added after first deploy still get seeded
                    cur.execute("SELECT COUNT(*) FROM store WHERE table_name = %s", (table,))
                    if cur.fetchone()[0] > 0:
                        continue
                    for record in records:
                        rid = str(record.get("id", uuid.uuid4()))
                        cur.execute(
                            """
                            INSERT INTO store (table_name, record_id, data)
                            VALUES (%s, %s, %s)
                            ON CONFLICT (table_name, record_id) DO NOTHING
                            """,
                            (table, rid, json.dumps(record, default=str))
                        )
                except Exception:
                    pass  # skip malformed files


def reseed_users():
    """Always upsert users from users.json so password/role changes propagate on redeploy."""
    data_dir = Path(__file__).parent.parent.parent / "data"
    json_file = data_dir / "users.json"
    if not json_file.exists():
        return
    try:
        records = json.loads(json_file.read_text(encoding="utf-8"))
        if not isinstance(records, list):
            return
        with _conn() as conn:
            with conn.cursor() as cur:
                for record in records:
                    rid = str(record.get("id", uuid.uuid4()))
                    cur.execute(
                        """
                        INSERT INTO store (table_name, record_id, data)
                        VALUES ('users', %s, %s)
                        ON CONFLICT (table_name, record_id) DO UPDATE
                        SET data = EXCLUDED.data
                        """,
                        (rid, json.dumps(record, default=str))
                    )
    except Exception:
        pass


def reseed_tables(table_names: list):
    """Always upsert specific tables from JSON files — used to propagate corrected seed data."""
    data_dir = Path(__file__).parent.parent.parent / "data"
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                for table in table_names:
                    json_file = data_dir / f"{table}.json"
                    if not json_file.exists():
                        continue
                    records = json.loads(json_file.read_text(encoding="utf-8"))
                    if not isinstance(records, list) or not records:
                        continue
                    for record in records:
                        rid = str(record.get("id", uuid.uuid4()))
                        cur.execute(
                            """
                            INSERT INTO store (table_name, record_id, data)
                            VALUES (%s, %s, %s)
                            ON CONFLICT (table_name, record_id) DO UPDATE
                            SET data = EXCLUDED.data
                            """,
                            (table, rid, json.dumps(record, default=str))
                        )
    except Exception:
        pass


# ── Public API — identical signatures to the JSON version ─────────────────────

def read_all(table: str) -> list:
    if not DATABASE_URL:
        return _json_read_all(table)
    import psycopg2.extras
    with _conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT data FROM store WHERE table_name = %s", (table,)
            )
            return [dict(row["data"]) for row in cur.fetchall()]


def write_all(table: str, data_list: list):
    if not DATABASE_URL:
        return _json_write_all(table, data_list)
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM store WHERE table_name = %s", (table,))
            for record in data_list:
                rid = str(record.get("id", uuid.uuid4()))
                cur.execute(
                    "INSERT INTO store (table_name, record_id, data) VALUES (%s, %s, %s)",
                    (table, rid, json.dumps(record, default=str))
                )


def find_one(table: str, **filters):
    for row in read_all(table):
        if all(row.get(k) == v for k, v in filters.items()):
            return row
    return None


def find_by_id(table: str, id: str):
    if not DATABASE_URL:
        return _json_find_one(table, id=id, deleted_at=None)
    import psycopg2.extras
    with _conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT data FROM store WHERE table_name = %s AND record_id = %s",
                (table, str(id))
            )
            row = cur.fetchone()
            if row is None:
                return None
            record = dict(row["data"])
            return None if record.get("deleted_at") else record


def insert(table: str, data: dict) -> dict:
    data.setdefault("id", str(uuid.uuid4()))
    data.setdefault("created_at", datetime.now().isoformat())
    data.setdefault("updated_at", datetime.now().isoformat())
    data.setdefault("deleted_at", None)
    if not DATABASE_URL:
        return _json_insert(table, data)
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO store (table_name, record_id, data) VALUES (%s, %s, %s)",
                (table, str(data["id"]), json.dumps(data, default=str))
            )
    return data


def update(table: str, id: str, updates: dict):
    updates["updated_at"] = datetime.now().isoformat()
    if not DATABASE_URL:
        return _json_update(table, id, updates)
    import psycopg2.extras
    with _conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE store
                   SET data = data || %s::jsonb
                 WHERE table_name = %s AND record_id = %s
                RETURNING data
                """,
                (json.dumps(updates, default=str), table, str(id))
            )
            row = cur.fetchone()
            return dict(row["data"]) if row else None


def soft_delete(table: str, id: str) -> bool:
    return update(table, id, {"deleted_at": datetime.now().isoformat()}) is not None


def search_rows(rows: list, fields: list, keyword: str) -> list:
    if not keyword:
        return rows
    kw = keyword.lower()
    return [r for r in rows if any(kw in str(r.get(f, "")).lower() for f in fields)]


def filter_rows(rows: list, **filters) -> list:
    for k, v in filters.items():
        if v:
            rows = [r for r in rows if str(r.get(k, "")) == str(v)]
    return rows


def paginate(rows: list, page: int = 1, per_page: int = 20):
    total = len(rows)
    total_pages = math.ceil(total / per_page) if total else 1
    items = rows[(page - 1) * per_page: page * per_page]
    return items, {
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": total_pages,
    }


# ── JSON fallback (when DATABASE_URL is not set) ───────────────────────────────

DATA_DIR = Path(__file__).parent.parent.parent / "data"


def _json_path(table):
    return DATA_DIR / f"{table}.json"


def _json_read_all(table):
    p = _json_path(table)
    if not p.exists():
        p.write_text("[]")
    return json.loads(p.read_text(encoding="utf-8"))


def _json_write_all(table, data):
    _json_path(table).write_text(
        json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )


def _json_find_one(table, **filters):
    for row in _json_read_all(table):
        if all(row.get(k) == v for k, v in filters.items()):
            return row
    return None


def _json_insert(table, data):
    rows = _json_read_all(table)
    rows.append(data)
    _json_write_all(table, rows)
    return data


def _json_update(table, id, updates):
    rows = _json_read_all(table)
    for i, row in enumerate(rows):
        if row.get("id") == id:
            rows[i] = {**row, **updates}
            _json_write_all(table, rows)
            return rows[i]
    return None
