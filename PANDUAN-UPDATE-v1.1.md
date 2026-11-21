# Panduan Update KasirMart v1.0 → v1.1

Panduan ini untuk Anda yang **sudah memasang KasirMart v1.0**. Waktu yang dibutuhkan sekitar 15 menit.
Data lama (barang, kategori, stok, transaksi, pengaturan, kata sandi pemilik) **tetap aman**. Tidak ada data yang dihapus.

---

## 1. Yang baru di v1.1

| Permintaan | Hasil |
|---|---|
| Tampilan dirapikan | Label "SKU aktif" yang patah 2 baris dihapus, judul kartu stok dipersingkat, scrollbar di bar tab hilang, nominal besar tidak lagi terpotong ("Rp 5.161.1…"), tabel muat tanpa digeser di laptop 1024–1366 px, dan tampilan HP dirapikan. Diperiksa otomatis di 4 ukuran layar: 0 temuan. |
| Tampilan kasir | Akun **Kasir** terpisah untuk karyawan. Kasir hanya melihat 3 menu: **Kasir**, **Cek Stok**, **Transaksi Saya**. Kasir tidak bisa melihat harga modal, keuntungan, laporan, data barang, atau pengaturan. |
| Bayar QRIS / bank | Gambar **QRIS toko** tampil langsung di layar kasir, dan bisa diperbesar ke **layar pelanggan** (QR besar + total). Pilihan **Transfer** menampilkan rekening bank toko dengan tombol salin. |
| Cek stok di layar kasir | Menu **Cek Stok**: sisa stok semua barang dengan filter Tersedia / Menipis / Habis. Stok juga tampil di setiap kartu barang. |
| Satuan lebih lengkap | 38 satuan dalam 3 kelompok (hitung, timbang/takar, takaran kecil) plus isian "Lainnya". Satuan **kg, ons, liter, meter** bisa dijual **pecahan** (misalnya 0,5 kg), atau berdasarkan nominal ("beli Rp 10.000"). |

---

## 2. Apa yang berubah di Google Sheets

- Sheet **Transaksi** mendapat **1 kolom baru di paling kanan: `Kasir`**. Kolom lama tidak digeser. Transaksi lama (kolom ini kosong) dianggap dibuat oleh **Pemilik**.
- Sheet **Pengaturan** mendapat baris baru: `Rek1_Bank`, `Rek1_Nomor`, `Rek1_Nama`, `Rek2_…`, `QRIS_Merchant`, `QRIS_Versi`.
- Akun kasir **tidak** disimpan di Sheets. Akun kasir disimpan di Script Properties (`USR_nama`), dan hanya hash kata sandinya yang disimpan.

---

## 3. Urutan update: backend dulu, baru frontend

| Kombinasi | Hasil |
|---|---|
| Backend v1.1 + frontend v1.0 | Aplikasi lama tetap jalan normal (aman sebagai langkah antara) |
| Backend v1.0 + frontend v1.1 | Login pemilik jalan, tetapi login kasir, QRIS, dan menu Pengguna kasir **gagal** |
| Backend v1.1 + frontend v1.1 | Semua fitur baru aktif ✅ |

---

## 4. Update backend (Google Apps Script)

1. Buka proyek Apps Script KasirMart (dari spreadsheet: **Ekstensi → Apps Script**, atau dari script.google.com).
2. **Cadangkan kode lama**: klik berkas `Kode.gs`, tekan **Ctrl+A**, **Ctrl+C**, lalu tempel ke Notepad dan simpan sebagai `Kode-v1.0.txt`.
3. Buka berkas **`Kode.gs` v1.1** dari paket ini (dengan Notepad). Tekan **Ctrl+A**, **Ctrl+C**.
4. Kembali ke editor Apps Script, klik di dalam `Kode.gs`, tekan **Ctrl+A**, lalu **Ctrl+V**. Semua kode lama tergantikan.
5. Tekan **Ctrl+S** (Simpan).
6. Di bilah atas, pilih fungsi **`setupAppEnvironment`**, lalu klik **▶ Jalankan**. Bila diminta izin, klik **Izinkan**.
   Log yang benar kira-kira seperti ini:
   ```
   🚀 Menyiapkan KasirMart 1.1.0 ...
   ✅ Setup selesai.
      Akun kasir  : 0 (kelola di aplikasi: Pengaturan → Pengguna kasir)
   🔐 Kata sandi admin sudah ada sebelumnya — tidak diubah.
   ```
   Fungsi ini aman diulang: kata sandi pemilik tidak berubah dan data tidak tersentuh. Fungsi ini hanya menambah kolom `Kasir` dan baris pengaturan baru.
7. **Terapkan → Kelola deployment → ✏️ (Edit) → Versi: Versi baru → Terapkan.**
   ⚠️ **Jangan** pilih "Deployment baru", karena URL `/exec` akan berubah dan frontend tidak bisa terhubung.
8. Cek: buka URL `/exec` Anda di browser dan tambahkan `?action=ping` di belakangnya. Hasilnya harus memuat `"version":"1.1.0"`.

---

## 5. Update frontend (GitHub Pages)

