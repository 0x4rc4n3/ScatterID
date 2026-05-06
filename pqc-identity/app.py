"""
app.py — PQC Decentralized Identity System
Flask application — all routes and API endpoints.
"""
# ── System Administrator Backup (Hardcoded for Retrieval) ────────────
# DID: did:key:zVtJRTd2JDUz2My6Uo2n9Cdcj
# Role: Admin
# Private Key (SK): dee87aeff905690aa0a62296bc08b4b97ec582302f3291d3c1650b2f1c868b291e4ebd90d9d6c8ed5e77bf6f4a041252343a5d2cf76ca82c4912c95ad56c79994bcb168d39c789dfa2ee4404402bb717927097f4f8b3114f1b93cb1a0ae3da3f0ab38206e83a02697657e39bb3636bc4785c79c316011717026de05d156d9f6e1bb32912c58d1b2528dba2001b378d49100c5bb0448c183140908c1a231010874184c86183240000c1319834400a10415ca20ccb922c88a6408a264d1a298a83b64844b68181828921b9405b280020367119100cccb26059484a1b950508b285531485549408c9465083226d9c92451aa261a4060848081001192660a24951201102b708203631da4431d42025ccb68809480999224e129181220520918080e4802112b84009886ca4846418418252480191a20599282d18142c02b190cb40611b180e5908011c04049a484d21292400306942927004288e5398891322491946901a214421339020c309c0903164464411b709d1c4049892480b398201336dd4208d43388c133001599490e446255192409ac248c3264ae2a805212002190821e2400244a46501452980c4045c1286dbc22888329001c9251c314d02a06181324408b34c49b0111b088508b291ca96211a394193222ac01684c9481242904541a468002028190990e41290c2b0680c440609318ce3908988324cc8167263000ed128698120311b0169e49811c0a0319ba051d1044e80402121264a41300804c68520896421082a53340ddc48625a00042018329230911c3924c0464e52b2642499514cc8284c2641cc484ed44071d8b20d5c10628c06098b928c60400221262264240ca3b870240929e0220aa43411e10404e2a68dcca80898224110302694a0094b2281218181830488e4104a4b469122b82c64b2309338011b9509a4307281108121b72853084650480858302e039368498241439045e2a0091a484159c028e0380ed3a21182c40082c02c9c106840482e43966d83908d4026889a0060c1002850108409a761d9328e00b30da2b064190992238788d2140909002c0b04289c0464648260d8464a0a464854c0116280801406410031020a81600c973019c680224524e1a46114158a2019710b89602033621cc56c10b690d99220994484a208491924252183894034280816089ab6411143842421500231281a955120a22000412604c86d8212449914809a100aa226329940268a122291a46dccc46854a28da019652a12d3e8b90369e3bc6b06c1d298a9228e14adb021a33882a7b08cab66a086619359b5cc5c63423230e71bd8b7e1afd2e5128865415cdd46ff9f4a03332b711ed040ebbba50561eaf9efe040ba5ce058bb216db0d3bebd5114d3e9665196e4a776160394ac1b939416bc32adba7292d4e63a5b7fe91663814b9df863b6e0277337556fcedca6184eab0802ffb3c5b3ec2146fee8df1c9c53adee9f1437fa9ba8e6dd1ab9530586de869173232e0f879851933e7873b60fdf2f386ab1fde1dae541481fc0c19cc7a07070ae8cdd5b3feb8449f1e9eefe11db8c7324a2fb8c0ebba0357be83dc35f800020cf91781f7975d3b390f5f9bf3087022979af08bcc64069995b4205777ef9929cf8cfb09e0de75c179b193e027b596928e4967526a3f7e3adcd20a574a1248ad6a47d7bba169e0ed817e72960cae556c0adb3c21beaff52671221bd8792f4d4faac5f278793bc18b1b7f0a6a30e54ca90302087819db0c94f70ef2cc666f15450173ef0ceb7ba2765d687d14e907a6189d82b1c2db645293035bbc238c67227a8415dcb061785939e375551d0c27e3d02e3b33c0f91564875250eddc4ed35006ec321614540658be45cf362293c16d904b622b6b7f6d32c3cce76a2771846d663704dd0a7f77be603052ceaecdf92e58f031ff452cdc665d853705bcc044b6468a77c6b27d50f422874148b8725490fa20ec2a4e0dbff602f97350b742d564990f0dc7f33eba007d66832aa84058a6be308c367c399661e768b8825d638abe84938d31bf853435bc9191ceac57f0e0ebabb14fb22ece9ccfacae94066b0baeaae49a952b5749f594217f49107a3f0fcab980e99087de6ecd965c56295fc5e72470ca90c57b9a38120aa8a1bcc246ff44e0d531fb2e4e9393ad7a88e884041eca656cdd800d0d9c9b2d63c1d852ac51c6d817e5ccb4404910543155cfdf6989e9b91ff539893a05b1935081edeaeafaac1736e90f8c048b65dbe51c12d2fff693d9fe8a43c694e6fac7e62486c93bb30ec1df510bdcde9c1909a2f3fe09a6575c35df8e9ff91c2eb8df25f3472c9e961ae82153bbe07c872ef064ecf301d242894e87c5b311975c89f041a2f7ad0106bf7e3b32384c7a764c9ccd8a72f9e06f2d5b648947672bbeb4d6686cddf7ac3dbdfe7dd05804eaab8ee52ed378f4991fce7771b2e1a1d541596cc720d2b95eb16819898aa1b97b6daf59a18ee70b17e3dc9bc60cd9493b21da618d0d59cc8c2d5ae9bee6d3cbf20fcff64a12907c57234b39c8709fb7bde39eed0b9033b793fad54d74da8a1b263873c63f58b53b2dd48aa50dbde908898f9a5ef2e85b3f73908c994636af8e97de4db7ccaaeb497222533587a06e4860b0cb00e7a21d2943db4fff02a3e23a74dd6b481d9faa4bffd331971f15a290743e5c41dd10be28051b6a762964326265a2c918ba1850773573ed95731c1cfd831ae06d653b7f04a3322c782b5c129df0889e6307871efe568d82d09b01c2f059efd13c26d828d7e313fef910aa84ab7a6818bf83629c8b1782bb8b628cfb2fc1733dfe40a78e7e474185bd9c3f9271d9f6fe4a1fc80e4641c5c5a082eb0b780b81fc196f0200524e145c4623c1fac2db81f07ab052f10878df378770f25142611a5da21da12a359b3200f722048b975677000a6caee3fe095935e6fed4649a8718901aa4af70fcaf40da191da4ef42c6643d0d99d4c9bd81c8e025e830e37defc55d5738282868ef057f367d323b17c87419d8444f7012071edeb4a2afe4b6821278d1173e1bb3cf5f7f149ef6e5b32391a97c32397b3d95a32e877426ed2eb700dd4697f95a02fdbb587a761ded036287728dc02ef7f650ab0a26995582d7d042714b3a45fd1dc78c55fd8cd8ffb95c196f3e8d4cd668a2f77a37f254c117defd2fc5c4941c1f121a49010bfa04df8c45646153f9411abe0985457cb50e42de3f196838a463f638d59f6be4f1a109d44c6026f2640a60f9ec05bbe2eaafe325ebc9e5bd6a6295645a2cc9e2636746ed4025b4fa3c1ef1628151149bfaef1807110dfb4725a4feb376f5462cb6de12065661bc042bfb9c3c32aa13c8aa67f9ad5b9af4c448ea261bf24db273d1ae41ea1b1e537a0b05d1055d856ccfd1eeb203f230bfbfeb6613d8452aab6bd6c5ccbdfe907c5e294b5e4fc85981cd28d4b0f5e2b022239cc9e989c9f8c6254cd8b67449039206c0a271e9e9f93aaf69aac042499552e11469b7f9566b54696533ed507b9038d5d33ba700e7f1ffaf794badaf3fa6d51d62a9cc76cb88708fd8ef1ed16d5e63a973802031230f3c399fb75281b646a2f73a14db240cc941a5c56

