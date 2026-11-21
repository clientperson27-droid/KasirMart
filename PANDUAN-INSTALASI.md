# Panduan Instalasi KasirMart v1.1

Aplikasi kasir toko sembako: backend **Google Apps Script + Google Sheets**, frontend di **GitHub Pages**.
Panduan ini ditulis untuk pemula. Ikuti urutannya dari atas ke bawah. Waktu total sekitar 30–45 menit.

> **Sudah memasang v1.0?** Jangan ikuti panduan ini dari awal. Baca **`PANDUAN-UPDATE-v1.1.md`**.

---

## 0. Isi paket

| Berkas | Untuk apa | Dipasang di mana |
|---|---|---|
| `Kode.gs` | Seluruh backend (API, database, login, laporan) | Editor Google Apps Script |
| `appsscript.json` | Pengaturan proyek (zona waktu Asia/Jakarta). **Opsional**, lihat langkah A3 | Editor Google Apps Script |
| `kasirmart-frontend.zip` | Tampilan aplikasi lengkap (`index.html`, `css/`, `js/`), untuk **instalasi baru** | GitHub Pages |
| `kasirmart-frontend-UPDATE-v1.1.zip` | Sama, tetapi **tanpa `js/config.js`**, untuk update dari v1.0 | GitHub Pages |
| `PANDUAN-INSTALASI.md` | Dokumen ini | Untuk dibaca |
| `PANDUAN-UPDATE-v1.1.md` | Langkah update dari v1.0, panduan kasir, QRIS & rekening | Untuk dibaca |

> **Penting:** `Kode.gs` dan `appsscript.json` **tidak** dimasukkan ke ZIP frontend. Keduanya cukup disalin-tempel ke Apps Script. Repository GitHub hanya berisi isi ZIP.

---

## A. Pasang backend (Google Apps Script)

**A1. Buat proyek**
1. Buka **https://script.google.com** dengan akun Google pemilik toko.
2. Klik **Proyek baru**. Ganti nama proyek menjadi `KasirMart` (klik tulisan "Proyek tanpa judul").

**A2. Tempel kode**
1. Di panel kiri ada berkas `Code.gs` (atau `Kode.gs`). Klik berkas itu, hapus semua isinya.
2. Buka `Kode.gs` dari paket ini, salin **seluruh** isinya, lalu tempel ke editor.
3. Tekan **Ctrl+S** untuk menyimpan.

**A3. Atur zona waktu (wajib)**
Nomor transaksi (`TRX-20261121-001`) dan laporan harian memakai tanggal server, jadi zona waktunya harus WIB.
- Klik ⚙️ **Setelan Proyek** (Project Settings) di kiri.
- Di **Zona waktu**, pilih **(GMT+07:00) Jakarta**.

Cara alternatif: centang *"Tampilkan file manifes appsscript.json di editor"*, lalu ganti isi `appsscript.json` dengan berkas dari paket ini.

**A4. Jalankan setup (sekali)**
1. Kembali ke **Editor** (ikon `< >`).
2. Di menu tarik-turun di atas editor, pilih fungsi **`setupAppEnvironment`** lalu klik ▶ **Jalankan**.
3. Muncul **Perlu otorisasi** → **Tinjau izin** → pilih akun Anda.
4. Bila muncul *"Google belum memverifikasi aplikasi ini"*: klik **Lanjutan** → **Buka KasirMart (tidak aman)** → **Izinkan**.
   Ini normal untuk skrip buatan sendiri. Skrip meminta akses Spreadsheet, Drive (logo & cadangan), dan pemicu waktu.
5. Lihat **Log eksekusi** di bawah. Anda akan melihat:

```
✅ Setup selesai.
   Spreadsheet : https://docs.google.com/spreadsheets/d/…
   Folder Drive: https://drive.google.com/drive/folders/…
   keepWarm    : aktif (tiap 5 menit)

🔐 KATA SANDI AWAL ADMIN (catat sekarang — hanya tampil SEKALI):
   Ab3dEf7hJk2m
```