Pakai **`kasirmart-frontend-UPDATE-v1.1.zip`**. ZIP ini sengaja **tidak berisi `js/config.js`**, jadi URL backend Anda tidak tertimpa.

1. Ekstrak ZIP update. Isinya: `index.html`, `css/`, `js/` (tanpa `config.js`), `README.md`, dan panduan.
2. Buka folder repo frontend Anda di komputer, yaitu **folder yang dulu dipakai untuk `git push`**. Di dalamnya ada `index.html` dan folder tersembunyi `.git`.
3. **Salin semua isi ZIP ke folder itu**, lalu pilih **Ganti / Replace** untuk berkas yang sama. Berkas `js/config.js` milik Anda tetap seperti semula.
4. Buka PowerShell di folder itu (klik address bar File Explorer, ketik `powershell`, lalu Enter), kemudian jalankan:
   ```bash
   git status
   git add .
   git commit -m "Update KasirMart v1.1"
   git push
   ```
   `git status` harus menampilkan berkas `css/style.css`, `index.html`, dan `js/…` sebagai *modified*. **`js/config.js` tidak boleh** ada di daftar itu. Kalau muncul, berarti config tertimpa: buka berkasnya dan isi lagi URL `/exec` Anda sebelum `git add`.
5. Tunggu 1–2 menit. Buka situs, lalu tekan **Ctrl+Shift+R** (di HP: tutup tab, lalu buka lagi).
6. Cek: halaman login sekarang punya pilihan **Masuk sebagai: Pemilik | Kasir**, dan di Pengaturan → Keamanan & sistem tertulis **Versi frontend 1.1.0** dan **Versi backend 1.1.0**.

> Tidak perlu login ulang. Sesi pemilik dari v1.0 tetap berlaku.

---

## 6. Setelah update: siapkan sebagai Pemilik (sekali saja)

### 6a. Pembayaran QRIS & transfer
**Pengaturan → Pembayaran**
1. **Unggah gambar QRIS**: foto atau unduh gambar QRIS statis toko Anda (QRIS dari bank/e-wallet merchant yang biasa ditempel di meja). Potong agar hanya kotak QR yang terlihat. Format PNG/JPG/WEBP; gambar besar diperkecil otomatis.
2. Isi **Nama merchant** sesuai tulisan di stiker QRIS, misalnya `TOKO SEMBAKO BERKAH`.
3. Isi **Rekening transfer** 1 (dan 2 bila ada): nama bank, nomor rekening, atas nama.
4. Klik **Simpan Perubahan**. Tombol **Lihat tampilan pelanggan** menampilkan pratinjau layar yang dilihat pelanggan.

### 6b. Akun kasir
**Pengaturan → Pengguna kasir → Tambah kasir**
1. Isi nama kasir. Nama pengguna terisi otomatis (bisa diubah: huruf kecil, angka, titik, garis bawah).
2. Kata sandi sementara 6 angka dibuat otomatis.
3. Klik **Buat akun**. Info login tampil **sekali**. Klik **Salin info login**, lalu kirim lewat WhatsApp ke kasir.
4. Kelola kapan saja: **✏️ ubah nama**, **🔑 reset sandi**, **⊘ nonaktifkan** (langsung keluar dari semua perangkat), atau **🗑 hapus**. Riwayat transaksi kasir tetap tersimpan walaupun akunnya dihapus.

### 6c. Satuan barang curah
**Barang → Edit** barang yang dijual timbang (beras curah, gula curah, minyak curah, telur per kg, bawang, dll.), lalu ubah **Satuan** ke **kg**, **ons**, **liter**, atau **meter**. Setelah itu kasir bisa menjual 0,25 / 0,5 / 1,5 kg.
Stok pecahan dicatat lewat **Stok → Tambah Stok Masuk**, misalnya 12,5 kg.

---

## 7. Cara kasir bekerja

1. Buka alamat aplikasi yang sama → pilih **Kasir** → isi nama pengguna dan kata sandi sementara → buat kata sandi sendiri (minimal 6 karakter, boleh PIN angka).
2. **Jual barang**: klik kartu barang atau scan barcode. Untuk barang kg/liter muncul dialog **Isi berat**: pilih ¼, ½, 1, 2, atau 5 kg, ketik berat (contoh `1,5`), atau ketik nominal (contoh `Rp 10.000`).
3. **Bayar QRIS**: pilih **QRIS**. Kode QR dan total tampil di keranjang. Klik **Tampilkan ke pelanggan** untuk QR besar. Pelanggan memindai, mengetik nominal, lalu membayar. Setelah dana masuk, tekan **Pembayaran diterima**.
4. **Bayar transfer**: pilih **Transfer**. Rekening tampil dan bisa disalin atau ditampilkan ke pelanggan. Setelah dana masuk, tekan **Sudah dibayar**.
5. **Cek Stok** (tombol F4): sisa stok semua barang. Klik kartu **Habis** atau **Menipis** untuk menyaring.
6. **Transaksi Saya**: transaksi kasir itu sendiri hari ini, total **uang tunai yang harus ada di laci**, dan total non-tunai. Struk bisa dicetak ulang dari sini.
7. Keluar: klik nama di kanan atas (di HP: **Akun**) → **Keluar**.