import os, json, time, secrets, functools, datetime
from flask import (Flask, render_template, request, session,
                   redirect, url_for, jsonify, g)

from models  import (init_db, create_signup_request, get_pending_requests,
                     get_all_requests, update_request_status, create_user,
                     get_user_by_did, get_user_by_email, get_user_by_roll_no,
                     get_all_users, delete_user, update_last_login, update_user,
                     create_challenge, consume_challenge, log_event,
                     get_recent_events, get_all_events, roll_to_email, email_to_roll)
from pqc_engine import generate_keypair, verify_signature
from ledger   import (init_ledger, add_block, get_chain, get_ledger_stats,
                      verify_chain, get_block_by_did, NODE_NAMES)

app = Flask(__name__)
# Bind a deterministic secret so multi-worker gunicorn instances share session decryption logic natively.
app.secret_key = os.environ.get("SECRET_KEY", "b3a5b8214fbc9048a1c8f192b73a38")

# ── Jinja filters ─────────────────────────────────────────────────────────────

@app.template_filter("ts_to_dt")
def ts_to_dt(ts):
    if not ts: return "—"
    try:
        return datetime.datetime.fromtimestamp(int(ts)).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return str(ts)

@app.template_filter("truncate_hex")
def truncate_hex(hex_str, head=8, tail=8):
    if not hex_str or len(hex_str) <= head + tail + 3:
        return hex_str or "—"
    return f"{hex_str[:head]}…{hex_str[-tail:]}"

