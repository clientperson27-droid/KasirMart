/* ==========================================================================
   KasirMart — pages.js
   Dashboard · Riwayat · Cek Stok (kasir) · Barang · Kategori · Stok · Laporan · Pengaturan
   ========================================================================== */
'use strict';

/* ----------------------------------------------------------------- Komponen kecil */
function pageHead(o) {
  return `<header class="page-head"><div class="grow"><div class="eyebrow">${o.eyebrow || ''}</div>
    <h1>${o.title}${o.tag ? ` <span class="tag">${U.esc(o.tag)}</span>` : ''}</h1>${o.sub ? `<p>${o.sub}</p>` : ''}</div>
    ${o.actions ? `<div class="actions">${o.actions}</div>` : ''}</header>`;
}
function statCard(o) {
  return `<div class="stat${o.alert ? ' alert' : ''}"><div class="stat-top"><div class="grow"><div class="eyebrow">${o.label}</div>
    <div class="stat-val ${o.valCls || ''}">${o.value}${o.small ? `<small>${o.small}</small>` : ''}</div></div>
    ${o.icon ? `<span class="stat-ico" aria-hidden="true">${I(o.icon)}</span>` : ''}${o.pill || ''}</div>
    ${o.foot ? `<div class="stat-foot">${o.foot}</div>` : ''}</div>`;
}
function errBox(msg, retryAttr = 'data-retry') {
  return `<div class="notice danger">${I('alert')}<div class="grow"><b>Gagal memuat data.</b> ${U.esc(msg)}</div><button class="btn btn-sm" ${retryAttr}>${I('refresh', 'ic-sm')} Coba lagi</button></div>`;
}
const katName = id => { const k = ((App.state.katalog || {}).kategori || []).find(x => x.id === id); return k ? k.nama : '-'; };

/** Daftar satuan, dikelompokkan menurut cara hitungnya. Kelompok "Timbang / takar" boleh pecahan (0,5 kg). */
const SATUAN = [
  ['Satuan hitung (bilangan bulat)', [['pcs', 'pcs'], ['buah', 'buah'], ['bungkus', 'bungkus'], ['sachet', 'sachet'], ['renteng', 'renteng'], ['pak', 'pak'], ['bal', 'bal'],
    ['dus', 'dus'], ['karton', 'karton'], ['kotak', 'kotak'], ['botol', 'botol'], ['kaleng', 'kaleng'], ['pouch', 'pouch'], ['cup', 'cup'], ['karung', 'karung'], ['sak', 'sak'],
    ['ikat', 'ikat'], ['sisir', 'sisir'], ['butir', 'butir'], ['rak', 'rak (telur)'], ['tray', 'tray'], ['lusin', 'lusin (12 buah)'], ['kodi', 'kodi (20 buah)'],
    ['slop', 'slop'], ['batang', 'batang'], ['lembar', 'lembar'], ['rim', 'rim'], ['pasang', 'pasang'], ['set', 'set'], ['tabung', 'tabung'], ['galon', 'galon']]],
  ['Timbang / takar (boleh pecahan, mis. 0,5)', [['kg', 'kg — kilogram'], ['ons', 'ons — 100 gram'], ['liter', 'liter'], ['meter', 'meter']]],
  ['Takaran kecil (bilangan bulat)', [['gram', 'gram'], ['ml', 'ml — mililiter'], ['cm', 'cm — sentimeter']]]
];
const SATUAN_ALL = SATUAN.flatMap(g => g[1].map(x => x[0]));
/** Pilihan satuan + isian "Lainnya". Nilai lama yang tidak ada di daftar tetap dipertahankan. */
function satuanField(cur) {
  cur = String(cur || 'pcs').trim();
  const known = SATUAN_ALL.includes(cur.toLowerCase());
  return `<label class="field"><span class="lbl">Satuan penjualan</span>
    <select class="input" name="satuanSel">${SATUAN.map(g => `<optgroup label="${U.esc(g[0])}">${g[1].map(o => `<option value="${o[0]}" ${known && cur.toLowerCase() === o[0] ? 'selected' : ''}>${U.esc(o[1])}</option>`).join('')}</optgroup>`).join('')}
      <optgroup label="Lainnya"><option value="__lain" ${known ? '' : 'selected'}>Lainnya (ketik sendiri)…</option></optgroup></select>
    <input class="input" name="satuanLain" maxlength="20" placeholder="Ketik satuan, mis. bks" value="${known ? '' : U.esc(cur)}" ${known ? 'hidden' : ''}>
    <span class="hint" data-sat-hint></span></label>`;
}
function bindSatuan(f, onChange) {
  const sel = f.satuanSel, lain = f.satuanLain;
  const val = () => (sel.value === '__lain' ? lain.value.trim() : sel.value) || 'pcs';
  const upd = () => {
    lain.hidden = sel.value !== '__lain';
    const v = val(), dec = U.desimal(v);
    f.querySelector('[data-sat-hint]').innerHTML = dec ? `Satuan <b>${U.esc(v)}</b> boleh dijual pecahan, misalnya 0,5 atau 1,25 ${U.esc(v)}.` : 'Dijual per satuan utuh (1, 2, 3, …).';
    if (onChange) onChange(v, dec);
  };
  sel.addEventListener('change', () => { upd(); if (sel.value === '__lain') lain.focus(); });
  lain.addEventListener('input', upd);
  upd();
  return val;
}

/* =================================================================== DASHBOARD */
const PageDashboard = {
  async render(view) {
    view.innerHTML = pageHead({
      eyebrow: '<span class="accent">[Panel operasional]</span> / Ringkasan toko', title: 'Dashboard',
      sub: 'Ringkasan aktivitas dan performa penjualan toko hari ini.',
      actions: `<button class="btn" data-act="sync">${I('refresh', 'ic-sm')} <span data-sync>Sinkron</span></button>
        <a class="btn btn-primary" href="#/kasir">${I('cart', 'ic-sm')} Buka Kasir <span class="kbd">F2</span></a>`
    }) + `<div data-body class="stack">${View.loading()}</div>`;
    view.querySelector('[data-act="sync"]').onclick = e => busy(e.currentTarget, () => this.load(view, true), 'Sinkron…');
    view.addEventListener('click', e => {
      const r = e.target.closest('[data-trx]'); if (r) PageRiwayat.openDetail(r.dataset.trx);
      const s = e.target.closest('[data-restok]'); if (s) PageStok.openAdjust(s.dataset.restok, 'Penambahan');
      if (e.target.closest('[data-goto-users]')) PageSetting.tab = 'pengguna';
      if (e.target.closest('[data-retry]')) this.load(view, true);
    });
    const cached = Store.get('dash');
    if (cached) this.draw(view, cached);
    await this.load(view);
  },
  async load(view, fresh) {
    const r = await API.q('dashboard', fresh ? { _t: Date.now() } : {});
    if (!view.isConnected) return;
    if (r.success) { Store.set('dash', r.data); this.draw(view, r.data); }
    else if (!Store.get('dash')) view.querySelector('[data-body]').innerHTML = errBox(r.message);
    else Toast.err(r.message);
  },
  draw(view, d) {
    const h = d.hariIni, k = d.kemarin, pct = U.pct(h.omzet, k.omzet);
    const s = view.querySelector('[data-sync]'); if (s) s.textContent = 'Sinkron: ' + d.jam + ' WIB';
    const trend = pct === null ? `<span>Kemarin belum ada penjualan</span>`
      : `<span class="${pct >= 0 ? 'trend-up' : 'trend-down'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toLocaleString('id-ID')}%</span><span>dari kemarin (${U.rpShort(k.omzet)})</span>`;
    const today = d.tanggal;
    view.querySelector('[data-body]').innerHTML = `
      <section class="stats" aria-label="Ringkasan hari ini">
        ${statCard({ label: 'Omzet hari ini', value: U.rp(h.omzet), icon: 'money', foot: trend })}
        ${statCard({ label: 'Transaksi hari ini', value: U.num(h.trx), small: 'nota', icon: 'bag', foot: `<span>Kemarin: ${U.num(k.trx)} nota</span><span>${U.num(h.item)} item terjual</span>` })}
        ${statCard({ label: 'Keuntungan hari ini', value: U.rp(h.untung), valCls: 'accent', icon: 'trend', foot: `<span>Margin bersih: <b>${h.margin.toLocaleString('id-ID')}%</b></span><span>Estimasi laba kotor</span>` })}
        ${statCard({ label: 'Rata-rata transaksi', value: U.rp(h.rata), icon: 'tag', foot: `<span>Per keranjang belanja</span><span>${h.itemPerTrx.toLocaleString('id-ID')} item / struk</span>` })}
      </section>
      <section class="split">
        <div class="card"><div class="card-head"><h2><span class="sq"></span>5 Transaksi Terakhir</h2><a class="btn-link btn" href="#/riwayat">Lihat semua riwayat ${I('arrowR', 'ic-sm')}</a></div>
          ${d.terakhir.length ? `<div class="table-wrap"><table class="tbl tbl-cards tbl-compact"><thead><tr><th>No. Nota</th><th>Waktu &amp; kasir</th><th>Daftar barang belanja</th><th class="num">Total &amp; metode</th></tr></thead><tbody>
          ${d.terakhir.map(t => `<tr class="clickable" data-trx="${U.esc(t.id)}" tabindex="0"><td class="mono nowrap"><b>${U.esc(t.id)}</b></td>
            <td class="nowrap">${t.w.slice(0, 10) === today ? 'Hari ini, ' + U.jam(t.w) : U.tglPendek(t.w)}${t.on ? `<span class="sub sub-plain">${U.esc(t.on)}</span>` : ''}</td><td data-hide-sm><span class="clamp2 recent-items">${U.esc(t.r)}</span></td>
            <td class="num"><span class="cell-stack"><b>${U.rp(t.t)}</b>${View.metode(t.m)}</span></td></tr>`).join('')}</tbody></table></div>`
          : View.empty('receipt', 'Belum ada transaksi', 'Transaksi dari halaman Kasir akan muncul di sini.')}
          <div class="card-foot"><span>Menampilkan ${d.terakhir.length} transaksi terakhir</span><a class="btn-link btn" href="#/pengaturan" data-goto-users>${I('users', 'ic-sm')} Kelola akun kasir</a></div></div>
        <div class="card"><div class="card-head"><h2>${I('alert')} Stok Habis</h2>${d.habis.length ? `<span class="pill pill-danger">${d.habis.length} kritis</span>` : '<span class="pill pill-ok">Aman</span>'}</div>
          <div class="card-body" style="padding-top:4px;padding-bottom:4px">${d.habis.length ? d.habis.slice(0, 6).map(b => `
            <div class="stockout"><span class="ph" aria-hidden="true"></span><div class="grow"><div class="nm ellipsis">${U.esc(b.nama)}</div>
              <div class="meta"><span class="qty-tag">Stok 0 ${U.esc(b.satuan)}</span><span class="caption mono">${U.esc(b.barcode ? 'SKU ' + b.barcode : b.id)}</span></div></div>
              <button class="btn btn-sm" style="color:var(--accent);border-color:var(--accent)" data-restok="${U.esc(b.id)}">${I('cart', 'ic-sm')} Restok</button></div>`).join('')
            + (d.habis.length > 6 ? `<p class="caption" style="padding:10px 0">+${d.habis.length - 6} barang lain habis.</p>` : '')
          : View.empty('check', 'Semua stok tersedia', 'Tidak ada barang aktif yang stoknya 0.')}</div>
          <div class="card-foot"><span>${d.menipis} barang stoknya menipis</span><a class="btn btn-sm" href="#/stok">${I('stock', 'ic-sm')} Buka manajemen stok</a></div></div>
      </section>
      <section class="shortcuts" aria-label="Pintasan keyboard"><b>Pintasan kasir:</b><span class="kbd">F2 Buka kasir / cari barang</span><span class="kbd">F8 Bayar</span><span class="kbd">Esc Tutup dialog</span>
        <span class="grow"></span><span class="caption">Frontend v${APP_FE_VERSION} · Backend v${U.esc((App.state.version || '-'))}</span></section>`;
  }
};

