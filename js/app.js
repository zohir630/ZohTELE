import * as db from "./github-db.js";
import { bn, money, num, pinHash, txId, addDays, fmtDate, isValidNumber, esc } from "./util.js";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userPath = (n) => `data/users/${n}.json`;

const S = {
  cfg: { quickAmounts: [], methods: [], minRecharge: 20, maxRecharge: 1000, validityDays: 30, brand: "জোনাকি", plan: "" },
  packs: [],
  offers: [],
  user: null,
  tab: "home",
  ptab: "net",
  authMode: "login",
  method: "বিকাশ",
  f: { number: "", amount: "100", loginNumber: "", name: "", regNumber: "" },
  sheet: null,
  err: "",
};

const icon = (d) => `<svg class="ic" viewBox="0 0 24 24">${d}</svg>`;
const IC = {
  home: icon('<path d="M3 11l9-8 9 8M5 10v10h14V10"/>'),
  recharge: icon('<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M12 9v6M9 12h6"/>'),
  packs: icon('<path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5"/>'),
  history: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  me: icon('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 5-6 8-6s7 2 8 6"/>'),
  tag: icon('<path d="M20 12l-8 8-9-9V3h8l9 9zM7.5 7.5h.01"/>'),
};

/* ---------- helpers ---------- */
function toast(msg, kind = "") {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast " + kind;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 3600);
}

const modeChip = () =>
  db.isLive()
    ? '<span class="mode live"><i></i>GitHub · লাইভ</span>'
    : '<span class="mode demo"><i></i>ডেমো · লোকাল</span>';

const header = (title) =>
  `<div class="top">${title ? `<h1 style="font-size:24px">${title}</h1>` : `<div class="brand"><img src="icons/icon.svg" alt="">${S.cfg.brand}</div>`}${modeChip()}</div>`;

function ring(label, u, unit) {
  const p = u.total ? Math.max(0, Math.min(1, u.left / u.total)) : 0;
  return `<div class="glass ring"><svg viewBox="0 0 66 66"><circle class="track" cx="33" cy="33" r="28"/><circle class="val" data-off="${176 * (1 - p)}" cx="33" cy="33" r="28"/></svg><b>${num(u.left)} ${unit}</b><span>${label}</span></div>`;
}

const txRow = (t) =>
  `<div class="item"><div class="t"><b>${esc(t.title)}</b><span>${esc(t.method)} · ${fmtDate(t.at, true)}</span></div><div class="amt ${t.amount > 0 ? "in" : ""}">${t.amount > 0 ? "+" : "−"}${money(Math.abs(t.amount))}</div></div>`;

/* ---------- views ---------- */
function authView() {
  const reg = S.authMode === "register";
  return `<main class="auth">
    <div class="brand" style="margin-bottom:18px"><img src="icons/icon.svg" alt="">${S.cfg.brand}</div>
    <h1>${reg ? "নতুন অ্যাকাউন্ট" : "স্বাগতম"}</h1>
    <p class="sub">${reg ? "আপনার নম্বর ও ৪ সংখ্যার পিন দিন।" : "নম্বর ও পিন দিয়ে ঢুকুন।"}</p>
    <div class="glass pad" style="margin-top:18px;display:flex;flex-direction:column;gap:12px">
      ${reg ? `<div class="field"><label for="name">নাম</label><input class="in" id="name" value="${esc(S.f.name)}" autocomplete="name"></div>` : ""}
      <div class="field"><label for="num">মোবাইল নম্বর</label><input class="in" id="num" inputmode="numeric" maxlength="11" placeholder="01XXXXXXXXX" value="${esc(reg ? S.f.regNumber : S.f.loginNumber)}" autocomplete="tel"></div>
      <div class="field"><label for="pin">পিন (৪ সংখ্যা)</label><input class="in" id="pin" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="current-password"></div>
      <div class="err">${S.err}</div>
      <button class="btn block" data-act="${reg ? "register" : "login"}">${reg ? "অ্যাকাউন্ট খুলুন" : "ঢুকুন"}</button>
      <button class="btn ghost block" data-act="authmode">${reg ? "আগে থেকেই অ্যাকাউন্ট আছে" : "নতুন অ্যাকাউন্ট খুলুন"}</button>
    </div>
    <p class="note" style="margin-top:14px">ডেমো: ০১৭১২৩৪৫৬৭৮, পিন ১২৩৪ ${modeChip()}</p>
  </main>`;
}