6. **Catat kata sandi awal itu sekarang.** Kata sandi ini hanya tampil sekali dan wajib diganti saat login pertama.

Setup membuat:
- Folder **KasirMart** di Google Drive, berisi subfolder `KasirMart_Assets` (logo) dan `Cadangan`.
- Spreadsheet **KasirMart — Database** dengan sheet: Pengaturan, Kategori, Barang, Transaksi, Detail_Transaksi, Log_Stok, AppConfig.

`setupAppEnvironment()` **aman dijalankan ulang**. Data, kata sandi, dan kunci rahasia yang sudah ada tidak akan ditimpa.

**A5. (Opsional) Isi data contoh**
Ingin mencoba dulu dengan barang contoh? Pilih fungsi **`isiDataContoh`** → ▶ Jalankan. Fungsi ini menambahkan 7 kategori dan 16 barang (termasuk 3 barang curah ber-satuan kg/liter), hanya bila sheet Barang masih kosong. Lewati langkah ini bila Anda akan mengimpor data sendiri (bagian D).

**A6. Deploy sebagai Web App**
1. Klik **Terapkan (Deploy)** → **Deployment baru**.
2. Klik ikon ⚙️ di samping "Pilih jenis" → pilih **Aplikasi web**.
3. Isi:
   - **Jalankan sebagai:** *Saya (email Anda)*
   - **Yang memiliki akses:** *Siapa saja (Anyone)*
4. Klik **Terapkan**, lalu **salin URL Aplikasi web**. URL berakhiran `/exec`, contoh:
   `https://script.google.com/macros/s/AKfycbx…/exec`

> "Siapa saja" diperlukan agar halaman GitHub Pages bisa memanggil API. Data tetap aman karena setiap aksi wajib login dengan kata sandi dan token sesi.

**A7. Uji backend**
Buka URL `/exec` tadi di browser dengan tambahan `?action=ping`, contoh `…/exec?action=ping`. Hasil yang benar:

```json
{"success":true,"data":{"app":"KasirMart","version":"1.1.0","ready":true,…}}
```

---

## B. Pasang frontend (GitHub Pages)

**B1. Ekstrak ZIP**
Ekstrak `kasirmart-frontend.zip`. Anda mendapat folder **`kasirmart-frontend`** berisi:

```
kasirmart-frontend\
├── index.html      ← harus ada di sini (paling atas)
├── README.md
├── PANDUAN-INSTALASI.md
├── PANDUAN-UPDATE-v1.1.md
├── css\style.css
└── js\config.js, core.js, charts.js, kasir.js, pages.js, app.js
```

**Folder `kasirmart-frontend` inilah yang nanti di-`git init`.** Jangan masuk lebih dalam, jangan naik satu level.

**B2. Isi URL backend**
Buka `js\config.js` dengan Notepad. Ganti `GANTI_DENGAN_ID_DEPLOYMENT` sehingga menjadi URL `/exec` Anda:

```js
window.APP_CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbx…/exec'
};
```

Simpan. Ini satu-satunya nilai yang perlu diisi di frontend, dan nilai ini bukan rahasia.

**B3. Pasang Git & buat akun GitHub**
- Windows: unduh dari **https://git-scm.com/download/win**, install dengan pilihan bawaan. Mac: ketik `git --version` di Terminal.
- Daftar di **https://github.com** bila belum punya akun. Username akan menjadi bagian alamat situs: `username.github.io`.
- Sekali saja per komputer:

```bash
git config --global user.name "Nama Anda"
git config --global user.email "email-akun-github@contoh.com"
```

**B4. Buat repository**
Di github.com: **+** → **New repository** → nama misalnya `kasirmart` → pilih **Public** → **jangan** centang README/.gitignore/license → **Create repository**.

**B5. Masuk ke folder yang benar & cek isinya**
Buka folder `kasirmart-frontend` di File Explorer, klik bilah alamat, ketik `powershell`, lalu tekan Enter. Kemudian:

