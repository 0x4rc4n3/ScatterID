import time
import json
import csv
import os
from functools import wraps

class TelemetryLogger:
    def __init__(self, data_dir="."):
        self.data_dir = data_dir
        self.json_path = os.path.join(data_dir, "metrics.json")
        self.csv_path = os.path.join(data_dir, "metrics.csv")
        self._init_files()

    def _init_files(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
            
        if not os.path.exists(self.json_path):
            with open(self.json_path, "w") as f:
                json.dump([], f)
                
        if not os.path.exists(self.csv_path):
            with open(self.csv_path, "w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["Timestamp", "Operation", "Entity", "Latency_ms", "PayloadSize_bytes", "Method"])

    def record_metric(self, operation, entity, latency_ms, payload_size_bytes, method="ML-DSA-44"):
        # Append to JSON
        with open(self.json_path, "r") as f:
            data = json.load(f)
            
        entry = {
            "timestamp": time.time(),
            "operation": operation,
            "entity": entity,
            "latency_ms": round(latency_ms, 3),
            "payload_size_bytes": payload_size_bytes,
            "method": method
        }
        data.append(entry)
        
        with open(self.json_path, "w") as f:
            json.dump(data, f, indent=2)
            
        # Append to CSV
        with open(self.csv_path, "a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([entry["timestamp"], operation, entity, entry["latency_ms"], payload_size_bytes, method])

    def record_usability_event(self, session_id, event_type, status, duration_ms=0, details=""):
        """Logs anonymous human-factor data for usability analysis."""
        log_path = os.path.join(self.data_dir, "usability_study.json")
        if not os.path.exists(log_path):
            with open(log_path, "w") as f:
                json.dump([], f)
        
        with open(log_path, "r") as f:
            logs = json.load(f)
            
        entry = {
            "timestamp": time.time(),
            "session_id": session_id, # Anonymous random ID
            "event_type": event_type, # e.g., 'login', 'keygen', 'wallet_save'
            "status": status,         # 'success' or 'error'
            "duration_ms": round(duration_ms, 2),
            "details": details
        }
        logs.append(entry)
        
        with open(log_path, "w") as f:
            json.dump(logs, f, indent=2)
        
        # Also append to usability CSV for research analysis
        csv_log = os.path.join(self.data_dir, "usability_study.csv")
        is_new = not os.path.exists(csv_log)
        with open(csv_log, "a", newline="") as f:
            writer = csv.writer(f)
            if is_new:
                writer.writerow(["Timestamp", "SessionID", "Event", "Status", "DurationMS", "Details"])
            writer.writerow([entry["timestamp"], session_id, event_type, status, entry["duration_ms"], details])

class BenchmarkTimer:
    """Context manager to measure high-resolution latency."""
    def __init__(self):
        self.start_time = 0
        self.end_time = 0
        self.latency_ms = 0
        
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.perf_counter()
        self.latency_ms = (self.end_time - self.start_time) * 1000

def simulate_network_throttle(delay_ms=300):
    """
    Decorator to introduce artificial latency simulating real-world
    University Network Environment constraints.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            time.sleep(delay_ms / 1000.0)
            return func(*args, **kwargs)
        return wrapper
    return decorator

# Global singleton instance for the main application to import later
telemetry = TelemetryLogger(data_dir=os.path.dirname(os.path.realpath(__file__)))
