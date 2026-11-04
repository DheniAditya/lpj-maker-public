# LPJ Maker

Buat **LPJ (Laporan Pertanggungjawaban)** yang rapi — dari foto nota sampai PDF bertanda tangan. Gratis, tanpa akun, dan **semua diproses di browser**: foto nota, tanda tangan, dan data transaksi tidak pernah dikirim ke server.

## Fitur

- Info laporan: judul, nama organisasi, kota, tanggal, dan logo (opsional)
- Transaksi Debit (uang masuk) dan Kredit (uang keluar), saldo dihitung otomatis
- Lampirkan foto nota dari galeri atau langsung dari kamera HP (otomatis dikompres)
- Tanda tangan: tulis di layar atau unggah foto — latar putih dibuat transparan; bisa sampai 4 penanda tangan
- Download PDF: tabel bernomor, total, saldo akhir + terbilang, tanda tangan, dan lampiran nota
- Draf tersimpan otomatis di perangkat (IndexedDB), bisa dihapus lewat **Mulai LPJ Baru**

## Menjalankan di komputer sendiri

Tidak perlu build atau instalasi paket. Cukup jalankan server statis di folder ini, misalnya:

```bash
python -m http.server 8080
# atau
npx serve .
```

Lalu buka http://localhost:8080.

> Membuka `index.html` langsung (file://) tidak disarankan karena modul JavaScript butuh server.

## Struktur

```
index.html              Halaman utama
assets/css/style.css    Tampilan
assets/js/app.js        Interaksi & state
assets/js/pdf.js        Pembuatan PDF (jsPDF)
assets/js/image.js      Kompres foto & bersihkan latar tanda tangan
assets/js/storage.js    Simpan draf di IndexedDB
assets/js/format.js     Format Rupiah, tanggal, terbilang
assets/vendor/          jsPDF 2.5.2 (MIT)
```

## Deploy

Situs ini statis, jadi bisa dihosting gratis di **GitHub Pages** (Settings → Pages → Deploy from a branch → `main` / root) atau Cloudflare Pages / Netlify.

## Kontribusi

Issue dan pull request sangat diterima. Mohon jaga prinsip utamanya: **tidak ada data pengguna yang dikirim ke server**.

## Kredit

- Foto latar halaman: diambil dari Pinterest (hak cipta milik fotografernya).

## Lisensi

[MIT](LICENSE) © 2026 Deni Aditya Warman. Menggunakan [jsPDF](https://github.com/parallax/jsPDF) (MIT).
