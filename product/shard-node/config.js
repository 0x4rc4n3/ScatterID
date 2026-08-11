import fs from 'fs';
import path from 'path';

let configData = {};
try {
  const configPath = process.env.CONFIG_PATH || '/app/config.json';
  if (fs.existsSync(configPath)) {
    configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.warn('KMS Warning: Failed to load global config.json:', err.message);
}

/**
 * Retrieves a configuration value from the global configuration file.
 * Falls back to the provided fallback value if the key is not present.
 * 
 * @param {string} pathStr Dot-separated path to the configuration key (e.g. 'security.shard_node_api_key')
 * @param {*} fallback Fallback value
 * @returns {*} Configured value or fallback
 */
export function getConfig(pathStr, fallback) {
  const keys = pathStr.split('.');
  let current = configData;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return fallback;
    }
  }
  if (current && typeof current === 'object' && 'value' in current) {
    if (current.value === undefined || current.value === null || current.value === '') {
      return fallback;
    }
    return current.value;
  }
  if (current === undefined || current === null || current === '') {
    return fallback;
  }
  return current;
}