```powershell
dir
```

Pastikan **`index.html`** terlihat bersama folder `css` dan `js`. Kalau yang terlihat justru folder lain, berarti Anda salah folder. Jangan lanjut sebelum benar.

**B6. Kirim ke GitHub** (satu per satu)

```bash
git init
git add .
git commit -m "Upload pertama KasirMart"
git branch -M main
git remote add origin https://github.com/USERNAME/kasirmart.git
git push -u origin main
```

- Perhatikan **titik** di `git add .`.
- Saat diminta **Password**, GitHub tidak menerima kata sandi akun biasa. Buat **Personal Access Token** di **https://github.com/settings/tokens** → *Generate new token (classic)* → centang **repo** → salin token `ghp_…` lalu tempel sebagai password.
- Saat mengetik atau menempel token, layar memang **tidak menampilkan apa pun**. Itu normal; tekan Enter.
- Tanda berhasil: muncul `Writing objects: 100%` dan `* [new branch] main -> main`.

**B7. Aktifkan GitHub Pages**
Repository → **Settings** → **Pages** → Source: **Deploy from a branch** → Branch: **main** / **(root)** → **Save**. Centang **Enforce HTTPS**.
Setelah 1–2 menit muncul: *Your site is live at `https://USERNAME.github.io/kasirmart/`*.

> Jangan unggah lewat tombol "Upload files" di web GitHub. Cara itu meratakan folder `css/` dan `js/`, sehingga tampilan rusak.

---

## C. Login pertama

1. Buka alamat situs. Status di kanan atas kartu login harus **[SERVER SIAP]**.
2. Masukkan **kata sandi awal** dari langkah A4.
3. Aplikasi langsung meminta **kata sandi baru**: minimal 8 karakter, berisi huruf dan angka.
4. Selesai. Anda masuk ke Dashboard.

Halaman login punya pilihan **Masuk sebagai: Pemilik | Kasir**. Pemilik cukup mengisi kata sandi. Kasir mengisi nama pengguna dan kata sandi dari akun yang dibuat pemilik.

### C2. Siapkan pembayaran & akun kasir (v1.1)
- **Pengaturan → Pembayaran**: unggah gambar QRIS statis toko, isi nama merchant dan rekening transfer.
- **Pengaturan → Pengguna kasir**: buat akun untuk karyawan. Kasir hanya bisa membuka Kasir, Cek Stok, dan Transaksi Saya, tanpa harga modal, keuntungan, laporan, atau pengaturan.
- **Barang**: barang curah pakai satuan **kg / ons / liter / meter** agar bisa dijual pecahan (0,5 kg).

Rinciannya ada di `PANDUAN-UPDATE-v1.1.md` bagian 6–8.

Lupa kata sandi? Di editor Apps Script jalankan **`resetSandiAdmin`**. Kata sandi sementara baru akan tampil di log dan wajib diganti saat login.
Login terkunci 15 menit karena 5 kali salah sandi? Jalankan **`bukaKunciLogin`**.

---

## D. Import data lama (migrasi)

Menu **Pengaturan → Import data**. Spreadsheet sumber **hanya dibaca**, tidak pernah diubah.

**Dari Google Sheets lama** (misalnya catatan stok manual):
1. Spreadsheet sumber harus milik **akun Google yang sama** dengan Apps Script.
2. Sheet bernama `Barang` (atau sheet pertama) dibaca berdasarkan **nama kolom**, jadi urutan kolom bebas. Nama kolom yang dikenali:
   - Nama barang: *Nama, Nama Barang, Produk*
   - Kategori: *Kategori*
   - Satuan: *Satuan*
   - Harga beli: *Harga Beli, Modal, HPP*
   - Harga jual: *Harga Jual, Harga*
   - Stok: *Stok, Qty, Jumlah*
   - Barcode: *Barcode, SKU*