/* =================================================================== RIWAYAT TRANSAKSI (pemilik) / TRANSAKSI SAYA (kasir) */
const PageRiwayat = {
  st: null,
  def() {
    const n = new Date();
    return { from: App.isKasir() ? U.ymd(n) : U.ymd(new Date(n.getFullYear(), n.getMonth(), 1)), to: U.ymd(n), q: '', metode: '', kasir: '', page: 1, sel: null };
  },
  range(k) {
    const n = new Date(), y = new Date(n.getTime() - 86400e3);
    return { hari: [U.ymd(n), U.ymd(n)], kemarin: [U.ymd(y), U.ymd(y)], minggu: [U.ymd(new Date(n.getTime() - 6 * 86400e3)), U.ymd(n)], bulan: [U.ymd(new Date(n.getFullYear(), n.getMonth(), 1)), U.ymd(n)] }[k];
  },
  async render(view) {
    this.st = this.st || this.def();
    const s = this.st, k = App.isKasir();
    view.innerHTML = pageHead(k ? {
      eyebrow: '<span class="accent">[Kasir]</span> / Rekap shift', title: 'Transaksi Saya',
      sub: 'Transaksi yang Anda catat. Cocokkan uang tunai di laci dengan ringkasan di bawah, dan cetak ulang struk bila pelanggan meminta.'
    } : {
      eyebrow: '<span class="accent">[Penjualan]</span> / Arsip nota', title: 'Riwayat Transaksi',
      sub: 'Cari transaksi lama, lihat rinciannya, siapa kasirnya, dan cetak ulang struk.'
    }) + `<form class="toolbar" data-filter>
        <div class="field field-quick"><span class="lbl">Periode cepat</span><div class="seg seg-quick" role="group" aria-label="Periode cepat">
          ${[['hari', 'Hari ini'], ['kemarin', 'Kemarin'], ['minggu', '7 hari'], ['bulan', 'Bulan ini']].map(x => { const r = this.range(x[0]); return `<button type="button" data-range="${x[0]}" aria-pressed="${s.from === r[0] && s.to === r[1]}">${x[1]}</button>`; }).join('')}</div></div>
        <label class="field grow-1"><span class="lbl">Dari</span><input class="input" type="date" name="from" value="${s.from}"></label>
        <label class="field grow-1"><span class="lbl">Sampai</span><input class="input" type="date" name="to" value="${s.to}"></label>
        <label class="field grow-2"><span class="lbl">Cari barang / no. nota</span><input class="input" type="search" name="q" placeholder="Contoh: beras, TRX-20261121" value="${U.esc(s.q)}"></label>
        <label class="field grow-1"><span class="lbl">Metode bayar</span><select class="input" name="metode"><option value="">Semua metode</option>${METODE_BAYAR.map(m => `<option ${s.metode === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        ${k ? '' : `<label class="field grow-1"><span class="lbl">Kasir</span><select class="input" name="kasir" data-kasir-sel>${this.kasirOpts()}</select></label>`}
        <div class="row"><button class="btn btn-primary" type="submit">${I('filter', 'ic-sm')} Terapkan</button><button class="btn btn-ghost" type="button" data-reset>Reset</button></div>
      </form>
      <div data-sum></div>
      <div class="split split-detail" data-split>
        <div class="card" data-list>${View.loading()}</div>
        <div class="card hide-tablet" data-detail>${View.empty('receipt', 'Pilih transaksi', 'Klik salah satu baris untuk melihat rincian dan mencetak ulang struk.')}</div>
      </div>`;
    const f = view.querySelector('[data-filter]');
    f.onsubmit = e => { e.preventDefault(); const fd = new FormData(f); Object.assign(s, { from: fd.get('from'), to: fd.get('to'), q: fd.get('q'), metode: fd.get('metode'), kasir: fd.get('kasir') || '', page: 1 }); this.syncQuick(view); this.load(view); };
    f.querySelectorAll('[data-range]').forEach(b => b.onclick = () => { const r = this.range(b.dataset.range); f.from.value = r[0]; f.to.value = r[1]; f.requestSubmit(); });
    if (f.kasir) f.kasir.onchange = () => f.requestSubmit();
    f.metode.onchange = () => f.requestSubmit();
    view.querySelector('[data-reset]').onclick = () => { this.st = this.def(); App.rerender(); };
    view.addEventListener('click', e => {
      const r = e.target.closest('[data-row]');
      if (e.target.closest('[data-print-id]')) { e.stopPropagation(); this.printId(e.target.closest('[data-print-id]').dataset.printId); return; }
      if (r) this.select(view, r.dataset.row);
      if (e.target.closest('[data-retry]')) this.load(view);
    });
    view.addEventListener('keydown', e => { const r = e.target.closest('[data-row]'); if (r && e.key === 'Enter') this.select(view, r.dataset.row); });
    Pager.bind(view.querySelector('[data-list]'), p => { s.page = p; this.load(view); });
    if (!k && !App.state.users) API.q('users.list').then(r => { if (r.success) { App.state.users = r.data.users; const sel = view.querySelector('[data-kasir-sel]'); if (sel && sel.isConnected) sel.innerHTML = this.kasirOpts(); } });
    await this.load(view);
  },
  kasirOpts() {
    const s = this.st || {}, users = App.state.users || [];
    return `<option value="">Semua kasir</option><option value="admin" ${s.kasir === 'admin' ? 'selected' : ''}>Pemilik</option>` +
      users.map(u => `<option value="${U.esc(u.username)}" ${s.kasir === u.username ? 'selected' : ''}>${U.esc(u.nama)}${u.aktif ? '' : ' (nonaktif)'}</option>`).join('') +
      (s.kasir && s.kasir !== 'admin' && !users.some(u => u.username === s.kasir) ? `<option value="${U.esc(s.kasir)}" selected>${U.esc(s.kasir)}</option>` : '');
  },
  syncQuick(view) {
    view.querySelectorAll('[data-range]').forEach(b => { const r = this.range(b.dataset.range); b.setAttribute('aria-pressed', String(this.st.from === r[0] && this.st.to === r[1])); });
  },
  async load(view) {
    const s = this.st, list = view.querySelector('[data-list]'), k = App.isKasir();
    list.style.opacity = '.6';
    const r = await API.call('transaksi.list', { from: s.from, to: s.to, q: s.q, metode: s.metode, kasir: k ? '' : s.kasir, page: s.page });
    if (!view.isConnected) return;
    list.style.opacity = '';
    if (!r.success) { list.innerHTML = errBox(r.message); return; }
    const d = r.data, pm = d.perMetode || {}, val = m => (pm[m] || { total: 0, trx: 0 });
    const non = ['QRIS', 'Transfer', 'Lainnya'].reduce((a, m) => a + val(m).total, 0), nonN = ['QRIS', 'Transfer', 'Lainnya'].reduce((a, m) => a + val(m).trx, 0);
    const periode = s.from === s.to ? U.tgl(s.from, false) : `${U.tgl(s.from, false)} – ${U.tgl(s.to, false)}`;
    const cash = statCard({ label: 'Uang tunai', value: U.rp(val('Tunai').total), icon: 'cash', foot: `<span>${U.num(val('Tunai').trx)} nota tunai</span><span>${k ? 'Harus ada di laci' : 'Diterima di laci'}</span>` });
    const nonCash = statCard({ label: 'Non-tunai', value: U.rp(non), icon: 'qr', foot: `<span>QRIS ${U.rpShort(val('QRIS').total)} · Transfer ${U.rpShort(val('Transfer').total)}</span><span>${U.num(nonN)} nota</span>` });
    view.querySelector('[data-sum]').innerHTML = `<section class="stats">
      ${statCard({ label: 'Transaksi', value: U.num(d.sum.trx), small: 'nota', icon: 'receipt', foot: `<span>${periode}</span>` })}
      ${statCard({ label: k ? 'Total penjualan' : 'Total omzet', value: U.rp(d.sum.omzet), icon: 'money', foot: `<span>Rata-rata ${U.rp(d.sum.rata)} / nota</span>` })}
      ${k || d.sum.untung === undefined ? cash + nonCash
        : statCard({ label: 'Total keuntungan', value: U.rp(d.sum.untung), valCls: 'accent', icon: 'trend', foot: `<span>Margin ${(d.sum.margin || 0).toLocaleString('id-ID')}%</span>` }) + cash}</section>`;
    list.innerHTML = `<div class="card-head"><h2><span class="sq"></span>Daftar transaksi</h2><span class="caption">Terbaru di atas</span></div>` + (d.rows.length
      ? `<div class="table-wrap"><table class="tbl tbl-cards tbl-compact"><thead><tr><th>No. Nota</th><th>${k ? 'Waktu' : 'Waktu &amp; kasir'}</th><th>Barang</th><th class="num">Total &amp; metode</th><th class="num"><span class="sr-only">Aksi</span></th></tr></thead><tbody>
        ${d.rows.map(t => `<tr class="clickable${s.sel === t.id ? ' selected' : ''}" data-row="${U.esc(t.id)}" tabindex="0">
          <td class="mono nowrap"><b>${U.esc(t.id)}</b></td><td class="nowrap">${U.tglPendek(t.w)}${k ? '' : `<span class="sub sub-plain">${I('user', 'ic-xs')} ${U.esc(t.on || 'Pemilik')}</span>`}</td>
          <td data-hide-sm><span class="clamp2">${U.esc(t.r)}</span></td>
          <td class="num"><span class="cell-stack"><b>${U.rp(t.t)}</b>${View.metode(t.m)}</span></td>
          <td><div class="act"><button class="icon-btn" style="width:36px;height:36px" data-print-id="${U.esc(t.id)}" aria-label="Cetak ulang struk ${U.esc(t.id)}" title="Cetak ulang struk">${I('printer', 'ic-sm')}</button></div></td></tr>`).join('')}
        </tbody></table></div>${Pager.html(d, 'transaksi')}`
      : View.empty('search', 'Tidak ada transaksi', k ? 'Belum ada transaksi Anda pada periode ini.' : 'Ubah rentang tanggal, kasir, atau kata kunci pencarian.'));
  },
  async select(view, id) {
    this.st.sel = id;
    view.querySelectorAll('[data-row]').forEach(r => r.classList.toggle('selected', r.dataset.row === id));
    if (matchMedia('(max-width: 1099px)').matches) return this.openDetail(id);
    const box = view.querySelector('[data-detail]');
    box.innerHTML = View.loading('Memuat rincian…');
    const r = await API.call('transaksi.detail', { id });
    if (!box.isConnected || this.st.sel !== id) return;
    box.innerHTML = r.success ? this.detailHtml(r.data, true) : errBox(r.message);
    const p = box.querySelector('[data-print]'); if (p) p.onclick = () => Receipt.preview(r.data);
    const c = box.querySelector('[data-close-detail]'); if (c) c.onclick = () => { this.st.sel = null; view.querySelectorAll('[data-row]').forEach(x => x.classList.remove('selected')); box.innerHTML = View.empty('receipt', 'Pilih transaksi', 'Klik salah satu baris untuk melihat rincian.'); };
  },
  meta(t) { return `${U.tgl(t.w)} · ${U.esc(t.m)}${t.on ? ' · Kasir: ' + U.esc(t.on) : ''}`; },
  detailHtml(d, panel) {
    const t = d.trx, cost = !App.isKasir() && d.items.length && d.items[0].untung !== undefined;
    const untung = cost ? d.items.reduce((a, i) => a + i.untung, 0) : 0;
    return `${panel ? `<div class="card-head" style="background:var(--panel)"><div class="grow"><h2 class="mono" style="font-size:16px">${U.esc(t.id)}</h2><span class="caption">${this.meta(t)}</span></div><button class="icon-btn plain" data-close-detail aria-label="Tutup detail">${I('x')}</button></div>` : ''}
      <div class="table-wrap"><table class="tbl tbl-detail"><thead><tr><th>Barang</th><th class="num">Qty</th><th class="num">Subtotal</th>${cost ? '<th class="num">Untung</th>' : ''}</tr></thead><tbody>
      ${d.items.map(i => `<tr><td>${U.esc(i.nama)}<span class="sub">${U.esc(i.id)} · @ ${U.num(i.harga)}</span></td><td class="num">${U.esc(U.qtySat(i.qty, i.satuan))}</td><td class="num">${U.num(i.subtotal)}</td>${cost ? `<td class="num accent">${U.num(i.untung)}</td>` : ''}</tr>`).join('')}
      </tbody></table></div>
      <div class="card-body" style="background:var(--panel);border-top:1px solid var(--divider)"><dl class="kv">
        <dt>Total</dt><dd>${U.rp(t.t)}</dd><dt>Dibayar (${U.esc(t.m)})</dt><dd>${U.rp(t.b)}</dd>${t.m === 'Tunai' ? `<dt>Kembalian</dt><dd>${U.rp(t.k)}</dd>` : ''}
        ${cost ? `<dt><b>Total keuntungan</b></dt><dd class="accent">${U.rp(untung)}</dd>` : ''}</dl></div>
      ${panel ? `<div class="card-foot" style="background:var(--surface)"><button class="btn btn-primary grow" data-print>${I('printer', 'ic-sm')} Cetak Ulang Struk</button></div>` : ''}`;
  },
  async openDetail(id) {
    const m = Modal.open({ title: 'Detail ' + U.esc(id), size: 'lg', icon: I('receipt'), body: View.loading('Memuat rincian…'),
      foot: `<button class="btn" data-close>Tutup</button><button class="btn btn-primary" data-print disabled>${I('printer', 'ic-sm')} Cetak Ulang Struk</button>` });
    const r = await API.call('transaksi.detail', { id });
    if (!m.el.isConnected) return;
    const body = m.el.querySelector('.dialog-body');
    if (!r.success) { body.innerHTML = errBox(r.message, ''); return; }
    body.style.padding = '0';
    body.innerHTML = `<div class="card-body" style="padding-bottom:0"><span class="caption">${this.meta(r.data.trx)}</span></div>` + this.detailHtml(r.data, false);
    const p = m.el.querySelector('[data-print]'); p.disabled = false; p.onclick = () => Receipt.preview(r.data);
  },
  async printId(id) {
    const r = await API.call('transaksi.detail', { id });
    if (r.success) Receipt.preview(r.data); else Toast.err(r.message);
  }
};
const METODE_BAYAR = ['Tunai', 'QRIS', 'Transfer', 'Lainnya'];

/* =================================================================== CEK STOK (kasir) */
const PageCekStok = {
  st: { q: '', kat: '', kondisi: '', page: 1 },
  render(view) {
    const s = this.st;
    view.innerHTML = pageHead({
      eyebrow: '<span class="accent">[Persediaan]</span> / Cek stok', title: 'Cek Stok Barang',
      sub: 'Sisa stok semua barang yang dijual. Laporkan ke pemilik toko bila ada barang yang menipis atau habis.',
      actions: `<span class="caption" data-upd></span><button class="btn" data-reload>${I('refresh', 'ic-sm')} Muat ulang stok</button>`
    }) + `<section class="stats stat-filters" data-stats></section>
      <div class="card"><div class="toolbar" style="border:0;border-bottom:1px solid var(--divider)">
        <label class="field grow-2"><span class="lbl">Pencarian</span><span class="ig"><span class="adorn">${I('search', 'ic-sm')}</span><input class="input" type="search" data-f="q" placeholder="Cari nama / kode / barcode…" value="${U.esc(s.q)}"></span></label>
        <label class="field grow-1"><span class="lbl">Kategori</span><select class="input" data-f="kat"><option value="">Semua kategori</option>${((App.state.katalog || {}).kategori || []).filter(k => k.status === 'Aktif').map(k => `<option value="${U.esc(k.id)}" ${s.kat === k.id ? 'selected' : ''}>${U.esc(k.nama)}</option>`).join('')}</select></label>
        <label class="field grow-1"><span class="lbl">Kondisi stok</span><select class="input" data-f="kondisi"><option value="">Semua kondisi</option>${['Tersedia', 'Menipis', 'Habis'].map(x => `<option ${s.kondisi === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      </div><div data-tbl></div></div>`;
    view.querySelectorAll('[data-f]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', U.debounce(() => { s[el.dataset.f] = el.value; s.page = 1; this.draw(view); }, 120)));
    view.addEventListener('click', e => {
      const k = e.target.closest('[data-kondisi]'); if (k) { s.kondisi = k.dataset.kondisi; s.page = 1; view.querySelector('[data-f="kondisi"]').value = s.kondisi; this.draw(view); }
    });
    view.querySelector('[data-reload]').onclick = e => busy(e.currentTarget, async () => { await App.refreshKatalog(true); this.draw(view); Toast.ok('Stok diperbarui.'); }, 'Memuat…');
    Pager.bind(view.querySelector('[data-tbl]'), p => { s.page = p; this.draw(view); view.querySelector('[data-tbl]').scrollIntoView({ block: 'start' }); });
    this.draw(view);
    if (Date.now() - (App.state.katalogAt || 0) > 30000) App.refreshKatalog(true).then(() => { if (view.isConnected) this.draw(view); });
    setTimeout(() => { const q = view.querySelector('[data-f="q"]'); if (q && matchMedia('(min-width: 900px)').matches) q.focus(); }, 50);
  },
  draw(view) {
    const s = this.st, batas = Number((App.state.settings || {}).Batas_Stok_Menipis || 5), q = U.norm(s.q);
    const all = ((App.state.katalog || {}).barang || []).filter(b => b.status === 'Aktif');
    const cnt = { '': all.length, Tersedia: 0, Menipis: 0, Habis: 0 };
    all.forEach(b => cnt[View.stokStatus(b, batas)]++);
    const card = (k, label, foot, cls) => `<button class="stat stat-btn ${cls || ''}" data-kondisi="${k}" aria-pressed="${s.kondisi === k}"><span class="eyebrow">${label}</span><span class="stat-val">${U.num(cnt[k])}</span><span class="stat-foot"><span>${foot}</span></span></button>`;
    view.querySelector('[data-stats]').innerHTML = card('', 'Semua barang', 'Barang aktif dijual') + card('Tersedia', 'Tersedia', `Stok di atas ${batas}`, 'ok') +
      card('Menipis', 'Menipis', `Stok 1–${batas}`, 'warn') + card('Habis', 'Habis', 'Tidak bisa dijual', cnt.Habis ? 'bad' : '');
    const at = App.state.katalogAt; view.querySelector('[data-upd]').textContent = at ? 'Diperbarui ' + new Date(at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
    const list = all.filter(b => (!s.kat || b.kat === s.kat) && (!s.kondisi || View.stokStatus(b, batas) === s.kondisi) &&
      (!q || U.norm(b.nama).includes(q) || b.id.toLowerCase().includes(q) || (b.barcode || '').includes(q)))
      .sort((a, b) => a.stok - b.stok || a.nama.localeCompare(b.nama, 'id'));
    const p = Pager.local(list, s.page, 20); s.page = p.page;
    view.querySelector('[data-tbl]').innerHTML = !p.total ? View.empty('search', 'Tidak ada barang', 'Ubah kata kunci atau filter kondisi stok.') : `<div class="table-wrap"><table class="tbl tbl-cards stock-tbl"><thead><tr>
      <th>Barang</th><th>Kategori</th><th class="num">Harga jual</th><th class="num">Sisa stok</th><th>Kondisi</th></tr></thead><tbody>
      ${p.rows.map(b => { const st = View.stokStatus(b, batas), out = st === 'Habis'; return `<tr class="${out ? 'row-danger' : ''}">
        <td><span class="nm" style="font-weight:600">${U.esc(b.nama)}</span><span class="sub">${U.esc(b.id)}${b.barcode ? ' · ' + U.esc(b.barcode) : ''}</span></td>
        <td data-hide-sm>${U.esc(katName(b.kat))}</td><td class="num" data-hide-sm>${U.rp(b.jual)}<span class="sub sub-plain">per ${U.esc(b.satuan)}</span></td>
        <td class="num"><b class="stock-big ${out ? 'danger-text' : ''}">${U.qty(b.stok)}</b> <span class="caption">${U.esc(b.satuan)}</span></td>
        <td>${View.pill(st === 'Habis' ? 'Stok Habis' : st)}</td></tr>`; }).join('')}
      </tbody></table></div>${Pager.html(p, 'barang')}`;
  }
};

/* =================================================================== BARANG */
const PageBarang = {
  st: { q: '', kat: '', status: '', sort: 'nama', page: 1 },
  render(view) {
    const s = this.st;
    view.innerHTML = pageHead({
      eyebrow: '<span class="accent">[Master data]</span> / Katalog produk', title: 'Barang',
      sub: 'Kelola katalog sembako: harga modal (beli), harga jual, dan status penjualan.',
      actions: `<button class="btn" data-export>${I('download', 'ic-sm')} Ekspor CSV</button><button class="btn btn-primary" data-new>${I('plus', 'ic-sm')} Tambah Barang</button>`
    }) + `<section class="stats" data-stats></section>
      <div class="toolbar">
        <label class="field grow-2"><span class="lbl">Pencarian</span><span class="ig"><span class="adorn">${I('search', 'ic-sm')}</span><input class="input" type="search" data-f="q" placeholder="Cari nama / kode / barcode…" value="${U.esc(s.q)}"></span></label>
        <label class="field grow-1"><span class="lbl">Kategori</span><select class="input" data-f="kat"></select></label>
        <label class="field grow-1"><span class="lbl">Status</span><select class="input" data-f="status"><option value="">Semua status</option><option ${s.status === 'Aktif' ? 'selected' : ''}>Aktif</option><option ${s.status === 'Nonaktif' ? 'selected' : ''}>Nonaktif</option><option value="Habis" ${s.status === 'Habis' ? 'selected' : ''}>Stok habis</option></select></label>
        <label class="field grow-1"><span class="lbl">Urutkan</span><select class="input" data-f="sort">
          ${[['nama', 'Nama A–Z'], ['baru', 'Terakhir diubah'], ['stok', 'Stok terendah'], ['jual', 'Harga jual tertinggi'], ['margin', 'Margin tertinggi']].map(o => `<option value="${o[0]}" ${s.sort === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>
      </div>
      <div class="card" data-table></div>`;
    view.querySelector('[data-new]').onclick = () => this.form();
    view.querySelector('[data-export]').onclick = () => this.export();
    view.querySelectorAll('[data-f]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', U.debounce(() => { s[el.dataset.f] = el.value; s.page = 1; this.draw(view); }, 120)));
    view.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.edit) this.form(b.dataset.edit);
      if (b.dataset.toggle) this.toggle(b, b.dataset.toggle);
      if (b.dataset.restok) PageStok.openAdjust(b.dataset.restok, 'Penambahan');
    });
    Pager.bind(view.querySelector('[data-table]'), p => { s.page = p; this.draw(view); view.querySelector('[data-table]').scrollIntoView({ block: 'start' }); });
    this.draw(view);
  },
  list() {
    const s = this.st, q = U.norm(s.q);
    const arr = ((App.state.katalog || {}).barang || []).filter(b =>
      (!s.kat || b.kat === s.kat) && (!s.status || (s.status === 'Habis' ? b.status === 'Aktif' && b.stok <= 0 : b.status === s.status)) &&
      (!q || U.norm(b.nama).includes(q) || b.id.toLowerCase().includes(q) || (b.barcode || '').includes(q)));
    const m = b => b.jual - b.beli;
    const cmp = { nama: (a, b) => a.nama.localeCompare(b.nama, 'id'), baru: (a, b) => String(b.diubah).localeCompare(String(a.diubah)), stok: (a, b) => a.stok - b.stok, jual: (a, b) => b.jual - a.jual, margin: (a, b) => m(b) - m(a) }[s.sort];
    return arr.sort(cmp);
  },
  draw(view) {
    const all = (App.state.katalog || {}).barang || [], kats = (App.state.katalog || {}).kategori || [];
    const aktif = all.filter(b => b.status === 'Aktif'), habis = aktif.filter(b => b.stok <= 0);
    view.querySelector('[data-stats]').innerHTML =
      statCard({ label: 'Total barang', value: U.num(all.length), small: 'produk' }) +
      statCard({ label: 'Barang aktif', value: U.num(aktif.length), small: 'produk', valCls: 'accent', pill: '<span class="pill pill-ok">Aktif</span>' }) +
      statCard({ label: 'Nonaktif', value: U.num(all.length - aktif.length), small: 'produk', pill: '<span class="pill pill-off">Arsip</span>' }) +
      statCard({ label: 'Stok habis', value: U.num(habis.length), small: 'produk', valCls: habis.length ? 'danger-text' : '', pill: habis.length ? '<span class="pill pill-danger">Perlu restok</span>' : '' });
    const sel = view.querySelector('[data-f="kat"]');
    sel.innerHTML = `<option value="">Semua kategori</option>` + kats.map(k => `<option value="${U.esc(k.id)}" ${this.st.kat === k.id ? 'selected' : ''}>${U.esc(k.nama)}${k.status === 'Nonaktif' ? ' (nonaktif)' : ''}</option>`).join('');
    const p = Pager.local(this.list(), this.st.page, 15);
    this.st.page = p.page;
    view.querySelector('[data-table]').innerHTML = !all.length
      ? View.empty('box', 'Belum ada barang', 'Klik "Tambah Barang", atau impor dari spreadsheet lama di Pengaturan → Import Data.')
      : !p.total ? View.empty('search', 'Tidak ada barang yang cocok', 'Ubah kata kunci atau filter.')
      : `<div class="table-wrap"><table class="tbl tbl-cards"><thead><tr><th class="col-lg">Kode</th><th>Nama barang</th><th class="num col-lg">Harga beli</th><th class="num">Harga jual &amp; margin</th><th class="num">Stok</th><th>Status</th><th class="num">Aksi</th></tr></thead><tbody>
        ${p.rows.map(b => { const mg = b.jual - b.beli, off = b.status === 'Nonaktif', out = !off && b.stok <= 0; return `<tr class="${out ? 'row-danger' : ''}">
          <td class="mono nowrap col-lg"><b>${U.esc(b.id)}</b></td>
          <td><span class="nm ${off ? 'strike' : ''}">${U.esc(b.nama)}</span><span class="sub sub-plain"><span class="mono only-lg">${U.esc(b.id)} · </span>${U.esc(katName(b.kat))}${b.barcode ? ` · <span class="mono">${U.esc(b.barcode)}</span>` : ''}</span></td>
          <td class="num col-lg" data-hide-sm>${U.num(b.beli)}</td>
          <td class="num"><b>${U.num(b.jual)}</b><span class="sub ${mg >= 0 ? 'accent' : 'danger-text'}" data-hide-sm>${mg >= 0 ? '+' : ''}${U.num(mg)} · ${b.jual ? (mg / b.jual * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 }) : 0}%</span></td>
          <td class="num nowrap"><b class="${out ? 'danger-text' : ''}">${U.qty(b.stok)}</b> <span class="caption">${U.esc(b.satuan)}</span></td>
          <td>${View.pill(out ? 'Habis' : b.status)}</td>
          <td><div class="act">${out ? `<button class="btn btn-sm btn-danger" data-restok="${U.esc(b.id)}">Restok</button>` : ''}<button class="btn btn-sm" data-edit="${U.esc(b.id)}" aria-label="Edit ${U.esc(b.nama)}">${I('pencil', 'ic-sm')}<span class="lbl-lg">Edit</span></button>
            <button class="icon-btn" style="width:32px;height:32px" data-toggle="${U.esc(b.id)}" aria-label="${off ? 'Aktifkan' : 'Nonaktifkan'} ${U.esc(b.nama)}" title="${off ? 'Aktifkan kembali' : 'Nonaktifkan (sembunyikan dari kasir)'}">${I(off ? 'check' : 'ban', 'ic-sm')}</button></div></td></tr>`; }).join('')}
        </tbody></table></div>${Pager.html(p, 'barang')}`;
  },
  form(id) {
    const b = id ? ((App.state.katalog || {}).barang || []).find(x => x.id === id) : null;
    const kats = ((App.state.katalog || {}).kategori || []).filter(k => k.status === 'Aktif' || (b && k.id === b.kat));
    if (!kats.length) { Toast.err('Buat kategori terlebih dahulu di menu Kategori.'); return; }
    Modal.open({
      title: b ? 'Edit Barang: ' + U.esc(b.nama) : 'Tambah Barang', icon: I(b ? 'pencil' : 'plus'),
      body: `<form class="stack" data-form novalidate>
        <div class="grid-2"><label class="field"><span class="lbl">Kode barang</span><input class="input mono" value="${b ? U.esc(b.id) : 'Otomatis (BRG-xxxx)'}" readonly></label>
          <label class="field"><span class="lbl">Barcode / SKU</span><span class="ig"><input class="input mono" name="barcode" inputmode="numeric" value="${b ? U.esc(b.barcode) : ''}" placeholder="Scan atau ketik (opsional)" autocomplete="off"><span class="adorn">${I('barcode')}</span></span></label></div>
        <label class="field"><span class="lbl">Nama barang <span class="req">*</span></span><input class="input" name="nama" maxlength="120" required value="${b ? U.esc(b.nama) : ''}" placeholder="Contoh: Beras Pandan Wangi 5kg"></label>
        <div class="grid-2"><label class="field"><span class="lbl">Kategori <span class="req">*</span></span><select class="input" name="kategori">${kats.map(k => `<option value="${U.esc(k.id)}" ${b && b.kat === k.id ? 'selected' : ''}>${U.esc(k.nama)}</option>`).join('')}</select></label>
          ${satuanField(b ? b.satuan : 'pcs')}</div>
        <div class="grid-2"><label class="field"><span class="lbl">Harga beli (modal) <span class="req">*</span></span><span class="ig"><span class="pre">Rp</span><input class="input tnum" name="beli" inputmode="numeric" value="${b ? U.num(b.beli) : ''}" placeholder="0"></span></label>
          <label class="field"><span class="lbl">Harga jual toko <span class="req">*</span></span><span class="ig"><span class="pre">Rp</span><input class="input tnum" name="jual" inputmode="numeric" value="${b ? U.num(b.jual) : ''}" placeholder="0"></span></label></div>
        <div class="notice info" data-margin></div>
        ${b ? `<div class="notice">${I('stock')}<div>Stok saat ini <b>${U.qty(b.stok)} ${U.esc(b.satuan)}</b>. Penambahan atau koreksi stok dilakukan di menu <a href="#/stok">Stok</a> agar tercatat di log mutasi.</div></div>`
          : `<label class="field"><span class="lbl" data-stok-lbl>Stok awal</span><input class="input tnum" name="stok" inputmode="numeric" value="0" autocomplete="off"><span class="hint">Dicatat sebagai "Stok awal" di log mutasi stok.</span></label>`}
        <div class="field"><span class="lbl">Status penjualan</span><div class="choice-grid">
          <label class="choice ${!b || b.status === 'Aktif' ? 'on' : ''}"><input type="radio" name="status" value="Aktif" ${!b || b.status === 'Aktif' ? 'checked' : ''}><span><b>Aktif dijual</b><small>Tampil di halaman Kasir</small></span></label>
          <label class="choice ${b && b.status === 'Nonaktif' ? 'on' : ''}"><input type="radio" name="status" value="Nonaktif" ${b && b.status === 'Nonaktif' ? 'checked' : ''}><span><b>Nonaktif</b><small>Disembunyikan dari transaksi</small></span></label></div></div>
        <p class="err-text" data-err role="alert"></p></form>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-save>${I('check', 'ic-sm')} ${b ? 'Simpan Perubahan' : 'Simpan Barang'}</button>`,
      onMount: (el, m) => {
        const f = el.querySelector('[data-form]');
        const money = n => { n.addEventListener('input', () => { const v = U.parseNum(n.value); n.value = v ? U.num(v) : ''; margin(); }); };
        const margin = () => {
          const beli = U.parseNum(f.beli.value), jual = U.parseNum(f.jual.value), mg = jual - beli;
          el.querySelector('[data-margin]').innerHTML = `${I('trend')}<div class="grow row" style="justify-content:space-between"><b>Margin keuntungan:</b><span class="${mg < 0 ? 'danger-text' : ''}" style="font-weight:700">${U.rp(mg)} <span class="caption">(${jual ? (mg / jual * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 }) : 0}% dari harga jual)</span></span></div>`;
        };
        money(f.beli); money(f.jual); margin();
        let dec = false;
        const satuanVal = bindSatuan(f, (v, d) => {
          dec = d;
          if (!f.stok) return;
          f.stok.inputMode = d ? 'decimal' : 'numeric';
          el.querySelector('[data-stok-lbl]').textContent = 'Stok awal (' + v + ')';
          f.stok.value = U.cleanQty(f.stok.value, d) || '0';
        });
        if (f.stok) f.stok.addEventListener('input', () => { f.stok.value = U.cleanQty(f.stok.value, dec); });
        f.querySelectorAll('input[name=status]').forEach(r => r.onchange = () => f.querySelectorAll('.choice').forEach(c => c.classList.toggle('on', c.querySelector('input').checked)));
        f.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); el.querySelector('[data-save]').click(); } });
        el.querySelector('[data-save]').onclick = e => {
          const err = el.querySelector('[data-err]'), data = {
            id: b ? b.id : '', nama: f.nama.value.trim(), barcode: f.barcode.value.trim(), kategori: f.kategori.value, satuan: satuanVal(),
            beli: U.parseNum(f.beli.value), jual: U.parseNum(f.jual.value), stok: f.stok ? U.parseQty(f.stok.value) : 0, status: f.status.value
          };
          f.querySelectorAll('.invalid').forEach(x => x.classList.remove('invalid'));
          if (!data.nama) { f.nama.classList.add('invalid'); f.nama.focus(); err.textContent = 'Nama barang wajib diisi.'; return; }
          if (f.satuanSel.value === '__lain' && !f.satuanLain.value.trim()) { f.satuanLain.classList.add('invalid'); f.satuanLain.focus(); err.textContent = 'Ketik nama satuannya.'; return; }
          if (!(data.beli > 0) || !(data.jual > 0)) { (data.beli > 0 ? f.jual : f.beli).classList.add('invalid'); err.textContent = 'Harga beli dan harga jual wajib diisi lebih dari 0.'; return; }
          busy(e.currentTarget, async () => {
            const r = await API.call('barang.save', data);
            if (!r.success) { err.textContent = r.message; return; }
            App.setKatalog(r.data.katalog); m.close(); Toast.ok(r.message); App.rerender();
          }, 'Menyimpan…');
        };
      }
    });
  },
  async toggle(btn, id) {
    const b = App.state.katalog.barang.find(x => x.id === id), to = b.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    if (to === 'Nonaktif' && !(await Modal.confirm({ title: 'Nonaktifkan barang?', message: `<b>${U.esc(b.nama)}</b> akan disembunyikan dari halaman Kasir. Riwayat transaksinya tetap utuh dan barang bisa diaktifkan lagi kapan saja.`, okText: 'Nonaktifkan' }))) return;
    busy(btn, async () => { const r = await API.call('barang.status', { id, status: to }); if (Toast.res(r)) { App.setKatalog(r.data.katalog); App.rerender(); } }, '');
  },
  export() {
    const rows = [['ID_Barang', 'Barcode', 'Nama_Barang', 'Kategori', 'Satuan', 'Harga_Beli', 'Harga_Jual', 'Stok', 'Status']];
    this.list().forEach(b => rows.push([b.id, b.barcode, b.nama, katName(b.kat), b.satuan, b.beli, b.jual, b.stok, b.status]));
    U.csv(`barang-${U.ymd()}.csv`, rows);
  }
};

/* =================================================================== KATEGORI */
const PageKategori = {
  st: { q: '', status: '' },
  render(view) {
    view.innerHTML = pageHead({
      eyebrow: '<span class="accent">[Master data]</span> / Pengelompokan', title: 'Kategori Barang', tag: 'Master data',
      sub: 'Kelola kelompok barang untuk memudahkan pencarian dan filter di layar kasir.',
      actions: `<button class="btn" data-export>${I('download', 'ic-sm')} Ekspor CSV</button><button class="btn btn-primary" data-new>${I('plus', 'ic-sm')} Tambah Kategori</button>`
    }) + `<div data-top></div>
      <div class="toolbar"><label class="field grow-2"><span class="lbl">Pencarian</span><span class="ig"><span class="adorn">${I('search', 'ic-sm')}</span><input class="input" type="search" data-f="q" placeholder="Cari nama atau ID kategori…" value="${U.esc(this.st.q)}"></span></label>
        <label class="field grow-1"><span class="lbl">Status</span><select class="input" data-f="status"><option value="">Semua (aktif & nonaktif)</option><option ${this.st.status === 'Aktif' ? 'selected' : ''}>Aktif</option><option ${this.st.status === 'Nonaktif' ? 'selected' : ''}>Nonaktif</option></select></label></div>
      <div class="card" data-table></div><div class="card" data-dist></div>`;
    view.querySelector('[data-new]').onclick = () => this.form();
    view.querySelector('[data-export]').onclick = () => {
      const rows = [['ID_Kategori', 'Nama_Kategori', 'Deskripsi', 'Status', 'Jumlah_Barang']];
      this.data().forEach(k => rows.push([k.id, k.nama, k.desk, k.status, k.n]));
      U.csv(`kategori-${U.ymd()}.csv`, rows);
    };
    view.querySelectorAll('[data-f]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', U.debounce(() => { this.st[el.dataset.f] = el.value; this.draw(view); }, 120)));
    view.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.edit) this.form(b.dataset.edit);
      if (b.dataset.toggle) this.toggle(b, b.dataset.toggle);
      if (b.dataset.del) this.del(b, b.dataset.del);
    });
    this.draw(view);
  },
  data() {
    const k = App.state.katalog || { kategori: [], barang: [] };
    return k.kategori.map(c => {
      const items = k.barang.filter(b => b.kat === c.id);
      return { ...c, n: items.length, aktif: items.filter(b => b.status === 'Aktif').length, contoh: items.slice(0, 3).map(b => b.nama) };
    });
  },
  draw(view) {
    const all = this.data(), q = U.norm(this.st.q);
    const list = all.filter(c => (!this.st.status || c.status === this.st.status) && (!q || U.norm(c.nama).includes(q) || c.id.toLowerCase().includes(q)));
    const aktif = all.filter(c => c.status === 'Aktif').length, totalBrg = all.reduce((a, c) => a + c.n, 0);
    view.querySelector('[data-top]').innerHTML = `<section class="stats stats-kat">
      ${statCard({ label: 'Kategori terdaftar', value: U.num(all.length), icon: 'layers', foot: `<span class="accent">Aktif: ${aktif} | Nonaktif: ${all.length - aktif}</span>` })}
      ${statCard({ label: 'Total barang terikat', value: U.num(totalBrg), small: 'barang', icon: 'box' })}
      <div class="notice info">${I('info')}<div><b>Integritas data transaksi terjaga.</b><br>Kategori yang masih dipakai barang aktif tidak dapat dinonaktifkan, dan kategori yang masih tercatat pada barang tidak dapat dihapus — cukup ganti nama atau pindahkan barangnya.</div></div></section>`;
    view.querySelector('[data-table]').innerHTML = !all.length
      ? View.empty('tag', 'Belum ada kategori', 'Tambahkan kategori pertama, misalnya Beras, Minyak Goreng, atau Gula.')
      : !list.length ? View.empty('search', 'Tidak ada kategori yang cocok')
      : `<div class="table-wrap"><table class="tbl tbl-cards"><thead><tr><th class="col-lg">ID kategori</th><th>Nama kategori</th><th class="num">Jumlah barang</th><th class="col-md">Contoh barang</th><th>Status</th><th class="num">Aksi</th></tr></thead><tbody>
        ${list.map(c => `<tr><td class="mono accent nowrap col-lg"><b>${U.esc(c.id)}</b></td><td><b>${U.esc(c.nama)}</b><span class="mono caption only-lg"> · ${U.esc(c.id)}</span>${c.desk ? `<span class="sub" style="font-family:var(--font)">${U.esc(c.desk)}</span>` : ''}</td>
          <td class="num"><b>${U.num(c.n)}</b> <span class="caption">(${c.aktif} aktif)</span></td><td data-hide-sm class="caption col-md"><span class="clamp2">${U.esc(c.contoh.join(', ') || '-')}</span></td>
          <td>${View.pill(c.status)}</td>
          <td><div class="act"><button class="btn btn-sm" data-edit="${U.esc(c.id)}">${I('pencil', 'ic-sm')} Edit</button>
            <button class="btn btn-sm btn-ghost" data-toggle="${U.esc(c.id)}" ${c.status === 'Aktif' && c.aktif ? 'disabled title="Masih dipakai barang aktif"' : ''}>${c.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}</button>
            ${c.n ? `<button class="icon-btn" style="width:32px;height:32px" disabled title="Dipakai oleh ${c.n} barang — tidak bisa dihapus" aria-label="Tidak bisa dihapus: dipakai ${c.n} barang">${I('lock', 'ic-sm')}</button>`
              : `<button class="icon-btn" style="width:32px;height:32px;color:var(--danger)" data-del="${U.esc(c.id)}" aria-label="Hapus kategori ${U.esc(c.nama)}">${I('trash', 'ic-sm')}</button>`}</div></td></tr>`).join('')}
        </tbody></table></div><div class="card-foot"><span>Menampilkan ${list.length} dari ${all.length} kategori</span></div>`;
    const withItems = all.filter(c => c.n).sort((a, b) => b.n - a.n);
    view.querySelector('[data-dist]').innerHTML = withItems.length ? `<div class="card-head"><div><h2>Distribusi barang per kategori</h2><span class="caption">Proporsi jumlah barang di setiap kategori</span></div><span class="pill pill-ok">${U.num(totalBrg)} total barang</span></div>
      <div class="card-body stack-sm"><div class="distbar" role="img" aria-label="Distribusi barang per kategori">${withItems.map((c, i) => `<span title="${U.esc(c.nama)}: ${c.n}" style="width:${c.n / totalBrg * 100}%;background:color-mix(in srgb, var(--accent) ${100 - i * (70 / Math.max(1, withItems.length - 1))}%, #fff)"></span>`).join('')}</div>
      <div class="legend">${withItems.map((c, i) => `<span><i style="background:color-mix(in srgb, var(--accent) ${100 - i * (70 / Math.max(1, withItems.length - 1))}%, #fff)"></i>${U.esc(c.nama)} (${(c.n / totalBrg * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%)</span>`).join('')}</div></div>` : '';
    view.querySelector('[data-dist]').hidden = !withItems.length;
  },
  form(id) {
    const k = id ? App.state.katalog.kategori.find(x => x.id === id) : null;
    const nextId = () => { let m = 0; App.state.katalog.kategori.forEach(c => { const x = c.id.match(/^KAT-(\d+)$/); if (x) m = Math.max(m, +x[1]); }); return 'KAT-' + String(m + 1).padStart(3, '0'); };
    Modal.open({
      title: k ? 'Edit Kategori' : 'Tambah Kategori Baru', icon: I('tag'), size: 'sm',
      body: `<form class="stack" data-form novalidate>
        <div class="field"><div class="lbl-row"><span class="lbl">ID kategori</span><span class="caption mono">[Otomatis]</span></div><div class="ig"><span class="pre">#</span><input class="input mono accent" value="${k ? U.esc(k.id) : nextId()}" readonly style="font-weight:700"></div></div>
        <label class="field"><span class="lbl">Nama kategori <span class="req">*</span></span><input class="input" name="nama" maxlength="60" value="${k ? U.esc(k.nama) : ''}" placeholder="Contoh: Sabun & Pembersih Rumah"><span class="hint">Nama ini tampil sebagai tombol filter di layar kasir.</span></label>
        <label class="field"><span class="lbl">Deskripsi singkat (opsional)</span><textarea class="input" name="desk" maxlength="200" placeholder="Keterangan jenis barang dalam kelompok ini…">${k ? U.esc(k.desk) : ''}</textarea></label>
        <div class="field"><span class="lbl">Status operasional</span><div class="choice-grid">
          <label class="choice ${!k || k.status === 'Aktif' ? 'on' : ''}"><input type="radio" name="status" value="Aktif" ${!k || k.status === 'Aktif' ? 'checked' : ''}><span><b>Aktif</b><small>Tampil di kasir</small></span></label>
          <label class="choice ${k && k.status === 'Nonaktif' ? 'on' : ''}"><input type="radio" name="status" value="Nonaktif" ${k && k.status === 'Nonaktif' ? 'checked' : ''}><span><b>Nonaktif</b><small>Disembunyikan sementara</small></span></label></div></div>
        <p class="err-text" data-err role="alert"></p></form>`,
      foot: `<span class="hint">[Esc] Batal | [Enter] Simpan</span><button class="btn" data-close>Batal</button><button class="btn btn-primary" data-save>${I('check', 'ic-sm')} Simpan Kategori</button>`,
      onMount: (el, m) => {
        const f = el.querySelector('[data-form]');
        f.querySelectorAll('input[name=status]').forEach(r => r.onchange = () => f.querySelectorAll('.choice').forEach(c => c.classList.toggle('on', c.querySelector('input').checked)));
        f.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); el.querySelector('[data-save]').click(); } });
        el.querySelector('[data-save]').onclick = e => {
          const err = el.querySelector('[data-err]'), data = { id: k ? k.id : '', nama: f.nama.value.trim(), desk: f.desk.value.trim(), status: f.status.value };
          if (!data.nama) { f.nama.classList.add('invalid'); f.nama.focus(); err.textContent = 'Nama kategori wajib diisi.'; return; }
          busy(e.currentTarget, async () => {
            const r = await API.call('kategori.save', data);
            if (!r.success) { err.textContent = r.message; return; }
            App.setKatalog(r.data.katalog); m.close(); Toast.ok(r.message); App.rerender();
          }, 'Menyimpan…');
        };
      }
    });
  },
  toggle(btn, id) {
    const k = App.state.katalog.kategori.find(x => x.id === id), to = k.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    busy(btn, async () => { const r = await API.call('kategori.status', { id, status: to }); if (Toast.res(r)) { App.setKatalog(r.data.katalog); App.rerender(); } }, '');
  },
  async del(btn, id) {
    const k = App.state.katalog.kategori.find(x => x.id === id);
    if (!(await Modal.confirm({ title: 'Hapus kategori?', message: `Kategori <b>${U.esc(k.nama)}</b> akan dihapus permanen.`, okText: 'Hapus', danger: true }))) return;
    busy(btn, async () => { const r = await API.call('kategori.delete', { id }); if (Toast.res(r)) { App.setKatalog(r.data.katalog); App.rerender(); } }, '');
  }
};

/* =================================================================== STOK */
const PageStok = {
  st: { tab: 'stok', q: '', kat: '', kondisi: '', page: 1, log: { from: '', to: '', jenis: '', q: '', page: 1 } },
  render(view) {
    const s = this.st;
    view.innerHTML = pageHead({
      eyebrow: '<span class="accent">[Inventori]</span> / Mutasi barang', title: 'Manajemen Stok &amp; Log Mutasi',
      sub: 'Pantau jumlah stok, catat stok masuk dari pemasok, dan sesuaikan dengan hitung fisik (opname).',
      actions: `<button class="btn" data-adj="Penyesuaian">${I('clipboard', 'ic-sm')} Penyesuaian Stok (Opname)</button><button class="btn btn-primary" data-adj="Penambahan">${I('plus', 'ic-sm')} Tambah Stok Masuk</button>`
    }) + `<section class="stats" data-stats></section>
      <div class="card"><div class="tabs" role="tablist">
        <button class="tab" role="tab" data-tab="stok" aria-selected="${s.tab === 'stok'}">${I('box', 'ic-sm')} Stok Saat Ini <span class="pill pill-ok" data-count></span></button>
        <button class="tab" role="tab" data-tab="log" aria-selected="${s.tab === 'log'}">${I('history', 'ic-sm')} Log Mutasi Stok</button></div>
        <div data-pane></div></div>
      <div class="card" data-recent ${s.tab === 'log' ? 'hidden' : ''}></div>`;
    view.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.adj) this.openAdjust(b.dataset.id || '', b.dataset.adj);
      if (b.dataset.tab) { s.tab = b.dataset.tab; App.rerender(); }
      if (b.dataset.exportStok !== undefined) this.exportStok();
      if (b.dataset.retry !== undefined) this.drawPane(view);
    });
    this.draw(view);
  },
  batas() { return Number((App.state.settings || {}).Batas_Stok_Menipis || 5); },
  draw(view) {
    const brg = ((App.state.katalog || {}).barang || []).filter(b => b.status === 'Aktif'), batas = this.batas();
    const habis = brg.filter(b => b.stok <= 0).length, tipis = brg.filter(b => b.stok > 0 && b.stok <= batas).length;
    view.querySelector('[data-stats]').innerHTML =
      statCard({ label: 'Jenis barang aktif', value: U.num(brg.length), small: 'jenis', icon: 'box', foot: '<span>Semua barang yang dijual</span>' }) +
      statCard({ label: 'Stok aman', value: U.num(brg.length - habis - tipis), valCls: 'accent', pill: '<span class="pill pill-ok">Normal</span>', foot: `<span>Stok di atas ${batas}</span><span>${brg.length ? Math.round((brg.length - habis - tipis) / brg.length * 100) : 0}% barang</span>` }) +
      statCard({ label: 'Stok menipis', value: U.num(tipis), pill: tipis ? '<span class="pill pill-warn">Perlu order</span>' : '', foot: `<span>Stok 1–${batas}</span><span>Segera pesan ke pemasok</span>` }) +
      statCard({ label: 'Stok habis', value: U.num(habis), valCls: habis ? 'danger-text' : '', alert: habis > 0, pill: habis ? '<span class="pill pill-danger">Restok</span>' : '', foot: `<span class="${habis ? 'danger-text' : ''}">${habis ? habis + ' barang tidak bisa dijual' : 'Tidak ada barang kosong'}</span>` });
    view.querySelector('[data-count]').textContent = U.num(brg.length);
    this.drawPane(view);
  },
  drawPane(view) {
    const pane = view.querySelector('[data-pane]'), s = this.st;
    if (s.tab === 'log') return this.drawLog(view, pane);
    const kats = (App.state.katalog || {}).kategori || [];
    if (!pane.querySelector('[data-stok-tb]')) {
      pane.innerHTML = `<div class="toolbar" style="border:0;border-bottom:1px solid var(--divider)" data-stok-tb>
        <label class="field grow-2"><span class="lbl">Pencarian</span><span class="ig"><span class="adorn">${I('search', 'ic-sm')}</span><input class="input" type="search" data-f="q" placeholder="Cari nama / kode / barcode…" value="${U.esc(s.q)}"></span></label>
        <label class="field grow-1"><span class="lbl">Kategori</span><select class="input" data-f="kat"><option value="">Semua kategori</option>${kats.map(k => `<option value="${U.esc(k.id)}" ${s.kat === k.id ? 'selected' : ''}>${U.esc(k.nama)}</option>`).join('')}</select></label>
        <label class="field grow-1"><span class="lbl">Kondisi</span><select class="input" data-f="kondisi"><option value="">Semua kondisi</option>${['Tersedia', 'Menipis', 'Habis'].map(x => `<option ${s.kondisi === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <button class="icon-btn" data-export-stok aria-label="Unduh daftar stok (CSV)" title="Unduh CSV">${I('download')}</button></div><div data-stok-tbl></div>`;
      pane.querySelectorAll('[data-f]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', U.debounce(() => { s[el.dataset.f] = el.value; s.page = 1; this.drawStokTable(view); }, 120)));
      Pager.bind(pane, p => { s.page = p; this.drawStokTable(view); });
    }
    this.drawStokTable(view);
    this.drawRecent(view);
  },
  stokList() {
    const s = this.st, q = U.norm(s.q), batas = this.batas();
    return ((App.state.katalog || {}).barang || []).filter(b => b.status === 'Aktif')
      .filter(b => (!s.kat || b.kat === s.kat) && (!s.kondisi || View.stokStatus(b, batas) === s.kondisi) && (!q || U.norm(b.nama).includes(q) || b.id.toLowerCase().includes(q) || (b.barcode || '').includes(q)))
      .sort((a, b) => a.stok - b.stok || a.nama.localeCompare(b.nama, 'id'));
  },
  drawStokTable(view) {
    const batas = this.batas(), p = Pager.local(this.stokList(), this.st.page, 15), box = view.querySelector('[data-stok-tbl]');
    this.st.page = p.page;
    box.innerHTML = !p.total ? View.empty('box', 'Tidak ada barang', 'Ubah filter atau tambahkan barang di menu Barang.') : `<div class="table-wrap"><table class="tbl tbl-cards"><thead><tr>
      <th class="col-lg">Kode</th><th>Nama barang</th><th class="col-lg">Kategori</th><th class="num">Stok saat ini</th><th class="num col-lg">Nilai modal</th><th>Status</th><th class="num">Aksi cepat</th></tr></thead><tbody>
      ${p.rows.map(b => { const st = View.stokStatus(b, batas), out = st === 'Habis'; return `<tr class="${out ? 'row-danger' : ''}">
        <td class="mono nowrap col-lg ${out ? 'danger-text' : ''}"><b>${U.esc(b.id)}</b></td><td><span class="nm" style="font-weight:600">${U.esc(b.nama)}</span><span class="sub"><span class="only-lg">${U.esc(b.id)}${b.barcode ? ' · ' : ''}</span>${U.esc(b.barcode)}</span></td>
        <td data-hide-sm class="col-lg">${U.esc(katName(b.kat))}</td><td class="num nowrap"><b class="stock-big ${out ? 'danger-text' : ''}">${U.qty(b.stok)}</b> <span class="caption">${U.esc(b.satuan)}</span></td>
        <td class="num col-lg" data-hide-sm>${U.rp(Math.round(Math.max(0, b.stok) * b.beli))}</td><td>${View.pill(st === 'Habis' ? 'Stok Habis' : st)}</td>
        <td><div class="act">${out ? `<button class="btn btn-sm btn-danger-solid" data-adj="Penambahan" data-id="${U.esc(b.id)}">${I('plus', 'ic-sm')} Restok cepat</button>`
          : `<button class="btn btn-sm btn-primary" data-adj="Penambahan" data-id="${U.esc(b.id)}">${I('plus', 'ic-sm')} Tambah stok</button>`}
          <button class="btn btn-sm" data-adj="Penyesuaian" data-id="${U.esc(b.id)}">Sesuaikan</button></div></td></tr>`; }).join('')}
      </tbody></table></div>${Pager.html(p, 'jenis barang')}`;
  },
  async drawRecent(view) {
    const box = view.querySelector('[data-recent]'); if (!box || box.hidden) return;
    box.innerHTML = `<div class="card-head"><h2>${I('history')} Log perubahan stok terakhir</h2><span class="eyebrow">8 mutasi terkini</span></div>` + View.loading();
    const r = await API.call('stok.log', { limit: 10, size: 8 });
    if (!box.isConnected) return;
    box.innerHTML = `<div class="card-head"><h2>${I('history')} Log perubahan stok terakhir</h2><button class="btn btn-sm" data-tab="log">Lihat semua log ${I('arrowR', 'ic-sm')}</button></div>` +
      (!r.success ? `<div class="card-body">${errBox(r.message)}</div>` : !r.data.rows.length ? View.empty('history', 'Belum ada mutasi stok') : this.logTable(r.data.rows));
  },
  logTable(rows) {
    const color = j => j === 'Penambahan' ? 'accent' : j === 'Penyesuaian' ? 'danger-text' : 'muted';
    return `<div class="table-wrap"><table class="tbl tbl-cards"><thead><tr><th>Waktu</th><th>Barang</th><th>Jenis / referensi</th><th class="num">Perubahan</th><th class="num">Sisa stok</th></tr></thead><tbody>
      ${rows.map(l => `<tr><td class="nowrap caption">${U.tgl(l.w)}</td><td><b>${U.esc(l.nama)}</b><span class="sub">${U.esc(l.id)}</span></td>
        <td data-hide-sm><span class="dotlbl ${color(l.jenis)}">${U.esc(l.jenis)}</span> <span class="caption">${U.esc(l.ket)}</span></td>
        <td class="num"><b class="${l.ubah > 0 ? 'accent' : 'danger-text'}">${l.ubah > 0 ? '+' : ''}${U.qty(l.ubah)}</b></td><td class="num"><b>${U.qty(l.sesudah)}</b></td></tr>`).join('')}
      </tbody></table></div>`;
  },
  drawLog(view, pane) {
    const L = this.st.log;
    pane.innerHTML = `<form class="toolbar" style="border:0;border-bottom:1px solid var(--divider)" data-log-f>
        <label class="field grow-1"><span class="lbl">Dari</span><input class="input" type="date" name="from" value="${L.from}"></label>
        <label class="field grow-1"><span class="lbl">Sampai</span><input class="input" type="date" name="to" value="${L.to}"></label>
        <label class="field grow-1"><span class="lbl">Jenis</span><select class="input" name="jenis"><option value="">Semua jenis</option>${['Penjualan', 'Penambahan', 'Penyesuaian'].map(j => `<option ${L.jenis === j ? 'selected' : ''}>${j}</option>`).join('')}</select></label>
        <label class="field grow-2"><span class="lbl">Cari barang / keterangan</span><input class="input" type="search" name="q" value="${U.esc(L.q)}" placeholder="Contoh: beras, supplier"></label>
        <button class="btn btn-primary" type="submit">${I('filter', 'ic-sm')} Terapkan</button></form><div data-log-tbl>${View.loading()}</div>`;
    const f = pane.querySelector('[data-log-f]');
    f.onsubmit = e => { e.preventDefault(); const fd = new FormData(f); Object.assign(L, { from: fd.get('from'), to: fd.get('to'), jenis: fd.get('jenis'), q: fd.get('q'), page: 1 }); this.loadLog(view); };
    Pager.bind(pane.querySelector('[data-log-tbl]'), p => { L.page = p; this.loadLog(view); });
    this.loadLog(view);
  },
  async loadLog(view) {
    const L = this.st.log, box = view.querySelector('[data-log-tbl]');
    box.style.opacity = '.6';
    const r = await API.call('stok.log', { from: L.from, to: L.to, jenis: L.jenis, q: L.q, page: L.page, limit: 500 });
    if (!box.isConnected) return;
    box.style.opacity = '';
    box.innerHTML = !r.success ? `<div class="card-body">${errBox(r.message)}</div>` : !r.data.total
      ? View.empty('history', 'Tidak ada mutasi', L.from || L.to ? 'Ubah rentang tanggal.' : 'Tanpa filter tanggal, ditampilkan 500 mutasi terakhir.')
      : this.logTable(r.data.rows) + Pager.html(r.data, 'mutasi') + (!L.from && !L.to ? `<p class="caption" style="padding:0 16px 12px">Tanpa filter tanggal, ditampilkan 500 mutasi terakhir. Isi tanggal untuk melihat yang lebih lama.</p>` : '');
  },
  exportStok() {
    const rows = [['ID_Barang', 'Barcode', 'Nama_Barang', 'Kategori', 'Stok', 'Satuan', 'Harga_Beli', 'Nilai_Modal', 'Status_Stok']], batas = this.batas();
    this.stokList().forEach(b => rows.push([b.id, b.barcode, b.nama, katName(b.kat), String(b.stok).replace('.', ','), b.satuan, b.beli, Math.round(Math.max(0, b.stok) * b.beli), View.stokStatus(b, batas)]));
    U.csv(`stok-${U.ymd()}.csv`, rows);
  },
  /** Modal tambah stok / penyesuaian — dipakai juga dari Dashboard & Barang. */
  openAdjust(id, jenis) {
    const brg = ((App.state.katalog || {}).barang || []).filter(b => b.status === 'Aktif').sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
    if (!brg.length) return Toast.err('Belum ada barang aktif.');
    jenis = jenis === 'Penyesuaian' ? 'Penyesuaian' : 'Penambahan';
    Modal.open({
      title: jenis === 'Penyesuaian' ? 'Penyesuaian Stok (Opname)' : 'Tambah Stok Masuk', icon: I(jenis === 'Penyesuaian' ? 'clipboard' : 'stock'),
      body: `<form class="stack" data-form novalidate>
        <label class="field"><span class="lbl">Pilih barang <span class="req">*</span></span>
          <input class="input" type="search" data-find placeholder="Ketik untuk menyaring daftar barang…" autocomplete="off">
          <select class="input" name="id" size="5" style="height:auto;padding:4px 0">${brg.map(b => `<option value="${U.esc(b.id)}" ${b.id === id ? 'selected' : ''}>${U.esc(b.id)} — ${U.esc(b.nama)} (stok ${U.qty(b.stok)} ${U.esc(b.satuan)})</option>`).join('')}</select></label>
        <div class="field"><span class="lbl">Jenis mutasi</span><div class="choice-grid">
          <label class="choice"><input type="radio" name="jenis" value="Penambahan" ${jenis === 'Penambahan' ? 'checked' : ''}><span><b>Penambahan</b><small>Barang masuk dari pemasok</small></span></label>
          <label class="choice"><input type="radio" name="jenis" value="Penyesuaian" ${jenis === 'Penyesuaian' ? 'checked' : ''}><span><b>Penyesuaian (opname)</b><small>Samakan dengan hitung fisik</small></span></label></div></div>
        <label class="field"><span class="lbl" data-qlbl>Jumlah</span><span class="ig"><input class="input input-lg tnum" name="qty" inputmode="numeric" placeholder="Masukkan jumlah…" autocomplete="off"><span class="pre" data-qsat>pcs</span></span><span class="hint" data-qhint></span></label>
        <div class="notice" data-prev></div>
        <label class="field"><span class="lbl">Keterangan (opsional)</span><input class="input" name="ket" maxlength="200" placeholder="Contoh: Supplier CV Berkah / stok opname bulanan / kemasan rusak"></label>
        <p class="err-text" data-err role="alert"></p></form>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-save>${I('check', 'ic-sm')} Simpan</button>`,
      onMount: (el, m) => {
        const f = el.querySelector('[data-form]'), sel = f.id;
        if (!sel.value) sel.selectedIndex = 0;
        const upd = () => {
          const j = f.jenis.value, b = brg.find(x => x.id === sel.value), q = U.parseQty(f.qty.value);
          f.querySelectorAll('.choice').forEach(c => c.classList.toggle('on', c.querySelector('input').checked));
          el.querySelector('[data-qlbl]').textContent = j === 'Penambahan' ? 'Jumlah stok masuk' : 'Stok hasil hitung fisik';
          el.querySelector('h2').textContent = j === 'Penyesuaian' ? 'Penyesuaian Stok (Opname)' : 'Tambah Stok Masuk';
          if (!b) { el.querySelector('[data-prev]').innerHTML = 'Pilih barang terlebih dahulu.'; return; }
          const dec = U.desimal(b.satuan);
          f.qty.inputMode = dec ? 'decimal' : 'numeric';
          el.querySelector('[data-qsat]').textContent = b.satuan;
          el.querySelector('[data-qhint]').textContent = dec ? `Boleh pecahan, contoh 12,5 ${b.satuan}.` : '';
          const after = Math.round((j === 'Penambahan' ? b.stok + q : q) * 1000) / 1000, d = Math.round((after - b.stok) * 1000) / 1000;
          el.querySelector('[data-prev]').innerHTML = `${I('stock')}<div class="grow"><b>${U.esc(b.nama)}</b><br>Stok tercatat <b>${U.qty(b.stok)} ${U.esc(b.satuan)}</b>${f.qty.value !== '' ? ` → <b>${U.qty(after)} ${U.esc(b.satuan)}</b> <span class="${d >= 0 ? 'accent' : 'danger-text'}" style="font-weight:700">(${d >= 0 ? '+' : ''}${U.qty(d)})</span>` : ''}</div>`;
        };
        el.querySelector('[data-find]').addEventListener('input', e => {
          const q = U.norm(e.target.value);
          Array.from(sel.options).forEach(o => { o.hidden = !!q && !U.norm(o.textContent).includes(q); });
          const first = Array.from(sel.options).find(o => !o.hidden); if (first) sel.value = first.value; upd();
        });
        const curDec = () => { const b = brg.find(x => x.id === sel.value); return !!b && U.desimal(b.satuan); };
        sel.onchange = () => { f.qty.value = U.cleanQty(f.qty.value, curDec()); upd(); }; f.jenis.forEach(r => r.onchange = upd);
        f.qty.addEventListener('input', () => { f.qty.value = U.cleanQty(f.qty.value, curDec()); upd(); });
        f.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.name === 'qty') { e.preventDefault(); el.querySelector('[data-save]').click(); } });
        upd();
        setTimeout(() => (id ? f.qty : el.querySelector('[data-find]')).focus(), 60);
        el.querySelector('[data-save]').onclick = e => {
          const err = el.querySelector('[data-err]'), data = { id: sel.value, jenis: f.jenis.value, qty: U.parseQty(f.qty.value), keterangan: f.ket.value.trim() };
          if (!data.id) { err.textContent = 'Pilih barang.'; return; }
          if (f.qty.value === '' || (data.jenis === 'Penambahan' && !(data.qty > 0))) { f.qty.classList.add('invalid'); f.qty.focus(); err.textContent = data.jenis === 'Penambahan' ? 'Jumlah stok masuk harus lebih dari 0.' : 'Isi stok hasil hitung fisik.'; return; }
          busy(e.currentTarget, async () => {
            const r = await API.call('stok.adjust', data);
            if (!r.success) { err.textContent = r.message; return; }
            App.setKatalog(r.data.katalog); m.close(); Toast.ok(r.message); Store.del('dash'); App.rerender();
          }, 'Menyimpan…');
        };
      }
    });
  }
};