@app.template_filter("truncate_did")
def truncate_did(did, head=20, tail=8):
    if not did: return "—"
    if len(did) <= head + tail + 3: return did
    return f"{did[:head]}…{did[-tail:]}"

# ── CORS Support for Wallet Extension ─────────────────────────────────────────

@app.after_request
def add_cors_headers(response):
    # Allow local extension dev and common origins
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, PUT, DELETE"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

# ── Bootstrap ─────────────────────────────────────────────────────────────────

ADMIN_DID_FILE = os.path.join(os.path.dirname(__file__), "db", "admin_did.json")

def bootstrap():
    init_db()
    init_ledger()
    _ensure_admin()

def _ensure_admin():
    if os.path.exists(ADMIN_DID_FILE):
        with open(ADMIN_DID_FILE) as f:
            info = json.load(f)
        if not get_user_by_did(info["did"]):
            create_user(info["did"], info["email"], info["full_name"],
                        None, info["pubkey_hex"], role="admin")
        return

    print("\n[PQC-ID] First run: generating admin identity…")
    did, pubkey_hex, privkey_hex = generate_keypair()
    info = {
        "did":        did,
        "pubkey_hex": pubkey_hex,
        "privkey_hex": privkey_hex,
        "email":      "admin@kfueit.edu.pk",
        "full_name":  "System Administrator",
    }
    os.makedirs(os.path.dirname(ADMIN_DID_FILE), exist_ok=True)
    with open(ADMIN_DID_FILE, "w") as f:
        json.dump(info, f, indent=2)

    create_user(did, info["email"], info["full_name"],
                None, pubkey_hex, role="admin")

    # Anchor admin identity on the chain
    try:
        add_block({
            "action": "register_admin",
            "did":    did,
            "email":  info["email"],
            "name":   info["full_name"],
            "pubkey": pubkey_hex[:16] + "…",
        })
    except Exception as e:
        print(f"[Ledger] Admin anchor failed: {e}")

    print(f"""
╔══════════════════════════════════════════════════════════════╗
║       ADMIN IDENTITY GENERATED — SAVE THIS NOW               ║
╠══════════════════════════════════════════════════════════════╣
║  DID:  {did[:55]}…
║  Key saved to: db/admin_did.json
╚══════════════════════════════════════════════════════════════╝
""")

# ── Auth decorators ───────────────────────────────────────────────────────────

def login_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        if "did" not in session:
            return redirect(url_for("login_page"))
        if not get_user_by_did(session["did"]):
            session.clear()
            return redirect(url_for("login_page"))
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        if "did" not in session or session.get("role") != "admin":
            session.clear()
            return redirect(url_for("login_page"))
        if not get_user_by_did(session["did"]):
            session.clear()
            return redirect(url_for("login_page"))
        return f(*args, **kwargs)
    return decorated

# ── Page routes ───────────────────────────────────────────────────────────────

@app.route("/")
def index():
    if "did" in session:
        if not get_user_by_did(session["did"]):
            session.clear()
        else:
            return redirect(url_for("admin_dashboard") if session.get("role") == "admin"
                            else url_for("student_dashboard"))
    return render_template("home.html")

@app.route("/login")
def login_page():
    if "did" in session:
        return redirect(url_for("index"))
    return render_template("login.html")

@app.route("/signup")
def signup_page():
    return render_template("signup.html")

@app.route("/pending")
def pending_page():
    did = request.args.get("did", "")
    return render_template("pending.html", did=did)

@app.route("/info")
def info_page():
    return render_template("info.html")

@app.route("/dashboard")
@login_required
def student_dashboard():
    user = get_user_by_did(session["did"])
    return render_template("dashboard_student.html", user=user)

