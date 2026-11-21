/* ==========================================================================
   KasirMart — core.js
   Utilitas, ikon, penyimpanan lokal, klien API (dedupe + batch + retry),
   toast, modal, tema, paginasi.
   ========================================================================== */
'use strict';
const APP_FE_VERSION = '1.1.0';

/* ----------------------------------------------------------------- Utilitas */
const U = {
  esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  num(n) { return Math.round(Number(n) || 0).toLocaleString('id-ID'); },
  rp(n) { const v = Math.round(Number(n) || 0); return (v < 0 ? '-Rp ' : 'Rp ') + Math.abs(v).toLocaleString('id-ID'); },
  rpShort(n) {
    const v = Number(n) || 0, a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' M';
    if (a >= 1e6) return (v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' jt';
    if (a >= 1e3) return (v / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' rb';
    return String(Math.round(v));
  },
  parseNum(s) { const d = String(s || '').replace(/[^\d]/g, ''); return d ? Number(d) : 0; },
  /** Jumlah barang: bilangan bulat, atau pecahan (maks. 3 desimal) untuk kg/liter. Tampil "1,5". */
  qty(n) { return (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString('id-ID', { maximumFractionDigits: 3 }); },
  /** "1,5" / "1.5" / "0,25 kg" → 1.5 / 0.25 (koma atau titik = desimal) */
  parseQty(s) {
    const t = String(s === undefined || s === null ? '' : s).replace(',', '.').replace(/[^\d.]/g, '');
    const i = t.indexOf('.'), v = parseFloat(i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, ''));
    return isFinite(v) ? Math.round(v * 1000) / 1000 : 0;
  },
  /** Bersihkan ketikan jumlah: angka + satu pemisah desimal (koma), maks. 3 angka di belakang koma. */
  cleanQty(s, desimal) {
    let t = String(s || '').replace('.', ',').replace(/[^\d,]/g, '');
    if (!desimal) return t.replace(/,/g, '');
    const i = t.indexOf(',');
    return i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/,/g, '').slice(0, 3);
  },
  /** Satuan yang boleh pecahan — harus sama dengan SATUAN_DESIMAL di Kode.gs */
  DESIMAL: ['kg', 'kilogram', 'ons', 'liter', 'ltr', 'l', 'meter', 'm'],
  desimal(satuan) { return U.DESIMAL.includes(String(satuan || '').toLowerCase().trim()); },
  /** "1,5 kg" untuk satuan pecahan, "3" untuk satuan hitung */
  qtySat(q, satuan) { return U.desimal(satuan) ? U.qty(q) + ' ' + satuan : U.qty(q); },
  /** Subtotal rupiah — dibulatkan sama seperti server */
  sub(q, harga) { return Math.round((Number(q) || 0) * (Number(harga) || 0)); },
  async copy(text) {
    try { await navigator.clipboard.writeText(String(text)); return true; }
    catch (e) {
      const t = document.createElement('textarea'); t.value = String(text); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (x) { ok = false; } t.remove(); return ok;
    }
  },
  /** Perkecil gambar sebelum diunggah (QR tetap tajam: PNG dulu, JPEG bila masih besar). */
  async shrinkImage(file, maxSide = 1000, maxBytes = 500 * 1024) {
    const url = await U.fileToBase64(file);
    if (file.size <= maxBytes) {
      const dim = await new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.onerror = () => r([0, 0]); i.src = url; });
      if (Math.max(dim[0], dim[1]) <= maxSide * 1.6) return { mime: file.type, base64: url };
    }
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Gambar tidak terbaca.')); i.src = url; });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = k < 1; x.drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL('image/png'), mime = 'image/png';
    if (out.length * 0.75 > maxBytes) { out = c.toDataURL('image/jpeg', 0.92); mime = 'image/jpeg'; }
    if (out.length * 0.75 > maxBytes) throw new Error('Gambar masih lebih dari 500 KB setelah diperkecil. Potong gambar agar hanya kotak QR yang terlihat.');
    return { mime, base64: out };
  },
  BULAN: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  BULAN_PANJANG: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
  HARI: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
  /** '2026-11-21 14:22:05' → '21 Nov 2026, 14:22' */
  tgl(s, withTime = true) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!m) return String(s || '-');
    const d = `${+m[3]} ${U.BULAN[+m[2] - 1]} ${m[1]}`;
    return withTime && m[4] ? `${d}, ${m[4]}:${m[5]}` : d;
  },
  /** Tanggal ringkas untuk tabel: '20 Nov, 06:21' (tahun hanya bila bukan tahun ini) */
  tglPendek(s) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return U.tgl(s);
    return `${+m[3]} ${U.BULAN[+m[2] - 1]}${+m[1] !== new Date().getFullYear() ? ' ' + m[1] : ''}, ${m[4]}:${m[5]}`;
  },
  jam(s) { const m = String(s || '').match(/(\d{2}):(\d{2})/); return m ? `${m[1]}:${m[2]}` : '-'; },
  ymd(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },
  ym(d = new Date()) { return U.ymd(d).slice(0, 7); },
  hariPanjang(d = new Date()) { return `${U.HARI[d.getDay()]}, ${d.getDate()} ${U.BULAN[d.getMonth()]} ${d.getFullYear()}`; },
  dk(s) { return String(s || '').replace(/-/g, ''); },
  uuid() { return (crypto.randomUUID ? crypto.randomUUID() : 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2)); },
  debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
  norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); },
  pct(a, b) { return b ? Math.round((a - b) / b * 1000) / 10 : null; },
  initials(s) { return String(s || 'KM').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'KM'; },
  csv(filename, rows) {
    const body = rows.map(r => r.map(c => {
      const v = String(c === undefined || c === null ? '' : c);
      return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  },
  fileToBase64(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Berkas tidak terbaca.')); r.readAsDataURL(file); });
  },
  fileToText(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Berkas tidak terbaca.')); r.readAsText(file, 'utf-8'); });
  },
  /** Luminansi relatif & kontras WCAG */
  lum(hex) {
    const m = String(hex).replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return 0;
    const ch = m.slice(1).map(x => { const c = parseInt(x, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  },
  contrast(a, b) { const x = U.lum(a), y = U.lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
};
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

/* ----------------------------------------------------------------- Ikon (SVG garis, tanpa emoji) */
const ICONS = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  cart: 'M2 3h3l2.6 12.2h11.2L21 7H6.2M10.5 20a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM19.5 20a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z',
  receipt: 'M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2zM9 7h6M9 11h6M9 15h4',
  box: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  tag: 'M3 3h8l10 10-8 8L3 11zM7 7.5a.5.5 0 1 0 1 0 .5.5 0 1 0-1 0',
  stock: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  chart: 'M4 20V11M10 20V4M16 20v-8M21 20H3',
  sliders: 'M3 6h11M18 6h3M3 12h5M12 12h9M3 18h13M20 18h1M16 4v4M10 10v4M18 16v4',
  logout: 'M15 3h5v18h-5M10 17l5-5-5-5M15 12H3',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.6-4.6',
  barcode: 'M3 5v14M6.5 5v14M9 5v14M12.5 5v14M15 5v14M18 5v14M21 5v14',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 3 8 3 8H3s3-2 3-8M10.3 21a2 2 0 0 0 3.4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
  x: 'M18 6L6 18M6 6l12 12',
  check: 'M20 6L9 17l-5-5',
  printer: 'M6 9V2h12v7M6 18H3v-9h18v9h-3M6 14h12v8H6z',
  pencil: 'M16 3l5 5L8 21H3v-5z',
  ban: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  money: 'M2 6h20v12H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v4M18 10v4',
  bag: 'M5 7h14l1 14H4zM9 10V6a3 3 0 0 1 6 0v4',
  filter: 'M3 4h18l-7 8v6l-4 2v-8z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  image: 'M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  menu: 'M3 6h18M3 12h18M3 18h18',
  chevL: 'M15 18l-6-6 6-6',
  chevR: 'M9 18l6-6-6-6',
  calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3',
  layers: 'M12 2l10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5',
  database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  key: 'M7.5 21a4.5 4.5 0 1 1 3.2-7.7L20 4M16 8l3 3M13 11l2 2',
  store: 'M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6',
  clipboard: 'M8 3h8v3H8zM6 4H4v17h16V4h-2M8 12h8M8 16h5',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  file: 'M14 2H5v20h14V7zM14 2v5h5M8 13h8M8 17h8',
  palette: 'M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-1.2-1-1.5-1-2.5S13.3 15 14.5 15H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11.5v.5M10 7.5v.5M15 7.5v.5',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  import: 'M12 3v12M7 10l5 5 5-5M4 15v6h16v-6',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M14 10.3A10 10 0 0 1 19 13M2 9a15 15 0 0 1 4.3-2.6M12 20v.5',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM6 6h1v1H6zM17 6h1v1h-1zM6 17h1v1H6zM14 14h3v3h-3zM18 18h3v3h-3zM14 20h1M20 14h1',
  bank: 'M3 9l9-6 9 6M4 9h16M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 21h18M3 18h18',
  copy: 'M8 8h13v13H8zM16 8V3H3v13h5',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14.5a7 7 0 0 1 4 6.5',
  scale: 'M12 3v18M5 21h14M4 7h16M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z',
  expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  cash: 'M2 6h20v12H2zM6 12h.5M17.5 12h.5M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  dots: 'M12 5v.5M12 12v.5M12 19v.5'
};
function I(name, cls = '') { return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICONS[name] || ''}"/></svg>`; }

/* ----------------------------------------------------------------- Penyimpanan lokal */
const Store = {
  P: 'km1:',
  get(k, def = null) { try { const v = localStorage.getItem(this.P + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(this.P + k, JSON.stringify(v)); } catch (e) { /* kuota penuh: abaikan */ } },
  del(k) { try { localStorage.removeItem(this.P + k); } catch (e) { /* abaikan */ } }
};

/* ----------------------------------------------------------------- Sesi */
const Session = {
  get token() { return Store.get('token'); },
  set(token, exp) { Store.set('token', token); Store.set('tokenExp', exp); },
  clear() { Store.del('token'); Store.del('tokenExp'); Store.del('boot'); },
  valid() { const t = Store.get('token'), e = Store.get('tokenExp'); return !!t && (!e || e > Date.now()); }
};

/* ----------------------------------------------------------------- Klien API */
const API = (() => {
  const READ = /^(ping|publicSettings|boot|katalog|qris\.get|users\.list|dashboard|transaksi\.(list|detail)|stok\.log|laporan|system\.status|batch)$/;
  const inflight = {};
  let epoch = 0;
  const log = [];
  const handlers = { auth: null, mustChange: null };

  function url() { return (window.APP_CONFIG && window.APP_CONFIG.GAS_URL) || ''; }
  function configured() { const u = url(); return !!u && !/GANTI|XXXX/.test(u) && /^https?:\/\//.test(u); }

  async function raw(action, data) {
    const t0 = performance.now();
    const res = await fetch(url(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },      // wajib text/plain: hindari CORS preflight
      body: JSON.stringify({ action, token: Session.token, data: data || {} }),
      redirect: 'follow'
    });
    const text = await res.text();
    let j;
    try { j = JSON.parse(text); }
    catch (e) { throw new Error('Respons server bukan JSON. Periksa URL /exec dan akses deploy "Anyone".'); }
    const total = Math.round(performance.now() - t0);
    log.push({ action, total, server: j.ms || 0, net: total - (j.ms || 0), ok: !!j.success, at: new Date().toLocaleTimeString('id-ID') });
    if (log.length > 200) log.shift();
    API.lastMs = total;
    return j;
  }

  async function call(action, data, opts = {}) {
    if (!configured()) return { success: false, code: 'CONFIG', message: 'URL backend belum diisi di js/config.js.' };
    const isRead = READ.test(action);
    if (!isRead) epoch++;
    const key = isRead ? epoch + '|' + action + '|' + JSON.stringify(data || {}) : null;
    if (key && inflight[key]) return inflight[key];
    const retries = opts.retry !== undefined ? opts.retry : (isRead ? 1 : 0);
    const p = (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const j = await raw(action, data);
          if (!j.success && j.code === 'AUTH' && handlers.auth && !opts.silentAuth) handlers.auth(j);
          if (!j.success && j.code === 'MUST_CHANGE' && handlers.mustChange) handlers.mustChange(j);
          return j;
        } catch (e) {
          if (attempt < retries) { await U.sleep(700 * (attempt + 1)); continue; }
          return { success: false, code: 'NETWORK', message: navigator.onLine ? 'Gagal terhubung ke server. ' + e.message : 'Tidak ada koneksi internet.' };
        }
      }
    })();
    if (key) { inflight[key] = p; p.finally(() => { delete inflight[key]; }); }
    return p;
  }

  /** Penggabung otomatis: beberapa baca dalam satu tik → 1 eksekusi 'batch'. */
  const Batcher = {
    q: null,
    add(action, data) {
      return new Promise(res => {
        if (!this.q) { this.q = []; setTimeout(() => this.flush(), 0); }
        this.q.push({ action, data: data || {}, res });
      });
    },
    async flush() {
      const q = this.q; this.q = null;
      const uniq = [];
      q.forEach(it => { const k = it.action + JSON.stringify(it.data); let u = uniq.find(x => x.k === k); if (!u) { u = { k, action: it.action, data: it.data, subs: [] }; uniq.push(u); } u.subs.push(it.res); });
      for (let i = 0; i < uniq.length; i += 10) {
        const part = uniq.slice(i, i + 10);
        if (part.length === 1) { const r = await call(part[0].action, part[0].data); part[0].subs.forEach(s => s(r)); continue; }
        const r = await call('batch', { calls: part.map(p => ({ action: p.action, data: p.data })) });
        part.forEach((p, j) => { const one = r.success ? r.data.results[j] : r; p.subs.forEach(s => s(one)); });
      }
    }
  };

  async function get(params) {
    if (!configured()) return { success: false, code: 'CONFIG', message: 'URL backend belum diisi.' };
    try {
      const qs = new URLSearchParams(params).toString();
      const r = await fetch(url() + (url().includes('?') ? '&' : '?') + qs, { redirect: 'follow' });
      return JSON.parse(await r.text());
    } catch (e) { return { success: false, code: 'NETWORK', message: 'Gagal terhubung ke server.' }; }
  }

  /** Panaskan server (cache) — maks. 1×/4 menit per lingkup. */
  function warm(scope) {
    if (!configured()) return;
    try {
      const k = 'km1:warm_' + scope, last = Number(sessionStorage.getItem(k) || 0);
      if (Date.now() - last < 240000) return;
      sessionStorage.setItem(k, String(Date.now()));
      fetch(url() + (url().includes('?') ? '&' : '?') + 'w=' + scope, { mode: 'no-cors' }).catch(() => {});
    } catch (e) { /* abaikan */ }
  }

  return { call, q: (a, d) => Batcher.add(a, d), get, warm, configured, url, log, handlers, lastMs: 0 };
})();

/** Pengukur performa: ketik Perf.table() atau Perf.summary() di console. */
window.Perf = {
  table() { console.table(API.log); },
  summary() {
    const by = {};
    API.log.forEach(l => { const b = by[l.action] = by[l.action] || { n: 0, total: 0, server: 0 }; b.n++; b.total += l.total; b.server += l.server; });
    console.table(Object.keys(by).map(k => ({ aksi: k, jumlah: by[k].n, rata_total_ms: Math.round(by[k].total / by[k].n), rata_server_ms: Math.round(by[k].server / by[k].n) })));
  }
};

/* ----------------------------------------------------------------- Toast */
const Toast = {
  show(msg, type = 'ok', ms = 3600) {
    const root = $('#toast-root');
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `${I(type === 'error' ? 'alert' : 'check')}<div class="grow">${U.esc(msg)}</div><button class="icon-btn plain" aria-label="Tutup notifikasi" style="width:28px;height:28px">${I('x', 'ic-sm')}</button>`;
    el.querySelector('button').onclick = () => el.remove();
    root.appendChild(el);
    while (root.children.length > 4) root.firstChild.remove();
    setTimeout(() => el.remove(), type === 'error' ? Math.max(ms, 6000) : ms);
  },
  ok(m) { this.show(m, 'ok'); },
  clear() { const r = $('#toast-root'); if (r) r.innerHTML = ''; },
  err(m) { this.show(m, 'error'); },
  res(r, okMsg) { if (r.success) this.ok(okMsg || r.message || 'Berhasil.'); else this.err(r.message || 'Terjadi kesalahan.'); return r.success; }
};

/* ----------------------------------------------------------------- Modal */
const Modal = {
  stack: [],
  open({ title = '', body = '', foot = '', size = '', icon = '', onMount, onClose, dismissible = true, headless = false }) {
    const prevFocus = document.activeElement;
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    const id = 'dlg' + Date.now();
    scrim.innerHTML = `<div class="dialog ${size}" role="dialog" aria-modal="true" ${title ? `aria-labelledby="${id}"` : ''}>
      ${headless ? '' : `<div class="dialog-head">${icon}<h2 id="${id}">${title}</h2>${dismissible ? `<button class="icon-btn plain" data-close aria-label="Tutup">${I('x')}</button>` : ''}</div>`}
      <div class="dialog-body">${body}</div>
      ${foot ? `<div class="dialog-foot">${foot}</div>` : ''}</div>`;
    $('#modal-root').appendChild(scrim);
    document.body.classList.add('modal-open');
    const dlg = scrim.firstElementChild;
    const api = {
      el: dlg, scrim,
      close(val) {
        if (!scrim.isConnected) return;
        scrim.remove();
        Modal.stack = Modal.stack.filter(x => x !== api);
        if (!Modal.stack.length) document.body.classList.remove('modal-open');
        if (onClose) onClose(val);
        if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
      },
      dismissible
    };
    Modal.stack.push(api);
    if (dismissible) scrim.addEventListener('mousedown', e => { if (e.target === scrim) api.close(); });
    dlg.addEventListener('click', e => { if (e.target.closest('[data-close]')) api.close(); });
    if (onMount) onMount(dlg, api);
    setTimeout(() => { const f = dlg.querySelector('[autofocus]') || dlg.querySelector('input:not([type=hidden]):not([readonly]), select, textarea, .btn-primary'); if (f) f.focus(); }, 30);
    return api;
  },
  top() { return this.stack[this.stack.length - 1]; },
  confirm({ title = 'Konfirmasi', message = '', okText = 'Ya, lanjutkan', danger = false } = {}) {
    return new Promise(res => {
      let done = false;
      const m = Modal.open({
        title, size: 'sm', body: `<p>${message}</p>`,
        foot: `<button class="btn btn-secondary" data-close>Batal</button><button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-ok>${U.esc(okText)}</button>`,
        onMount: (el, api) => { el.querySelector('[data-ok]').onclick = () => { done = true; api.close(); res(true); }; },
        onClose: () => { if (!done) res(false); }
      });
      return m;
    });
  }
};
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && Modal.stack.length) { const t = Modal.top(); if (t.dismissible) { e.preventDefault(); t.close(); } }
});