3. Tempel URL spreadsheet → klik **Pindai (dry-run)**. Anda akan melihat jumlah yang akan ditambah, diperbarui, dan dilewati. Belum ada data yang ditulis.
4. Klik **Jalankan import**.

**Dari CSV** (misalnya ekspor dari aplikasi lain): klik **Unduh template**, isi, lalu **Pindai CSV** → **Import CSV**. Pemisah koma dan titik koma sama-sama diterima, dan harga boleh ditulis `Rp 12.500`.

Sifat import:
- **Aman diulang.** Barang dicocokkan berdasarkan kode atau nama, jadi menjalankan import dua kali tidak menghasilkan data ganda.
- **Delta sync.** Jalankan lagi menjelang pindah penuh untuk menangkap barang baru. Centang *"Perbarui harga/barcode/satuan"* bila harga di sumber berubah.
- **Stok dan status barang yang sudah ada tidak pernah ditimpa.** Koreksi stok dilakukan lewat menu Stok → Penyesuaian agar tercatat di log.
- Kategori yang belum ada dibuat otomatis. Barang tanpa kategori masuk ke "Lainnya".
- Barang tanpa harga jual dilewati, dan Anda akan mendapat peringatan.

---

## E. Penyimpanan rahasia (Script Properties)

Semua rahasia disimpan di **Script Properties**. Tidak ada rahasia di kode, di spreadsheet, maupun di GitHub.

| Kunci | Isi | Cara terisi |
|---|---|---|
| `SESSION_SECRET` | Kunci tanda tangan token login | Otomatis saat setup |
| `ADMIN_PASS_HASH`, `ADMIN_SALT` | Hash kata sandi (sandi asli tidak disimpan) | Otomatis saat setup / ganti sandi |
| `SPREADSHEET_ID`, `DRIVE_ROOT_FOLDER_ID`, `FOLDER_ASSETS`, `FOLDER_BACKUP` | Lokasi database & folder | Otomatis saat setup |
| `LOGO_FILE_ID`, `QRIS_FILE_ID` | Berkas logo & gambar QRIS di Drive (QRIS tidak dibagikan publik) | Otomatis saat unggah |
| `USR_<nama>` | Akun kasir: nama, **hash + salt** kata sandi, status (sandi asli tidak disimpan) | Dari Pengaturan → Pengguna kasir |
| `REV_admin`, `REV_k_<nama>`, `RVT`, `LOGIN_KUNCI_SAMPAI`, `KEEP_WARM` | Status sesi pemilik/kasir, kunci login, saklar keepWarm | Otomatis |

Melihatnya: Apps Script → ⚙️ Setelan Proyek → **Properti skrip**. Jangan mengubah atau menghapus `SESSION_SECRET`; gunakan fungsi `rotasiSecretSesi` bila perlu.

Sheet **AppConfig** hanya catatan baca-saja berisi ID (bukan rahasia). Kode tidak membacanya.

**Jaga keamanan:**
- Jangan menambah editor ke proyek Apps Script. Siapa pun yang bisa mengedit proyek bisa melihat Script Properties.
- Jangan membagikan spreadsheet database ke orang lain.
- HP atau laptop pemilik hilang? Buka **Pengaturan → Keamanan → Keluar dari semua perangkat**.
- HP kasir hilang, atau karyawan berhenti? **Pengaturan → Pengguna kasir → Nonaktifkan** (langsung keluar dari semua perangkat) atau **Reset sandi**.

---

## F. Printer thermal

Aplikasi web tidak bisa langsung mengakses printer USB atau Bluetooth. Struk dicetak lewat **dialog cetak browser**.

1. Pasang driver printer thermal (58 mm atau 80 mm) di komputer kasir sampai printer muncul di Windows.
2. Di **Pengaturan → Struk & stok**, pilih lebar kertas 58 mm atau 80 mm, lalu klik **Cetak uji**.
3. Di dialog cetak Chrome: pilih printer thermal, **Margin: Tidak ada**, matikan **Header dan footer**. Chrome akan mengingat pilihan ini.
4. Opsional, agar struk langsung tercetak tanpa dialog: buat shortcut Chrome khusus kasir dengan tambahan `--kiosk-printing` di akhir *Target* (klik kanan shortcut → Properties).