/* =================================================================== LAPORAN */
const PageLaporan = {
  st: { mode: 'bulanan', bulan: U.ym(), tanggal: U.ymd(), q: '', barang: '', from: '', to: '', page: 1 },
  data: null,
  async render(view) {
    const s = this.st;
    view.innerHTML = pageHead({
      eyebrow: '<span class="accent">[Analitik]</span> / Kinerja penjualan', title: 'Laporan Penjualan',
      sub: 'Omzet, jumlah transaksi, dan keuntungan harian maupun bulanan.',
      actions: `<button class="btn" data-pdf>${I('file', 'ic-sm')} Unduh PDF</button><button class="btn" data-print>${I('printer', 'ic-sm')} Cetak</button>`
    }) + `<form class="toolbar" data-ctl>
        <div class="field"><span class="lbl">Periode</span><div class="seg" style="min-width:220px" role="group" aria-label="Jenis periode"><button type="button" data-mode="harian" aria-pressed="${s.mode === 'harian'}">Harian</button><button type="button" data-mode="bulanan" aria-pressed="${s.mode === 'bulanan'}">Bulanan</button></div></div>
        <label class="field grow-1" data-when></label>
        <button class="btn btn-primary" type="submit">${I('filter', 'ic-sm')} Terapkan</button>
        <span class="grow"></span><span class="caption" data-made></span></form>
      <div data-body class="stack">${View.loading('Menyusun laporan…')}</div>`;
    const ctl = view.querySelector('[data-ctl]');
    const when = () => {
      ctl.querySelector('[data-when]').innerHTML = s.mode === 'harian'
        ? `<span class="lbl">Tanggal</span><input class="input" type="date" name="tanggal" value="${s.tanggal}" max="${U.ymd()}">`
        : `<span class="lbl">Bulan</span><input class="input" type="month" name="bulan" value="${s.bulan}" max="${U.ym()}">`;
      ctl.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === s.mode)));
    };
    when();
    ctl.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { s.mode = b.dataset.mode; when(); });
    ctl.onsubmit = e => {
      e.preventDefault();
      if (s.mode === 'harian') s.tanggal = ctl.tanggal.value || U.ymd(); else s.bulan = ctl.bulan.value || U.ym();
      Object.assign(s, { q: '', barang: '', from: '', to: '', page: 1 });
      this.load(view, true);
    };
    view.querySelector('[data-print]').onclick = () => this.print(false);
    view.querySelector('[data-pdf]').onclick = () => this.print(true);
    view.addEventListener('click', e => { if (e.target.closest('[data-retry]')) this.load(view, true); });
    await this.load(view, true);
  },
  params() { const s = this.st; return { mode: s.mode, bulan: s.bulan, tanggal: s.tanggal, q: s.q, barang: s.barang, from: s.from, to: s.to, page: s.page }; },
  async load(view, full) {
    const body = view.querySelector('[data-body]');
    if (full) body.innerHTML = View.loading('Menyusun laporan…'); else { const t = body.querySelector('[data-tbl]'); if (t) t.style.opacity = '.6'; }
    const r = await API.call('laporan', this.params());
    if (!view.isConnected) return;
    if (!r.success) { body.innerHTML = errBox(r.message); return; }
    this.data = r.data;
    view.querySelector('[data-made]').textContent = 'Data per ' + U.tgl(r.data.dibuat);
    if (full || !body.querySelector('[data-tbl]')) this.drawAll(view); else this.drawTable(view);
  },
  label() {
    const d = this.data, ym = d.bulan;
    return d.mode === 'harian' ? U.tgl(this.st.tanggal, false) : U.BULAN_PANJANG[+ym.slice(4) - 1] + ' ' + ym.slice(0, 4);
  },
  charts(d, compact) {
    const day = d.mode === 'harian' ? Number(d.dari.slice(6, 8)) - 1 : -1;
    const nowYm = U.ym().replace('-', ''), upto = d.bulan.slice(0, 4) === nowYm.slice(0, 4) ? Number(nowYm.slice(4)) - 1 : 11;
    const bar = Charts.bar(d.harian.map(h => h.omzet), { labels: d.harian.map(h => String(h.hari)), highlight: day, height: compact ? 200 : 240,
      title: 'Grafik batang omzet harian', tip: (i, v) => `${d.harian[i].hari} ${U.BULAN[+d.bulan.slice(4) - 1]}: ${U.rp(v)} · ${d.harian[i].trx} transaksi` });
    const line = Charts.line([{ values: d.tren.map(t => t.omzet), cls: 'line' }, { values: d.tren.map(t => t.untung), cls: 'line2' }],
      { labels: U.BULAN, upto, highlight: +d.bulan.slice(4) - 1, height: compact ? 200 : 240, title: 'Grafik garis tren omzet bulanan' });
    return { bar, line };
  },
  drawAll(view) {
    const d = this.data, a = d.ringkasan, ch = this.charts(d);
    const opts = ((App.state.katalog || {}).barang || []).slice().sort((x, y) => x.nama.localeCompare(y.nama, 'id'));
    view.querySelector('[data-body]').innerHTML = `
      <section class="stats three">
        ${statCard({ label: 'Total omzet', value: U.rp(a.omzet), icon: 'money', foot: `<span>${U.esc(this.label())}</span><span>Rata-rata ${U.rp(a.rata)} / nota</span>` })}
        ${statCard({ label: 'Jumlah transaksi', value: U.num(a.trx), small: 'nota', icon: 'receipt', foot: `<span>${U.qty(a.item)} item terjual</span><span>${a.itemPerTrx.toLocaleString('id-ID')} item / nota</span>` })}
        ${statCard({ label: 'Total keuntungan', value: U.rp(a.untung), valCls: 'accent', icon: 'trend', foot: `<span>Margin ${a.margin.toLocaleString('id-ID')}% dari omzet</span>` })}
      </section>
      <section class="grid-2">
        <div class="card"><div class="card-head"><div><h2>Penjualan harian dalam bulan</h2><span class="caption">${U.BULAN_PANJANG[+d.bulan.slice(4) - 1]} ${d.bulan.slice(0, 4)} · omzet per tanggal</span></div></div><div class="card-body">${ch.bar}</div></div>
        <div class="card"><div class="card-head"><div><h2>Tren omzet bulanan</h2><span class="caption">Tahun ${d.bulan.slice(0, 4)}</span></div><div class="legend"><span><i></i>Omzet</span><span><i class="dash"></i>Keuntungan</span></div></div><div class="card-body">${ch.line}</div></div>
      </section>
      <div class="card" data-tbl-card>
        <div class="card-head"><div><h2><span class="sq"></span>Rincian penjualan per barang</h2><span class="caption">${U.esc(this.label())}</span></div><button class="btn btn-sm" data-csv>${I('download', 'ic-sm')} Ekspor CSV</button></div>
        <form class="toolbar" style="border:0;border-bottom:1px solid var(--divider)" data-tf>
          <label class="field grow-2"><span class="lbl">Cari transaksi / barang</span><span class="ig"><span class="adorn">${I('search', 'ic-sm')}</span><input class="input" type="search" name="q" placeholder="Masukkan kata kunci…" value="${U.esc(this.st.q)}"></span></label>
          ${d.mode === 'bulanan' ? `<label class="field grow-1"><span class="lbl">Dari tanggal</span><input class="input" type="date" name="from" min="${this.iso(d.dari)}" max="${this.iso(d.sampai)}" value="${this.st.from}"></label>
            <label class="field grow-1"><span class="lbl">Sampai tanggal</span><input class="input" type="date" name="to" min="${this.iso(d.dari)}" max="${this.iso(d.sampai)}" value="${this.st.to}"></label>` : ''}
          <label class="field grow-1"><span class="lbl">Nama barang</span><select class="input" name="barang"><option value="">Semua barang</option>${opts.map(b => `<option value="${U.esc(b.id)}" ${this.st.barang === b.id ? 'selected' : ''}>${U.esc(b.nama)}</option>`).join('')}</select></label>
          <button class="btn btn-primary" type="submit">Terapkan</button></form>
        <div data-tbl></div></div>`;
    const tf = view.querySelector('[data-tf]');
    tf.onsubmit = e => { e.preventDefault(); const fd = new FormData(tf); Object.assign(this.st, { q: fd.get('q') || '', barang: fd.get('barang') || '', from: fd.get('from') || '', to: fd.get('to') || '', page: 1 }); this.load(view, false); };
    tf.barang.onchange = () => tf.requestSubmit();
    Pager.bind(view.querySelector('[data-tbl-card]'), p => { this.st.page = p; this.load(view, false); });
    view.querySelector('[data-csv]').onclick = e => busy(e.currentTarget, () => this.exportCsv(), 'Menyiapkan…');
    this.drawTable(view);
  },
  iso(dk) { return `${dk.slice(0, 4)}-${dk.slice(4, 6)}-${dk.slice(6, 8)}`; },
  drawTable(view) {
    const t = this.data.tabel, box = view.querySelector('[data-tbl]');
    box.style.opacity = '';
    box.innerHTML = !t.total ? View.empty('chart', 'Tidak ada penjualan', 'Belum ada transaksi yang cocok pada periode atau filter ini.') : `<div class="table-wrap"><table class="tbl tbl-cards"><thead><tr><th>Tanggal</th><th class="col-lg">ID transaksi</th><th>Barang</th><th class="num">Qty</th><th class="num">Total</th><th class="num">Untung</th><th>Metode</th></tr></thead><tbody>
      ${t.rows.map(r => `<tr><td class="nowrap">${U.tglPendek(r.w)}</td><td class="mono nowrap col-lg" data-hide-sm>${U.esc(r.id)}</td><td><b>${U.esc(r.nama)}</b></td><td class="num">${U.qty(r.qty)}</td>
        <td class="num">${U.rp(r.total)}</td><td class="num accent">${U.rp(r.untung)}</td><td>${View.metode(r.metode)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="col-lg"></td><td>${U.num(t.total)} baris sesuai filter</td><td class="num">${U.qty(t.sum.qty)}</td><td class="num">${U.rp(t.sum.total)}</td><td class="num accent">${U.rp(t.sum.untung)}</td><td></td></tr></tfoot></table></div>
      ${Pager.html(t, 'baris')}`;
  },
  async exportCsv() {
    const r = await API.call('laporan', { ...this.params(), page: 1, size: 20000 });
    if (!r.success) return Toast.err(r.message);
    const rows = [['Tanggal_Waktu', 'ID_Transaksi', 'ID_Barang', 'Nama_Barang', 'Qty', 'Harga', 'Total', 'Untung', 'Metode_Bayar']];
    r.data.tabel.rows.forEach(x => rows.push([x.w, x.id, x.barang, x.nama, String(x.qty).replace('.', ','), x.harga, x.total, x.untung, x.metode]));
    U.csv(`laporan-${this.data.mode}-${this.data.dari}${this.data.mode === 'bulanan' ? '-' + this.data.sampai : ''}.csv`, rows);
  },
  print(pdf) {
    const d = this.data; if (!d) return;
    const s = App.state.settings || {}, a = d.ringkasan, ch = this.charts(d, true), name = s.Nama_Toko || s.Nama_Aplikasi || 'KasirMart';
    const judul = d.mode === 'harian' ? 'Laporan Penjualan Harian' : 'Laporan Penjualan Bulanan';
    const rekap = d.mode === 'bulanan'
      ? `<h2>Rekap per hari</h2><table><thead><tr><th>Tanggal</th><th class="num">Transaksi</th><th class="num">Omzet</th><th class="num">Keuntungan</th></tr></thead><tbody>
        ${d.harian.filter(h => h.trx).map(h => `<tr><td>${h.hari} ${U.BULAN[+d.bulan.slice(4) - 1]} ${d.bulan.slice(0, 4)}</td><td class="num">${U.num(h.trx)}</td><td class="num">${U.rp(h.omzet)}</td><td class="num">${U.rp(h.untung)}</td></tr>`).join('') || '<tr><td colspan="4">Belum ada penjualan.</td></tr>'}
        <tr><th>Total</th><th class="num">${U.num(a.trx)}</th><th class="num">${U.rp(a.omzet)}</th><th class="num">${U.rp(a.untung)}</th></tr></tbody></table>`
      : `<h2>Daftar transaksi</h2><table><thead><tr><th>Jam</th><th>No. transaksi</th><th>Barang</th><th>Metode</th><th class="num">Total</th></tr></thead><tbody>
        ${d.transaksi.map(t => `<tr><td>${U.jam(t.w)}</td><td>${U.esc(t.id)}</td><td>${U.esc(t.r)}</td><td>${U.esc(t.m)}</td><td class="num">${U.rp(t.t)}</td></tr>`).join('') || '<tr><td colspan="5">Belum ada transaksi.</td></tr>'}</tbody></table>`;
    $('#print-root').innerHTML = `<div class="rp">
      <div class="rp-head"><div><h1>${U.esc(judul)}</h1><div>${U.esc(name)}${s.Alamat_Toko ? ' · ' + U.esc(s.Alamat_Toko) : ''}</div></div><div style="text-align:right"><b>${U.esc(this.label())}</b><br>Dicetak ${U.tgl(d.dibuat)}</div></div>
      <div class="rp-stats"><div>Total omzet<b>${U.rp(a.omzet)}</b></div><div>Jumlah transaksi<b>${U.num(a.trx)}</b></div><div>Total keuntungan<b>${U.rp(a.untung)}</b></div><div>Margin<b>${a.margin.toLocaleString('id-ID')}%</b></div></div>
      <h2>Grafik</h2><div class="charts"><div>${ch.bar}<div style="font-size:8.5pt">Omzet per tanggal</div></div><div>${ch.line}<div style="font-size:8.5pt">Omzet (garis) & keuntungan (putus-putus) per bulan</div></div></div>
      ${rekap}
      <h2>10 barang terlaris</h2><table><thead><tr><th>Barang</th><th class="num">Qty</th><th class="num">Omzet</th><th class="num">Keuntungan</th></tr></thead><tbody>
      ${d.terlaris.map(b => `<tr><td>${U.esc(b.nama)}</td><td class="num">${U.qty(b.qty)}</td><td class="num">${U.rp(b.total)}</td><td class="num">${U.rp(b.untung)}</td></tr>`).join('') || '<tr><td colspan="4">Belum ada penjualan.</td></tr>'}</tbody></table>
      <div class="foot">Laporan dibuat otomatis oleh ${U.esc(s.Nama_Aplikasi || 'KasirMart')}. Keuntungan = (harga jual − harga beli) × qty, memakai harga saat transaksi.</div></div>`;
    let st = $('#print-page');
    if (!st) { st = document.createElement('style'); st.id = 'print-page'; document.head.appendChild(st); }
    st.textContent = '@page { size: A4; margin: 12mm; }';
    const oldTitle = document.title;
    document.title = `Laporan-${(s.Nama_Aplikasi || 'KasirMart').replace(/\s+/g, '')}-${d.mode === 'harian' ? this.st.tanggal : d.bulan.slice(0, 4) + '-' + d.bulan.slice(4)}`;
    if (pdf) Toast.ok('Di dialog cetak, pilih tujuan "Simpan sebagai PDF".');
    document.body.classList.add('print-report');
    const done = () => { document.body.classList.remove('print-report'); $('#print-root').innerHTML = ''; st.textContent = ''; document.title = oldTitle; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { window.print(); setTimeout(done, 1500); }, pdf ? 400 : 50);
  }
};

/* =================================================================== PENGATURAN */
const PageSetting = {
  tab: 'identitas',
  draft: null,
  render(view) {
    this.draft = { ...(App.state.settings || {}) };
    const tabs = [['identitas', 'store', 'Identitas & tampilan'], ['struk', 'receipt', 'Struk & stok'], ['pembayaran', 'qr', 'Pembayaran'],
      ['pengguna', 'users', 'Pengguna kasir'], ['import', 'import', 'Import data'], ['keamanan', 'shield', 'Keamanan & sistem']];
    if (!tabs.some(t => t[0] === this.tab)) this.tab = 'identitas';
    view.innerHTML = pageHead({ eyebrow: '<span class="accent">[Sistem]</span> / Konfigurasi', title: 'Pengaturan', sub: 'Identitas toko, struk, pembayaran QRIS & transfer, akun kasir, impor data lama, keamanan, dan cadangan.' }) +
      `<div class="set-layout"><nav class="set-nav" aria-label="Bagian pengaturan">${tabs.map(t => `<button data-stab="${t[0]}" aria-current="${this.tab === t[0]}">${I(t[1], 'ic-sm')} ${t[2]}</button>`).join('')}</nav>
       <div class="stack" data-pane></div></div>`;
    view.querySelectorAll('[data-stab]').forEach(b => b.onclick = () => { this.leave(); this.tab = b.dataset.stab; App.rerender(); });
    const pane = view.querySelector('[data-pane]');
    ({ identitas: () => this.identitas(pane), struk: () => this.struk(pane), pembayaran: () => this.pembayaran(pane), pengguna: () => this.pengguna(pane),
      import: () => this.importer(pane), keamanan: () => this.keamanan(pane) })[this.tab]();
  },
  /** Batalkan pratinjau warna yang belum disimpan. */
  leave() { Theme.apply(App.state.settings); },
  saveBar(label = 'Simpan Perubahan') { return `<div class="sticky-save"><span class="caption grow" data-dirty></span><button class="btn" data-revert>Batalkan</button><button class="btn btn-primary" data-save>${I('check', 'ic-sm')} ${label}</button></div>`; },
  bindSave(pane, keys) {
    const mark = () => { const dirty = keys.some(k => String(this.draft[k] || '') !== String(App.state.settings[k] || '')); pane.querySelector('[data-dirty]').textContent = dirty ? 'Ada perubahan yang belum disimpan.' : ''; };
    pane.addEventListener('input', mark); pane.addEventListener('change', mark);
    pane.querySelector('[data-revert]').onclick = () => { this.leave(); App.rerender(); };
    pane.querySelector('[data-save]').onclick = e => busy(e.currentTarget, async () => {
      const out = {}; keys.forEach(k => { out[k] = this.draft[k]; });
      const r = await API.call('pengaturan.save', { settings: out });
      if (Toast.res(r)) { App.setSettings(r.data.settings); App.rerender(); }
    }, 'Menyimpan…');
  },
  identitas(pane) {
    const s = this.draft;
    pane.innerHTML = `
      <div class="card"><div class="card-head"><h2>${I('store')} Identitas aplikasi</h2></div><div class="card-body stack">
        <div class="grid-2"><label class="field"><span class="lbl">Nama aplikasi <span class="req">*</span></span><input class="input" data-k="Nama_Aplikasi" maxlength="40" value="${U.esc(s.Nama_Aplikasi)}"><span class="hint">Tampil di menu samping, judul halaman, dan halaman login.</span></label>
          <label class="field"><span class="lbl">Nama toko (di struk)</span><input class="input" data-k="Nama_Toko" maxlength="60" value="${U.esc(s.Nama_Toko)}"></label>
          <label class="field"><span class="lbl">Alamat toko</span><input class="input" data-k="Alamat_Toko" maxlength="120" value="${U.esc(s.Alamat_Toko)}" placeholder="Opsional"></label>
          <label class="field"><span class="lbl">Telepon toko</span><input class="input" data-k="Telepon_Toko" maxlength="30" value="${U.esc(s.Telepon_Toko)}" placeholder="Opsional"></label></div>
        <div class="field"><span class="lbl">Logo aplikasi</span><div class="row-wrap" style="gap:16px;align-items:flex-start">
          <span class="ph logo-box">${s.URL_Logo ? `<img src="${U.esc(s.URL_Logo)}" alt="Logo saat ini" referrerpolicy="no-referrer">` : ''}</span>
          <div class="stack-sm"><div class="row-wrap"><label class="btn">${I('upload', 'ic-sm')} Unggah logo<input type="file" accept="image/png,image/jpeg,image/webp" data-logo hidden></label>
            ${s.URL_Logo ? `<button class="btn btn-danger" data-logo-del>${I('trash', 'ic-sm')} Hapus logo</button>` : ''}</div>
            <span class="hint">PNG, JPG, atau WEBP. Maksimal 500 KB. Logo ditampilkan kecil (thumbnail) di menu, halaman login, dan struk; berkas aslinya disimpan di Google Drive.</span></div></div></div>
      </div></div>
      <div class="card"><div class="card-head"><h2>${I('palette')} Warna tema</h2><button class="btn-link btn" data-reset-color>Kembalikan ke awal</button></div><div class="card-body stack">
        <div class="grid-2">${[['Warna_Utama', 'Warna utama', 'Tombol utama, menu aktif, ubin logo'], ['Warna_Aksen', 'Warna aksen', 'Angka keuntungan, grafik, tautan, fokus']].map(c => `
          <label class="field"><span class="lbl">${c[1]}</span><span class="swatch-row"><input type="color" data-color="${c[0]}" value="${U.esc(s[c[0]])}" aria-label="Pilih ${c[1].toLowerCase()}"><input class="input mono" data-hex="${c[0]}" value="${U.esc(s[c[0]])}" maxlength="7"></span><span class="hint">${c[2]}</span><span class="err-text" data-cwarn="${c[0]}"></span></label>`).join('')}</div>
        <div class="field"><span class="lbl">Pratinjau langsung</span><div class="preview-strip"><div class="preview-head">${View.logo(s, 32)}<b>${U.esc(s.Nama_Aplikasi)}</b><span class="grow"></span><span class="pill pill-ok">Aktif</span></div>
          <button class="btn btn-primary" type="button">${I('check', 'ic-sm')} Tombol contoh</button><span class="accent" style="font-weight:700">+Rp 12.500</span></div></div>
      </div></div>` + this.saveBar();
    const keys = ['Nama_Aplikasi', 'Nama_Toko', 'Alamat_Toko', 'Telepon_Toko', 'Warna_Utama', 'Warna_Aksen'];
    pane.querySelectorAll('[data-k]').forEach(i => i.addEventListener('input', () => { s[i.dataset.k] = i.value; }));
    const setColor = (k, v) => {
      if (!/^#[0-9a-f]{6}$/i.test(v)) return;
      s[k] = v.toUpperCase();
      pane.querySelector(`[data-color="${k}"]`).value = v; pane.querySelector(`[data-hex="${k}"]`).value = s[k];
      const c = U.contrast(v, '#FFFFFF');
      pane.querySelector(`[data-cwarn="${k}"]`).textContent = c < 3 ? `Kontras dengan putih hanya ${c.toFixed(1)}:1 — teks akan digelapkan otomatis agar tetap terbaca.` : '';
      Theme.apply(s);
    };
    pane.querySelectorAll('[data-color]').forEach(i => i.addEventListener('input', () => setColor(i.dataset.color, i.value)));
    pane.querySelectorAll('[data-hex]').forEach(i => i.addEventListener('input', () => setColor(i.dataset.hex, i.value.trim())));
    pane.querySelector('[data-reset-color]').onclick = () => { setColor('Warna_Utama', '#0F766E'); setColor('Warna_Aksen', '#0F766E'); pane.dispatchEvent(new Event('input')); };
    pane.querySelector('[data-logo]').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return Toast.err('Format logo harus PNG, JPG, atau WEBP.');
      if (f.size > 500 * 1024) return Toast.err(`Ukuran logo ${Math.round(f.size / 1024)} KB. Maksimal 500 KB.`);
      const lbl = e.target.closest('label');
      await busy(lbl, async () => {
        const r = await API.call('logo.upload', { mime: f.type, base64: await U.fileToBase64(f), nama: f.name });
        if (r.success) { App.setSettings(r.data.settings); App.rerender(); }
        Toast.show(r.message, r.success && r.data.dibagikan !== false ? 'ok' : 'error');
      }, 'Mengunggah…');
    };
    const del = pane.querySelector('[data-logo-del]');
    if (del) del.onclick = async () => {
      if (!(await Modal.confirm({ title: 'Hapus logo?', message: 'Logo akan dihapus dari aplikasi dan struk.', okText: 'Hapus logo', danger: true }))) return;
      busy(del, async () => { const r = await API.call('logo.remove', {}); if (Toast.res(r)) { App.setSettings(r.data.settings); App.rerender(); } });
    };
    this.bindSave(pane, keys);
  },
  struk(pane) {
    const s = this.draft;
    const sample = { id: 'TRX-' + U.dk(U.ymd()) + '-001', waktu: U.ymd() + ' ' + new Date().toTimeString().slice(0, 8), metode: 'Tunai', total: 122750, bayar: 150000, kembali: 27250, kasir: (App.state.me || {}).nama || 'Admin Toko',
      items: [{ nama: 'Beras Pandan Wangi 5kg', qty: 1, satuan: 'karung', harga: 68000, subtotal: 68000 }, { nama: 'Minyak Goreng 2L', qty: 1, satuan: 'pouch', harga: 34500, subtotal: 34500 },
        { nama: 'Gula Pasir Curah', qty: 1.25, satuan: 'kg', harga: 17000, subtotal: 21250 }] };
    pane.innerHTML = `<div class="grid-2" style="align-items:start">
      <div class="stack"><div class="card"><div class="card-head"><h2>${I('receipt')} Struk</h2></div><div class="card-body stack">
        <div class="field"><span class="lbl">Lebar kertas thermal</span><div class="choice-grid">${['58', '80'].map(w => `<label class="choice ${s.Lebar_Struk === w ? 'on' : ''}"><input type="radio" name="lebar" value="${w}" ${s.Lebar_Struk === w ? 'checked' : ''}><span><b>${w} mm</b><small>${w === '58' ? 'Printer kecil / portabel' : 'Printer kasir standar'}</small></span></label>`).join('')}</div></div>
        <label class="check"><input type="checkbox" data-auto ${s.Cetak_Otomatis !== 'tidak' ? 'checked' : ''}> Buka dialog cetak otomatis setelah transaksi</label>
        <label class="field"><span class="lbl">Catatan di bawah struk</span><input class="input" data-k="Catatan_Struk" maxlength="80" value="${U.esc(s.Catatan_Struk)}"></label>
        <p class="hint">Aplikasi web tidak bisa langsung mengakses printer USB/Bluetooth. Struk dicetak lewat dialog cetak browser; pastikan printer thermal sudah terpasang di komputer/HP kasir dan pilih ukuran kertas yang sesuai.</p></div></div>
      <div class="card"><div class="card-head"><h2>${I('stock')} Stok</h2></div><div class="card-body stack">
        <label class="field"><span class="lbl">Batas stok menipis</span><input class="input tnum" data-k="Batas_Stok_Menipis" inputmode="numeric" value="${U.esc(s.Batas_Stok_Menipis)}"><span class="hint">Barang aktif dengan stok 1 sampai angka ini ditandai "Menipis" di menu Stok dan Dashboard.</span></label></div></div></div>
      <div class="card"><div class="card-head"><h2>Pratinjau struk</h2><button class="btn btn-sm" data-test>${I('printer', 'ic-sm')} Cetak uji</button></div><div class="receipt-stage" data-prev></div></div></div>` + this.saveBar();
    const draw = () => { pane.querySelector('[data-prev]').innerHTML = `<div class="ruler ${s.Lebar_Struk === '80' ? 'w80' : ''}">${s.Lebar_Struk} mm</div>` + Receipt.html(sample, s.Lebar_Struk, s); };
    pane.querySelectorAll('input[name=lebar]').forEach(r => r.onchange = () => { s.Lebar_Struk = r.value; pane.querySelectorAll('.choice').forEach(c => c.classList.toggle('on', c.querySelector('input').checked)); Store.del('lebarStruk'); draw(); });
    pane.querySelector('[data-auto]').onchange = e => { s.Cetak_Otomatis = e.target.checked ? 'ya' : 'tidak'; Store.del('autoPrint'); };
    pane.querySelectorAll('[data-k]').forEach(i => i.addEventListener('input', () => { s[i.dataset.k] = i.dataset.k === 'Batas_Stok_Menipis' ? String(U.parseNum(i.value)) : i.value; draw(); }));
    pane.querySelector('[data-test]').onclick = () => Receipt.print(sample, s.Lebar_Struk, s);
    draw();
    this.bindSave(pane, ['Lebar_Struk', 'Cetak_Otomatis', 'Catatan_Struk', 'Batas_Stok_Menipis']);
  },
  /* ---------------- Pembayaran: QRIS statis + rekening transfer */
  pembayaran(pane) {
    const s = this.draft, banks = ['BCA', 'BRI', 'BNI', 'Mandiri', 'BSI', 'BTN', 'CIMB Niaga', 'Permata', 'Danamon', 'OCBC', 'Maybank', 'Panin', 'SeaBank', 'Bank Jago', 'blu by BCA Digital', 'Bank Jatim', 'Bank Jateng', 'Bank BJB', 'Bank DKI', 'Bank Muamalat'];
    pane.innerHTML = `
      <div class="card"><div class="card-head"><h2>${I('qr')} QRIS toko</h2><button class="btn btn-sm" data-preview="QRIS">${I('expand', 'ic-sm')} Lihat tampilan pelanggan</button></div><div class="card-body">
        <div class="qris-set">
          <div class="qris-preview" data-qprev>${View.loading('Memuat…')}</div>
          <div class="stack">
            <label class="field"><span class="lbl">Nama merchant (sesuai stiker QRIS)</span><input class="input" data-k="QRIS_Merchant" maxlength="60" value="${U.esc(s.QRIS_Merchant)}" placeholder="Contoh: TOKO BERKAH SEMBAKO"><span class="hint">Tampil di layar pelanggan agar mereka yakin membayar ke toko yang benar.</span></label>
            <div class="row-wrap"><button class="btn btn-primary" data-qbtn>${I('upload', 'ic-sm')} <span data-qup-lbl>Unggah gambar QRIS</span></button><input type="file" accept="image/png,image/jpeg,image/webp" data-qup hidden aria-label="Pilih gambar QRIS">
              <button class="btn btn-danger" data-qdel hidden>${I('trash', 'ic-sm')} Hapus QRIS</button></div>
            <div class="notice">${I('info')}<div><b>Cara menyiapkan:</b> foto atau unduh gambar QRIS statis toko Anda dari aplikasi bank/e-wallet merchant (QRIS yang ditempel di meja kasir). Potong agar hanya kotak QR yang terlihat. PNG/JPG/WEBP, gambar besar diperkecil otomatis.</div></div>
            <p class="hint">Gambar disimpan privat di Google Drive dan hanya dikirim ke aplikasi yang sudah login. Pelanggan memasukkan nominal sendiri saat membayar (QRIS statis), kasir menekan <b>Sudah dibayar</b> setelah dana masuk.</p>
          </div></div></div></div>
      <div class="card"><div class="card-head"><h2>${I('bank')} Rekening transfer bank</h2><button class="btn btn-sm" data-preview="Transfer">${I('expand', 'ic-sm')} Lihat tampilan pelanggan</button></div><div class="card-body stack">
        <datalist id="bank-list">${banks.map(b => `<option value="${b}">`).join('')}</datalist>
        ${[1, 2].map(i => `<div class="rek-form"><span class="rek-idx">${i}</span>
          <label class="field"><span class="lbl">Nama bank${i === 2 ? ' (opsional)' : ''}</span><input class="input" data-k="Rek${i}_Bank" list="bank-list" maxlength="60" value="${U.esc(s['Rek' + i + '_Bank'])}" placeholder="Contoh: BCA"></label>
          <label class="field"><span class="lbl">Nomor rekening</span><input class="input mono" data-k="Rek${i}_Nomor" inputmode="numeric" maxlength="30" value="${U.esc(s['Rek' + i + '_Nomor'])}" placeholder="Contoh: 1234567890"></label>
          <label class="field"><span class="lbl">Atas nama</span><input class="input" data-k="Rek${i}_Nama" maxlength="60" value="${U.esc(s['Rek' + i + '_Nama'])}" placeholder="Nama pemilik rekening"></label></div>`).join('')}
        <span class="hint">Rekening yang nomornya kosong tidak ditampilkan. Kasir bisa menyalin nomor dan menampilkannya ke pelanggan dari layar Kasir.</span>
      </div></div>` + this.saveBar();
    pane.querySelectorAll('[data-k]').forEach(i => i.addEventListener('input', () => {
      if (/_Nomor$/.test(i.dataset.k)) i.value = i.value.replace(/[^\d .-]/g, '');
      s[i.dataset.k] = i.value;
    }));
    const prev = pane.querySelector('[data-qprev]'), del = pane.querySelector('[data-qdel]');
    const paint = q => {
      if (!prev.isConnected) return;
      prev.innerHTML = q ? `<img src="${q.dataUrl}" alt="QRIS toko">` : `<div class="empty">${I('qr')}<b>Belum ada QRIS</b><span class="caption">Unggah gambar QRIS toko</span></div>`;
      del.hidden = !q;
      const l = pane.querySelector('[data-qup-lbl]'); if (l) l.textContent = q ? 'Ganti gambar QRIS' : 'Unggah gambar QRIS';
    };
    const qbtn = pane.querySelector('[data-qbtn]');
    qbtn.onclick = () => pane.querySelector('[data-qup]').click();
    Kasir.loadQris(true).then(paint);
    pane.querySelector('[data-qup]').onchange = async e => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return Toast.err('Format gambar QRIS harus PNG, JPG, atau WEBP.');
      await busy(qbtn, async () => {
        let img; try { img = await U.shrinkImage(file); } catch (x) { Toast.err(x.message); return; }
        const r = await API.call('qris.upload', img);
        if (!Toast.res(r)) return;
        App.setSettings(Object.assign({}, App.state.settings, { QRIS_Versi: r.data.versi }));
        Kasir.qris = { versi: r.data.versi, dataUrl: r.data.dataUrl }; Kasir._qrisAt = Date.now();
        if (r.data.dataUrl.length < 900000) Store.set('qris', Kasir.qris);
      }, 'Mengunggah…');
      paint(Kasir.qris);
    };
    del.onclick = async () => {
      if (!(await Modal.confirm({ title: 'Hapus gambar QRIS?', message: 'Pembayaran QRIS di layar kasir tidak bisa dipakai sampai gambar baru diunggah.', okText: 'Hapus QRIS', danger: true }))) return;
      busy(del, async () => { const r = await API.call('qris.remove', {}); if (Toast.res(r)) { App.setSettings(Object.assign({}, App.state.settings, { QRIS_Versi: '' })); Kasir.qris = null; Kasir._qrisAt = Date.now(); Store.del('qris'); paint(null); } });
    };
    pane.querySelectorAll('[data-preview]').forEach(b => b.onclick = () => {
      const k = b.dataset.preview, keep = App.state.settings;
      if (k === 'QRIS' && !Kasir.qris) return Toast.err('Unggah gambar QRIS terlebih dahulu.');
      App.state.settings = Object.assign({}, keep, this.draft);                // pratinjau memakai isian yang belum disimpan
      if (k === 'Transfer' && !Kasir.rekening().length) { App.state.settings = keep; return Toast.err('Isi minimal satu nomor rekening.'); }
      Kasir.showCustomer(k, { total: 87500, preview: true });
      App.state.settings = keep;
    });
    this.bindSave(pane, ['QRIS_Merchant', 'Rek1_Bank', 'Rek1_Nomor', 'Rek1_Nama', 'Rek2_Bank', 'Rek2_Nomor', 'Rek2_Nama']);
  },

  /* ---------------- Pengguna kasir */
  async pengguna(pane) {
    pane.innerHTML = `
      <div class="notice info">${I('users')}<div><b>Akun kasir untuk karyawan.</b> Kasir hanya bisa membuka <b>Kasir</b>, <b>Cek Stok</b>, dan <b>Transaksi Saya</b>. Kasir tidak bisa melihat harga modal, keuntungan, laporan, data barang, atau pengaturan. Setiap transaksi tercatat atas nama kasirnya.</div></div>
      <div class="card"><div class="card-head"><div><h2>${I('users')} Akun kasir</h2><span class="caption" data-ucount></span></div><button class="btn btn-primary" data-unew>${I('plus', 'ic-sm')} Tambah kasir</button></div><div data-ulist>${View.loading()}</div></div>
      <div class="card"><div class="card-head"><h2>${I('info')} Cara kasir masuk</h2></div><div class="card-body stack-sm">
        <ol class="steps"><li>Buka alamat aplikasi ini di HP/komputer kasir: <span class="mono url-chip">${U.esc(location.origin + location.pathname)}</span> <button class="btn btn-sm" data-copy-url>${I('copy', 'ic-sm')} Salin</button></li>
          <li>Pilih <b>Kasir</b> di halaman login, isi nama pengguna dan kata sandi sementara.</li>
          <li>Kasir langsung diminta membuat kata sandi sendiri (minimal 6 karakter, boleh PIN angka).</li></ol></div></div>`;
    pane.querySelector('[data-copy-url]').onclick = () => U.copy(location.origin + location.pathname).then(ok => ok ? Toast.ok('Alamat aplikasi disalin.') : Toast.err('Gagal menyalin.'));
    pane.querySelector('[data-unew]').onclick = () => this.userForm(pane);
    pane.addEventListener('click', e => {
      const b = e.target.closest('button[data-u]'); if (!b) return;
      const u = (App.state.users || []).find(x => x.username === b.dataset.u); if (!u) return;
      ({ edit: () => this.userForm(pane, u), reset: () => this.userReset(pane, u), toggle: () => this.userToggle(pane, u, b), del: () => this.userDelete(pane, u, b) })[b.dataset.op]();
    });
    const r = await API.call('users.list', {});
    if (!pane.isConnected) return;
    if (!r.success) { pane.querySelector('[data-ulist]').innerHTML = `<div class="card-body">${errBox(r.message)}</div>`; return; }
    this.drawUsers(pane, r.data.users, r.data.maks);
  },
  drawUsers(pane, users, maks) {
    App.state.users = users;
    if (maks) this._maks = maks;
    const box = pane.querySelector('[data-ulist]'); if (!box) return;
    pane.querySelector('[data-ucount]').textContent = `${users.length} dari maksimal ${this._maks || 30} akun`;
    box.innerHTML = !users.length ? View.empty('users', 'Belum ada akun kasir', 'Klik "Tambah kasir" untuk membuat akun pertama, misalnya untuk karyawan yang menjaga toko.')
      : `<div class="table-wrap"><table class="tbl tbl-cards"><thead><tr><th>Kasir</th><th>Status</th><th class="col-lg">Login terakhir</th><th class="num">Aksi</th></tr></thead><tbody>
        ${users.map(u => `<tr><td><span class="row" style="gap:10px"><span class="avatar sm" aria-hidden="true">${U.esc(U.initials(u.nama))}</span><span><b>${U.esc(u.nama)}</b><span class="sub">@${U.esc(u.username)}</span></span></span></td>
          <td><span class="pill-col">${View.pill(u.aktif ? 'Aktif' : 'Nonaktif')}${u.wajibGanti ? '<span class="pill pill-warn">Sandi sementara</span>' : ''}</span></td>
          <td data-hide-sm class="caption nowrap col-lg">${u.loginTerakhir ? U.tglPendek(u.loginTerakhir) : 'Belum pernah'}</td>
          <td><div class="act"><button class="icon-btn" style="width:32px;height:32px" data-u="${U.esc(u.username)}" data-op="edit" aria-label="Ubah nama ${U.esc(u.nama)}" title="Ubah nama">${I('pencil', 'ic-sm')}</button>
            <button class="btn btn-sm" data-u="${U.esc(u.username)}" data-op="reset" aria-label="Reset sandi ${U.esc(u.nama)}" title="Reset kata sandi">${I('key', 'ic-sm')}<span class="lbl-lg">Reset sandi</span></button>
            <button class="btn btn-sm btn-ghost" data-u="${U.esc(u.username)}" data-op="toggle" aria-label="${u.aktif ? 'Nonaktifkan' : 'Aktifkan'} ${U.esc(u.nama)}" title="${u.aktif ? 'Nonaktifkan' : 'Aktifkan'}">${I(u.aktif ? 'ban' : 'check', 'ic-sm')}<span class="lbl-lg">${u.aktif ? 'Nonaktifkan' : 'Aktifkan'}</span></button>
            <button class="icon-btn" style="width:32px;height:32px;color:var(--danger)" data-u="${U.esc(u.username)}" data-op="del" aria-label="Hapus akun ${U.esc(u.username)}" title="Hapus akun">${I('trash', 'ic-sm')}</button></div></td></tr>`).join('')}
        </tbody></table></div>`;
  },
  pin() { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(100000 + (a[0] % 900000)); },
  /** Tampilkan info login sekali, untuk diberikan ke kasir. */
  showCred(u, pw, title) {
    const txt = `Login kasir ${(App.state.settings || {}).Nama_Aplikasi || 'KasirMart'}\nAlamat: ${location.origin + location.pathname}\nNama pengguna: ${u}\nKata sandi sementara: ${pw}`;
    Modal.open({
      title, size: 'sm', icon: I('key'),
      body: `<p>Berikan info login ini kepada kasir. Kata sandi sementara <b>hanya ditampilkan sekali</b>; kasir wajib menggantinya saat login.</p>
        <dl class="kv cred"><dt>Nama pengguna</dt><dd class="mono">${U.esc(u)}</dd><dt>Kata sandi sementara</dt><dd class="mono">${U.esc(pw)}</dd></dl>`,
      foot: `<button class="btn" data-ccopy>${I('copy', 'ic-sm')} Salin info login</button><button class="btn btn-primary" data-close>Selesai</button>`,
      onMount: el => { el.querySelector('[data-ccopy]').onclick = () => U.copy(txt).then(ok => ok ? Toast.ok('Info login disalin. Kirim lewat WhatsApp ke kasir.') : Toast.err('Gagal menyalin.')); }
    });
  },
  userForm(pane, u) {
    const baru = !u;
    Modal.open({
      title: baru ? 'Tambah akun kasir' : 'Ubah nama kasir', size: 'sm', icon: I(baru ? 'plus' : 'pencil'),
      body: `<form class="stack" data-uf autocomplete="off" novalidate>
        <label class="field"><span class="lbl">Nama kasir <span class="req">*</span></span><input class="input" name="nama" maxlength="40" value="${u ? U.esc(u.nama) : ''}" placeholder="Contoh: Sari Lestari"><span class="hint">Tampil di layar kasir, struk, dan riwayat transaksi.</span></label>
        <label class="field"><span class="lbl">Nama pengguna (untuk login) <span class="req">*</span></span><span class="ig"><span class="pre">@</span><input class="input mono" name="username" maxlength="20" autocapitalize="none" spellcheck="false" value="${u ? U.esc(u.username) : ''}" ${u ? 'readonly' : ''} placeholder="sari"></span>
          <span class="hint">${u ? 'Nama pengguna tidak bisa diubah.' : '3–20 karakter: huruf kecil, angka, titik, atau garis bawah. Tanpa spasi.'}</span></label>
        ${baru ? `<label class="field"><span class="lbl">Kata sandi sementara <span class="req">*</span></span><span class="ig"><input class="input mono" name="password" maxlength="40" value="${this.pin()}"><button type="button" class="icon-btn" data-gen aria-label="Buat sandi acak baru" title="Buat sandi acak baru">${I('refresh', 'ic-sm')}</button></span>
          <span class="hint">Minimal 6 karakter. Kasir wajib menggantinya saat login pertama.</span></label>` : ''}
        <p class="err-text" data-uerr role="alert"></p></form>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-usave>${I('check', 'ic-sm')} ${baru ? 'Buat akun' : 'Simpan'}</button>`,
      onMount: (el, m) => {
        const f = el.querySelector('[data-uf]'), err = el.querySelector('[data-uerr]');
        let touched = false;
        if (baru) {
          f.username.addEventListener('input', () => { touched = true; f.username.value = f.username.value.toLowerCase().replace(/[^a-z0-9._]/g, ''); });
          f.nama.addEventListener('input', () => { if (!touched) f.username.value = U.norm(f.nama.value).split(' ')[0].replace(/[^a-z0-9._]/g, '').slice(0, 20); });
          el.querySelector('[data-gen]').onclick = () => { f.password.value = this.pin(); };
        }
        f.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.querySelector('[data-usave]').click(); } });
        el.querySelector('[data-usave]').onclick = e => {
          const d = { baru, nama: f.nama.value.trim(), username: f.username.value.trim(), password: baru ? f.password.value.trim() : '' };
          if (!d.nama) { err.textContent = 'Nama kasir wajib diisi.'; f.nama.focus(); return; }
          if (baru && !/^[a-z0-9._]{3,20}$/.test(d.username)) { err.textContent = 'Nama pengguna 3–20 karakter: huruf kecil, angka, titik, atau garis bawah.'; f.username.focus(); return; }
          if (baru && d.password.length < 6) { err.textContent = 'Kata sandi sementara minimal 6 karakter.'; f.password.focus(); return; }
          busy(e.currentTarget, async () => {
            const r = await API.call('users.save', d);
            if (!r.success) { err.textContent = r.message; return; }
            m.close(); this.drawUsers(pane, r.data.users);
            if (baru) this.showCred(d.username, d.password, 'Akun kasir dibuat'); else Toast.ok(r.message);
          }, 'Menyimpan…');
        };
      }
    });
  },
  userReset(pane, u) {
    Modal.open({
      title: 'Reset kata sandi @' + U.esc(u.username), size: 'sm', icon: I('key'),
      body: `<p>Kasir <b>${U.esc(u.nama)}</b> akan dikeluarkan dari semua perangkat dan harus masuk dengan kata sandi sementara di bawah.</p>
        <label class="field"><span class="lbl">Kata sandi sementara baru</span><span class="ig"><input class="input mono" data-np maxlength="40" value="${this.pin()}"><button type="button" class="icon-btn" data-gen aria-label="Buat sandi acak baru">${I('refresh', 'ic-sm')}</button></span></label>
        <p class="err-text" data-rerr role="alert"></p>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-rok>${I('check', 'ic-sm')} Reset kata sandi</button>`,
      onMount: (el, m) => {
        const np = el.querySelector('[data-np]');
        el.querySelector('[data-gen]').onclick = () => { np.value = this.pin(); };
        el.querySelector('[data-rok]').onclick = e => {
          const pw = np.value.trim();
          if (pw.length < 6) { el.querySelector('[data-rerr]').textContent = 'Minimal 6 karakter.'; return; }
          busy(e.currentTarget, async () => {
            const r = await API.call('users.password', { username: u.username, password: pw });
            if (!r.success) { el.querySelector('[data-rerr]').textContent = r.message; return; }
            m.close(); this.drawUsers(pane, r.data.users); this.showCred(u.username, pw, 'Kata sandi direset');
          }, 'Menyimpan…');
        };
      }
    });
  },
  async userToggle(pane, u, btn) {
    if (u.aktif && !(await Modal.confirm({ title: 'Nonaktifkan kasir?', message: `<b>${U.esc(u.nama)}</b> langsung dikeluarkan dari semua perangkat dan tidak bisa login sampai diaktifkan lagi. Riwayat transaksinya tetap tersimpan.`, okText: 'Nonaktifkan' }))) return;
    busy(btn, async () => { const r = await API.call('users.status', { username: u.username, aktif: !u.aktif }); if (Toast.res(r)) this.drawUsers(pane, r.data.users); }, '');
  },
  async userDelete(pane, u, btn) {
    if (!(await Modal.confirm({ title: 'Hapus akun kasir?', message: `Akun <b>@${U.esc(u.username)}</b> (${U.esc(u.nama)}) dihapus permanen. Transaksi yang pernah dicatat tetap ada di riwayat. Bila hanya cuti, pilih Nonaktifkan.`, okText: 'Hapus akun', danger: true }))) return;
    busy(btn, async () => { const r = await API.call('users.delete', { username: u.username }); if (Toast.res(r)) this.drawUsers(pane, r.data.users); }, '');
  },
  importer(pane) {
    pane.innerHTML = `
      <div class="notice info">${I('info')}<div><b>Import aman diulang.</b> Spreadsheet sumber hanya <b>dibaca</b>, tidak pernah diubah. Barang dicocokkan berdasarkan kode/nama, jadi menjalankan import dua kali tidak membuat data ganda. Jalankan <b>Pindai</b> dulu untuk melihat hasilnya tanpa menulis apa pun.</div></div>
      <div class="card"><div class="card-head"><h2>${I('database')} Import dari Google Sheets lama</h2></div><div class="card-body stack">
        <label class="field"><span class="lbl">URL atau ID spreadsheet sumber</span><input class="input" data-src placeholder="https://docs.google.com/spreadsheets/d/…/edit" autocomplete="off"><span class="hint">Spreadsheet harus milik akun Google yang sama dengan Apps Script. Sheet "Barang" (atau sheet pertama) dibaca berdasarkan nama kolom: Nama, Kategori, Satuan, Harga Beli, Harga Jual, Stok, Barcode.</span></label>
        <div class="row-wrap" style="gap:20px"><label class="check"><input type="checkbox" data-sheet="Kategori" checked> Kategori</label><label class="check"><input type="checkbox" data-sheet="Barang" checked> Barang</label>
          <label class="check"><input type="checkbox" data-ow> Perbarui harga/barcode/satuan barang yang sudah ada (stok & status tidak pernah ditimpa)</label></div>
        <div class="row-wrap"><button class="btn" data-run="scan">${I('search', 'ic-sm')} Pindai (dry-run)</button><button class="btn btn-primary" data-run="go">${I('import', 'ic-sm')} Jalankan import</button></div>
        <div data-res="sheet"></div></div></div>
      <div class="card"><div class="card-head"><h2>${I('file')} Import dari berkas CSV</h2><button class="btn btn-sm" data-tpl>${I('download', 'ic-sm')} Unduh template</button></div><div class="card-body stack">
        <label class="field"><span class="lbl">Berkas CSV</span><input class="input" type="file" accept=".csv,text/csv" data-csv style="padding:8px"><span class="hint">Pemisah koma atau titik koma. Kolom wajib: nama, harga_jual. Harga boleh ditulis "Rp 12.500".</span></label>
        <label class="check"><input type="checkbox" data-ow-csv> Perbarui harga/barcode/satuan barang yang sudah ada</label>
        <div class="row-wrap"><button class="btn" data-csvrun="scan">${I('search', 'ic-sm')} Pindai CSV</button><button class="btn btn-primary" data-csvrun="go">${I('import', 'ic-sm')} Import CSV</button></div>
        <div data-res="csv"></div></div></div>`;
    const show = (where, r) => {
      const box = pane.querySelector(`[data-res="${where}"]`);
      if (!r.success) { box.innerHTML = `<div class="notice danger">${I('alert')}<div>${U.esc(r.message)}</div></div>`; return; }
      const d = r.data, rep = d.report;
      box.innerHTML = `<div class="notice ${d.dryRun ? '' : 'info'}">${I(d.dryRun ? 'search' : 'check')}<div><b>${d.dryRun ? 'Hasil pindai (belum ada yang ditulis)' : 'Import selesai'}</b> — sumber: ${U.esc(d.source.nama)}</div></div>
        <div class="table-wrap" style="border:1px solid var(--border)"><table class="tbl result-tbl"><thead><tr><th>Data</th><th class="num">Di sumber</th><th class="num">Ditambah</th><th class="num">Diperbarui</th><th class="num">Dilewati</th></tr></thead><tbody>
        ${Object.keys(rep).map(k => `<tr><td><b>${k}</b></td><td class="num">${U.num(rep[k].sumber)}</td><td class="num accent"><b>${U.num(rep[k].ditambah)}</b></td><td class="num">${U.num(rep[k].diperbarui)}</td><td class="num">${U.num(rep[k].dilewati)}</td></tr>`).join('')}</tbody></table></div>
        ${d.warnings.length ? `<ul class="caption" style="margin:0;padding-left:18px">${d.warnings.map(w => `<li>${U.esc(w)}</li>`).join('')}</ul>` : ''}`;
      if (!d.dryRun && d.katalog) App.setKatalog(d.katalog);
    };
    pane.querySelectorAll('[data-run]').forEach(b => b.onclick = async () => {
      const src = pane.querySelector('[data-src]').value.trim();
      if (!src) return Toast.err('Tempel URL atau ID spreadsheet sumber.');
      const go = b.dataset.run === 'go';
      if (go && !(await Modal.confirm({ title: 'Jalankan import?', message: 'Data dari spreadsheet sumber akan ditambahkan ke database KasirMart. Disarankan menjalankan Pindai terlebih dahulu.', okText: 'Jalankan import' }))) return;
      busy(b, async () => show('sheet', await API.call('import.run', { source: src, dryRun: !go, overwrite: pane.querySelector('[data-ow]').checked, sheets: $$('[data-sheet]', pane).filter(c => c.checked).map(c => c.dataset.sheet) })), go ? 'Mengimpor…' : 'Memindai…');
    });
    pane.querySelectorAll('[data-csvrun]').forEach(b => b.onclick = async () => {
      const f = pane.querySelector('[data-csv]').files[0];
      if (!f) return Toast.err('Pilih berkas CSV terlebih dahulu.');
      if (f.size > 2 * 1024 * 1024) return Toast.err('Berkas CSV maksimal 2 MB.');
      const go = b.dataset.csvrun === 'go';
      if (go && !(await Modal.confirm({ title: 'Import CSV?', message: `Barang dari <b>${U.esc(f.name)}</b> akan ditambahkan.`, okText: 'Import' }))) return;
      busy(b, async () => show('csv', await API.call('import.csv', { csv: await U.fileToText(f), nama: f.name, dryRun: !go, overwrite: pane.querySelector('[data-ow-csv]').checked })), go ? 'Mengimpor…' : 'Memindai…');
    });
    pane.querySelector('[data-tpl]').onclick = () => U.csv('template-import-barang.csv', [['nama', 'kategori', 'satuan', 'harga_beli', 'harga_jual', 'stok', 'barcode'],
      ['Beras Pandan Wangi 5kg', 'Beras', 'karung', '66000', '74000', '10', '8992775120029'], ['Gula Pasir 1kg', 'Gula', 'bungkus', '15200', '17500', '24', '']]);
  },
  async keamanan(pane) {
    pane.innerHTML = `
      <div class="card"><div class="card-head"><h2>${I('key')} Ubah kata sandi</h2></div><div class="card-body stack">
        <form class="grid-3" data-pw autocomplete="off">${[['lama', 'Kata sandi saat ini', 'current-password'], ['baru', 'Kata sandi baru', 'new-password'], ['ulang', 'Konfirmasi kata sandi baru', 'new-password']].map(f => `
          <label class="field"><span class="lbl">${f[1]}</span><span class="ig"><input class="input" type="password" name="${f[0]}" autocomplete="${f[2]}"><button type="button" class="icon-btn" data-eye aria-label="Tampilkan kata sandi">${I('eye', 'ic-sm')}</button></span></label>`).join('')}</form>
        <div class="row-wrap"><button class="btn btn-primary" data-pw-save>${I('check', 'ic-sm')} Perbarui kata sandi</button><span class="hint">Minimal 8 karakter, berisi huruf dan angka. Perangkat lain akan otomatis keluar.</span></div>
        <p class="err-text" data-pw-err role="alert"></p></div></div>
      <div class="card"><div class="card-head"><h2>${I('shield')} Sesi login</h2></div><div class="card-body row-wrap" style="justify-content:space-between">
        <span class="muted grow">Sesi berlaku 12 jam. Bila HP/laptop pemilik hilang atau dipinjam, keluarkan semua perangkat pemilik. Akun kasir dikelola terpisah di tab <b>Pengguna kasir</b>.</span>
        <button class="btn btn-danger" data-logout-all>${I('logout', 'ic-sm')} Keluar dari semua perangkat</button></div></div>
      <div class="card"><div class="card-head"><h2>${I('database')} Cadangan data</h2></div><div class="card-body row-wrap" style="justify-content:space-between">
        <div><div>Buat salinan spreadsheet database ke folder <b>Cadangan</b> di Google Drive.</div><span class="caption" data-last>Cadangan terakhir: ${U.esc(App.state.settings.Cadangan_Terakhir || 'belum pernah')}</span></div>
        <button class="btn" data-backup>${I('download', 'ic-sm')} Buat cadangan</button></div></div>
      <div class="card"><div class="card-head"><h2>${I('info')} Informasi sistem</h2><button class="btn btn-sm" data-perf>Ukur kecepatan</button></div><div class="card-body" data-sys>${View.loading()}</div></div>`;
    pane.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => { const i = b.previousElementSibling, show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = I(show ? 'eyeOff' : 'eye', 'ic-sm'); b.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'); });
    pane.querySelector('[data-pw-save]').onclick = e => App.changePassword(pane.querySelector('[data-pw]'), pane.querySelector('[data-pw-err]'), e.currentTarget);
    pane.querySelector('[data-logout-all]').onclick = async e => {
      if (!(await Modal.confirm({ title: 'Keluar dari semua perangkat?', message: 'Semua perangkat yang masuk sebagai pemilik, termasuk yang ini, harus masuk lagi dengan kata sandi. Kasir tidak ikut keluar.', okText: 'Keluarkan semua', danger: true }))) return;
      busy(e.target.closest('button'), async () => { const r = await API.call('auth.logoutAll', {}); if (Toast.res(r)) App.logout(true); });
    };
    pane.querySelector('[data-backup]').onclick = e => busy(e.currentTarget, async () => {
      const r = await API.call('backup.create', {});
      if (Toast.res(r)) { App.setSettings(r.data.settings); pane.querySelector('[data-last]').innerHTML = `Cadangan terakhir: ${U.esc(r.data.settings.Cadangan_Terakhir)} · <a href="${U.esc(r.data.url)}" target="_blank" rel="noopener">buka salinan</a>`; }
    }, 'Membuat cadangan…');
    pane.querySelector('[data-perf]').onclick = e => busy(e.currentTarget, async () => {
      const t = []; for (let i = 0; i < 3; i++) { const t0 = performance.now(); await API.call('katalog', { _p: i + Date.now() }); t.push(Math.round(performance.now() - t0)); }
      Toast.ok(`Rata-rata waktu respons: ${Math.round(t.reduce((a, b) => a + b, 0) / t.length)} ms (${t.join(', ')} ms).`);
    }, 'Mengukur…');
    const r = await API.call('system.status', {});
    const box = pane.querySelector('[data-sys]'); if (!box) return;
    box.innerHTML = !r.success ? errBox(r.message) : `<dl class="kv" style="grid-template-columns:auto 1fr">
      <dt>Versi frontend</dt><dd>${APP_FE_VERSION}</dd><dt>Versi backend</dt><dd>${U.esc(r.data.version)}</dd><dt>Zona waktu server</dt><dd>${U.esc(r.data.zonaWaktu)}</dd>
      <dt>Pemanas server (keepWarm)</dt><dd>${r.data.keepWarm ? '<span class="pill pill-ok">Aktif · tiap 5 menit</span>' : r.data.keepWarmMati ? '<span class="pill pill-off">Dimatikan</span>' : '<span class="pill pill-danger">Belum terpasang</span>'}</dd>
      <dt>Cache dipanaskan</dt><dd>${r.data.warmTerakhir ? U.esc(new Date(r.data.warmTerakhir.at).toLocaleString('id-ID')) : '-'}</dd>
      <dt>Akun kasir</dt><dd>${r.data.jumlahKasir !== undefined ? U.num(r.data.jumlahKasir) + ' akun' : '-'}</dd>
      <dt>Script Properties</dt><dd>${r.data.propsKB} KB dari 500 KB</dd>
      <dt>Database</dt><dd><a href="${U.esc(r.data.spreadsheetUrl)}" target="_blank" rel="noopener">Buka spreadsheet</a></dd>
      <dt>Folder Drive</dt><dd><a href="${U.esc(r.data.folderUrl)}" target="_blank" rel="noopener">Buka folder</a></dd></dl>`;
  }
};
