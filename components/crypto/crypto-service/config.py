import os
import json

_config_data = {}
try:
    config_path = os.environ.get("CONFIG_PATH", "/app/config.json")
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            _config_data = json.load(f)
except Exception as e:
    print(f"KMS Warning: Failed to load global config.json: {e}")

def get_config(path_str, fallback=None):
    """
    Retrieves a configuration value from the global configuration file.
    Falls back to the provided fallback value if the key is not present.
    
    :param path_str: Dot-separated path to the configuration key (e.g. 'security.vault_secret_path')
    :param fallback: Fallback value
    :return: Configured value or fallback
    """
    keys = path_str.split('.')
    current = _config_data
    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return fallback
    if isinstance(current, dict) and 'value' in current:
        return current['value']
    return current if current is not None else fallback
