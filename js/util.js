const BN = "০১২৩৪৫৬৭৮৯";

export const bn = (v) => String(v).replace(/\d/g, (c) => BN[c]);

export function money(n) {
  const v = Math.round(n * 100) / 100;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2);
  return "৳" + bn(s);
}

export function num(n) {
  return bn(Math.round(n * 10) / 10);
}

export async function pinHash(number, pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`jonaki|${number}|${pin}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function txId() {
  return "JK" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

export function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso, withTime = false) {
  const d = new Date(iso);
  const opts = withTime
    ? { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }
    : { day: "numeric", month: "long", year: "numeric" };
  return d.toLocaleString("bn-BD", opts);
}

export const isValidNumber = (n) => /^01[3-9]\d{8}$/.test(n);

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
