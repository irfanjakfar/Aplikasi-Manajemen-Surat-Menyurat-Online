Oke, aku bikin **dokumentasi lengkap** buat presentasi kamu. Tinggal copy paste ke laporan / slide / word. Gaya bahasa aku bikin semi-formal biar cocok buat laporan sekolah. 👇

---

# 📄 DOKUMENTASI PROYEK — E-SURAT SMK

## Aplikasi Manajemen Surat Menyurat Berbasis Mobile

---

## 1. Latar Belakang

Di lingkungan sekolah/kantor, sering kali menumpuk surat dan dokumen fisik yang sulit dilacak keberadaannya. Proses pengajuan surat masih dilakukan secara manual — dari pembuatan, penomoran, hingga tanda tangan pimpinan.

**Solusi:** Aplikasi mobile **E-Surat SMK** yang mendigitalisasi seluruh alur surat menyurat:
- Digitalisasi dokumen fisik (upload/foto)
- Penomoran otomatis
- Pelacakan status surat secara real-time
- Approval berjenjang (Staf → TU → Pimpinan)

---

## 2. Model Monetisasi

Aplikasi ini menggunakan **2 model monetisasi** yang bisa dipilih:

| Model | Deskripsi | Cocok untuk |
|---|---|---|
| **Subscription** | Biaya bulanan, unlimited dokumen | Instansi dengan volume surat tinggi |
| **Per-Document Fee** | Bayar per dokumen (beli kuota) | Penggunaan tidak rutin |

---

## 3. Teknologi yang Digunakan

### 3.1 Framework & Platform

| Teknologi | Fungsi |
|---|---|
| **React Native** + **Expo** | Framework utama untuk membangun aplikasi mobile cross-platform |
| **Expo Router** | Sistem navigasi berbasis file (file-based routing) |
| **Node.js** | Runtime untuk menjalankan tools development |

### 3.2 Database & Backend

| Teknologi | Fungsi |
|---|---|
| **Supabase** | Backend-as-a-Service (BaaS) berbasis PostgreSQL |
| **PostgreSQL** | Mesin database relasional di balik Supabase |
| **Supabase JS Client** | Library untuk komunikasi antara aplikasi dengan database |

### 3.3 Library NPM Tambahan

| Library | Versi | Fungsi |
|---|---|---|
| `@supabase/supabase-js` | — | Koneksi ke Supabase (CRUD, realtime, auth) |
| `@react-native-async-storage/async-storage` | — | Menyimpan sesi login (role user) di HP |
| `expo-document-picker` | — | Memilih file dari memori HP (PDF) |
| `expo-image-picker` | — | Ambil foto dari kamera / galeri HP |
| `expo-file-system` | — | Baca/tulis file, konversi file ke Base64 |
| `expo-print` | — | Konversi HTML → PDF (gabung foto jadi PDF) |
| `expo-sharing` | — | Membuka share sheet bawaan OS (kirim/simpan file) |
| `react-native-qrcode-svg` | — | Menampilkan QR Code (simulasi pembayaran QRIS) |
| `react-native-svg` | — | Render komponen SVG (pendukung QR Code) |

### 3.4 Development Tools

| Tools | Fungsi |
|---|---|
| **VS Code** | Code editor |
| **Expo Go** | Aplikasi di HP untuk testing langsung |
| **Laragon** | Local server (untuk manajemen folder project) |

---

## 4. Arsitektur Sistem

```
┌─────────────────────────────────────────────┐
│              APLIKASI MOBILE                │
│         (React Native + Expo Go)            │
│                                             │
│  ┌────────┐  ┌────────┐  ┌──────────────┐  │
│  │  Staf  │  │   TU   │  │   Pimpinan   │  │
│  └───┬────┘  └───┬────┘  └──────┬───────┘  │
│      │           │              │           │
│      └───────────┴──────────────┘           │
│                  │                          │
└──────────────────┼──────────────────────────┘
                   │
                   │ HTTPS Request
                   │ (dengan API Key)
                   │
                   ▼
        ┌──────────────────────┐
        │   SUPABASE CLOUD     │
        │                      │
        │  ┌────────────────┐  │
        │  │ Tabel: surat   │  │
        │  └────────────────┘  │
        │  ┌────────────────┐  │
        │  │ Tabel:monetisasi│ │
        │  └────────────────┘  │
        │                      │
        │  PostgreSQL Engine   │
        └──────────────────────┘
```

---

## 5. Cara Menghubungkan Aplikasi dengan Supabase

### 5.1 Konsep Koneksi

Aplikasi mobile **tidak menyimpan kredensial database secara langsung** untuk keamanan. Sebagai gantinya, aplikasi memakai **2 nilai kunci** yang disimpan di file `.env`:

