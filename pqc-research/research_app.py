from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
import os
import json
import time

app = Flask(__name__)
CORS(app) # Enable CORS for cross-port telemetry from LMS (:8080)
RESEARCH_DIR = os.path.dirname(os.path.realpath(__file__))
METRICS_FILE = os.path.join(RESEARCH_DIR, "metrics.json")

@app.route("/")
def index():
    return send_from_directory(RESEARCH_DIR, "dashboard.html")

@app.route("/participate")
def participate():
    return send_from_directory(RESEARCH_DIR, "participation.html")

@app.route("/api/usability", methods=["POST"])
def post_usability():
    """Endpoint for anonymous usability data from the LMS."""
    data = request.get_json(silent=True) or {}
    session_id  = data.get("session_id", "anon")
    event_type  = data.get("event", "unknown")
    status      = data.get("status", "pending")
    duration    = data.get("duration", 0)
    details     = data.get("details", "")

    try:
        from telemetry import telemetry
        telemetry.record_usability_event(session_id, event_type, status, duration, details)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/usability/stats")
def get_usability_stats():
    """Provides aggregated stats for the usability dashboard."""
    log_path = os.path.join(RESEARCH_DIR, "usability_study.json")
    if not os.path.exists(log_path):
        return jsonify([])
    try:
        with open(log_path, "r") as f:
            return jsonify(json.load(f))
    except:
        return jsonify([])

@app.route("/api/metrics")
def get_metrics():
    if not os.path.exists(METRICS_FILE):
        return jsonify([])
    
    try:
        with open(METRICS_FILE, "r") as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("\n[PQC-Research] Starting Research Dashboard...")
    print(f"[PQC-Research] Data Directory: {RESEARCH_DIR}")
    print("[PQC-Research] Access Dashboard at http://localhost:8081\n")
    app.run(host="0.0.0.0", port=8081, debug=True)