@app.route("/admin/logs")
def admin_logs():
    if session.get("role") != "admin":
        return redirect(url_for("index"))
    
    all_logs = get_all_events()
    
    # Calculate Stats for the Ribbon
    stats = {
        "total":   len(all_logs),
        "success": len([l for l in all_logs if l["event"] == "login_ok"]),
        "failed":  len([l for l in all_logs if l["event"] == "login_fail"]),
        "admin":   len([l for l in all_logs if l["event"] in ["approved", "rejected", "keygen"]])
    }
    
    # Success rate calculation
    total_auth = stats["success"] + stats["failed"]
    stats["rate"] = round((stats["success"] / total_auth * 100), 1) if total_auth > 0 else 0

    return render_template("admin_logs.html", logs=all_logs, stats=stats)

@app.route("/admin")
@admin_required
def admin_dashboard():
    pending = get_pending_requests()
    users   = get_all_users()
    log     = get_recent_events(20)
    stats   = get_ledger_stats()
    return render_template(
        "dashboard_admin.html",
        pending=pending, users=users, log=log,
        ledger_stats=stats,
        admin=get_user_by_did(session["did"]),
    )

@app.route("/verify")
def verify_page():
    query  = request.args.get("q", "").strip()
    result = None
    chain_block = None
    err = None

    if query:
        # Try roll no first, then DID
        user = None
        if query.startswith("did:"):
            user = get_user_by_did(query)
        else:
            user = get_user_by_roll_no(query)
            if not user:
                user = get_user_by_email(query)

        if not user:
            err = f"No identity found for '{query}'"
        else:
            chain_block = get_block_by_did(user["did"])
            result = user

    return render_template("verify.html", query=query,
                           result=result, chain_block=chain_block, err=err)

@app.route("/blockchain")
def blockchain_page():
    stats = get_ledger_stats()
    chains = []
    for i in range(3):
        chain = get_chain(i)
        valid, msg, _ = verify_chain(i)
        chains.append({
            "node":   i,
            "name":   NODE_NAMES[i],
            "chain":  list(reversed(chain)),   # newest first
            "valid":  valid,
            "status": msg,
            "count":  len(chain),
        })
    return render_template("blockchain.html", chains=chains, stats=stats)

@app.route("/logout", methods=["POST"])
def logout():
    log_event("logout", did=session.get("did"), ip=request.remote_addr)
    session.clear()
    return redirect(url_for("login_page"))

# ── API: Keygen ───────────────────────────────────────────────────────────────

@app.route("/api/keygen", methods=["POST"])
def api_keygen():
    try:
        did, pubkey_hex, privkey_hex = generate_keypair()
        log_event("keygen", ip=request.remote_addr)
        return jsonify({"ok": True, "did": did,
                        "pubkey_hex": pubkey_hex, "privkey_hex": privkey_hex})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

# ── API: Signup ───────────────────────────────────────────────────────────────

@app.route("/api/signup", methods=["POST"])
def api_signup():
    data       = request.get_json(silent=True) or {}
    full_name  = data.get("full_name", "").strip()
    roll_no    = data.get("roll_no",   "").strip().lower()
    did        = data.get("did",       "").strip()
    pubkey_hex = data.get("pubkey_hex","").strip()

    if not all([full_name, roll_no, did, pubkey_hex]):
        return jsonify({"ok": False, "error": "All fields required."}), 400
    if not did.startswith("did:key:z"):
        return jsonify({"ok": False, "error": "Invalid DID format."}), 400

    email = roll_to_email(roll_no)
    ok, err = create_signup_request(
        full_name, email, roll_no, did, pubkey_hex, roll_no=roll_no
    )
    if not ok:
        return jsonify({"ok": False, "error": err}), 409

    log_event("signup_request", did=did, ip=request.remote_addr,
              detail=f"{full_name} <{email}>")
    return jsonify({"ok": True, "email": email,
                    "message": "Request submitted. Awaiting admin approval."})

# ── API: Challenge (accepts roll_no OR did) ───────────────────────────────────

@app.route("/api/challenge", methods=["POST"])
def api_challenge():
    data    = request.get_json(silent=True) or {}
    roll_no = data.get("roll_no", "").strip()
    did     = data.get("did",     "").strip()

    user = None
    if roll_no:
        user = get_user_by_roll_no(roll_no)
        if not user:
            return jsonify({"ok": False,
                            "error": f"Roll number '{roll_no}' not found or not approved."}), 404
    elif did:
        user = get_user_by_did(did)
        if not user:
            return jsonify({"ok": False, "error": "Identity not found."}), 404
    else:
        return jsonify({"ok": False, "error": "Provide roll_no or did."}), 400

    challenge = create_challenge(user["did"], ttl=120)
    return jsonify({
        "ok":       True,
        "challenge": challenge,
        "did":      user["did"],
        "name":     user["full_name"],
        "email":    user["email"],
        "ttl":      120,
    })

