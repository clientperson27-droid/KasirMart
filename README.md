# KasirMart — Frontend

Aplikasi kasir digital untuk toko sembako (v1.1: akun kasir, QRIS & transfer, satuan pecahan kg/liter). Folder ini adalah **frontend** yang dipasang di GitHub Pages.
Backend-nya berjalan di Google Apps Script (`Kode.gs`, disalin-tempel ke editor Apps Script, tidak ada di repo ini).

## Yang perlu diisi
Hanya satu nilai: `GAS_URL` di `js/config.js`, yaitu URL Web App Apps Script yang berakhiran `/exec`.

## Struktur
```
index.html          halaman tunggal (SPA)
css/style.css       desain "Wireframe Precision POS" (teal, radius 0, angka tabular)
js/config.js        URL backend
js/core.js          utilitas, klien API (dedupe, batch, retry), ikon, modal, toast, tema
js/charts.js        grafik SVG (tanpa pustaka luar)
js/kasir.js         halaman Kasir, timbang kg/liter, QRIS & transfer, layar pelanggan, struk thermal 58/80 mm
js/pages.js         Dashboard, Riwayat, Cek Stok, Barang, Kategori, Stok, Laporan, Pengaturan
js/app.js           boot, login Pemilik/Kasir, tampilan per peran, router, pintasan keyboard
```

## Memperbarui
```bash
git add .
git commit -m "Update KasirMart"
git push
```
Lalu buka situs dan tekan Ctrl+Shift+R.

Panduan lengkap: `PANDUAN-INSTALASI.md`. Update dari v1.0: `PANDUAN-UPDATE-v1.1.md`.