Di Android: gunakan aplikasi layanan cetak dari produsen printer (Bluetooth), lalu pilih printer itu di menu Cetak.

---

## G. Kecepatan

Yang sudah diterapkan:
- **Cache berversi.** Katalog, pengaturan, dan data per bulan disimpan di cache server. Menyimpan transaksi hanya menghanguskan cache bulan berjalan, sehingga laporan bulan lalu tetap instan.
- **Baca per blok bulan.** Laporan hanya membaca baris bulan yang diminta, bukan seluruh sheet.
- **Warmup.** Browser memanaskan server saat halaman login dibuka. Pemicu `keepWarm` (tiap 5 menit) menjaga cache tetap terisi.
- **Batch & dedupe.** Beberapa permintaan baca dalam satu saat digabung menjadi satu panggilan.

Fungsi editor yang terkait:
- `cekPerforma`: status cache (HANGAT/dingin), pemicu, dan ukuran Script Properties.
- `matikanKeepWarm` / `nyalakanKeepWarm`.

`keepWarm` memakai sekitar 3–6 menit kuota pemicu per hari. Akun Gmail biasa punya batas 90 menit per hari. Warmup menjamin **cache** tetap hangat, tetapi tidak menjamin mesin Google selalu siap; permintaan pertama setelah lama tidak dipakai tetap bisa 2–4 detik.

Ingin mengukur kecepatan? Buka aplikasi → tekan **F12** → tab Console → ketik `Perf.table()` atau `Perf.summary()`. Bisa juga lewat **Pengaturan → Keamanan & sistem → Ukur kecepatan**.

---

## H. Memperbarui aplikasi nanti

**Backend:** tempel kode baru → simpan → **Terapkan → Kelola deployment → ✏️ Edit → Versi: Versi baru → Terapkan**.
Jangan memilih "Deployment baru", karena URL `/exec` akan berubah. Bila setup versi baru meminta, jalankan `setupAppEnvironment` sekali lagi; data tidak tersentuh.

**Frontend:** salin berkas baru ke folder `kasirmart-frontend` (timpa), lalu:

```bash
git add .
git commit -m "Update KasirMart"
git push
```

Tunggu 1–2 menit, lalu buka situs dan tekan **Ctrl+Shift+R**.

Mengubah barang, kategori, atau pengaturan langsung di Google Sheets (bukan lewat aplikasi)? Perubahan baru terlihat setelah cache berganti (paling lama 6 jam). Agar langsung terlihat, jalankan `setupAppEnvironment` sekali; fungsi itu juga menyegarkan cache. Sheet transaksi sebaiknya tidak diedit manual, karena laporan dan stok dihitung darinya.

---

## I. Fungsi yang bisa dijalankan dari editor

| Fungsi | Kegunaan |
|---|---|
| `setupAppEnvironment` | Setup awal; aman diulang dan menyegarkan cache |
| `isiDataContoh` | Data contoh (hanya bila Barang kosong) |
| `resetSandiAdmin` | Lupa kata sandi → sandi sementara baru di log |
| `bukaKunciLogin` | Membuka kunci login pemilik setelah 5 kali salah |
| `bukaKunciKasir` | Membuka kunci akun kasir (atau cukup Reset sandi dari aplikasi) |
| `rotasiSecretSesi` | Curiga token bocor → semua perangkat (pemilik & kasir) wajib login ulang |
| `cekPerforma` | Laporan status cache & pemicu |
| `matikanKeepWarm` / `nyalakanKeepWarm` | Saklar pemicu pemanas |

---

## J. Kendala umum