/* ----------------------------------------------------------------- Tombol sibuk */
async function busy(btn, fn, text = 'Memproses…') {
  if (!btn) return fn();
  if (btn.dataset.busy) return;
  const html = btn.innerHTML;
  btn.dataset.busy = '1'; btn.disabled = true;
  btn.innerHTML = `<span class="spin" style="width:16px;height:16px;border-top-color:currentColor"></span> ${U.esc(text)}`;
  try { return await fn(); }
  finally { if (btn.isConnected) { btn.innerHTML = html; btn.disabled = false; delete btn.dataset.busy; } }
}

/* ----------------------------------------------------------------- Tema */
const Theme = {
  DEF: { Warna_Utama: '#0F766E', Warna_Aksen: '#0F766E' },
  apply(s) {
    s = s || {};
    const p = /^#[0-9a-f]{6}$/i.test(s.Warna_Utama) ? s.Warna_Utama : this.DEF.Warna_Utama;
    const a = /^#[0-9a-f]{6}$/i.test(s.Warna_Aksen) ? s.Warna_Aksen : this.DEF.Warna_Aksen;
    const root = document.documentElement.style;
    root.setProperty('--primary', p);
    root.setProperty('--on-primary', U.contrast(p, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#1A1C1C');
    // Bila aksen terlalu terang sebagai teks di atas putih, gelapkan otomatis agar tetap terbaca
    root.setProperty('--accent', U.contrast(a, '#FFFFFF') >= 4.5 ? a : `color-mix(in srgb, ${a} 55%, #000)`);
    const meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', p);
    if (s.Nama_Aplikasi) document.title = s.Nama_Aplikasi;
  }
};

/* ----------------------------------------------------------------- Paginasi */
const Pager = {
  /** p = {page, pages, total}; attr = nama atribut data untuk handler */
  html(p, label = 'data') {
    if (!p || !p.total) return '';
    const { page, pages, total } = p, size = p.size || 25;
    const from = (page - 1) * size + 1, to = Math.min(page * size, total);
    const nums = [];
    const add = n => nums.push(`<button data-page="${n}" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`);
    const set = new Set([1, pages, page - 1, page, page + 1].filter(n => n >= 1 && n <= pages));
    let last = 0;
    [...set].sort((a, b) => a - b).forEach(n => { if (n - last > 1) nums.push('<span class="gap">…</span>'); add(n); last = n; });
    return `<div class="pager"><span class="caption">Menampilkan <b>${U.num(from)}–${U.num(to)}</b> dari <b>${U.num(total)}</b> ${label}</span>
      <div class="pages"><button data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Sebelumnya">${I('chevL', 'ic-sm')}</button>${nums.join('')}<button data-page="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Berikutnya">${I('chevR', 'ic-sm')}</button></div></div>`;
  },
  local(arr, page, size = 15) {
    const pages = Math.max(1, Math.ceil(arr.length / size)), p = Math.min(Math.max(1, page || 1), pages);
    return { rows: arr.slice((p - 1) * size, p * size), page: p, pages, total: arr.length, size };
  },
  bind(container, fn) {
    container.addEventListener('click', e => { const b = e.target.closest('[data-page]'); if (b && !b.disabled) fn(Number(b.dataset.page)); });
  }
};

/* ----------------------------------------------------------------- Tampilan bersama */
const View = {
  pill(status) {
    const map = { Aktif: 'pill-ok', Tersedia: 'pill-ok', Lunas: 'pill-ok', Nonaktif: 'pill-off', Habis: 'pill-danger', 'Stok Habis': 'pill-danger', Menipis: 'pill-warn' };
    return `<span class="pill ${map[status] || 'pill-neutral'}">${U.esc(status)}</span>`;
  },
  metode(m) { return `<span class="pill ${m === 'Tunai' ? 'pill-ok' : m === 'QRIS' || m === 'Transfer' ? 'pill-info' : 'pill-neutral'}">${U.esc(m)}</span>`; },
  /** Logo toko (thumbnail kecil); bila belum ada → ubin inisial berwarna tema. */
  logo(settings, size = 40) {
    const url = settings && settings.URL_Logo;
    const ini = U.esc(U.initials(settings && settings.Nama_Aplikasi));
    const box = `width:${size}px;height:${size}px`;
    return url
      ? `<span class="ph" style="${box}"><img src="${U.esc(url)}" alt="Logo ${U.esc(settings.Nama_Aplikasi || '')}" referrerpolicy="no-referrer" onerror="this.remove()"></span>`
      : `<span class="brand-tile" style="${box};font-size:${Math.round(size * 0.38)}px" aria-hidden="true">${ini}</span>`;
  },
  empty(icon, title, sub = '') { return `<div class="empty">${I(icon)}<b>${title}</b>${sub ? `<span class="caption">${sub}</span>` : ''}</div>`; },
  loading(txt = 'Memuat data…') { return `<div class="loading"><span class="spin"></span>${U.esc(txt)}</div>`; },
  stokStatus(b, batas) {
    if (b.stok <= 0) return 'Habis';
    if (b.stok <= batas) return 'Menipis';
    return 'Tersedia';
  }
};
