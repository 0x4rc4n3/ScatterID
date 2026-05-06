"""
ledger.py — 3-node append-only identity blockchain
SHA3-256 hash chain, one SQLite file per node.
Blocks contain identity registration events.
"""
import sqlite3, hashlib, json, time, os

_BASE     = os.path.dirname(os.path.abspath(__file__))
NODE_DBS  = [os.path.join(_BASE, "db", f"node{i}.db") for i in range(3)]
NODE_NAMES = ["Node 0 — Primary", "Node 1 — Secondary", "Node 2 — Replica"]

GENESIS_TS = 1745000000   # fixed for reproducible genesis hash

# ── Hash helper ───────────────────────────────────────────────────────────────

def _block_hash(index, ts, data_str, prev_hash):
    payload = f"{index}:{ts}:{data_str}:{prev_hash}"
    return hashlib.sha3_256(payload.encode()).hexdigest()

# ── Node init ─────────────────────────────────────────────────────────────────

def _init_node(db_path: str):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    db = sqlite3.connect(db_path)
    db.execute("""
        CREATE TABLE IF NOT EXISTS blocks (
            idx       INTEGER PRIMARY KEY,
            ts        INTEGER NOT NULL,
            data      TEXT    NOT NULL,
            prev_hash TEXT    NOT NULL,
            hash      TEXT    NOT NULL UNIQUE
        )
    """)
    db.close()

def init_ledger():
    for p in NODE_DBS:
        _init_node(p)

# ── Add block ─────────────────────────────────────────────────────────────────

def add_block(data: dict) -> dict:
    """
    Append a block to all 3 nodes (requires 2-of-3).
    data = arbitrary dict (identity event payload).
    Returns the new block dict.
    """
    ts       = int(time.time())
    data_str = json.dumps(data, sort_keys=True)

    # Read latest from node 0 for index/prev_hash
    db0  = sqlite3.connect(NODE_DBS[0])
    last = db0.execute("SELECT idx, hash FROM blocks ORDER BY idx DESC LIMIT 1").fetchone()
    db0.close()

    new_idx   = (last[0] + 1) if last else 0
    prev_hash = last[1]       if last else "0" * 64
    h         = _block_hash(new_idx, ts, data_str, prev_hash)

    block = {"index": new_idx, "ts": ts, "data": data, "prev_hash": prev_hash, "hash": h}

    written = 0
    for db_path in NODE_DBS:
        try:
            db = sqlite3.connect(db_path)
            db.execute(
                "INSERT OR IGNORE INTO blocks (idx, ts, data, prev_hash, hash) VALUES (?, ?, ?, ?, ?)",
                (new_idx, ts, data_str, prev_hash, h)
            )
            db.commit()
            db.close()
            written += 1
        except Exception as e:
            print(f"[Ledger] Node write error: {e}")

    if written < 2:
        raise RuntimeError(f"Quorum failure: only {written}/3 nodes confirmed write")

    return block

# ── Read chain ────────────────────────────────────────────────────────────────

def get_chain(node_idx: int) -> list:
    db_path = NODE_DBS[node_idx]
    db = sqlite3.connect(db_path)
    rows = db.execute(
        "SELECT idx, ts, data, prev_hash, hash FROM blocks ORDER BY idx ASC"
    ).fetchall()
    db.close()
    return [
        {"index": r[0], "ts": r[1], "data": json.loads(r[2]),
         "prev_hash": r[3], "hash": r[4]}
        for r in rows
    ]

def get_block_by_did(did: str) -> dict | None:
    """Search all nodes for the first block containing this DID."""
    for i in range(3):
        for blk in get_chain(i):
            if blk["data"].get("did") == did:
                return {**blk, "node": i}
    return None

# ── Chain verification ────────────────────────────────────────────────────────

def verify_chain(node_idx: int) -> tuple:
    """Returns (is_valid: bool, message: str, checked_blocks: int)."""
    chain = get_chain(node_idx)
    if not chain:
        return False, "Empty chain", 0
    if chain[0]["index"] != 0:
        return False, "Missing genesis block", 0

    for i in range(1, len(chain)):
        blk  = chain[i]
        prev = chain[i - 1]
        # Check linkage
        if blk["prev_hash"] != prev["hash"]:
            return False, f"Hash mismatch at block {i}", i
        # Recompute hash
        data_str = json.dumps(blk["data"], sort_keys=True)
        expected = _block_hash(blk["index"], blk["ts"], data_str, blk["prev_hash"])
        if expected != blk["hash"]:
            return False, f"Block {i} hash corrupted", i

    return True, f"All {len(chain)} blocks verified", len(chain)

# ── Stats ─────────────────────────────────────────────────────────────────────

def get_ledger_stats() -> list:
    stats = []
    for i, db_path in enumerate(NODE_DBS):
        try:
            db    = sqlite3.connect(db_path)
            count = db.execute("SELECT COUNT(*) FROM blocks").fetchone()[0]
            tip   = db.execute("SELECT hash FROM blocks ORDER BY idx DESC LIMIT 1").fetchone()
            last_ts = db.execute("SELECT ts FROM blocks ORDER BY idx DESC LIMIT 1").fetchone()
            db.close()
            valid, msg, _ = verify_chain(i)
            stats.append({
                "node":    i,
                "name":    NODE_NAMES[i],
                "blocks":  count,
                "tip":     tip[0] if tip else "—",
                "last_ts": last_ts[0] if last_ts else 0,
                "online":  True,
                "valid":   valid,
                "status":  msg,
            })
        except Exception as e:
            stats.append({
                "node": i, "name": NODE_NAMES[i],
                "blocks": 0, "tip": "—", "last_ts": 0,
                "online": False, "valid": False, "status": str(e)
            })
    return stats