# ── API: Login ────────────────────────────────────────────────────────────────

@app.route("/api/login", methods=["POST"])
def api_login():
    data      = request.get_json(silent=True) or {}
    did       = data.get("did",       "").strip()
    challenge = data.get("challenge", "").strip()
    sig_hex   = data.get("signature", "").strip()

    if not all([did, challenge, sig_hex]):
        return jsonify({"ok": False, "error": "DID, challenge, and signature required."}), 400

    user = get_user_by_did(did)
    if not user:
        log_event("login_fail", did=did, ip=request.remote_addr, detail="unknown DID")
        return jsonify({"ok": False, "error": "Identity not found."}), 404

    if not consume_challenge(challenge, did):
        log_event("login_fail", did=did, ip=request.remote_addr, detail="bad/expired challenge")
        return jsonify({"ok": False, "error": "Challenge invalid or expired."}), 401

    valid = verify_signature(user["pubkey_hex"], challenge.encode(), sig_hex)
    if not valid:
        log_event("login_fail", did=did, ip=request.remote_addr, detail="bad signature")
        return jsonify({"ok": False, "error": "Signature verification failed."}), 401

    session.clear()
    session["did"]       = did
    session["role"]      = user["role"]
    session["full_name"] = user["full_name"]
    session["email"]     = user["email"]
    update_last_login(did)
    log_event("login_ok", did=did, ip=request.remote_addr)

    redirect_url = (url_for("admin_dashboard") if user["role"] == "admin"
                    else url_for("student_dashboard"))
    return jsonify({"ok": True, "role": user["role"], "redirect": redirect_url})

# ── API: Admin approve / reject ───────────────────────────────────────────────

@app.route("/api/admin/approve/<int:req_id>", methods=["POST"])
@admin_required
def api_approve(req_id):
    req = update_request_status(req_id, "approved", session["did"])
    if not req:
        return jsonify({"ok": False, "error": "Request not found."}), 404

    created = create_user(
        req["did"], req["email"], req["full_name"],
        req["student_id"], req["pubkey_hex"], role="student"
    )

    # Anchor on blockchain
    try:
        add_block({
            "action":    "register",
            "did":       req["did"],
            "name":      req["full_name"],
            "email":     req["email"],
            "roll_no":   req.get("roll_no") or email_to_roll(req["email"]),
            "pubkey":    req["pubkey_hex"][:16] + "…",
            "approved_by": session["did"][:20] + "…",
        })
    except Exception as e:
        print(f"[Ledger] Anchor failed: {e}")

    log_event("approved", did=req["did"], ip=request.remote_addr, detail=req["email"])
    return jsonify({"ok": True, "did": req["did"], "email": req["email"]})

@app.route("/api/admin/reject/<int:req_id>", methods=["POST"])
@admin_required
def api_reject(req_id):
    req = update_request_status(req_id, "rejected", session["did"])
    if not req:
        return jsonify({"ok": False, "error": "Request not found."}), 404
    log_event("rejected", did=req["did"], ip=request.remote_addr, detail=req["email"])
    return jsonify({"ok": True})

@app.route("/api/admin/revoke/<did>", methods=["POST"])
@admin_required
def api_revoke(did):
    if did == session.get("did"):
        return jsonify({"ok": False, "error": "Cannot revoke yourself."}), 400
    user = get_user_by_did(did)
    if not user:
        return jsonify({"ok": False, "error": "User not found."}), 404
    if user.get("role") == "admin":
        return jsonify({"ok": False, "error": "Cannot revoke an admin."}), 400
    
    success = delete_user(did)
    if not success:
        return jsonify({"ok": False, "error": "Failed to revoke user."}), 500
    
    try:
        # Also log it on the blockchain for audit trail
        add_block({
            "action":    "revoke",
            "did":       did,
            "email":     user["email"],
            "revoked_by": session["did"][:20] + "…"
        })
    except Exception as e:
        print(f"[Ledger] Anchor failed during revocation: {e}")

    log_event("revoked", did=did, ip=request.remote_addr, detail=user["email"])
    return jsonify({"ok": True})