Pemilik bisa melihat semua transaksi beserta nama kasirnya di **Riwayat Transaksi** (filter **Kasir**) dan di Dashboard.

---

## 8. Tentang QRIS di aplikasi ini (penting)

- Yang tampil adalah **QRIS statis milik toko**. Uang masuk langsung ke rekening/merchant Anda, bukan lewat aplikasi ini.
- Pelanggan **mengetik nominal sendiri**. Total besar di layar pelanggan membantu agar nominalnya tepat.
- Aplikasi **tidak mengecek otomatis** apakah dana sudah masuk. Kasir wajib melihat notifikasi aplikasi merchant/bank sebelum menekan **Pembayaran diterima**.
- QRIS dinamis (nominal otomatis dan lunas otomatis) membutuhkan *payment gateway* berbayar (misalnya Midtrans atau Xendit). Fitur ini belum termasuk di versi ini.

---

## 9. Fungsi editor baru

| Fungsi | Kegunaan |
|---|---|
| `bukaKunciKasir` | Akun kasir terkunci 15 menit (5× salah sandi). Lebih mudah: pemilik **Reset sandi** dari aplikasi; kunci ikut terbuka. |

Fungsi lama (`resetSandiAdmin`, `bukaKunciLogin`, `rotasiSecretSesi`, `cekPerforma`, dll.) tetap ada. `rotasiSecretSesi` sekarang mengeluarkan **pemilik dan semua kasir**.

---

## 10. Kendala umum

| Gejala | Penyebab | Solusi |
|---|---|---|
| Tidak ada pilihan "Kasir" di login | Browser masih memakai versi lama | Ctrl+Shift+R, atau buka di jendela Incognito |
| Login kasir selalu ditolak ("Kata sandi salah") padahal benar | Backend belum v1.1 (langkah 4 belum selesai), atau deployment belum "Versi baru" | Ulangi langkah 4.7, cek `?action=ping` |
| Situs: "URL backend belum diisi" | `js/config.js` tertimpa versi kosong | Isi lagi URL `/exec`, lalu commit & push |
| Pengaturan → Pengguna kasir: "Aksi tidak dikenal" | Backend masih v1.0 | Langkah 4 |
| QRIS: "Gambar QRIS toko belum diatur" | Belum diunggah | Langkah 6a |
| Kasir: "Menu ini khusus pemilik toko" | Kasir membuka menu pemilik | Normal. Kasir hanya punya 3 menu |
| Kasir lupa kata sandi | — | Pemilik: Pengguna kasir → 🔑 Reset sandi |
| Barang curah tidak bisa 0,5 | Satuan belum kg/liter/ons/meter | Langkah 6c |

---

## 11. Kalau ingin kembali ke v1.0 (rollback)

1. Apps Script: tempel kembali `Kode-v1.0.txt` (langkah 4.2) → Simpan → **Kelola deployment → Edit → Versi baru**.
2. GitHub: kembalikan berkas v1.0 dari ZIP lama → `git add .` → `git commit -m "Kembali ke v1.0"` → `git push`.
3. Kolom `Kasir` dan baris pengaturan baru boleh dibiarkan; v1.0 mengabaikannya. Akun kasir tidak bisa dipakai di v1.0.

---

## 12. Ringkasan pengujian v1.1

- **Backend: 199 uji lulus**, terdiri dari 108 uji lama (tetap lulus) dan 91 uji baru. Termasuk **uji upgrade sungguhan**: data dan sesi dari v1.0 → setup v1.1 → kolom lama tidak bergeser, sandi tidak berubah, sesi pemilik tetap berlaku, dan transaksi lama terbaca sebagai "Pemilik". Uji baru juga mencakup: 17 menu pemilik ditolak untuk kasir; harga modal dan keuntungan tidak pernah dikirim ke kasir; kasir tidak bisa melihat transaksi kasir lain; penjualan 1,5 kg dan ¼ liter (rupiah selalu bulat); satuan "bungkus" menolak pecahan; QRIS tersimpan privat di Drive; kunci login per akun kasir; nonaktif/reset sandi langsung mengeluarkan kasir.
- **Browser: 92 uji lulus** dengan Chrome di layar 1440 px dan HP 390 px. Alurnya: pemilik mengunggah QRIS dan membuat akun kasir, kasir login lalu ganti sandi, jual dengan QRIS (layar pelanggan) dan transfer, timbang kg, cek stok, transaksi saya, dan struk dengan nama kasir. Tidak ada error JavaScript.
- **Audit tata letak**: semua halaman pemilik (termasuk 6 tab Pengaturan) dan semua halaman kasir diperiksa di 1280×720, 1366×768, 1024×768, dan 390×844, mencari scroll menyamping, label patah baris, angka terpotong, dan tabel meluber. Hasilnya **0 temuan**.

Pengujian dijalankan di simulator Google Apps Script. Kecepatan di server Google asli biasanya 0,5–2 detik per aksi.