| Gejala | Penyebab | Solusi |
|---|---|---|
| Halaman "URL backend belum diisi" | `js/config.js` masih berisi `GANTI_…` | Isi URL `/exec`, lalu commit & push |
| Login: **[TIDAK TERHUBUNG]** | URL salah, atau deploy tidak "Siapa saja" | Cek URL; deploy ulang dengan akses *Anyone* |
| Login: **[BELUM DISIAPKAN]** | `setupAppEnvironment` belum dijalankan | Jalankan di editor |
| "Respons server bukan JSON" | URL mengarah ke `/dev` atau halaman login Google | Pakai URL berakhiran `/exec` dari deployment |
| Perubahan kode backend tidak berlaku | Deployment belum diperbarui | Kelola deployment → Edit → **Versi baru** |
| Nomor transaksi/tanggal meleset 7 jam | Zona waktu proyek belum WIB | Langkah A3 |
| Situs GitHub 404 | `index.html` tidak ada di root repo | Push ulang dari folder `kasirmart-frontend` |
| Tampilan polos tanpa warna | Folder `css/` dan `js/` rata | Jangan upload via web; push via git |
| Logo tidak tampil di perangkat lain | Drive menolak berbagi publik (akun kantor/sekolah) | Pakai akun Gmail pribadi, atau izinkan berbagi link di Drive |
| Struk terpotong atau berukuran A4 | Ukuran kertas atau margin printer | Langkah F3 |
| QRIS "belum diatur" di layar kasir | Gambar QRIS belum diunggah | Pengaturan → Pembayaran |
| Barang curah tidak bisa dijual 0,5 | Satuan bukan kg/ons/liter/meter | Ubah satuan di menu Barang |

---

## K. Batasan versi 1.1

- Satu akun pemilik ditambah maksimal 30 akun kasir. Kasir tidak bisa mengubah barang, stok, atau harga.
- Wajib internet; belum ada mode offline. Keranjang tetap tersimpan di perangkat bila koneksi putus.
- QRIS memakai **gambar QRIS statis** toko: pelanggan mengetik nominal sendiri, dan kasir mengonfirmasi setelah dana masuk. Tidak ada verifikasi otomatis; itu butuh *payment gateway* berbayar.
- Transfer bank dicatat manual setelah kasir melihat dana masuk.
- Belum ada diskon, promo, member, maupun foto barang.
- "Unduh PDF" memakai dialog cetak browser (pilih *Simpan sebagai PDF*).
- Sesi login berlaku 12 jam.

---

## L. Ringkasan pengujian

Diuji sebelum diserahkan:
- **Backend: 199 uji** di simulator Google Apps Script (Node): 108 uji v1.0 dan 91 uji v1.1 (akun kasir, batas hak kasir, QRIS, rekening, jumlah pecahan, upgrade dari v1.0). Cakupannya: setup berulang tanpa menimpa rahasia, login, penguncian 5 kali salah, wajib ganti sandi, token dicabut, transaksi dan stok, kirim ulang tanpa transaksi ganda, validasi stok/harga/uang kurang, nomor urut per hari, laporan cocok dengan jumlah manual, import dry-run/idempoten/delta, CSV, logo, dan cadangan.
- **Beban:** 3.100 transaksi dalam satu bulan (100 per hari). Laporan bulan pertama membaca ±115 ribu sel, permintaan berikutnya 0 sel (dari cache). Semua nilai cache tetap di bawah batas 100 KB.
- **Browser: 92 uji** dengan Chrome (layar 1440 px dan HP 390 px): login pemilik & kasir, kasir (tunai, QRIS + layar pelanggan, transfer, timbang kg), struk, riwayat, cek stok, barang, kategori, stok, laporan, pengaturan, import, tanpa error JavaScript dan tanpa scroll menyamping di HP.
- **Audit tata letak** di 1280×720, 1366×768, 1024×768, dan 390×844 untuk semua halaman pemilik dan kasir: 0 label patah, 0 angka terpotong, 0 tabel meluber.

Angka di atas diukur di simulator. Kecepatan di Google Apps Script asli bergantung pada server Google, biasanya 0,5–2 detik per aksi.