- `EXPO_PUBLIC_SUPABASE_URL` → alamat server Supabase
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` → kunci publik (anon key) untuk akses terbatas

### 5.2 File `.env`

File `.env` (environment) adalah file khusus yang menyimpan **variabel rahasia** yang tidak boleh ditulis langsung di kode.

```env
EXPO_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...[dipotong]...
```

**Kenapa pakai `.env`?**
1. **Keamanan** — kredensial tidak ter-hardcode di file JSX
2. **Fleksibilitas** — bisa ganti-ganti project Supabase tanpa ubah kode
3. **Best Practice** — sesuai standar industri

**Catatan:** File `.env` **wajib dimasukkan ke `.gitignore`** supaya tidak ter-upload ke GitHub.

### 5.3 File `src/lib/supabase.js`

File ini adalah **jembatan** antara aplikasi dengan database:

```javascript
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

**Penjelasan:**
- `process.env.EXPO_PUBLIC_...` → membaca nilai dari file `.env`
- `createClient()` → membuat "koneksi" ke Supabase
- `AsyncStorage` → menyimpan session supaya user tidak login berulang

### 5.4 Cara Pemakaian di Halaman

Setelah `supabase` dibuat di `lib/supabase.js`, setiap halaman bisa langsung import dan pakai:

```javascript
import { supabase } from '../../lib/supabase';

// CONTOH: Ambil semua surat
const { data, error } = await supabase
  .from('surat')
  .select('*')
  .eq('is_deleted', false)
  .order('id', { ascending: false });
```

Itu adalah perintah SQL `SELECT * FROM surat WHERE is_deleted = false ORDER BY id DESC` — tapi ditulis dengan gaya JavaScript yang lebih rapi.

---

## 6. Struktur Database

### Tabel `surat`
Menyimpan semua data surat.

| Kolom | Tipe | Fungsi |
|---|---|---|
| `id` | bigint | Primary key |
| `kategori` | text | Jenis dokumen (KTP, Ijazah, dll) |
| `perihal` | text | Judul/deskripsi surat |
| `nomor_surat` | text | Nomor otomatis (contoh: SR/2026/10/001) |
| `status` | text | Menunggu TU → Menunggu Pimpinan → Disetujui Pimpinan |
| `file_mentah` | text | Nama file asli dari Staf |
| `file_mentah_uri` | text | Base64 file dari Staf (bisa array JSON) |
| `file_pdf_final` | text | Nama PDF final dari TU |
| `file_pdf_uri` | text | Base64 file PDF final |
| `is_deleted` | boolean | Soft delete (data tidak benar-benar dihapus) |
| `diproses_pada` | timestamp | Waktu TU memproses surat |
| `created_at` | timestamp | Waktu surat dibuat |

### Tabel `monetisasi`
Menyimpan data langganan & kuota.

| Kolom | Tipe | Fungsi |
|---|---|---|
| `id` | bigint | Primary key (selalu 1) |
| `paket` | text | Nama paket per-document fee |
| `kuota_maksimal` | bigint | Batas maksimal dokumen |
| `kuota_terpakai` | bigint | Jumlah yang sudah dipakai |
| `subscription_aktif` | boolean | Status langganan bulanan |
| `nama_subscription` | text | Nama paket langganan |
| `harga_subscription` | bigint | Harga langganan |
| `tanggal_expired` | timestamp | Tanggal langganan habis |

---

## 7. Alur Kerja Aplikasi

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  1. STAF                                                 │
│     ├── Login dengan role "staf"                         │
│     ├── Isi form: kategori, perihal                      │
│     ├── Foto dokumen fisik (bisa banyak foto)            │
│     ├── Kirim → data masuk database (status: Menunggu TU)│
│     └── Bisa hapus jika masih "Menunggu TU"              │
│                                                          │
│  2. TU (Tata Usaha)                                      │
│     ├── Login dengan role "tu"                           │
│     ├── Lihat surat dari Staf                            │
│     ├── Cek kuota / status langganan                     │
│     ├── Preview foto → jadikan PDF final                 │
│     ├── Upload PDF → kirim ke Pimpinan                   │
│     └── Status berubah jadi "Menunggu Pimpinan"          │
│                                                          │
│  3. PIMPINAN                                             │
│     ├── Login dengan role "pimpinan"                     │
│     ├── Review PDF final dari TU                         │
│     ├── ACC / Setujui                                    │
│     └── Status berubah jadi "Disetujui Pimpinan"         │
│                                                          │
│  4. STAF (lagi)                                          │
│     └── Download PDF resmi yang sudah di-ACC             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 8. Fitur Unggulan

### 8.1 Multi-Role Authentication
- 3 role terpisah: **Staf**, **TU**, **Pimpinan**
- Sesi login disimpan dengan **AsyncStorage** (tidak perlu login berulang)

### 8.2 Penomoran Surat Otomatis
- Format: `SR/2026/10/001`
- Menggunakan **MAX id + 1** untuk mencegah nomor dobel