function homeView() {
  const u = S.user;
  return `${header()}
  <section class="glass balance">
    <small>${bn(u.number)} · ${esc(S.cfg.plan)}</small>
    <div class="amount">${money(u.balance)}</div>
    <div class="row"><span class="chip-info">মেয়াদ ${fmtDate(u.expiry)}</span><button class="btn" data-go="recharge">রিচার্জ</button></div>
  </section>
  <div class="rings">${ring("ইন্টারনেট", u.usage.net, "জিবি")}${ring("মিনিট", u.usage.min, "মি.")}${ring("এসএমএস", u.usage.sms, "টি")}</div>
  <div class="quick">
    <button data-go="recharge"><i class="glass">${IC.recharge}</i>রিচার্জ</button>
    <button data-go="packs"><i class="glass">${IC.packs}</i>প্যাক</button>
    <button data-go="history"><i class="glass">${IC.history}</i>ইতিহাস</button>
    <button data-go="profile"><i class="glass">${IC.me}</i>প্রোফাইল</button>
  </div>
  <div class="sec-h"><h2>অফার</h2></div>
  <div class="offers">${S.offers.map((o) => `<div class="glass offer ${o.tone}"><h3>${esc(o.title)}</h3><p>${esc(o.text)}</p></div>`).join("")}</div>
  <section class="glass pad"><div class="sec-h"><h2>সাম্প্রতিক</h2><button class="link" data-go="history">সব দেখুন</button></div>
    <div>${u.tx.slice(0, 3).map(txRow).join("") || '<div class="empty">এখনো কোনো লেনদেন নেই</div>'}</div></section>`;
}

function rechargeView() {
  const bonus = S.offers.find((o) => o.bonusPct);
  return `${header("রিচার্জ")}
  <div class="glass pad" style="display:flex;flex-direction:column;gap:14px">
    <div class="field"><label for="num">যে নম্বরে রিচার্জ</label><input class="in" id="num" inputmode="numeric" maxlength="11" value="${esc(S.f.number || S.user.number)}"></div>
    <div class="field"><label for="amt">টাকার পরিমাণ (${bn(S.cfg.minRecharge)} – ${bn(S.cfg.maxRecharge)})</label><input class="in" id="amt" inputmode="numeric" maxlength="4" value="${esc(S.f.amount)}"></div>
    <div class="chips">${S.cfg.quickAmounts.map((n) => `<button class="chip" data-amt="${n}" aria-pressed="${S.f.amount == n}">${money(n)}</button>`).join("")}</div>
    <div class="field"><label>পেমেন্ট মাধ্যম</label></div>
    <div class="methods">${S.cfg.methods.map((m) => `<button data-m="${m}" aria-pressed="${S.method === m}">${m}</button>`).join("")}</div>
    ${bonus ? `<div class="note">${esc(bonus.title)}: ${esc(bonus.text)}</div>` : ""}
    <div class="err">${S.err}</div>
    <button class="btn block" data-act="recharge-review">এগিয়ে যান</button>
  </div>
  <p class="note">পেমেন্ট ধাপটি সিমুলেটেড। বিকাশ, নগদ বা রকেটের সঙ্গে সত্যিকারের সংযোগ নেই।</p>`;
}

