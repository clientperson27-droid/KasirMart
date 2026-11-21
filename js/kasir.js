/* ==========================================================================
   KasirMart — kasir.js
   Halaman Kasir (POS), keranjang, timbang (kg/liter), pembayaran Tunai /
   QRIS / Transfer bank, layar untuk pelanggan, struk thermal 58/80 mm.
   ========================================================================== */
'use strict';

/* ----------------------------------------------------------------- Struk */
const Receipt = {
  /** Normalisasi data dari transaksi.create maupun transaksi.detail */
  norm(d) {
    if (d.trx) {
      const t = d.trx;
      return { id: t.id, waktu: t.w, metode: t.m, total: t.t, bayar: t.b, kembali: t.k, kasir: t.on || '', items: d.items };
    }
    return d;
  },
  width() { return String(Store.get('lebarStruk') || (App.state.settings || {}).Lebar_Struk || '58'); },
  html(d, width, so) {
    const s = so || App.state.settings || {}, t = this.norm(d), w80 = String(width) === '80', tunai = t.metode === 'Tunai';
    const lines = t.items.map(it => `<div class="it"><b>${U.esc(it.nama)}</b><div class="ln"><span>${U.esc(U.qtySat(it.qty, it.satuan))} x ${U.num(it.harga)}</span><span>${U.num(it.subtotal)}</span></div></div>`).join('');
    return `<div class="receipt${w80 ? ' w80' : ''}">
      <div class="c">${s.URL_Logo ? `<img class="logo" src="${U.esc(s.URL_Logo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
        <div class="shop">${U.esc(s.Nama_Toko || s.Nama_Aplikasi || 'KasirMart')}</div>
        ${s.Alamat_Toko ? `<div>${U.esc(s.Alamat_Toko)}</div>` : ''}${s.Telepon_Toko ? `<div>Telp ${U.esc(s.Telepon_Toko)}</div>` : ''}
        <div style="margin-top:1.5mm">${U.esc(U.tgl(t.waktu))}</div><div>No: ${U.esc(t.id)}</div>${t.kasir ? `<div>Kasir: ${U.esc(t.kasir)}</div>` : ''}</div>
      <hr>${lines}<hr>
      <div class="ln tot"><span>TOTAL</span><span>${U.num(t.total)}</span></div>
      <div class="ln"><span>${tunai ? 'Tunai' : 'Bayar (' + U.esc(t.metode) + ')'}</span><span>${U.num(t.bayar)}</span></div>
      ${tunai ? `<div class="ln"><span>Kembali</span><span>${U.num(t.kembali)}</span></div>` : `<div class="c" style="margin-top:1mm">** LUNAS **</div>`}
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
  cart: Store.get('cart', []),           // [{id, qty}] — qty boleh pecahan untuk kg/liter
  metode: 'Tunai',
  bayar: 0,
  kat: '',
  q: '',
  ref: null,                             // kunci idempoten untuk satu percobaan bayar
  el: null,
  clock: null,
  qris: undefined,                       // { versi, dataUrl } | null (belum diunggah) | undefined (belum dicek)
  _qrisAt: 0,
  METODE: [['Tunai', 'cash'], ['QRIS', 'qr'], ['Transfer', 'bank'], ['Lainnya', 'dots']],

  barang() { return (App.state.katalog && App.state.katalog.barang) || []; },
  byId(id) { return this.barang().find(b => b.id === id); },
  aktif() { return this.barang().filter(b => b.status === 'Aktif'); },
  save() { Store.set('cart', this.cart); this.ref = null; },
  lines() {
    return this.cart.map(c => { const b = this.byId(c.id); return { ...c, b, ok: !!b && b.status === 'Aktif', dec: !!b && U.desimal(b.satuan) }; });
  },
  total() { return this.lines().reduce((a, l) => a + (l.ok ? U.sub(l.qty, l.b.jual) : 0), 0); },
  /** Jumlah item: barang timbang dihitung 1 per baris (kg + pcs tidak bisa dijumlah). */
  count() { return this.lines().reduce((a, l) => a + (l.ok ? (l.dec ? 1 : l.qty) : 0), 0); },
  batas() { return Number((App.state.settings || {}).Batas_Stok_Menipis || 5); },
  autoPrint() { const v = Store.get('autoPrint'); return v === null ? (App.state.settings || {}).Cetak_Otomatis !== 'tidak' : !!v; },
  rekening() {
    const s = App.state.settings || {};
    return [1, 2].map(i => ({ bank: s['Rek' + i + '_Bank'] || '', nomor: s['Rek' + i + '_Nomor'] || '', nama: s['Rek' + i + '_Nama'] || '' })).filter(r => r.nomor);
  },
  merchant() { const s = App.state.settings || {}; return s.QRIS_Merchant || s.Nama_Toko || s.Nama_Aplikasi || 'Toko'; },
  stokTxt(b, q) { return U.qtySat(q === undefined ? b.stok : q, b.satuan) + (U.desimal(b.satuan) ? '' : ' ' + b.satuan); },

  render(view) {
    this.el = view;
    const me = App.state.me || {};
    view.innerHTML = `<div class="pos">
      <section class="pos-left" aria-label="Katalog barang">
        <div class="pos-head">
          <div class="pos-meta">
            <div class="m"><span>Kasir</span><b>${U.esc(me.nama || 'Admin Toko')}</b></div><i class="sep"></i>
            <div class="m"><span>Waktu</span><b class="tnum" data-clock>${U.esc(U.hariPanjang())}</b></div>
          </div>
          <div class="row-wrap hide-mobile"><span class="kbd">F2 Cari</span><span class="kbd">Enter Tambah</span><span class="kbd">F8 Bayar</span>${App.isKasir() ? '<span class="kbd">F4 Cek stok</span>' : ''}</div>
        </div>
        <div class="pos-search">
          <label class="ig"><span class="adorn">${I('search')}</span><span class="sr-only">Cari barang</span>
            <input class="input" id="pos-q" type="search" placeholder="Cari barang / scan barcode…" autocomplete="off" value="${U.esc(this.q)}"></label>
          <button class="icon-btn" style="width:48px;height:auto" data-act="refresh" aria-label="Muat ulang katalog & stok" title="Muat ulang katalog & stok">${I('refresh')}</button>
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
    const tick = () => { const c = $('[data-clock]', view); if (!c) return clearInterval(this.clock); c.textContent = U.hariPanjang() + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); };
    this.clock = setInterval(tick, 15000); tick();
    if (matchMedia('(min-width: 900px)').matches) setTimeout(() => q.focus(), 50);
    // Segarkan katalog bila sudah lebih dari 60 dtk (stok bisa berubah dari perangkat lain)
    if (Date.now() - (App.state.katalogAt || 0) > 60000) App.refreshKatalog().then(() => { if (this.el === view && view.isConnected) this.redraw(); });
    // Siapkan gambar QRIS di latar agar tampil instan saat dipilih
    if ((App.state.settings || {}).QRIS_Versi) setTimeout(() => this.loadQris(), 800);
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
    if (!this.barang().length) { grid.innerHTML = `<div style="grid-column:1/-1">${View.empty('box', 'Belum ada barang', App.isKasir() ? 'Minta pemilik toko menambahkan barang terlebih dahulu.' : 'Tambahkan barang di menu Barang atau impor dari spreadsheet lama (Pengaturan → Import Data).')}</div>`; return; }
    if (!list.length) { grid.innerHTML = `<div style="grid-column:1/-1">${View.empty('search', 'Barang tidak ditemukan', 'Coba kata kunci lain atau pilih kategori "Semua".')}</div>`; return; }
    const inCart = {}; this.cart.forEach(c => { inCart[c.id] = c.qty; });
    const shown = list.slice(0, 240);
    grid.innerHTML = shown.map(b => {
      const out = b.stok <= 0, low = !out && b.stok <= batas, dec = U.desimal(b.satuan);
      return `<button class="pcard${out ? ' out' : ''}" data-add="${U.esc(b.id)}" ${out ? 'aria-disabled="true"' : ''} aria-label="${dec ? 'Timbang' : 'Tambah'} ${U.esc(b.nama)}, ${U.rp(b.jual)} per ${U.esc(b.satuan)}, stok ${U.esc(this.stokTxt(b))}">
        ${inCart[b.id] ? `<span class="incart" aria-hidden="true">${U.qty(inCart[b.id])}</span>` : ''}
        <span class="ptop"><span class="ph" aria-hidden="true"></span><span class="pmeta"><span class="tag">${U.esc(b.id)}</span>
          <span class="stock-badge${out ? ' out' : low ? ' low' : ''}">${out ? 'Habis' : 'Stok ' + U.esc(U.qtySat(b.stok, b.satuan))}</span></span></span>
        <span class="pname clamp2">${U.esc(b.nama)}</span>
        <span class="pprice-row"><span class="pprice">${U.rp(b.jual)}</span><span class="punit">/ ${U.esc(b.satuan)}</span></span>
        <span class="padd">${out ? 'Stok kosong' : dec ? I('scale', 'ic-sm') + ' Isi berat' : I('plus', 'ic-sm') + ' Tambah'}</span>
      </button>`;
    }).join('') + (list.length > shown.length ? `<p class="caption" style="grid-column:1/-1">Menampilkan ${shown.length} dari ${list.length} barang. Persempit pencarian untuk melihat sisanya.</p>` : '');
  },
  drawCart() {
    const lines = this.lines(), total = this.total(), count = this.count();
    const cart = $('[data-cart]', this.el);
    const head = `<div class="cart-head"><h2>${I('bag')} Keranjang</h2><span class="pill pill-neutral">${U.num(lines.length)} jenis · ${U.qty(count)} item</span>
      <button class="icon-btn plain close-cart" data-act="close-cart" aria-label="Tutup keranjang">${I('x')}</button></div>`;
    if (!lines.length) {
      cart.innerHTML = head + `<div class="cart-empty">${I('cart')}<b>Keranjang masih kosong</b><span class="caption">Pilih barang di katalog atau scan barcode untuk memulai transaksi.</span></div>`;
    } else {
      cart.innerHTML = head + `<div class="cart-list">${lines.map(l => l.ok ? `
        <div class="cline"><div><div class="nm">${U.esc(l.b.nama)}</div><div class="meta">${U.esc(l.b.id)} · ${U.rp(l.b.jual)} / ${U.esc(l.b.satuan)}</div></div>
          <div class="sub">${U.rp(U.sub(l.qty, l.b.jual))}</div>
          <div class="ctrl">${l.dec
            ? `<button class="qty-btn" data-weigh="${U.esc(l.id)}" aria-label="Ubah berat ${U.esc(l.b.nama)}">${I('scale', 'ic-sm')}<b>${U.esc(U.qty(l.qty))}</b> ${U.esc(l.b.satuan)}</button>`
            : `<div class="stepper"><button data-dec="${U.esc(l.id)}" aria-label="Kurangi ${U.esc(l.b.nama)}">${I('minus', 'ic-sm')}</button>
            <input inputmode="numeric" data-qty="${U.esc(l.id)}" value="${l.qty}" aria-label="Jumlah ${U.esc(l.b.nama)}">
            <button data-inc="${U.esc(l.id)}" aria-label="Tambah ${U.esc(l.b.nama)}">${I('plus', 'ic-sm')}</button></div>`}
            <span class="caption grow" style="text-align:right">sisa ${U.esc(this.stokTxt(l.b, l.b.stok - l.qty))}</span>
            <button class="icon-btn plain" data-del="${U.esc(l.id)}" aria-label="Hapus ${U.esc(l.b.nama)}">${I('trash')}</button></div></div>` : `
        <div class="cline"><div><div class="nm strike">${U.esc(l.b ? l.b.nama : l.id)}</div><div class="meta danger-text">Tidak dijual lagi — hapus dari keranjang</div></div>
          <button class="icon-btn plain" data-del="${U.esc(l.id)}" aria-label="Hapus">${I('trash')}</button></div>`).join('')}</div>
        <div class="cart-foot">
          <div class="sumrow"><span>Subtotal ${lines.length} jenis barang</span><button class="btn-link btn" data-act="clear" style="color:var(--danger-text)">Kosongkan</button></div>
          <div class="totalbox"><span class="lbl">Total belanja</span><span class="numeric-total" data-total>${U.rp(total)}</span></div>
          <div class="field"><span class="lbl">Metode pembayaran</span>
            <div class="seg seg-pay" role="group" aria-label="Metode pembayaran">${this.METODE.map(m => `<button data-metode="${m[0]}" aria-pressed="${this.metode === m[0]}">${I(m[1], 'ic-sm')}<span>${m[0]}</span></button>`).join('')}</div></div>
          <div data-cash></div>
          <button class="btn btn-primary btn-block pay-btn" data-act="pay">${I('check')} ${this.metode === 'Tunai' ? 'BAYAR' : 'SUDAH DIBAYAR'} ${U.rp(total)} <span class="kbd">F8</span></button>
          <label class="check"><input type="checkbox" data-autoprint ${this.autoPrint() ? 'checked' : ''}> Cetak struk otomatis</label>
        </div>`;
      this.drawPayPanel();
    }
    $('[data-cartbar]', this.el).innerHTML = `<div class="grow"><span>${U.num(lines.length)} jenis · total sementara</span><b>${U.rp(total)}</b></div>
      <button class="btn btn-primary" data-act="open-cart">${I('cart')} Lihat Keranjang</button>`;
  },

  /* ---------- Panel per metode bayar ---------- */
  drawPayPanel() {
    const box = $('[data-cash]', this.el); if (!box) return;
    if (this.metode === 'Tunai') return this.drawCash(box);
    if (this.metode === 'QRIS') return this.drawQris(box);
    if (this.metode === 'Transfer') return this.drawTransfer(box);
    box.innerHTML = `<p class="caption">Pembayaran lain (mis. e-wallet di luar QRIS, kartu) dicatat sebesar total belanja. Tekan tombol setelah dana benar-benar diterima.</p>`;
  },
  drawCash(box) {
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
  noSetup(what) {
    return App.isKasir()
      ? `<div class="notice">${I('info')}<div>${what} belum diatur. Minta pemilik toko mengisinya di <b>Pengaturan → Pembayaran</b>.</div></div>`
      : `<div class="notice">${I('info')}<div>${what} belum diatur. <a href="#/pengaturan" data-goto-pay>Atur di Pengaturan → Pembayaran</a>.</div></div>`;
  },
  async drawQris(box) {
    const paint = q => {
      if (!box.isConnected || this.metode !== 'QRIS') return;
      if (q === undefined) { box.innerHTML = `<div class="qris-mini">${View.loading('Memuat QRIS…')}</div>`; return; }
      if (!q) { box.innerHTML = this.noSetup('Gambar QRIS toko'); return; }
      box.innerHTML = `<div class="qris-mini">
        <button class="qris-thumb" data-show="QRIS" aria-label="Perbesar QRIS untuk pelanggan"><img src="${q.dataUrl}" alt="QRIS ${U.esc(this.merchant())}"></button>
        <div class="stack-sm grow"><span class="caption">QRIS · ${U.esc(this.merchant())}</span>
          <b class="tnum qris-amt">${U.rp(this.total())}</b>
          <button class="btn btn-sm" data-show="QRIS">${I('expand', 'ic-sm')} Tampilkan ke pelanggan</button></div></div>
        <p class="caption qris-note">Pelanggan memindai, memasukkan nominal di atas, lalu membayar. Tekan <b>Sudah dibayar</b> setelah notifikasi dana masuk.</p>`;
    };
    paint(this.qris && this._qrisAt ? this.qris : undefined);
    if (!this.qris || !this._qrisAt) paint(await this.loadQris());
  },
  drawTransfer(box) {
    const rek = this.rekening();
    if (!rek.length) { box.innerHTML = this.noSetup('Rekening transfer'); return; }
    box.innerHTML = `<div class="rek-list">${rek.map(r => `<div class="rek"><span class="rek-bank">${I('bank', 'ic-sm')}${U.esc(r.bank || 'Bank')}</span>
        <span class="rek-no mono">${U.esc(r.nomor)}</span><span class="caption">a.n. ${U.esc(r.nama || '-')}</span>
        <button class="icon-btn plain rek-copy" data-copy="${U.esc(r.nomor.replace(/[^\d]/g, ''))}" aria-label="Salin nomor rekening ${U.esc(r.bank)}">${I('copy', 'ic-sm')}</button></div>`).join('')}</div>
      <div class="row-wrap" style="justify-content:space-between"><span class="caption">Pastikan transfer <b>${U.rp(this.total())}</b> sudah masuk.</span>
        <button class="btn btn-sm" data-show="Transfer">${I('expand', 'ic-sm')} Tampilkan ke pelanggan</button></div>`;
  },
  async loadQris(force) {
    if (!force && this._qrisAt && Date.now() - this._qrisAt < 10 * 60e3) return this.qris;
    const v = (App.state.settings || {}).QRIS_Versi, c = Store.get('qris');
    if (!force && !this._qrisAt && c && v && c.versi === v) { this.qris = c; this._qrisAt = Date.now(); return c; }
    const r = await API.q('qris.get');
    if (!r.success) { if (this.qris === undefined) this.qris = null; return this.qris; }   // gangguan jaringan: pakai yang ada
    this._qrisAt = Date.now();
    if (!r.data.ada) { this.qris = null; Store.del('qris'); return null; }
    this.qris = { versi: r.data.versi, dataUrl: r.data.dataUrl };
    if (r.data.dataUrl.length < 900000) Store.set('qris', this.qris);
    if (v !== r.data.versi) { App.state.settings.QRIS_Versi = r.data.versi; App.saveBoot(); }
    return this.qris;
  },
  /** Layar besar untuk diarahkan ke pelanggan: QR / rekening + total. */
  showCustomer(kind, opt = {}) {
    const total = opt.total !== undefined ? opt.total : this.total(), s = App.state.settings || {};
    if (!total) return;
    const isQ = kind === 'QRIS';
    if (isQ && !this.qris) return Toast.err('Gambar QRIS belum tersedia.');
    const rek = this.rekening();
    Toast.clear();                                         // jangan ada notifikasi menutupi QR
    Modal.open({
      title: '', size: 'full', headless: true,
      body: `<div class="cust">
        <div class="cust-main">${isQ
          ? `<div class="cust-qr"><img src="${this.qris.dataUrl}" alt="Kode QRIS ${U.esc(this.merchant())}"></div>`
          : `<div class="cust-rek">${rek.map(r => `<div class="rek big"><span class="rek-bank">${I('bank')}${U.esc(r.bank || 'Bank')}</span><span class="rek-no mono">${U.esc(r.nomor)}</span><span>a.n. <b>${U.esc(r.nama || '-')}</b></span></div>`).join('')}</div>`}</div>
        <div class="cust-side">
          <div class="eyebrow">${isQ ? 'Bayar dengan QRIS' : 'Bayar dengan transfer bank'}</div>
          <div class="cust-shop">${U.esc(isQ ? this.merchant() : (s.Nama_Toko || s.Nama_Aplikasi || 'Toko'))}</div>
          <div class="cust-total"><span class="lbl">Total yang harus dibayar</span><span class="v tnum">${U.rp(total)}</span></div>
          <ol class="cust-steps">${isQ
            ? '<li>Buka aplikasi m-banking atau e-wallet apa pun (GoPay, OVO, DANA, ShopeePay, BCA, BRI, dll).</li><li>Pindai kode QR di layar ini.</li><li>Masukkan nominal <b>' + U.rp(total) + '</b>, lalu bayar.</li><li>Tunjukkan bukti berhasil ke kasir.</li>'
            : '<li>Transfer tepat <b>' + U.rp(total) + '</b> ke salah satu rekening.</li><li>Tunjukkan bukti transfer berhasil ke kasir.</li>'}</ol>
          <div class="cust-act"><button class="btn btn-lg" data-close>${I('chevL', 'ic-sm')} ${opt.preview ? 'Tutup pratinjau' : 'Kembali'}</button>
            ${opt.preview ? '' : `<button class="btn btn-primary btn-lg grow" data-paid>${I('check')} Pembayaran diterima</button>`}</div>
          <p class="caption">${opt.preview ? 'Pratinjau tampilan yang dilihat pelanggan di layar kasir.' : 'Kasir: tekan "Pembayaran diterima" hanya setelah dana benar-benar masuk.'}</p>
        </div></div>`,
      onMount: (el, m) => {
        const paid = el.querySelector('[data-paid]');
        if (paid) paid.onclick = async e => { const ok = await this.pay(e.currentTarget, () => m.close()); if (ok) m.close(); };
      }
    });
  },
  drawChange() {
    const box = $('[data-change]', this.el); if (!box) return;
    const total = this.total(), d = this.bayar - total;
    if (!this.bayar) { box.className = 'change'; box.innerHTML = `<span class="lbl">Kembalian</span><span class="v">Rp 0</span>`; return; }
    box.className = 'change' + (d < 0 ? ' short' : '');
    box.innerHTML = d < 0 ? `<span class="lbl">Kurang</span><span class="v">${U.rp(-d)}</span>` : `<span class="lbl">Kembalian</span><span class="v">${U.rp(d)}</span>`;
  },

  /* ---------- Keranjang ---------- */
  add(id, n = 1) {
    const b = this.byId(id);
    if (!b || b.status !== 'Aktif') return Toast.err('Barang tidak tersedia.');
    if (U.desimal(b.satuan)) return this.weigh(id);
    const c = this.cart.find(x => x.id === id), cur = c ? c.qty : 0;
    if (cur + n > b.stok) return Toast.err(b.stok <= 0 ? `${b.nama} sedang habis.` : `Stok ${b.nama} hanya ${U.qty(b.stok)}.`);
    if (c) c.qty += n; else this.cart.push({ id, qty: n });
    this.save(); this.drawCart(); this.drawGrid();
  },
  setQty(id, q) {
    const b = this.byId(id), c = this.cart.find(x => x.id === id);
    if (!c) return;
    q = b && U.desimal(b.satuan) ? Math.round(q * 1000) / 1000 : Math.floor(q);
    if (!(q > 0)) { this.cart = this.cart.filter(x => x.id !== id); }
    else if (b && q > b.stok) { Toast.err(`Stok ${b.nama} hanya ${this.stokTxt(b)}.`); c.qty = b.stok; }
    else c.qty = q;
    this.save(); this.drawCart(); this.drawGrid();
  },
  /** Dialog jumlah untuk barang timbang (kg, ons, liter, meter): pilih cepat, ketik berat, atau ketik nominal Rp. */
  weigh(id) {
    const b = this.byId(id); if (!b) return;
    const c = this.cart.find(x => x.id === id), sat = b.satuan, cur = c ? c.qty : 0;
    const quick = /^ons$/i.test(sat) ? [1, 2, 3, 5] : /^(meter|m)$/i.test(sat) ? [0.5, 1, 2, 5] : [0.25, 0.5, 1, 2, 5];
    const frac = v => ({ 0.25: '¼', 0.5: '½' }[v] || U.qty(v));
    Modal.open({
      title: (c ? 'Ubah jumlah: ' : 'Timbang: ') + U.esc(b.nama), size: 'sm', icon: I('scale'),
      body: `<div class="row-wrap" style="justify-content:space-between"><span><b class="tnum">${U.rp(b.jual)}</b> <span class="caption">/ ${U.esc(sat)}</span></span><span class="caption">Stok tersedia ${U.esc(this.stokTxt(b))}</span></div>
        <div class="wq" role="group" aria-label="Pilihan cepat">${quick.map(v => `<button type="button" data-wq="${v}" ${v > b.stok ? 'disabled' : ''}>${frac(v)} ${U.esc(sat)}</button>`).join('')}</div>
        <div class="grid-2 wgrid"><label class="field"><span class="lbl">Jumlah (${U.esc(sat)})</span><span class="ig"><input class="input input-lg tnum" data-wqty inputmode="decimal" autocomplete="off" placeholder="0" value="${cur ? U.esc(U.qty(cur)) : ''}"><span class="pre">${U.esc(sat)}</span></span></label>
          <label class="field"><span class="lbl">atau nominal</span><span class="ig"><span class="pre">Rp</span><input class="input input-lg tnum" data-wrp inputmode="numeric" autocomplete="off" placeholder="0" value="${cur ? U.num(U.sub(cur, b.jual)) : ''}"></span></label></div>
        <div class="wsum"><span class="lbl">Subtotal</span><b class="tnum" data-wsub>${U.rp(U.sub(cur, b.jual))}</b></div>
        <p class="hint">Contoh: ketik <b>1,5</b> untuk 1½ ${U.esc(sat)}, atau isi nominal <b>Rp 10.000</b> bila pelanggan membeli berdasarkan uang.</p>
        <p class="err-text" data-werr role="alert"></p>`,
      foot: `${c ? `<button class="btn btn-danger" data-wdel>${I('trash', 'ic-sm')} Hapus</button><span class="grow"></span>` : ''}<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-wok>${I('check', 'ic-sm')} ${c ? 'Perbarui' : 'Masukkan'} <span class="kbd">Enter</span></button>`,
      onMount: (el, m) => {
        const iq = el.querySelector('[data-wqty]'), ir = el.querySelector('[data-wrp]'), sub = el.querySelector('[data-wsub]'), err = el.querySelector('[data-werr]');
        let q = cur;
        const show = () => { sub.textContent = U.rp(U.sub(q, b.jual)); err.textContent = q > b.stok ? `Melebihi stok (${this.stokTxt(b)}).` : ''; };
        iq.addEventListener('input', () => { iq.value = U.cleanQty(iq.value, true); q = U.parseQty(iq.value); ir.value = q ? U.num(U.sub(q, b.jual)) : ''; show(); });
        ir.addEventListener('input', () => { const n = U.parseNum(ir.value); ir.value = n ? U.num(n) : ''; q = n ? Math.round(n / b.jual * 1000) / 1000 : 0; iq.value = q ? U.qty(q) : ''; show(); });
        const commit = () => {
          if (!(q > 0)) { err.textContent = 'Isi jumlah atau nominal terlebih dahulu.'; iq.focus(); return; }
          if (q > b.stok) { err.textContent = `Melebihi stok (${this.stokTxt(b)}).`; return; }
          const x = this.cart.find(y => y.id === id); if (x) x.qty = q; else this.cart.push({ id, qty: q });
          this.save(); this.drawCart(); this.drawGrid(); m.close();
          const s = $('#pos-q', this.el); if (s && matchMedia('(min-width: 900px)').matches) s.focus();
        };
        el.querySelectorAll('[data-wq]').forEach(x => x.onclick = () => { q = Number(x.dataset.wq); iq.value = U.qty(q); ir.value = U.num(U.sub(q, b.jual)); show(); commit(); });
        el.querySelector('[data-wok]').onclick = commit;
        const del = el.querySelector('[data-wdel]'); if (del) del.onclick = () => { m.close(); this.setQty(id, 0); };
        el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); commit(); } });
        setTimeout(() => { iq.focus(); iq.select(); }, 40);
      }
    });
  },
  enterSearch(v) {
    const q = String(v || '').trim(); if (!q) return;
    const a = this.aktif();
    const exact = a.find(b => b.barcode && b.barcode === q) || a.find(b => b.id.toLowerCase() === q.toLowerCase());
    const pick = exact || (this.filtered().length === 1 ? this.filtered()[0] : null);
    if (pick) { const el = $('#pos-q', this.el); el.value = ''; this.q = ''; this.drawGrid(); this.add(pick.id); if (!U.desimal(pick.satuan)) el.focus(); }
    else if (!this.filtered().length) Toast.err('Barang "' + q + '" tidak ditemukan.');
  },
  onClick(e) {
    if (e.target.closest('[data-goto-pay]')) { PageSetting.tab = 'pembayaran'; return; }
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.add !== undefined) { if (t.getAttribute('aria-disabled') !== 'true') this.add(t.dataset.add); return; }
    if (t.dataset.kat !== undefined) { this.kat = t.dataset.kat; this.drawChips(); this.drawGrid(); return; }
    if (t.dataset.inc) { const c = this.cart.find(x => x.id === t.dataset.inc); this.setQty(t.dataset.inc, (c ? c.qty : 0) + 1); return; }
    if (t.dataset.dec) { const c = this.cart.find(x => x.id === t.dataset.dec); this.setQty(t.dataset.dec, (c ? c.qty : 0) - 1); return; }
    if (t.dataset.weigh) { this.weigh(t.dataset.weigh); return; }
    if (t.dataset.del) { this.setQty(t.dataset.del, 0); return; }
    if (t.dataset.metode) { this.metode = t.dataset.metode; this.ref = null; this.drawCart(); return; }
    if (t.dataset.cash) { this.bayar = Number(t.dataset.cash); const i = $('#pos-bayar', this.el); if (i) i.value = U.num(this.bayar); this.drawChange(); return; }
    if (t.dataset.show) { this.showCustomer(t.dataset.show); return; }
    if (t.dataset.copy) { U.copy(t.dataset.copy).then(ok => ok ? Toast.ok('Nomor rekening disalin.') : Toast.err('Gagal menyalin.')); return; }
    const act = t.dataset.act;
    if (act === 'pay') this.pay(t);
    else if (act === 'clear') this.clear();
    else if (act === 'open-cart') $('[data-cart]', this.el).classList.add('open');
    else if (act === 'close-cart') $('[data-cart]', this.el).classList.remove('open');
    else if (act === 'refresh') busy(t, async () => { await App.refreshKatalog(true); this.redraw(); Toast.ok('Katalog & stok diperbarui.'); }, '');
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
  /** Simpan transaksi. onBeforeSuccess: dipanggil sebelum dialog sukses (mis. menutup layar pelanggan). */
  async pay(btn, onBeforeSuccess) {
    const lines = this.lines(), total = this.total();
    if (!lines.length) { Toast.err('Keranjang masih kosong.'); return false; }
    if (lines.some(l => !l.ok)) { Toast.err('Hapus dulu barang yang sudah tidak dijual.'); return false; }
    if (this.metode === 'Tunai' && this.bayar < total) {
      Toast.err('Uang pembayaran kurang ' + U.rp(total - this.bayar) + '.');
      const i = $('#pos-bayar', this.el); if (i) { i.classList.add('invalid'); i.focus(); setTimeout(() => i.classList.remove('invalid'), 1500); }
      return false;
    }
    btn = btn || $('[data-act="pay"]', this.el);
    if (!this.ref) this.ref = U.uuid();
    const payload = { ref: this.ref, metode: this.metode, bayar: this.metode === 'Tunai' ? this.bayar : total,
      items: lines.map(l => ({ id: l.id, qty: l.qty, harga: l.b.jual })) };
    const r = await busy(btn, () => API.call('transaksi.create', payload, { retry: 2 }), 'Menyimpan transaksi…');
    if (!r) return false;
    if (!r.success) {
      if (r.data && r.data.katalog) { App.setKatalog(r.data.katalog); this.redraw(); }
      if (r.code !== 'NETWORK') this.ref = null;            // gagal validasi → percobaan berikutnya kunci baru
      Toast.err(r.message); return false;
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
    if (onBeforeSuccess) onBeforeSuccess();
    this.success(d);
    if (this.autoPrint()) setTimeout(() => Receipt.print(d), 250);
    return true;
  },
  success(d) {
    const tunai = d.metode === 'Tunai';
    Modal.open({
      title: '', size: 'sm', headless: true,
      body: `<div class="stack" style="text-align:center;gap:8px"><div class="success-ico">${I('check')}</div>
          <h2 style="font-size:22px">Transaksi Berhasil</h2><p class="muted">Pembayaran tercatat dan stok sudah diperbarui.</p></div>
        <dl class="kv"><dt>No. transaksi</dt><dd class="mono">${U.esc(d.id)}</dd><dt>Waktu</dt><dd>${U.esc(U.tgl(d.waktu))}</dd>
          <dt>Metode bayar</dt><dd>${View.metode(d.metode)}</dd><dt>Total belanja</dt><dd>${U.rp(d.total)}</dd>${tunai ? `<dt>Uang diterima</dt><dd>${U.rp(d.bayar)}</dd>` : ''}</dl>
        ${tunai ? `<div class="bigchange"><span class="lbl">Kembalian</span><span class="v">${U.rp(d.kembali)}</span></div>`
          : `<div class="bigchange"><span class="lbl">Status</span><span class="v" style="font-size:24px">LUNAS · ${U.esc(d.metode)}</span></div>`}
        <details><summary class="caption" style="cursor:pointer">Rincian belanja (${d.items.length} jenis barang)</summary>
          <div class="stack-sm" style="margin-top:8px">${d.items.map(i => `<div class="row" style="justify-content:space-between;align-items:flex-start"><span>${U.esc(U.qtySat(i.qty, i.satuan))} × ${U.esc(i.nama)}</span><b class="tnum">${U.rp(i.subtotal)}</b></div>`).join('')}</div></details>`,
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
