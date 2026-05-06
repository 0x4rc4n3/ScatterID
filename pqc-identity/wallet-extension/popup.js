/**
 * popup.js — QuantumID Wallet Extension
 * Manages seeded accounts from seeds.json and orchestrates PQC signing.
 */

let LMS_URL      = "http://localhost:8080";
function getSignUrl() { return `${LMS_URL}/api/sign`; }
const SEEDS_URL    = chrome.runtime.getURL("seeds.json");

// ── State ─────────────────────────────────────────────────────────────────
let accounts      = [];
let currentIdx    = 0;
let detectedPage  = null;  // 'login' | 'signup' | 'dashboard' | null
let detectedChallenge = null;
let isUnlocked    = false;

// ── Helpers ───────────────────────────────────────────────────────────────
function toast(msg, ms = 1800) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), ms);
}

function currentAccount() { return accounts[currentIdx] || null; }

function shortDID(did) {
  if (!did) return "—";
  return did.slice(0, 22) + "…" + did.slice(-10);
}

function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ── Load / Seed accounts ──────────────────────────────────────────────────
// ── Load / Sync accounts ──────────────────────────────────────────────────
async function syncToBackend() {
  try {
    await fetch(`${LMS_URL}/api/wallet/seeds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accounts)
    });
  } catch(e) {
    console.warn("Failed to sync to backend:", e);
  }
}

async function loadAccounts() {
  return new Promise(resolve => {
    chrome.storage.local.get(["accounts", "currentIdx"], async (data) => {
      // Always try to sync from backend first to get fresh data
      try {
        const resp = await fetch(`${LMS_URL}/api/wallet/seeds`);
        if (resp.ok) {
          const seeds = await resp.json();
          if (seeds && seeds.length > 0) {
            accounts = seeds;
            currentIdx = data.currentIdx || 0;
            if (currentIdx >= accounts.length) currentIdx = 0;
            chrome.storage.local.set({ accounts, currentIdx });
            resolve();
            return;
          }
        }
      } catch(e) {
        console.warn("Backend sync failed, falling back to storage/local seeds:", e);
      }

      if (data.accounts && data.accounts.length > 0) {
        accounts   = data.accounts;
        currentIdx = data.currentIdx || 0;
        resolve();
      } else {
        // First run — load seeds.json package file
        try {
          const resp = await fetch(SEEDS_URL);
          const seeds = await resp.json();
          accounts   = seeds;
          currentIdx = 0;
          chrome.storage.local.set({ accounts, currentIdx });
          resolve();
        } catch(e) {
          console.error("Failed to load seeds:", e);
          accounts = [];
          resolve();
        }
      }
    });
  });
}

function saveCurrentIdx() {
  chrome.storage.local.set({ currentIdx });
}

// ── Render UI ─────────────────────────────────────────────────────────────
function renderAccount() {
  const acc = currentAccount();
  if (!acc) {
    document.getElementById("acc-name").textContent  = "No account";
    document.getElementById("acc-email").textContent = "";
    document.getElementById("did-value").textContent = "—";
    return;
  }

  const avatar = document.getElementById("acc-avatar");
  avatar.textContent = initials(acc.name);
  // Consistent gradient per account
  const hue = (acc.name.charCodeAt(0) * 13) % 360;
  avatar.style.background = `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${hue+60},80%,65%))`;

  document.getElementById("acc-name").textContent  = acc.name;
  document.getElementById("acc-email").textContent = acc.email;
  document.getElementById("did-value").textContent = shortDID(acc.did);
  document.getElementById("key-reveal-value").textContent = acc.privkey_hex || "—";
  
  // Prevent admin deletion
  const delBtn = document.getElementById("btn-delete-acc");
  if (acc.role === "admin") {
      delBtn.style.display = "none";
  } else {
      delBtn.style.display = "flex";
  }
}

function renderSelect() {
  const sel = document.getElementById("acc-select");
  sel.innerHTML = "";
  accounts.forEach((acc, i) => {
    const opt = document.createElement("option");
    opt.value   = i;
    opt.textContent = acc.name.split(" ")[0];
    if (i === currentIdx) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ── Save/Load index ────────────────────────────────────────────────────────
async function saveIdx(idx) {
  currentIdx = parseInt(idx);
  await chrome.storage.local.set({ currentIdx });
}
async function loadSavedIdx() {
  const data = await chrome.storage.local.get("currentIdx");
  if (data.currentIdx !== undefined && data.currentIdx < accounts.length) {
    currentIdx = data.currentIdx;
  }
}

// ── Page detection ────────────────────────────────────────────────────────
async function detectPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    setPageStatus(null, null);
    return;
  }

  // Support both localhost and 127.0.0.1
  const isLMS = tab.url.includes("localhost:8080") || tab.url.includes("127.0.0.1:8080");

  if (!isLMS) {
    setPageStatus(null, null);
    return;
  }
  
  const tabUrl = new URL(tab.url);
  LMS_URL = tabUrl.origin; // Update global LMS_URL from active tab

  const url = tab.url;

  if (url.includes("/login")) {
    // Ask content script for the current challenge
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: "GET_CHALLENGE" });
      if (resp && resp.challenge) {
        detectedPage      = "login-ready";
        detectedChallenge = resp.challenge;
        setPageStatus("login-ready", resp.challenge);
      } else {
        detectedPage = "login";
        setPageStatus("login", null);
      }
    } catch(e) {
      detectedPage = "login";
      setPageStatus("login", null);
    }
  } else if (url === LMS_URL || url === LMS_URL + "/") {
    detectedPage = "home";
    setPageStatus("home", null);
  } else if (url.includes("/signup")) {
    detectedPage = "signup";
    setPageStatus("signup", null);
  } else if (url.includes("/dashboard") || url.includes("/admin")) {
    detectedPage = "dashboard";
    setPageStatus("dashboard", null);
  } else {
    setPageStatus(null, null);
  }
}

function setPageStatus(page, challenge) {
  const panel  = document.getElementById("page-status");
  const label  = document.getElementById("ps-label");
  const chEl   = document.getElementById("ps-challenge");
  const signBtn = document.getElementById("btn-sign-login");

  panel.className = "page-status";
  chEl.textContent = "";
  signBtn.disabled = true;
  signBtn.textContent = "⚡ Sign & Login";

  if (!page) { return; }

  panel.classList.add("show");

  if (page === "login-ready") {
    panel.classList.add("ready");
    label.textContent = "✓ Challenge detected — ready to sign";
    chEl.textContent  = challenge;
    signBtn.disabled  = false;
  } else if (page === "login") {
    panel.classList.add("detected");
    label.textContent = "Login page detected — enter DID first, then sign";
    signBtn.disabled  = false;
    signBtn.textContent = "⚡ Fill DID & Sign";
  } else if (page === "signup") {
    panel.classList.add("detected");
    label.textContent = "Signup page — click to auto-fill your DID";
    signBtn.disabled  = false;
    signBtn.textContent = "📋 Fill DID on Signup";
  } else if (page === "home") {
    panel.classList.add("detected");
    label.textContent = "Home page — go to Login to sign in.";
    signBtn.disabled  = false;
    signBtn.textContent = "Go to Login";
  } else if (page === "dashboard") {
    panel.classList.add("ready");
    label.textContent = "✓ Logged in — dashboard active";
  }
}

// ── Global PIN Unlock ───────────────────────────────────────────────────────
document.getElementById("btn-pin-confirm").addEventListener("click", async () => {
  const pin = document.getElementById("ext-pin").value;
  const alert = document.getElementById("pin-alert");
  if (pin !== "1342") {
      alert.textContent = "✖ Invalid master PIN. Try again.";
      alert.style.display = "block";
      return;
  }
  alert.style.display = "none";
  document.getElementById("pin-overlay").style.display = "none";
  isUnlocked = true;
});

async function checkPinSession() {
  // Session persistence removed: extension will always prompt for PIN when opened
}

document.getElementById("ext-pin").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btn-pin-confirm").click();
});

// ── Sign & Login ──────────────────────────────────────────────────────────
document.getElementById("btn-sign-login").addEventListener("click", () => {
  const acc = currentAccount();
  if (!acc) { toast("No account selected"); return; }
  executeSignLog(acc);
});

async function executeSignLog(acc) {
  const btn = document.getElementById("btn-sign-login");
  btn.disabled = true;
  btn.innerHTML = "<span class='spinner'></span>&nbsp;Working…";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (detectedPage === "login-ready" && detectedChallenge) {
      // We have the challenge — sign and submit
      await signAndSubmit(tab, acc, detectedChallenge);
      setTimeout(() => window.close(), 1200);

    } else if (detectedPage === "login") {
      // Fill DID, wait for challenge to appear, then sign
      await fillDIDAndSign(tab, acc);
      setTimeout(() => window.close(), 1200);

    } else if (detectedPage === "signup") {
      // Fill DID on signup form
      await chrome.tabs.sendMessage(tab.id, { type: "FILL_SIGNUP_DID", did: acc.did });
      toast("DID filled on signup form!");
      setTimeout(() => window.close(), 1200);

    } else if (detectedPage === "home") {
      chrome.tabs.update(tab.id, { url: LMS_URL + "/login" });
      toast("Redirecting to login...");

    } else {
      // Not on LMS page — open LMS
      chrome.tabs.create({ url: LMS_URL });
    }
  } catch(e) {
    toast("Error: " + e.message);
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = detectedPage === "signup" ? "📋 Fill DID on Signup" : "⚡ Sign & Login";
  }
} // End executeSignLog



async function signAndSubmit(tab, acc, challenge) {
  // Call /api/sign on the LMS server with the private key
  const resp = await fetch(getSignUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challenge, privkey_hex: acc.privkey_hex })
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || "Signing failed");

  // Fill signature and submit via content script
  await chrome.tabs.sendMessage(tab.id, {
    type: "FILL_SIGNATURE_AND_SUBMIT",
    signature: data.signature
  });
  toast("✓ Signed! Logging in…");
}

async function fillDIDAndSign(tab, acc) {
  // Step 1: Fill roll number and click Continue
  await chrome.tabs.sendMessage(tab.id, { type: "FILL_ROLLNO", roll_no: acc.roll_no || acc.email.split("@")[0] });

  // Step 2: Poll for challenge (up to 8s)
  let challenge = null;
  for (let i = 0; i < 16; i++) {
    await sleep(500);
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: "GET_CHALLENGE" });
      if (resp && resp.challenge) { challenge = resp.challenge; break; }
    } catch(e) { /* still loading */ }
  }

  if (!challenge) { toast("Challenge not received — try manually"); return; }
  await signAndSubmit(tab, acc, challenge);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Copy DID ──────────────────────────────────────────────────────────────
document.getElementById("btn-copy-did").addEventListener("click", async () => {
  const acc = currentAccount();
  if (!acc) return;
  await navigator.clipboard.writeText(acc.did);
  const btn = document.getElementById("btn-copy-did");
  btn.textContent = "Copied!";
  btn.classList.add("copied");
  setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1500);
});

// ── Show/hide private key ─────────────────────────────────────────────────
let keyVisible = false;
document.getElementById("btn-show-key").addEventListener("click", () => {
  keyVisible = !keyVisible;
  document.getElementById("key-reveal").classList.toggle("show", keyVisible);
  document.getElementById("btn-show-key").textContent = keyVisible ? "🙈 Hide Key" : "👁 Show Key";
});

// ── Account Deletion ──────────────────────────────────────────────────────
document.getElementById("btn-delete-acc").addEventListener("click", () => {
  if (accounts.length === 0) return;
  const acc = currentAccount();
  document.getElementById("delete-target-name").textContent = acc.name;
  document.getElementById("confirm-overlay").style.display = "flex";
});

document.getElementById("btn-cancel-delete").addEventListener("click", () => {
  document.getElementById("confirm-overlay").style.display = "none";
});

document.getElementById("btn-confirm-delete").addEventListener("click", () => {
  const acc = currentAccount();
  accounts.splice(currentIdx, 1);
  currentIdx = Math.max(0, currentIdx - 1);
  chrome.storage.local.set({ accounts, currentIdx }, async () => {
    await syncToBackend();
    toast("Identity Removed ✓");
    document.getElementById("confirm-overlay").style.display = "none";
    renderSelect();
    renderAccount();
    detectPage();
  });
});

// ── Account switcher ──────────────────────────────────────────────────────
document.getElementById("acc-select").addEventListener("change", e => {
  currentIdx = parseInt(e.target.value);
  saveCurrentIdx();
  renderAccount();
  keyVisible = false;
  document.getElementById("key-reveal").classList.remove("show");
  document.getElementById("btn-show-key").textContent = "👁 Show Key";
  detectPage(); // re-detect for new account
});

// ── Open LMS ─────────────────────────────────────────────────────────────
document.getElementById("btn-goto-lms").addEventListener("click", () => {
  chrome.tabs.create({ url: LMS_URL });
});
document.getElementById("link-lms").addEventListener("click", () => {
  chrome.tabs.create({ url: LMS_URL });
});

// ── Import Account ────────────────────────────────────────────────────────
const btnImport = document.getElementById("btn-import-pane");
if (btnImport) {
  btnImport.addEventListener("click", () => {
    const pane = document.getElementById("import-reveal");
    pane.style.display = pane.style.display === "none" ? "block" : "none";
  });
}

const btnSave = document.getElementById("btn-save-import");
if (btnSave) {
  btnSave.addEventListener("click", () => {
    const name = document.getElementById("imp-name").value.trim();
    const roll = document.getElementById("imp-roll").value.trim();
    const did  = document.getElementById("imp-did").value.trim();
    const pk   = document.getElementById("imp-pk").value.trim();
    const sk   = document.getElementById("imp-sk").value.trim();
    
    if (!name || !roll || !did || !pk || !sk) {
      toast("All fields required");
      return;
    }

    accounts.push({
      name: name,
      email: `${roll}@kfueit.edu.pk`,
      roll_no: roll,
      role: roll === 'admin' ? 'admin' : 'student',
      did: did,
      pubkey_hex: pk,
      privkey_hex: sk
    });
    
    currentIdx = accounts.length - 1;
    chrome.storage.local.set({ accounts, currentIdx }, async () => {
      await syncToBackend();
      toast("Identity Imported ✓");
      document.getElementById("import-reveal").style.display = "none";
      document.getElementById("imp-name").value = "";
      document.getElementById("imp-roll").value = "";
      document.getElementById("imp-did").value = "";
      document.getElementById("imp-pk").value = "";
      document.getElementById("imp-sk").value = "";
      
      renderSelect();
      renderAccount();
      detectPage();
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────
(async () => {
  // 1. Check if already unlocked
  await checkPinSession();

  // 2. Detect page first to find LMS_URL
  await detectPage();
  
  // 3. Load accounts and restore index
  await loadAccounts();
  await loadSavedIdx();
  
  // 4. Render UI
  renderSelect();
  renderAccount();
  
  // 5. Re-detect status
  await detectPage();
})();

// Save index on change
document.getElementById("acc-select").addEventListener("change", (e) => {
  saveIdx(e.target.value);
  renderAccount();
});