### 8.3 Upload Multi-Foto
- Staf bisa upload **banyak foto sekaligus** (dari kamera atau galeri)
- Total maksimal 4 MB
- Bisa **hapus foto satu-satu** sebelum kirim

### 8.4 Konversi Base64
- Semua file dikonversi ke **Base64** dan disimpan di database
- Tidak butuh Supabase Storage (cocok untuk demo / proyek sekolah)
- Bisa dibuka kembali dengan `FileSystem.writeAsStringAsync`

### 8.5 Gabung PDF
- Semua foto bisa digabung jadi **1 file PDF** dengan `expo-print`
- Cocok untuk dokumen bersambung (surat 5 halaman → 1 PDF)

### 8.6 Soft Delete
- Data tidak langsung dihapus, cuma ditandai `is_deleted = true`
- Bisa di-restore kalau salah hapus
- Lebih aman dari hard delete

### 8.7 Auto-Sync Kuota
- Kuota per-document **otomatis sinkron** dengan jumlah surat yang diproses
- Gak perlu hitung manual

### 8.8 Dual Monetization
- **Subscription** (bulanan) dan **Per-Document Fee** (per dokumen)
- Sistem otomatis memilih: kalau langganan aktif → unlimited

---

## 9. Keamanan & Best Practice

| Aspek | Implementasi |
|---|---|
| **Kredensial** | Disimpan di file `.env`, tidak di kode |
| **Sesi Login** | AsyncStorage (encrypted di HP) |
| **Anon Key** | Supabase anon key (aman untuk aplikasi publik) |
| **Soft Delete** | Data tidak hilang permanen |
| **Error Handling** | Semua operasi database cek `error` manual |
| **Validasi Input** | Ukuran file, tipe file, field wajib |

---

## 10. Struktur Folder Project

```
apk_surat_menyurat/
├── src/
│   ├── app/                    ← Halaman aplikasi
│   │   ├── _layout.jsx         ← Layout utama
│   │   ├── index.jsx           ← Halaman login
│   │   ├── staf/beranda.jsx    ← Panel Staf
│   │   ├── tu/beranda.jsx      ← Panel TU
│   │   └── pimpinan/beranda.jsx ← Panel Pimpinan
│   ├── lib/
│   │   └── supabase.js         ← Koneksi ke Supabase
│   ├── styles/
│   │   └── theme.js            ← Kumpulan style & warna
│   ├── components/             ← Komponen reusable
│   ├── hooks/                  ← Custom hooks
│   └── constants/              ← Konstanta
├── .env                        ← Kredensial (JANGAN di-upload!)
├── .gitignore
├── package.json
└── app.json
```

---

## 11. Kesimpulan

Aplikasi **E-Surat SMK** berhasil mendigitalisasi alur surat menyurat dengan:
- ✅ **Digitalisasi dokumen** — foto/scan dari HP
- ✅ **Penomoran otomatis** — tidak akan dobel
- ✅ **Pelacakan status** — real-time antar role
- ✅ **Multi-model monetisasi** — Subscription & Per-Document Fee
- ✅ **Keamanan** — soft delete, kredensial di `.env`

Aplikasi dibangun dengan **React Native + Expo** untuk platform mobile dan **Supabase (PostgreSQL)** sebagai backend, menghubungkan 3 role user (Staf, TU, Pimpinan) dalam satu sistem yang terintegrasi.

---

## 12. Referensi

- Dokumentasi React Native: https://reactnative.dev
- Dokumentasi Expo: https://docs.expo.dev
- Dokumentasi Supabase: https://supabase.com/docs
- Dokumentasi Expo Router: https://docs.expo.dev/router/introduction

---

## 💡 Tips Presentasi

Kalau ditanya guru/dosen:

| Pertanyaan | Jawaban Singkat |
|---|---|
| *"Kenapa pakai Supabase?"* | "Supabase itu Backend-as-a-Service berbasis PostgreSQL. Saya pakai karena gratis, gak perlu setup server sendiri, dan punya SDK JavaScript yang gampang dipakai di React Native." |
| *"Kenapa pakai `.env`?"* | "Untuk menyimpan kredensial supaya tidak ter-hardcode di kode. Ini best practice keamanan — kalau kode di-share ke GitHub, kredensial tetap aman." |
| *"Kenapa file disimpan Base64?"* | "Karena proyek ini untuk demo lokal, tidak pakai Supabase Storage. Semua file di-encode Base64 dan disimpan langsung di database agar lebih simpel." |
| *"Kenapa ada 2 model monetisasi?"* | "Subscription cocok untuk instansi dengan volume surat tinggi, Per-Document Fee cocok untuk penggunaan tidak rutin. Sistem otomatis memilih mana yang lebih murah untuk user." |
| *"Bagaimana cara kerja soft delete?"* | "Data tidak benar-benar dihapus, hanya ditandai `is_deleted = true`. Query di aplikasi akan filter `is_deleted = false`, jadi data yang 'dihapus' tidak muncul tapi masih bisa direstore admin." |

---
