/* ==========================================================================
   KasirMart — app.js
   Boot, login (Pemilik / Kasir), layout per peran, router, pintasan, sesi.
   ========================================================================== */
'use strict';

const App = {
  state: { settings: null, katalog: null, katalogAt: 0, me: null, version: '', route: '', users: null },
  shell: false,
  /** roles: siapa yang boleh membuka halaman. Server tetap memeriksa ulang setiap aksi. */
  routes: {
    dashboard: { label: 'Dashboard', icon: 'grid', page: () => PageDashboard, roles: ['admin'] },
    kasir: { label: 'Kasir', icon: 'cart', page: () => Kasir, roles: ['admin', 'kasir'] },
    riwayat: { label: 'Riwayat Transaksi', labelKasir: 'Transaksi Saya', icon: 'receipt', page: () => PageRiwayat, roles: ['admin', 'kasir'] },
    cekstok: { label: 'Cek Stok', icon: 'stock', page: () => PageCekStok, roles: ['kasir'] },
    barang: { label: 'Barang', icon: 'box', page: () => PageBarang, roles: ['admin'] },
    kategori: { label: 'Kategori', icon: 'tag', page: () => PageKategori, roles: ['admin'] },
    stok: { label: 'Stok', icon: 'stock', page: () => PageStok, roles: ['admin'] },
    laporan: { label: 'Laporan', icon: 'chart', page: () => PageLaporan, roles: ['admin'] },
    pengaturan: { label: 'Pengaturan', icon: 'sliders', page: () => PageSetting, roles: ['admin'] }
  },
  role() { return (this.state.me && this.state.me.role) === 'kasir' ? 'kasir' : 'admin'; },
  isKasir() { return this.role() === 'kasir'; },
  home() { return this.isKasir() ? 'kasir' : 'dashboard'; },
  label(k) { const r = this.routes[k]; return (this.isKasir() && r.labelKasir) || r.label; },

  /* ------------------------------------------------------------- Boot */
  async start() {
    API.handlers.auth = () => this.sessionExpired();
    API.handlers.mustChange = () => this.forceChange();
    if (!API.configured()) return this.renderConfigError();
    const boot = Store.get('boot');
    if (boot && boot.settings) Theme.apply(boot.settings);
    if (!Session.valid()) return this.showLogin();
    if (boot && boot.katalog && boot.me) { this.applyBoot(boot); this.renderShell(); this.route(); }
    const r = await API.call('boot', {}, { retry: 2 });
    if (!r.success) {
      if (r.code === 'AUTH' || r.code === 'MUST_CHANGE') return;
      if (!this.shell) return this.renderBootError(r.message);
      Toast.err('Memakai data tersimpan di perangkat. ' + r.message);
      return;
    }
    const roleBefore = this.shell ? this.role() : null;
    this.applyBoot({ settings: r.data.settings, katalog: r.data.katalog, me: r.data.me, version: r.data.version });
    if (r.data.mustChange) { if (!this.shell) this.renderShell(true); return this.forceChange(); }
    this.state.katalogAt = Date.now();
    this.saveBoot();
    if (!this.shell || roleBefore !== this.role()) { this.renderShell(); this.route(); }
    else { this.updateBrand(); this.updateWho(); this.updateBadges(); if (!Modal.stack.length) this.rerender(); }
    if (!this.isKasir()) API.warm('admin');
  },
  applyBoot(b) {
    Object.assign(this.state, { settings: b.settings || this.state.settings, katalog: b.katalog || this.state.katalog, me: b.me || this.state.me, version: b.version || this.state.version });
    document.body.dataset.role = this.role();
    Theme.apply(this.state.settings);
  },
  saveBoot() { Store.set('boot', { settings: this.state.settings, katalog: this.state.katalog, me: this.state.me, version: this.state.version, at: Date.now() }); },
  setKatalog(k) { if (!k) return; this.state.katalog = k; this.state.katalogAt = Date.now(); this.saveBoot(); this.updateBadges(); },
  setSettings(s) { if (!s) return; this.state.settings = s; Theme.apply(s); this.saveBoot(); this.updateBrand(); },
  async refreshKatalog(force) {
    if (!force && Date.now() - this.state.katalogAt < 20000) return;
    const r = await API.q('katalog');
    if (r.success) this.setKatalog(r.data);
  },

  /* ------------------------------------------------------------- Layar khusus */
  renderConfigError() {
    $('#root').innerHTML = `<div class="login-wrap"><div class="login-card setup-card">
      <div class="login-strip"><span><span class="sq"></span>Konfigurasi belum lengkap</span><span class="danger-text">[BELUM SIAP]</span></div>
      <h1 style="font-size:22px">URL backend belum diisi</h1>
      <p>Buka berkas <b class="mono">js/config.js</b>, lalu ganti <span class="mono">GANTI_DENGAN_ID_DEPLOYMENT</span> dengan URL Web App Google Apps Script Anda (berakhiran <span class="mono">/exec</span>).</p>
      <pre class="mono" style="background:var(--panel);padding:12px;border:1px solid var(--border);overflow:auto;font-size:12px">window.APP_CONFIG = {\n  GAS_URL: 'https://script.google.com/macros/s/AKfy…/exec'\n};</pre>
      <p class="caption">Setelah disimpan, jalankan <span class="mono">git add . &amp;&amp; git commit -m "isi URL" &amp;&amp; git push</span>, lalu muat ulang halaman ini (Ctrl+Shift+R).</p></div></div>`;
  },
  renderBootError(msg) {
    $('#root').innerHTML = `<div class="login-wrap"><div class="login-card"><div class="notice danger">${I('wifiOff')}<div><b>Tidak dapat terhubung ke server.</b><br>${U.esc(msg)}</div></div>
      <button class="btn btn-primary btn-block" onclick="location.reload()">${I('refresh', 'ic-sm')} Coba lagi</button>
      <button class="btn btn-block" data-out>Keluar &amp; masuk ulang</button></div></div>`;
    $('[data-out]').onclick = () => this.logout(true);
  },

  /* ------------------------------------------------------------- Login */
  async showLogin(msg) {
    this.shell = false;
    Toast.clear();
    delete document.body.dataset.role;
    Store.del('token'); Store.del('tokenExp');
    const s = (Store.get('boot') || {}).settings || {};
    let mode = Store.get('loginMode') === 'kasir' ? 'kasir' : 'admin';
    $('#root').innerHTML = `<main class="login-wrap"><div class="login-card">
      <div class="login-strip"><span><span class="sq"></span><span data-strip>Masuk ke aplikasi</span></span><span data-srv class="faint">[MEMERIKSA…]</span></div>
      <div class="login-brand" data-brand>${View.logo(s, 64)}<h1>${U.esc(s.Nama_Aplikasi || 'KasirMart')}</h1><p class="muted">Aplikasi Kasir Toko Sembako</p></div>
      <div class="field"><span class="lbl">Masuk sebagai</span>
        <div class="seg seg-lg" role="group" aria-label="Masuk sebagai"><button type="button" data-mode="admin">${I('store', 'ic-sm')} Pemilik</button><button type="button" data-mode="kasir">${I('user', 'ic-sm')} Kasir</button></div></div>
      <div data-err ${msg ? '' : 'hidden'}>${msg ? this.loginErr('Sesi berakhir', msg) : ''}</div>
      <form class="stack" data-login novalidate>
        <label class="field" data-ufield><span class="lbl">Nama pengguna kasir</span>
          <span class="ig"><span class="adorn">${I('user', 'ic-sm')}</span><input class="input input-lg" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Contoh: sari" value="${U.esc(Store.get('lastUser') || '')}"></span></label>
        <label class="field"><span class="lbl-row"><span class="lbl" data-pwlbl>Kata sandi</span><span class="caption mono hide-mobile">[Enter: Masuk]</span></span>
          <span class="ig"><span class="adorn">${I('lock', 'ic-sm')}</span><input class="input input-lg" type="password" name="password" autocomplete="current-password" placeholder="Masukkan kata sandi…" required>
          <button type="button" class="icon-btn" data-eye aria-label="Tampilkan kata sandi">${I('eye', 'ic-sm')}</button></span></label>
        <button class="btn btn-primary btn-lg btn-block" type="submit">MASUK ${I('arrowR', 'ic-sm')}</button>
      </form>
      <div class="login-store">${I('store', 'ic-sm')}<span class="grow">Toko: <b data-store>${U.esc(s.Nama_Toko || 'Toko Sembako')}</b></span></div>
      <div class="login-foot" data-foot></div>
    </div></main>`;
    const f = $('[data-login]');
    const setMode = m => {
      mode = m; Store.set('loginMode', m);
      $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
      $('[data-ufield]').hidden = m !== 'kasir';
      $('[data-strip]').textContent = m === 'kasir' ? 'Login kasir' : 'Login pemilik toko';
      $('[data-pwlbl]').textContent = m === 'kasir' ? 'Kata sandi kasir' : 'Kata sandi pemilik';
      $('[data-foot]').innerHTML = m === 'kasir'
        ? `v${APP_FE_VERSION} · Akun kasir dibuat oleh pemilik toko.<br>Lupa kata sandi? Minta pemilik mereset di <b>Pengaturan → Pengguna kasir</b>.`
        : `v${APP_FE_VERSION} · Google Apps Script &amp; Sheets<br>Lupa kata sandi? Jalankan <span class="mono">resetSandiAdmin()</span> di editor Apps Script.`;
      const e = $('[data-err]'); if (e && !msg) e.hidden = true;
      setTimeout(() => (m === 'kasir' && !f.username.value ? f.username : f.password).focus(), 30);
    };
    $$('[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
    setMode(mode);
    $('[data-eye]').onclick = e => { const i = f.password, show = i.type === 'password'; i.type = show ? 'text' : 'password'; e.currentTarget.innerHTML = I(show ? 'eyeOff' : 'eye', 'ic-sm'); e.currentTarget.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'); };
    f.onsubmit = e => {
      e.preventDefault();
      const pw = f.password.value, user = mode === 'kasir' ? f.username.value.trim().toLowerCase() : '';
      if (mode === 'kasir' && !user) { this.loginShow('Nama pengguna kosong', 'Masukkan nama pengguna kasir.'); f.username.focus(); return; }
      if (!pw) { this.loginShow('Kata sandi kosong', 'Masukkan kata sandi.'); f.password.focus(); return; }
      busy(f.querySelector('[type=submit]'), async () => {
        const r = await API.call('auth.login', mode === 'kasir' ? { username: user, password: pw } : { password: pw }, { silentAuth: true });
        if (!r.success) { this.loginShow(r.code === 'LOCKED' ? 'Akses dikunci sementara' : r.code === 'DISABLED' ? 'Akun nonaktif' : 'Otentikasi gagal', r.message); f.password.select(); return; }
        if (mode === 'kasir') Store.set('lastUser', user);
        Toast.clear();
        this.resetForUser(r.data.me);
        Session.set(r.data.token, r.data.exp);
        this.state.me = r.data.me;
        document.body.dataset.role = this.role();
        if (r.data.mustChange) { this.renderShell(true); this.forceChange(); return; }
        $('#root').innerHTML = `<div class="boot-screen">${View.loading(this.isKasir() ? 'Membuka kasir…' : 'Menyiapkan aplikasi…')}</div>`;
        this.start();
      }, 'Memeriksa…');
    };
    API.warm('pub');
    const p = await API.get({ action: 'publicSettings' });
    const srv = $('[data-srv]'); if (!srv) return;
    if (p.success) {
      srv.innerHTML = '<span class="accent">[SERVER SIAP]</span>';
      Theme.apply(p.data);
      const b = Store.get('boot') || {}; b.settings = Object.assign({}, b.settings || {}, p.data); Store.set('boot', b);
      $('[data-brand]').innerHTML = `${View.logo(p.data, 64)}<h1>${U.esc(p.data.Nama_Aplikasi)}</h1><p class="muted">Aplikasi Kasir Toko Sembako</p>`;
      $('[data-store]').textContent = p.data.Nama_Toko || 'Toko Sembako';
    } else {
      srv.innerHTML = `<span class="danger-text">[${p.code === 'SETUP' ? 'BELUM DISIAPKAN' : 'TIDAK TERHUBUNG'}]</span>`;
      this.loginShow(p.code === 'SETUP' ? 'Backend belum disiapkan' : 'Server tidak terhubung', p.message);
    }
  },
  /** Ganti pengguna di perangkat yang sama → buang data milik pengguna sebelumnya (harga modal, dashboard). */
  resetForUser(me) {
    const b = Store.get('boot') || {};
    if (!b.me || b.me.u !== me.u) {
      Store.set('boot', { settings: b.settings });
      Store.del('dash'); Store.del('lastRoute'); Store.del('qris');
      this.state.katalog = null; this.state.users = null;
      if (typeof PageRiwayat !== 'undefined') PageRiwayat.st = null;
      if (typeof Kasir !== 'undefined') { Kasir.metode = 'Tunai'; Kasir.bayar = 0; }
    }
  },
  loginErr(t, m) { return `<div class="notice danger" role="alert">${I('alert')}<div><b>${U.esc(t)}</b><br>${U.esc(m)}</div></div>`; },
  loginShow(t, m) { const e = $('[data-err]'); if (e) { e.hidden = false; e.innerHTML = this.loginErr(t, m); } },
  sessionExpired() {
    if (this._expiring) return;
    this._expiring = true;
    Modal.stack.slice().forEach(m => m.close());
    this.showLogin('Sesi Anda berakhir atau dicabut. Silakan masuk lagi.').finally(() => { this._expiring = false; });
  },
  async logout(skipServer) {
    if (!skipServer) API.call('auth.logout', {}, { silentAuth: true });
    Session.clear();
    Store.del('dash');
    Modal.stack.slice().forEach(m => m.close());
    this.showLogin();
  },

  /* ------------------------------------------------------------- Ganti sandi */
  pwRule() { return this.isKasir() ? 'Minimal 6 karakter (boleh angka saja / PIN).' : 'Minimal 8 karakter, berisi huruf dan angka.'; },
  forceChange() {
    if (Modal.stack.some(m => m.el.dataset.force)) return;
    const k = this.isKasir();
    Modal.open({
      title: 'Buat kata sandi baru', size: 'sm', dismissible: false, icon: I('key'),
      body: `<div class="notice info">${I('shield')}<div>${k ? 'Anda masuk memakai <b>kata sandi sementara</b> dari pemilik toko.' : 'Anda masuk memakai <b>kata sandi awal</b> dari log setup.'} Demi keamanan, buat kata sandi baru yang hanya Anda ketahui.</div></div>
        <form class="stack" data-pw autocomplete="off">
          <label class="field"><span class="lbl">Kata sandi ${k ? 'sementara' : 'awal'} (saat ini)</span><input class="input" type="password" name="lama" autocomplete="current-password"></label>
          <label class="field"><span class="lbl">Kata sandi baru</span><input class="input" type="password" name="baru" autocomplete="new-password"><span class="hint">${this.pwRule()}</span></label>
          <label class="field"><span class="lbl">Ulangi kata sandi baru</span><input class="input" type="password" name="ulang" autocomplete="new-password"></label>
          <p class="err-text" data-pw-err role="alert"></p></form>`,
      foot: `<button class="btn" data-out>Keluar</button><button class="btn btn-primary" data-save>${I('check', 'ic-sm')} Simpan kata sandi</button>`,
      onMount: (el, m) => {
        el.dataset.force = '1';
        const f = el.querySelector('[data-pw]');
        f.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.querySelector('[data-save]').click(); } });
        el.querySelector('[data-out]').onclick = () => { m.close(); this.logout(); };
        el.querySelector('[data-save]').onclick = async e => {
          const ok = await this.changePassword(f, el.querySelector('[data-pw-err]'), e.currentTarget);
          if (ok) { m.close(); $('#root').innerHTML = `<div class="boot-screen">${View.loading('Menyiapkan aplikasi…')}</div>`; this.shell = false; this.start(); }
        };
      }
    });
  },
  async changePassword(form, errEl, btn) {
    const lama = form.lama.value, baru = form.baru.value, ulang = form.ulang.value;
    errEl.textContent = '';
    if (!lama || !baru) { errEl.textContent = 'Isi kata sandi lama dan baru.'; return false; }
    const lemah = this.isKasir() ? baru.length < 6 : (baru.length < 8 || !/[A-Za-z]/.test(baru) || !/\d/.test(baru));
    if (lemah) { errEl.textContent = 'Kata sandi baru terlalu lemah. ' + this.pwRule(); return false; }
    if (baru !== ulang) { errEl.textContent = 'Konfirmasi kata sandi baru tidak sama.'; form.ulang.focus(); return false; }
    const r = await busy(btn, () => API.call('auth.changePassword', { lama, baru }), 'Menyimpan…');
    if (!r || !r.success) { errEl.textContent = (r && r.message) || 'Gagal menyimpan.'; return false; }
    Session.set(r.data.token, r.data.exp);
    form.reset();
    Toast.ok(r.message + ' Perangkat lain telah dikeluarkan.');
    return true;
  },
  /** Kasir: ganti sandi dari menu akun. */
  openPassword() {
    Modal.open({
      title: 'Ganti kata sandi', size: 'sm', icon: I('key'),
      body: `<form class="stack" data-pw autocomplete="off">
          <label class="field"><span class="lbl">Kata sandi saat ini</span><input class="input" type="password" name="lama" autocomplete="current-password"></label>
          <label class="field"><span class="lbl">Kata sandi baru</span><input class="input" type="password" name="baru" autocomplete="new-password"><span class="hint">${this.pwRule()}</span></label>
          <label class="field"><span class="lbl">Ulangi kata sandi baru</span><input class="input" type="password" name="ulang" autocomplete="new-password"></label>
          <p class="err-text" data-pw-err role="alert"></p></form>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-save>${I('check', 'ic-sm')} Simpan</button>`,
      onMount: (el, m) => {
        const f = el.querySelector('[data-pw]');
        f.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.querySelector('[data-save]').click(); } });
        el.querySelector('[data-save]').onclick = async e => { if (await this.changePassword(f, el.querySelector('[data-pw-err]'), e.currentTarget)) m.close(); };
      }
    });
  },

  /* ------------------------------------------------------------- Layout */
  renderShell(minimal) {
    this.shell = true;
    document.body.dataset.role = this.role();
    if (this.isKasir()) return this.renderShellKasir(minimal);
    const nav = (k, extra = '') => { const r = this.routes[k]; return `<a class="nav-item" href="#/${k}" data-nav="${k}">${I(r.icon)}<span>${r.label}</span>${extra}</a>`; };
    $('#root').innerHTML = `<div class="app" id="app">
      <aside class="sidebar" aria-label="Menu utama">
        <a class="brand" href="#/dashboard" data-brand style="text-decoration:none;color:inherit"></a>
        <nav class="nav">
          ${nav('dashboard')}${nav('kasir')}${nav('riwayat')}
          <div class="nav-sec">Inventori</div>${nav('barang')}${nav('kategori')}${nav('stok', '<span class="pill pill-danger" data-badge hidden></span>')}
          <div class="nav-sec">Analitik &amp; sistem</div>${nav('laporan')}${nav('pengaturan')}
        </nav>
        <div class="side-foot"><button class="nav-item" data-logout>${I('logout')}<span>Keluar</span></button></div>
      </aside>
      <div class="main">
        <div class="offline-bar" data-offline hidden>${I('wifiOff', 'ic-sm')} Tidak ada koneksi internet. Transaksi tidak bisa disimpan sampai koneksi kembali.</div>
        <header class="topbar">
          <button class="icon-btn menu-btn" data-menu aria-label="Buka menu">${I('menu')}</button>
          <span class="topbar-title" data-title>Sistem Kasir Operasional</span>
          <div class="topbar-right">
            <span class="datebox" data-date>${U.esc(U.hariPanjang())}</span>
            <span class="pill pill-ok hide-sm" data-net title="Status koneksi">Online</span>
            <button class="icon-btn" data-bell aria-label="Barang stok habis">${I('bell')}<span class="dot" data-bell-dot hidden></span></button>
            <div class="who" data-who></div>
          </div>
        </header>
        <main class="view" id="view" tabindex="-1">${minimal ? View.loading('Menunggu kata sandi baru…') : ''}</main>
      </div>
      <nav class="bottomnav" aria-label="Navigasi cepat">
        <a href="#/dashboard" data-nav="dashboard">${I('grid')}Beranda</a><a href="#/kasir" data-nav="kasir">${I('cart')}Kasir</a>
        <a href="#/barang" data-nav="barang">${I('box')}Barang</a><a href="#/riwayat" data-nav="riwayat">${I('receipt')}Riwayat</a>
        <button data-menu>${I('menu')}Menu<span class="pill pill-danger" data-badge2 hidden></span></button>
      </nav></div>`;
    this.bindShell();
  },
  /** Tampilan kasir: tanpa menu samping, fokus ke layar jual. */
  renderShellKasir(minimal) {
    const tab = k => { const r = this.routes[k]; return `<a class="ktab" href="#/${k}" data-nav="${k}">${I(r.icon, 'ic-sm')}<span>${this.label(k)}</span>${k === 'cekstok' ? '<span class="pill pill-danger" data-badge hidden></span>' : ''}</a>`; };
    $('#root').innerHTML = `<div class="app kmode" id="app">
      <div class="main">
        <div class="offline-bar" data-offline hidden>${I('wifiOff', 'ic-sm')} Tidak ada koneksi internet. Transaksi tidak bisa disimpan sampai koneksi kembali.</div>
        <header class="topbar">
          <a class="brand kbrand" href="#/kasir" data-brand style="text-decoration:none;color:inherit"></a>
          <nav class="ktabs" aria-label="Menu kasir">${tab('kasir')}${tab('cekstok')}${tab('riwayat')}</nav>
          <div class="topbar-right">
            <span class="datebox" data-date>${U.esc(U.hariPanjang())}</span>
            <span class="pill pill-ok hide-sm" data-net title="Status koneksi">Online</span>
            <button class="icon-btn" data-bell aria-label="Barang stok habis">${I('bell')}<span class="dot" data-bell-dot hidden></span></button>
            <div class="who who-btn" data-who data-acct role="button" tabindex="0" aria-haspopup="menu" aria-label="Menu akun"></div>
          </div>
        </header>
        <main class="view" id="view" tabindex="-1">${minimal ? View.loading('Menunggu kata sandi baru…') : ''}</main>
      </div>
      <nav class="bottomnav four" aria-label="Navigasi kasir">
        <a href="#/kasir" data-nav="kasir">${I('cart')}Kasir</a><a href="#/cekstok" data-nav="cekstok">${I('stock')}Cek Stok<span class="pill pill-danger" data-badge2 hidden></span></a>
        <a href="#/riwayat" data-nav="riwayat">${I('receipt')}Transaksi</a><button data-acct>${I('user')}Akun</button>
      </nav></div>`;
    this.bindShell();
  },
  bindShell() {
    const app = $('#app');
    app.addEventListener('click', e => {
      if (e.target.closest('[data-menu]')) { app.classList.toggle('nav-open'); return; }
      if (e.target.closest('[data-logout]')) { this.confirmLogout(); return; }
      if (e.target.closest('[data-acct]')) { this.accountMenu(); return; }
      if (e.target.closest('[data-bell]')) {
        if (this.isKasir()) { PageCekStok.st.kondisi = 'Habis'; location.hash = '#/cekstok'; if (this.state.route === 'cekstok') this.rerender(); }
        else { PageStok.st.kondisi = 'Habis'; PageStok.st.tab = 'stok'; location.hash = '#/stok'; if (this.state.route === 'stok') this.rerender(); }
        return;
      }
      if (app.classList.contains('nav-open') && (e.target.closest('.nav-item') || e.target === app)) app.classList.remove('nav-open');
    });
    app.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-acct]')) this.accountMenu(); });
    app.addEventListener('pointerdown', e => { if (app.classList.contains('nav-open') && !e.target.closest('.sidebar') && !e.target.closest('[data-menu]')) app.classList.remove('nav-open'); });
    this.updateBrand(); this.updateWho(); this.updateBadges(); this.updateNet();
  },
  accountMenu() {
    const me = this.state.me || {};
    Modal.open({
      title: 'Akun kasir', size: 'sm', icon: I('user'),
      body: `<div class="acct"><span class="avatar lg" aria-hidden="true">${U.esc(U.initials(me.nama))}</span><div><b>${U.esc(me.nama || '-')}</b><span class="caption mono">@${U.esc(me.u || '')} · Kasir</span></div></div>
        <div class="stack-sm"><button class="btn btn-block btn-left" data-pw>${I('key', 'ic-sm')} Ganti kata sandi</button>
        <button class="btn btn-block btn-left btn-danger" data-out>${I('logout', 'ic-sm')} Keluar</button></div>
        <p class="caption">Sesi berlaku 12 jam. Selalu keluar bila perangkat dipakai bergantian.</p>`,
      onMount: (el, m) => {
        el.querySelector('[data-pw]').onclick = () => { m.close(); this.openPassword(); };
        el.querySelector('[data-out]').onclick = () => { m.close(); this.confirmLogout(); };
      }
    });
  },
  async confirmLogout() {
    if (Kasir.cart.length && !(await Modal.confirm({ title: 'Keluar dari aplikasi?', message: 'Keranjang kasir masih berisi barang. Isinya tetap tersimpan di perangkat ini.', okText: 'Keluar' }))) return;
    this.logout();
  },
  updateBrand() {
    const s = this.state.settings || {}, b = $('[data-brand]');
    if (b) b.innerHTML = `${View.logo(s, 40)}<span class="brand-txt"><span class="brand-name">${U.esc(s.Nama_Aplikasi || 'KasirMart')}</span><span class="brand-sub">${U.esc(s.Nama_Toko || 'Toko sembako')}</span></span>`;
  },
  updateWho() {
    const me = this.state.me || {}, w = $('[data-who]'); if (!w) return;
    w.innerHTML = `<div class="who-txt"><b>${U.esc(me.nama || 'Admin Toko')}</b><span>${U.esc(me.peran || 'Pemilik (Owner)')}</span></div><span class="avatar" aria-hidden="true">${this.isKasir() ? U.esc(U.initials(me.nama)) : I('user')}</span>`;
  },
  updateBadges() {
    const n = ((this.state.katalog || {}).barang || []).filter(b => b.status === 'Aktif' && b.stok <= 0).length;
    const b = $('[data-badge]'), b2 = $('[data-badge2]'), dot = $('[data-bell-dot]');
    if (b) { b.hidden = !n; b.textContent = this.isKasir() ? n : n + ' habis'; }
    if (b2) { b2.hidden = !n; b2.textContent = n; }
    if (dot) { dot.hidden = !n; dot.textContent = n > 99 ? '99+' : n; }
    const bell = $('[data-bell]'); if (bell) bell.setAttribute('aria-label', n ? `${n} barang stok habis` : 'Tidak ada barang stok habis');
  },
  updateNet() {
    const on = navigator.onLine, bar = $('[data-offline]'), pill = $('[data-net]');
    if (bar) bar.hidden = on;
    if (pill) { pill.textContent = on ? 'Online' : 'Offline'; pill.className = 'pill hide-sm ' + (on ? 'pill-ok' : 'pill-danger'); }
  },
  title() {
    const t = $('[data-title]'); if (!t) return;
    const r = this.routes[this.state.route];
    t.textContent = r && matchMedia('(max-width: 767px)').matches ? this.label(this.state.route) : 'Sistem Kasir Operasional';
  },

  /* ------------------------------------------------------------- Router */
  allowed(k) { const r = this.routes[k]; return !!r && r.roles.includes(this.role()); },
  route() {
    if (!this.shell) return;
    let k = (location.hash.match(/^#\/([a-z]+)/) || [])[1] || Store.get('lastRoute') || this.home();
    if (!this.allowed(k)) k = this.home();
    if (location.hash !== '#/' + k) { history.replaceState(null, '', '#/' + k); }
    this.state.route = k;
    Store.set('lastRoute', k);
    $$('[data-nav]').forEach(a => { if (a.dataset.nav === k) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const r = this.routes[k], s = this.state.settings || {};
    document.title = `${this.label(k)} · ${s.Nama_Aplikasi || 'KasirMart'}`;
    this.title();
    if (k !== 'pengaturan') Theme.apply(s);
    const view = $('#view');
    view.innerHTML = '';
    const fresh = view.cloneNode(false); view.replaceWith(fresh);         // buang listener halaman sebelumnya
    if (!this.state.katalog) { fresh.innerHTML = View.loading(); return; }
    try { r.page().render(fresh); }
    catch (e) { console.error(e); fresh.innerHTML = `<div class="notice danger">${I('alert')}<div><b>Halaman gagal dimuat.</b> ${U.esc(e.message)}</div></div>`; }
    window.scrollTo(0, 0);
  },
  rerender() { if (this.shell) this.route(); },

  /* ------------------------------------------------------------- Pintasan */
  hotkeys(e) {
    if (!this.shell || !Session.valid()) return;
    const top = Modal.top();
    if (top && e.key === 'Enter' && !e.target.matches('textarea, input, select, button')) {
      const b = top.el.querySelector('[data-new]'); if (b) { e.preventDefault(); b.click(); return; }
    }
    if (top) return;
    if (this.state.route === 'kasir' && Kasir.hotkey(e)) return;
    if (e.key === 'F2') { e.preventDefault(); location.hash = '#/kasir'; }
    if (e.key === 'F4' && this.isKasir()) { e.preventDefault(); location.hash = '#/cekstok'; }
  }
};

/* ------------------------------------------------------------- Event global */
window.addEventListener('hashchange', () => App.route());
window.addEventListener('keydown', e => App.hotkeys(e));
window.addEventListener('online', () => { App.updateNet(); Toast.ok('Koneksi internet kembali.'); });
window.addEventListener('offline', () => App.updateNet());
window.addEventListener('resize', U.debounce(() => App.title(), 200));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && App.shell && Session.valid()) {
    const d = $('[data-date]'); if (d) d.textContent = U.hariPanjang();
    App.refreshKatalog().then(() => {
      if (Modal.stack.length) return;
      if (App.state.route === 'kasir' && Kasir.el && Kasir.el.isConnected) Kasir.redraw();
      if (App.state.route === 'cekstok') App.rerender();
    });
  }
});
document.addEventListener('DOMContentLoaded', () => App.start());
