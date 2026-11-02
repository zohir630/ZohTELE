// GitHub as database: every JSON file under data/ is a "table row".
// Live mode  -> reads/writes through the GitHub Contents API (each write is a git commit).
// Demo mode  -> no token set; reads come from the static files, writes stay in localStorage.

const CFG_KEY = "jonaki.gh";
const OVERLAY = "jonaki.overlay.";

export function detectRepo() {
  const h = location.hostname;
  if (h.endsWith(".github.io")) {
    return { owner: h.split(".")[0], repo: location.pathname.split("/")[1] || "" };
  }
  return { owner: "", repo: "" };
}

export function loadCfg() {
  const base = { branch: "main", token: "", ...detectRepo() };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(CFG_KEY) || "{}") };
  } catch {
    return base;
  }
}

export function saveCfg(cfg) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

export function clearCfg() {
  localStorage.removeItem(CFG_KEY);
}

export function isLive() {
  const c = loadCfg();
  return Boolean(c.token && c.owner && c.repo);
}

const b64decode = (s) =>
  new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, "")), (c) => c.charCodeAt(0)));

function b64encode(str) {
  let bin = "";
  new TextEncoder().encode(str).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function apiUrl(cfg, path) {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
}

function headers(cfg) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${cfg.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export class DbError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** Read one JSON file. Returns { data, sha } or null when it does not exist. */
export async function read(path) {
  const cfg = loadCfg();
  if (isLive()) {
    const res = await fetch(`${apiUrl(cfg, path)}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`, {
      headers: headers(cfg),
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new DbError(await explain(res), res.status);
    const json = await res.json();
    return { data: JSON.parse(b64decode(json.content)), sha: json.sha };
  }
  const local = localStorage.getItem(OVERLAY + path);
  if (local) return { data: JSON.parse(local), sha: null };
  const res = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new DbError("ডেটা ফাইল পড়া যায়নি", res.status);
  return { data: await res.json(), sha: null };
}

/** Write one JSON file (one git commit in live mode). Returns the new sha. */
export async function write(path, data, message, sha) {
  const cfg = loadCfg();
  if (isLive()) {
    const body = { message, branch: cfg.branch, content: b64encode(JSON.stringify(data, null, 2) + "\n") };
    if (sha) body.sha = sha;
    const res = await fetch(apiUrl(cfg, path), {
      method: "PUT",
      headers: { ...headers(cfg), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new DbError(await explain(res), res.status);
    return (await res.json()).content.sha;
  }
  localStorage.setItem(OVERLAY + path, JSON.stringify(data));
  return null;
}

/**
 * Read-modify-write with retry on conflict (someone else committed in between).
 * mutate(current) must return the next value, or throw to abort.
 */
export async function update(path, mutate, message) {
  let lastErr;
  for (let i = 0; i < 3; i++) {
    const cur = await read(path);
    const next = mutate(cur ? structuredClone(cur.data) : null);
    try {
      await write(path, next, message, cur?.sha);
      return next;
    } catch (e) {
      lastErr = e;
      if (e.status !== 409 && e.status !== 422) throw e;
    }
  }
  throw lastErr;
}

export function resetDemo() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(OVERLAY))
    .forEach((k) => localStorage.removeItem(k));
}

export async function testConnection() {
  const cfg = loadCfg();
  const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`, { headers: headers(cfg) });
  if (!res.ok) throw new DbError(await explain(res), res.status);
  const repo = await res.json();
  return { name: repo.full_name, canPush: Boolean(repo.permissions?.push), isPrivate: repo.private };
}

async function explain(res) {
  if (res.status === 401) return "টোকেন ঠিক নয় বা মেয়াদ শেষ।";
  if (res.status === 403) return "অনুমতি নেই বা GitHub API সীমা শেষ। একটু পরে চেষ্টা করুন।";
  if (res.status === 404) return "রিপোজিটরি বা ফাইল পাওয়া যায়নি। owner/repo ও টোকেনের অনুমতি দেখুন।";
  if (res.status === 409 || res.status === 422) return "একই সময়ে অন্য পরিবর্তন হয়েছে, আবার চেষ্টা করুন।";
  return `GitHub ত্রুটি (${res.status})`;
}
