#!/usr/bin/env node

/**
 * ==============================================================================
 * ScatterID — Node.js Canonicalization Fuzzing Bridge
 * ==============================================================================
 * Reads line-delimited JSON test vectors from stdin, runs both the standalone
 * zero-dependency canonicalizer (from tools/verify_offline.js) and the official
 * npm canonicalize package (from the SDK), verifies they agree, and outputs the
 * canonical JSON serialization or error signature for Python diffing.
 * ==============================================================================
 */

import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

const [verifyOfflineModule, npmModule] = await Promise.all([
  import(path.join(rootDir, 'tools/verify_offline.js')),
  import(path.join(rootDir, 'sdk/node_modules/canonicalize/lib/canonicalize.js'))
]);

const verifyCanonicalize = verifyOfflineModule.canonicalize;
const npmCanonicalize = npmModule.default;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  if (!line || line.trim() === '') return;
  try {
    const obj = JSON.parse(line);
    let customRes, npmRes;
    let customErr = null, npmErr = null;

    try {
      customRes = verifyCanonicalize(obj);
    } catch (e) {
      customErr = e.message;
    }

    try {
      npmRes = npmCanonicalize(obj);
    } catch (e) {
      npmErr = e.message;
    }

    if (customErr || npmErr) {
      if (!customErr || !npmErr) {
        process.stdout.write(JSON.stringify({ status: 'INTERNAL_MISMATCH', customErr, npmErr }) + '\n');
      } else {
        process.stdout.write(JSON.stringify({ status: 'ERROR', error: customErr }) + '\n');
      }
      return;
    }

    if (customRes !== npmRes) {
      process.stdout.write(JSON.stringify({
        status: 'INTERNAL_MISMATCH',
        customRes,
        npmRes
      }) + '\n');
      return;
    }

    process.stdout.write(JSON.stringify({
      status: 'OK',
      canonical: customRes
    }) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({ status: 'PARSE_ERROR', error: err.message }) + '\n');
  }
});
