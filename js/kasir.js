/* ==========================================================================
   KasirMart — kasir.js
   Halaman Kasir (POS), keranjang, pembayaran, struk thermal 58/80 mm.
   ========================================================================== */
'use strict';

/* ----------------------------------------------------------------- Struk */
const Receipt = {
  /** Normalisasi data dari transaksi.create maupun transaksi.detail */
  norm(d) {
    if (d.trx) {
      const t = d.trx;
      return { id: t.id, waktu: t.w, metode: t.m, total: t.t, bayar: t.b, kembali: t.k, items: d.items };
    }
    return d;
  },
  width() { return String(Store.get('lebarStruk') || (App.state.settings || {}).Lebar_Struk || '58'); },
  html(d, width, so) {
    const s = so || App.state.settings || {}, t = this.norm(d), w80 = String(width) === '80';
    const lines = t.items.map(it => `<div class="it"><b>${U.esc(it.nama)}</b><div class="ln"><span>${U.num(it.qty)} x ${U.num(it.harga)}</span><span>${U.num(it.subtotal)}</span></div></div>`).join('');
    return `<div class="receipt${w80 ? ' w80' : ''}">
      <div class="c">${s.URL_Logo ? `<img class="logo" src="${U.esc(s.URL_Logo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
        <div class="shop">${U.esc(s.Nama_Toko || s.Nama_Aplikasi || 'KasirMart')}</div>
        ${s.Alamat_Toko ? `<div>${U.esc(s.Alamat_Toko)}</div>` : ''}${s.Telepon_Toko ? `<div>Telp ${U.esc(s.Telepon_Toko)}</div>` : ''}
        <div style="margin-top:1.5mm">${U.esc(U.tgl(t.waktu))}</div><div>No: ${U.esc(t.id)}</div></div>
      <hr>${lines}<hr>
      <div class="ln tot"><span>TOTAL</span><span>${U.num(t.total)}</span></div>
      <div class="ln"><span>Bayar (${U.esc(t.metode)})</span><span>${U.num(t.bayar)}</span></div>
      <div class="ln"><span>Kembali</span><span>${U.num(t.kembali)}</span></div>
      <hr><div class="c">${U.esc(s.Catatan_Struk || 'Terima kasih telah berbelanja')}</div></div>`;
  },
  async print(d, width, so) {
    width = String(width || this.width());
    const root = $('#print-root');
    root.innerHTML = this.html(d, width, so);
    let st = $('#print-page');
    if (!st) { st = document.createElement('style'); st.id = 'print-page'; document.head.appendChild(st); }
    st.textContent = `@page { size: ${width}mm auto; margin: 0; }`;
    const img = root.querySelector('img');
    if (img && !img.complete) await Promise.race([new Promise(r => { img.onload = img.onerror = r; }), U.sleep(1500)]);
    document.body.classList.add('print-receipt');
    const done = () => { document.body.classList.remove('print-receipt'); root.innerHTML = ''; st.textContent = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  },
  preview(d) {
    let w = this.width();
    Modal.open({
      title: 'Pratinjau Struk', size: 'lg', icon: I('receipt'),
      body: `<div class="row-wrap" style="justify-content:space-between"><div class="row"><span class="lbl">Lebar kertas</span>
          <div class="seg" style="width:180px" role="group" aria-label="Lebar kertas"><button data-w="58">58 mm</button><button data-w="80">80 mm</button></div></div>
          <span class="caption">Pilih printer thermal di dialog cetak browser.</span></div>
        <div class="receipt-stage"><div class="ruler" data-ruler></div><div data-rc></div></div>`,
      foot: `<button class="btn" data-close>Kembali</button><button class="btn btn-primary" data-print>${I('printer')} Cetak Struk</button>`,
      onMount: (el) => {
        const draw = () => {
          el.querySelector('[data-rc]').innerHTML = this.html(d, w);
          const r = el.querySelector('[data-ruler]'); r.textContent = w + ' mm'; r.className = 'ruler' + (w === '80' ? ' w80' : '');
          el.querySelectorAll('[data-w]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.w === w)));
        };
        el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { w = b.dataset.w; Store.set('lebarStruk', w); draw(); });
        el.querySelector('[data-print]').onclick = () => this.print(d, w);
        draw();
      }
    });
  }
};

/* ----------------------------------------------------------------- Kasir */
const Kasir = {
  cart: Store.get('cart', []),           // [{id, qty}]
  metode: 'Tunai',
  bayar: 0,
  kat: '',
  q: '',
  ref: null,                             // kunci idempoten untuk satu percobaan bayar
  el: null,
  clock: null,

  barang() { return (App.state.katalog && App.state.katalog.barang) || []; },
  byId(id) { return this.barang().find(b => b.id === id); },
  aktif() { return this.barang().filter(b => b.status === 'Aktif'); },
  save() { Store.set('cart', this.cart); this.ref = null; },
  lines() {
    return this.cart.map(c => { const b = this.byId(c.id); return { ...c, b, ok: !!b && b.status === 'Aktif' }; });
  },
  total() { return this.lines().reduce((a, l) => a + (l.ok ? l.qty * l.b.jual : 0), 0); },
  count() { return this.lines().reduce((a, l) => a + (l.ok ? l.qty : 0), 0); },
  batas() { return Number((App.state.settings || {}).Batas_Stok_Menipis || 5); },
  autoPrint() { const v = Store.get('autoPrint'); return v === null ? (App.state.settings || {}).Cetak_Otomatis !== 'tidak' : !!v; },

  render(view) {
    this.el = view;
    view.innerHTML = `<div class="pos">
      <section class="pos-left" aria-label="Katalog barang">
        <div class="pos-head">
          <div class="pos-meta">
            <div class="m"><span>Terminal</span><b>Kasir #01</b></div><i class="sep"></i>
            <div class="m"><span>Kasir</span><b>${U.esc((App.state.me || {}).nama || 'Admin Toko')}</b></div><i class="sep"></i>
            <div class="m"><span>Waktu</span><b class="tnum" data-clock>${U.esc(U.hariPanjang())}</b></div>
          </div>
          <div class="row-wrap hide-mobile"><span class="kbd">F2 Cari</span><span class="kbd">Enter Tambah</span><span class="kbd">F8 Bayar</span><span class="kbd">Esc Bersihkan</span></div>
        </div>
        <div class="pos-search">
          <label class="ig"><span class="adorn">${I('search')}</span><span class="sr-only">Cari barang</span>
            <input class="input" id="pos-q" type="search" placeholder="Cari nama, kode, atau scan barcode…" autocomplete="off" value="${U.esc(this.q)}"></label>
          <button class="icon-btn" style="width:48px;height:auto" data-act="refresh" aria-label="Muat ulang katalog" title="Muat ulang katalog">${I('refresh')}</button>
        </div>
        <div class="chips" role="group" aria-label="Filter kategori" data-chips></div>
        <div class="pgrid" data-grid></div>
      </section>
      <aside class="cart" aria-label="Keranjang belanja" data-cart></aside>
      <div class="cartbar" data-cartbar></div>
    </div>`;
    const q = $('#pos-q', view);
    q.addEventListener('input', U.debounce(() => { this.q = q.value; this.drawGrid(); }, 120));
    q.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.enterSearch(q.value); }
      if (e.key === 'Escape') { e.stopPropagation(); q.value = ''; this.q = ''; this.drawGrid(); }
    });
    view.addEventListener('click', e => this.onClick(e));
    view.addEventListener('change', e => this.onChange(e));
    view.addEventListener('input', e => {
      if (e.target.id === 'pos-bayar') {
        const n = U.parseNum(e.target.value);
        this.bayar = n;
        e.target.value = n ? U.num(n) : '';
        this.drawChange();
      }
    });
    this.drawChips(); this.drawGrid(); this.drawCart();
    clearInterval(this.clock);
    this.clock = setInterval(() => { const c = $('[data-clock]', view); if (!c) return clearInterval(this.clock); c.textContent = U.hariPanjang() + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); }, 15000);
    $('[data-clock]', view).textContent = U.hariPanjang() + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    if (matchMedia('(min-width: 900px)').matches) setTimeout(() => q.focus(), 50);
    // Segarkan katalog bila sudah lebih dari 60 dtk (stok bisa berubah dari perangkat lain)
    if (Date.now() - (App.state.katalogAt || 0) > 60000) App.refreshKatalog().then(() => { if (this.el === view && view.isConnected) this.redraw(); });
  },
  redraw() { this.drawChips(); this.drawGrid(); this.drawCart(); },

  filtered() {
    const q = U.norm(this.q);
    return this.aktif().filter(b => (!this.kat || b.kat === this.kat) &&
      (!q || U.norm(b.nama).includes(q) || b.id.toLowerCase().includes(q) || (b.barcode && b.barcode.includes(q))))
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  },
  drawChips() {
    const kats = ((App.state.katalog || {}).kategori || []).filter(k => k.status === 'Aktif');
    const aktif = this.aktif(), cnt = id => aktif.filter(b => b.kat === id).length;
    $('[data-chips]', this.el).innerHTML = `<button class="chip" data-kat="" aria-pressed="${!this.kat}">Semua<span class="cnt">${aktif.length}</span></button>` +
      kats.filter(k => cnt(k.id)).map(k => `<button class="chip" data-kat="${U.esc(k.id)}" aria-pressed="${this.kat === k.id}">${U.esc(k.nama)}<span class="cnt">${cnt(k.id)}</span></button>`).join('');
  },
  drawGrid() {
    const list = this.filtered(), batas = this.batas(), grid = $('[data-grid]', this.el);
    if (!this.barang().length) { grid.innerHTML = `<div style="grid-column:1/-1">${View.empty('box', 'Belum ada barang', 'Tambahkan barang di menu Barang atau impor dari spreadsheet lama (Pengaturan → Import Data).')}</div>`; return; }
    if (!list.length) { grid.innerHTML = `<div style="grid-column:1/-1">${View.empty('search', 'Barang tidak ditemukan', 'Coba kata kunci lain atau pilih kategori "Semua".')}</div>`; return; }
    const inCart = {}; this.cart.forEach(c => { inCart[c.id] = c.qty; });
    const shown = list.slice(0, 240);
    grid.innerHTML = shown.map(b => {
      const out = b.stok <= 0, low = !out && b.stok <= batas;
      return `<button class="pcard${out ? ' out' : ''}" data-add="${U.esc(b.id)}" ${out ? 'aria-disabled="true"' : ''} aria-label="Tambah ${U.esc(b.nama)}, ${U.rp(b.jual)}, stok ${b.stok}">
        ${inCart[b.id] ? `<span class="incart" aria-hidden="true">${inCart[b.id]}</span>` : ''}
        <span class="ptop"><span class="ph" aria-hidden="true"></span><span class="stack-sm" style="gap:4px;align-items:flex-end"><span class="tag">${U.esc(b.id)}</span>
          <span class="stock-badge${out ? ' out' : low ? ' low' : ''}">${out ? 'Habis' : 'Stok: ' + U.num(b.stok)}</span></span></span>
        <span class="pname clamp2">${U.esc(b.nama)}</span>
        <span><span class="pprice">${U.rp(b.jual)}</span> <span class="punit">/ ${U.esc(b.satuan)}</span></span>
        <span class="padd">${out ? 'Stok kosong' : I('plus', 'ic-sm') + ' Tambah'}</span>
      </button>`;
    }).join('') + (list.length > shown.length ? `<p class="caption" style="grid-column:1/-1">Menampilkan ${shown.length} dari ${list.length} barang. Persempit pencarian untuk melihat sisanya.</p>` : '');
  },
  drawCart() {
    const lines = this.lines(), total = this.total(), count = this.count();
    const cart = $('[data-cart]', this.el);
    const head = `<div class="cart-head"><h2>${I('bag')} Keranjang Belanja</h2><span class="pill pill-neutral">${U.num(count)} item</span>
      <button class="icon-btn plain close-cart" style="display:none" data-act="close-cart" aria-label="Tutup keranjang">${I('x')}</button></div>`;
    if (!lines.length) {
      cart.innerHTML = head + `<div class="cart-empty">${I('cart')}<b>Keranjang masih kosong</b><span class="caption">Pilih barang di katalog atau scan barcode untuk memulai transaksi.</span></div>`;
    } else {
      cart.innerHTML = head + `<div class="cart-list">${lines.map(l => l.ok ? `
        <div class="cline"><div><div class="nm">${U.esc(l.b.nama)}</div><div class="meta">${U.esc(l.b.id)} · ${U.rp(l.b.jual)} / ${U.esc(l.b.satuan)}</div></div>
          <div class="sub">${U.rp(l.qty * l.b.jual)}</div>
          <div class="ctrl"><div class="stepper"><button data-dec="${U.esc(l.id)}" aria-label="Kurangi ${U.esc(l.b.nama)}">${I('minus', 'ic-sm')}</button>
            <input inputmode="numeric" data-qty="${U.esc(l.id)}" value="${l.qty}" aria-label="Jumlah ${U.esc(l.b.nama)}">
            <button data-inc="${U.esc(l.id)}" aria-label="Tambah ${U.esc(l.b.nama)}">${I('plus', 'ic-sm')}</button></div>
            <span class="caption">sisa stok ${U.num(l.b.stok - l.qty)}</span>
            <button class="icon-btn plain" data-del="${U.esc(l.id)}" aria-label="Hapus ${U.esc(l.b.nama)}">${I('trash')}</button></div></div>` : `
        <div class="cline"><div><div class="nm strike">${U.esc(l.b ? l.b.nama : l.id)}</div><div class="meta danger-text">Tidak dijual lagi — hapus dari keranjang</div></div>
          <button class="icon-btn plain" data-del="${U.esc(l.id)}" aria-label="Hapus">${I('trash')}</button></div>`).join('')}</div>
        <div class="cart-foot">
          <div class="sumrow"><span>${lines.length} jenis barang · ${U.num(count)} item</span><button class="btn-link btn" data-act="clear" style="color:var(--danger-text)">Kosongkan</button></div>
          <div class="totalbox"><span class="lbl">Total belanja<small>Sudah termasuk semua item</small></span><span class="numeric-total" data-total>${U.rp(total)}</span></div>
          <div class="field"><span class="lbl">Metode pembayaran</span>
            <div class="seg" role="group" aria-label="Metode pembayaran">${['Tunai', 'Transfer', 'QRIS', 'Lainnya'].map(m => `<button data-metode="${m}" aria-pressed="${this.metode === m}">${m}</button>`).join('')}</div></div>
          <div data-cash></div>
          <button class="btn btn-primary btn-block pay-btn" data-act="pay">${I('check')} BAYAR ${U.rp(total)} <span class="kbd">F8</span></button>
          <label class="check"><input type="checkbox" data-autoprint ${this.autoPrint() ? 'checked' : ''}> Cetak struk otomatis</label>
        </div>`;
      this.drawCash();
    }
    $('[data-cartbar]', this.el).innerHTML = `<div class="grow"><span>${U.num(count)} item · total sementara</span><b>${U.rp(total)}</b></div>
      <button class="btn btn-primary" data-act="open-cart">${I('cart')} Lihat Keranjang</button>`;
  },
  drawCash() {
    const box = $('[data-cash]', this.el); if (!box) return;
    if (this.metode !== 'Tunai') { box.innerHTML = `<p class="caption">Pembayaran ${U.esc(this.metode)} dicatat sebesar total belanja. Pastikan dana sudah diterima sebelum menekan Bayar.</p>`; return; }
    // Pecahan yang lazim dibayarkan pelanggan: pembulatan ke 5rb/10rb/50rb/100rb, lalu nominal besar
    const total = this.total(), sug = [];
    [5000, 10000, 50000, 100000].forEach(step => { const v = Math.ceil(total / step) * step; if (v > total && !sug.includes(v)) sug.push(v); });
    sug.sort((a, b) => a - b);
    [50000, 100000, 200000, 500000, 1000000].forEach(v => { if (sug.length < 3 && v > Math.max(total, ...sug)) sug.push(v); });
    const quick = [total].concat(sug.slice(0, 3));
    box.innerHTML = `<div class="stack-sm">
      <div class="cash-quick" role="group" aria-label="Pilihan uang cepat">${quick.map((v, i) => `<button data-cash="${v}">${i === 0 ? 'Uang Pas' : U.num(v)}</button>`).join('')}</div>
      <label class="field"><span class="lbl">Jumlah bayar (Rp)</span>
        <input class="input input-lg tnum" id="pos-bayar" inputmode="numeric" autocomplete="off" placeholder="0" value="${this.bayar ? U.num(this.bayar) : ''}"></label>
      <div class="change" data-change></div></div>`;
    this.drawChange();
  },
  drawChange() {
    const box = $('[data-change]', this.el); if (!box) return;
    const total = this.total(), d = this.bayar - total;
    if (!this.bayar) { box.className = 'change'; box.innerHTML = `<span class="lbl">Kembalian</span><span class="v">Rp 0</span>`; return; }
    box.className = 'change' + (d < 0 ? ' short' : '');
    box.innerHTML = d < 0 ? `<span class="lbl">Kurang</span><span class="v">${U.rp(-d)}</span>` : `<span class="lbl">Kembalian</span><span class="v">${U.rp(d)}</span>`;
  },

  add(id, n = 1) {
    const b = this.byId(id);
    if (!b || b.status !== 'Aktif') return Toast.err('Barang tidak tersedia.');
    const c = this.cart.find(x => x.id === id), cur = c ? c.qty : 0;
    if (cur + n > b.stok) return Toast.err(b.stok <= 0 ? `${b.nama} sedang habis.` : `Stok ${b.nama} hanya ${b.stok}.`);
    if (c) c.qty += n; else this.cart.push({ id, qty: n });
    this.save(); this.drawCart(); this.drawGrid();
  },
  setQty(id, q) {
    const b = this.byId(id), c = this.cart.find(x => x.id === id);
    if (!c) return;
    q = Math.floor(q);
    if (!(q > 0)) { this.cart = this.cart.filter(x => x.id !== id); }
    else if (b && q > b.stok) { Toast.err(`Stok ${b.nama} hanya ${b.stok}.`); c.qty = b.stok; }
    else c.qty = q;
    this.save(); this.drawCart(); this.drawGrid();
  },
  enterSearch(v) {
    const q = String(v || '').trim(); if (!q) return;
    const a = this.aktif();
    const exact = a.find(b => b.barcode && b.barcode === q) || a.find(b => b.id.toLowerCase() === q.toLowerCase());
    const pick = exact || (this.filtered().length === 1 ? this.filtered()[0] : null);
    if (pick) { this.add(pick.id); const el = $('#pos-q', this.el); el.value = ''; this.q = ''; this.drawGrid(); el.focus(); }
    else if (!this.filtered().length) Toast.err('Barang "' + q + '" tidak ditemukan.');
  },
  onClick(e) {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.add !== undefined) { if (t.getAttribute('aria-disabled') !== 'true') this.add(t.dataset.add); return; }
    if (t.dataset.kat !== undefined) { this.kat = t.dataset.kat; this.drawChips(); this.drawGrid(); return; }
    if (t.dataset.inc) { const c = this.cart.find(x => x.id === t.dataset.inc); this.setQty(t.dataset.inc, (c ? c.qty : 0) + 1); return; }
    if (t.dataset.dec) { const c = this.cart.find(x => x.id === t.dataset.dec); this.setQty(t.dataset.dec, (c ? c.qty : 0) - 1); return; }
    if (t.dataset.del) { this.setQty(t.dataset.del, 0); return; }
    if (t.dataset.metode) { this.metode = t.dataset.metode; this.ref = null; this.drawCart(); return; }
    if (t.dataset.cash) { this.bayar = Number(t.dataset.cash); const i = $('#pos-bayar', this.el); if (i) i.value = U.num(this.bayar); this.drawChange(); return; }
    const act = t.dataset.act;
    if (act === 'pay') this.pay(t);
    else if (act === 'clear') this.clear();
    else if (act === 'open-cart') $('[data-cart]', this.el).classList.add('open');
    else if (act === 'close-cart') $('[data-cart]', this.el).classList.remove('open');
    else if (act === 'refresh') busy(t, async () => { await App.refreshKatalog(true); this.redraw(); Toast.ok('Katalog diperbarui.'); }, '');
  },
  onChange(e) {
    if (e.target.dataset.qty) this.setQty(e.target.dataset.qty, U.parseNum(e.target.value));
    if (e.target.matches('[data-autoprint]')) Store.set('autoPrint', e.target.checked);
  },
  async clear() {
    if (!this.cart.length) return;
    if (!(await Modal.confirm({ title: 'Kosongkan keranjang?', message: 'Semua barang di keranjang akan dihapus. Transaksi tidak disimpan.', okText: 'Kosongkan', danger: true }))) return;
    this.cart = []; this.bayar = 0; this.save(); this.drawCart(); this.drawGrid();
  },
  async pay(btn) {
    const lines = this.lines(), total = this.total();
    if (!lines.length) return Toast.err('Keranjang masih kosong.');
    if (lines.some(l => !l.ok)) return Toast.err('Hapus dulu barang yang sudah tidak dijual.');
    if (this.metode === 'Tunai' && this.bayar < total) {
      Toast.err('Uang pembayaran kurang ' + U.rp(total - this.bayar) + '.');
      const i = $('#pos-bayar', this.el); if (i) { i.classList.add('invalid'); i.focus(); setTimeout(() => i.classList.remove('invalid'), 1500); }
      return;
    }
    btn = btn || $('[data-act="pay"]', this.el);
    if (!this.ref) this.ref = U.uuid();
    const payload = { ref: this.ref, metode: this.metode, bayar: this.metode === 'Tunai' ? this.bayar : total,
      items: lines.map(l => ({ id: l.id, qty: l.qty, harga: l.b.jual })) };
    const r = await busy(btn, () => API.call('transaksi.create', payload, { retry: 2 }), 'Menyimpan transaksi…');
    if (!r) return;
    if (!r.success) {
      if (r.data && r.data.katalog) { App.setKatalog(r.data.katalog); this.redraw(); }
      if (r.code !== 'NETWORK') this.ref = null;            // gagal validasi → percobaan berikutnya kunci baru
      Toast.err(r.message); return;
    }
    const d = r.data;
    // Perbarui stok lokal tanpa memuat ulang katalog
    (App.state.katalog.barang || []).forEach(b => { if (d.stok[b.id] !== undefined) b.stok = d.stok[b.id]; });
    App.saveBoot();
    this.cart = []; this.bayar = 0; this.metode = 'Tunai'; this.save();
    $('[data-cart]', this.el).classList.remove('open');
    this.redraw();
    App.updateBadges();
    $$('.toast.error').forEach(t => t.remove());
    this.success(d);
    if (this.autoPrint()) setTimeout(() => Receipt.print(d), 250);
  },
  success(d) {
    Modal.open({
      title: '', size: 'sm', headless: true,
      body: `<div class="stack" style="text-align:center;gap:8px"><div class="success-ico">${I('check')}</div>
          <h2 style="font-size:22px">Transaksi Berhasil</h2><p class="muted">Pembayaran tercatat dan stok sudah diperbarui.</p></div>
        <dl class="kv"><dt>No. transaksi</dt><dd class="mono">${U.esc(d.id)}</dd><dt>Waktu</dt><dd>${U.esc(U.tgl(d.waktu))}</dd>
          <dt>Metode bayar</dt><dd>${View.metode(d.metode)}</dd><dt>Total belanja</dt><dd>${U.rp(d.total)}</dd><dt>Uang diterima</dt><dd>${U.rp(d.bayar)}</dd></dl>
        <div class="bigchange"><span class="lbl">Kembalian</span><span class="v">${U.rp(d.kembali)}</span></div>
        <details><summary class="caption" style="cursor:pointer">Rincian belanja (${d.items.length} jenis, ${U.num(d.nItem)} item)</summary>
          <div class="stack-sm" style="margin-top:8px">${d.items.map(i => `<div class="row" style="justify-content:space-between"><span>${U.num(i.qty)}× ${U.esc(i.nama)}</span><b class="tnum">${U.rp(i.subtotal)}</b></div>`).join('')}</div></details>`,
      foot: `<button class="btn" data-print>${I('printer')} Cetak Struk</button><button class="btn btn-primary" data-new autofocus>Transaksi Baru <span class="kbd">Enter</span></button>`,
      onMount: (el, m) => {
        el.querySelector('[data-print]').onclick = () => Receipt.print(d);
        el.querySelector('[data-new]').onclick = () => { m.close(); const q = $('#pos-q'); if (q) q.focus(); };
      }
    });
  },
  hotkey(e) {
    if (e.key === 'F2' || e.key === 'F1') { e.preventDefault(); const q = $('#pos-q', this.el); if (q) { q.focus(); q.select(); } return true; }
    if (e.key === 'F8') { e.preventDefault(); if (!Modal.stack.length) this.pay(); return true; }
    return false;
  }
};