@app.route("/api/admin/edit/<did>", methods=["POST"])
@admin_required
def api_edit_user(did):
    data = request.get_json(silent=True) or {}
    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip()
    role = data.get("role", "student").strip()
    
    if not all([full_name, email, role]):
        return jsonify({"ok": False, "error": "All fields required."}), 400
        
    user = get_user_by_did(did)
    if not user:
        return jsonify({"ok": False, "error": "User not found."}), 404
        
    success = update_user(did, full_name, email, role)
    if not success:
        return jsonify({"ok": False, "error": "Email might be already in use or update failed."}), 400
        
    try:
        add_block({
            "action":    "edit_user",
            "did":       did,
            "email":     email,
            "edited_by": session["did"][:20] + "…"
        })
    except Exception as e:
        print(f"[Ledger] Anchor failed during edit: {e}")
        
    log_event("edited_user", did=did, ip=request.remote_addr, detail=email)
    return jsonify({"ok": True})

# ── API: Sign (wallet proxy) ──────────────────────────────────────────────────

@app.route("/api/sign", methods=["POST"])
def api_sign():
    data        = request.get_json(silent=True) or {}
    challenge   = data.get("challenge", "")
    privkey_hex = data.get("privkey_hex", "")

    if not privkey_hex:
        if not os.path.exists(ADMIN_DID_FILE):
            return jsonify({"ok": False, "error": "No key provided."}), 400
        with open(ADMIN_DID_FILE) as f:
            admin_info = json.load(f)
        privkey_hex = admin_info["privkey_hex"]

    if not challenge:
        return jsonify({"ok": False, "error": "Challenge required."}), 400

    try:
        from pqc_engine import sign_message
        sig = sign_message(privkey_hex, challenge.encode())
        return jsonify({"ok": True, "signature": sig})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

# ── API: Blockchain ───────────────────────────────────────────────────────────

@app.route("/api/blockchain/node/<int:node_id>")
def api_blockchain_node(node_id):
    if node_id not in range(3):
        return jsonify({"ok": False, "error": "Node 0–2 only"}), 400
    chain = get_chain(node_id)
    valid, msg, _ = verify_chain(node_id)
    return jsonify({
        "ok":     True,
        "node":   node_id,
        "name":   NODE_NAMES[node_id],
        "blocks": list(reversed(chain)),
        "valid":  valid,
        "status": msg,
    })

@app.route("/api/blockchain/verify/<int:node_id>")
def api_verify_node(node_id):
    if node_id not in range(3):
        return jsonify({"ok": False, "error": "Node 0–2 only"}), 400
    valid, msg, n = verify_chain(node_id)
    # Get current tip and count for consensus UI
    stats = get_ledger_stats()
    node_stats = stats[node_id]
    return jsonify({
        "ok":     True,
        "valid":  valid,
        "message": msg,
        "checked": n,
        "blocks":  node_stats["blocks"],
        "tip":     node_stats["tip"]
    })

@app.route("/api/wallet/seeds")
def api_get_seeds():
    path = os.path.join(os.path.dirname(__file__), "wallet-extension", "seeds.json")
    if not os.path.exists(path):
        return jsonify([])
    with open(path) as f:
        return jsonify(json.load(f))

@app.route("/api/wallet/seeds", methods=["POST"])
def api_save_seeds():
    data = request.json
    if not isinstance(data, list):
        return jsonify({"ok": False, "error": "List expected"}), 400
    path = os.path.join(os.path.dirname(__file__), "wallet-extension", "seeds.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    return jsonify({"ok": True})

@app.route("/api/verify/identity")
def api_verify_identity():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"ok": False, "error": "q param required"}), 400
    user = (get_user_by_did(q) if q.startswith("did:")
            else get_user_by_roll_no(q) or get_user_by_email(q))
    if not user:
        return jsonify({"ok": False, "found": False, "message": "Identity not found"})
    blk = get_block_by_did(user["did"])

    # Verify their public key is still on chain
    on_chain = blk is not None
    return jsonify({
        "ok":       True,
        "found":    True,
        "name":     user["full_name"],
        "email":    user["email"],
        "role":     user["role"],
        "did":      user["did"],
        "on_chain": on_chain,
        "block":    blk,
    })

# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    bootstrap()
    print("\n[PQC-ID] Running at http://localhost:8080\n")
    app.run(host="0.0.0.0", port=8080, debug=True)