function packsView() {
  const tabs = [["net", "ইন্টারনেট"], ["min", "মিনিট"], ["combo", "কম্বো"]];
  return `${header("প্যাকেজ")}
  <div class="glass tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-pt="${k}" aria-selected="${S.ptab === k}">${l}</button>`).join("")}</div>
  ${S.packs.filter((p) => p.cat === S.ptab).map((p) => `<div class="glass pack"><div><h3>${esc(p.title)}</h3><p>মেয়াদ ${bn(p.days)} দিন</p></div><div class="price"><b>${money(p.price)}</b><button class="btn small" data-buy="${p.id}">কিনুন</button></div></div>`).join("")}`;
}

function historyView() {
  return `${header("ইতিহাস")}<section class="glass pad">${S.user.tx.map(txRow).join("") || '<div class="empty">এখনো কোনো লেনদেন নেই</div>'}</section>`;
}

function profileView() {
  const c = db.loadCfg(), u = S.user;
  return `${header("প্রোফাইল")}
  <section class="glass pad">
    <div class="sum" style="border:0;padding-top:0"><span>নাম</span><b>${esc(u.name)}</b></div>
    <div class="sum"><span>নম্বর</span><b>${bn(u.number)}</b></div>
    <div class="sum"><span>প্ল্যান</span><b>${esc(S.cfg.plan)}</b></div>
  </section>
  <section class="glass pad" style="display:flex;flex-direction:column;gap:12px">
    <h2 style="font-size:18px">GitHub ডাটাবেজ</h2>
    <p class="note" style="margin:0">টোকেন দিলে প্রতিটি লেনদেন রিপোজিটরিতে একটি কমিট হিসেবে সেভ হবে। না দিলে ডেমো মোডে শুধু এই ডিভাইসে সেভ হয়।</p>
    <div class="field"><label for="gh-owner">Owner</label><input class="in" id="gh-owner" value="${esc(c.owner)}" autocapitalize="off"></div>
    <div class="field"><label for="gh-repo">Repository</label><input class="in" id="gh-repo" value="${esc(c.repo)}" autocapitalize="off"></div>
    <div class="field"><label for="gh-branch">Branch</label><input class="in" id="gh-branch" value="${esc(c.branch)}" autocapitalize="off"></div>
    <div class="field"><label for="gh-token">Fine-grained টোকেন (Contents: Read and write)</label><input class="in" id="gh-token" type="password" value="${esc(c.token)}" autocomplete="off"></div>
    <div class="row"><button class="btn" data-act="gh-save">সেভ</button><button class="btn ghost" data-act="gh-test">পরীক্ষা</button><button class="btn ghost" data-act="gh-clear">বিচ্ছিন্ন</button></div>
  </section>
  <section class="glass pad row"><button class="btn ghost" data-act="demo-reset">ডেমো ডেটা রিসেট</button><button class="btn ghost" data-act="logout">লগআউট</button></section>`;
}

function sheetView() {
  const s = S.sheet;
  if (!s) return "";
  let body = "";
  if (s.type === "confirm") {
    body = `<h2 style="font-size:20px">${s.title}</h2>${s.rows.map(([a, b]) => `<div class="sum"><span>${a}</span><b>${b}</b></div>`).join("")}
      <button class="btn block" data-act="confirm">নিশ্চিত করুন</button><button class="btn ghost block" data-close>বাতিল</button>`;
  } else if (s.type === "busy") {
    body = `<div class="spin"></div><p style="text-align:center;margin:0">${s.msg}</p>`;
  } else {
    body = `<div class="check"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="40"/><path d="M26 43l11 11 21-23"/></svg></div>
      <h2 style="font-size:20px;text-align:center">${s.title}</h2><p class="note" style="text-align:center;margin:0">${s.msg}</p><button class="btn block" data-close>ঠিক আছে</button>`;
  }
  return `<div class="sheet-bg" data-bg><div class="glass sheet" role="dialog">${body}</div></div>`;
}

function nav() {
  const items = [["home", "হোম"], ["recharge", "রিচার্জ"], ["packs", "প্যাক"], ["history", "ইতিহাস"], ["profile", "প্রোফাইল"]];
  const ico = { profile: IC.me };
  return `<nav class="glass nav" aria-label="প্রধান মেনু">${items.map(([k, l]) => `<button data-go="${k}" ${S.tab === k ? 'aria-current="page"' : ""}>${ico[k] || IC[k]}${l}</button>`).join("")}</nav>`;
}

function render() {
  const app = $("app");
  if (!S.user) {
    app.innerHTML = authView() + sheetView();
    return;
  }
  const views = { home: homeView, recharge: rechargeView, packs: packsView, history: historyView, profile: profileView };
  app.innerHTML = `<main>${views[S.tab]()}</main>${nav()}${sheetView()}`;
  requestAnimationFrame(() => document.querySelectorAll(".ring .val").forEach((c) => (c.style.strokeDashoffset = c.dataset.off)));
}

/* ---------- data actions ---------- */
async function login(number, pin) {
  const r = await db.read(userPath(number));
  if (!r || r.data.pinHash !== (await pinHash(number, pin))) throw new Error("নম্বর বা পিন ঠিক নয়।");
  setUser(r.data);
}

async function register(name, number, pin) {
  if (name.trim().length < 2) throw new Error("নাম লিখুন।");
  if (await db.read(userPath(number))) throw new Error("এই নম্বরে অ্যাকাউন্ট আগে থেকেই আছে।");
  const today = new Date().toISOString().slice(0, 10);
  const user = {
    name: name.trim(), number, pinHash: await pinHash(number, pin), balance: 0,
    expiry: addDays(today, S.cfg.validityDays),
    usage: { net: { left: 0, total: 0 }, min: { left: 0, total: 0 }, sms: { left: 0, total: 0 } },
    tx: [],
  };
  await db.write(userPath(number), user, `register: ${number}`);
  setUser(user);
}

function setUser(u) {
  S.user = u;
  sessionStorage.setItem("jonaki.session", u.number);
}

const pushTx = (u, t) => {
  u.tx.unshift({ id: txId(), at: new Date().toISOString(), ...t });
  u.tx = u.tx.slice(0, 50);
};

async function doRecharge(target, amount, method) {
  const offer = S.offers.find((o) => o.bonusPct && amount >= o.minRecharge);
  const bonus = offer ? Math.floor((amount * offer.bonusPct) / 100) : 0;
  const next = await db.update(userPath(target), (u) => {
    if (!u) throw new Error("এই নম্বরে কোনো অ্যাকাউন্ট নেই।");
    u.balance = Math.round((u.balance + amount + bonus) * 100) / 100;
    pushTx(u, { type: "recharge", title: bonus ? `রিচার্জ + বোনাস ${money(bonus)}` : "রিচার্জ", method, amount: amount + bonus });
    return u;
  }, `recharge: ${target} +${amount}${bonus ? ` (+${bonus} bonus)` : ""}`);
  if (target === S.user.number) S.user = next;
  return bonus;
}

async function doBuy(pack) {
  S.user = await db.update(userPath(S.user.number), (u) => {
    if (u.balance < pack.price) throw new Error(`ব্যালেন্স কম। আরও ${money(pack.price - u.balance)} দরকার।`);
    u.balance = Math.round((u.balance - pack.price) * 100) / 100;
    u.usage.net.left += pack.gb; u.usage.net.total += pack.gb;
    u.usage.min.left += pack.min; u.usage.min.total += pack.min;
    const today = new Date().toISOString().slice(0, 10);
    const until = addDays(today, pack.days);
    if (until > u.expiry) u.expiry = until;
    pushTx(u, { type: "pack", title: `${pack.title} · ${bn(pack.days)} দিন`, method: "ব্যালেন্স", amount: -pack.price });
    return u;
  }, `pack: ${S.user.number} ${pack.id} -${pack.price}`);
}

/* ---------- events ---------- */
document.addEventListener("input", (e) => {
  const id = e.target.id;
  if (id === "num") S.f[S.user ? "number" : S.authMode === "register" ? "regNumber" : "loginNumber"] = e.target.value;
  if (id === "amt") S.f.amount = e.target.value;
  if (id === "name") S.f.name = e.target.value;
});

document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, [data-bg]");
  if (!t) return;
  try {
    if (t.hasAttribute("data-bg") && e.target === t) return closeSheet();
    if (t.hasAttribute("data-close")) return closeSheet();
    if (t.dataset.go) { S.tab = t.dataset.go; S.err = ""; S.sheet = null; render(); return scrollTo(0, 0); }
    if (t.dataset.pt) { S.ptab = t.dataset.pt; return render(); }
    if (t.dataset.amt) { S.f.amount = t.dataset.amt; return render(); }
    if (t.dataset.m) { S.method = t.dataset.m; return render(); }
    if (t.dataset.buy) return buyReview(t.dataset.buy);
    if (t.dataset.act) await act(t.dataset.act);
  } catch (err) {
    S.sheet = null;
    S.err = "";
    render();
    toast(err.message || "কিছু একটা ভুল হয়েছে।", "bad");
  }
});

function closeSheet() { S.sheet = null; render(); }

function buyReview(id) {
  const p = S.packs.find((x) => x.id === id);
  if (S.user.balance < p.price) { toast(`ব্যালেন্স কম। আরও ${money(p.price - S.user.balance)} দরকার।`, "bad"); return; }
  S.sheet = { type: "confirm", kind: "buy", pack: p, title: "প্যাক কেনা নিশ্চিত করুন", rows: [["প্যাক", esc(p.title)], ["মেয়াদ", bn(p.days) + " দিন"], ["মূল্য", money(p.price)]] };
  render();
}

async function act(a) {
  if (a === "authmode") { S.authMode = S.authMode === "login" ? "register" : "login"; S.err = ""; return render(); }
  if (a === "login" || a === "register") {
    const number = $("num").value.trim(), pin = $("pin").value.trim();
    S.f[a === "login" ? "loginNumber" : "regNumber"] = number;
    if (!isValidNumber(number)) { S.err = "সঠিক ১১ সংখ্যার নম্বর দিন।"; return render(); }
    if (!/^\d{4}$/.test(pin)) { S.err = "পিন ঠিক ৪ সংখ্যার হতে হবে।"; return render(); }
    S.sheet = { type: "busy", msg: "যাচাই হচ্ছে…" }; render();
    try { a === "login" ? await login(number, pin) : await register($("name")?.value ?? S.f.name, number, pin); }
    catch (err) { S.sheet = null; S.err = err.message; return render(); }
    S.sheet = null; S.err = ""; S.tab = "home"; return render();
  }
  if (a === "recharge-review") {
    const number = $("num").value.trim(), amount = parseInt($("amt").value, 10);
    S.f.number = number; S.f.amount = isNaN(amount) ? "" : String(amount);
    if (!isValidNumber(number)) { S.err = "সঠিক ১১ সংখ্যার নম্বর দিন।"; return render(); }
    if (!(amount >= S.cfg.minRecharge && amount <= S.cfg.maxRecharge)) { S.err = `${bn(S.cfg.minRecharge)} থেকে ${bn(S.cfg.maxRecharge)} টাকার মধ্যে দিন।`; return render(); }
    S.err = "";
    S.sheet = { type: "confirm", kind: "recharge", target: number, amount, title: "রিচার্জ নিশ্চিত করুন", rows: [["নম্বর", bn(number)], ["পরিমাণ", money(amount)], ["মাধ্যম", S.method]] };
    return render();
  }
  if (a === "confirm") {
    const s = S.sheet;
    S.sheet = { type: "busy", msg: s.kind === "recharge" ? "পেমেন্ট প্রক্রিয়া হচ্ছে (সিমুলেটেড)…" : "প্যাক চালু হচ্ছে…" }; render();
    if (s.kind === "recharge") {
      await sleep(900);
      const bonus = await doRecharge(s.target, s.amount, S.method);
      S.sheet = { type: "done", title: "রিচার্জ সফল", msg: `${bn(s.target)} নম্বরে ${money(s.amount)}${bonus ? ` ও বোনাস ${money(bonus)}` : ""} যোগ হয়েছে।` };
    } else {
      await doBuy(s.pack);
      S.sheet = { type: "done", title: "প্যাক চালু হয়েছে", msg: `${esc(s.pack.title)} আপনার নম্বরে যোগ হয়েছে।` };
    }
    return render();
  }
  if (a === "logout") { sessionStorage.removeItem("jonaki.session"); S.user = null; S.tab = "home"; return render(); }
  if (a === "demo-reset") { db.resetDemo(); sessionStorage.removeItem("jonaki.session"); S.user = null; toast("ডেমো ডেটা মুছে ফেলা হয়েছে।", "good"); return render(); }
  if (a === "gh-save" || a === "gh-test") {
    db.saveCfg({ owner: $("gh-owner").value.trim(), repo: $("gh-repo").value.trim(), branch: $("gh-branch").value.trim() || "main", token: $("gh-token").value.trim() });
    if (a === "gh-save") { toast("সেভ হয়েছে।", "good"); return render(); }
    const r = await db.testConnection();
    toast(`${r.name} সংযুক্ত${r.canPush ? "" : " (লেখার অনুমতি নেই)"}${r.isPrivate ? " · প্রাইভেট" : " · পাবলিক"}`, r.canPush ? "good" : "bad");
    return render();
  }
  if (a === "gh-clear") { db.clearCfg(); toast("GitHub সংযোগ সরানো হয়েছে।", "good"); return render(); }
}

/* ---------- boot ---------- */
async function boot() {
  try {
    const [cfg, packs, offers] = await Promise.all(
      ["data/config.json", "data/packages.json", "data/offers.json"].map((p) => fetch(p, { cache: "no-store" }).then((r) => r.json()))
    );
    Object.assign(S.cfg, cfg);
    S.packs = packs;
    S.offers = offers;
    S.method = cfg.methods[0];
  } catch {
    $("app").innerHTML = '<main class="auth"><div class="glass pad"><h2>ডেটা লোড হয়নি</h2><p class="note">ফাইল সরাসরি না খুলে GitHub Pages বা লোকাল সার্ভারে চালান।</p></div></main>';
    return;
  }
  const saved = sessionStorage.getItem("jonaki.session");
  if (saved) {
    try { const r = await db.read(userPath(saved)); if (r) S.user = r.data; } catch { /* fall back to login */ }
  }
  render();
}

boot();
