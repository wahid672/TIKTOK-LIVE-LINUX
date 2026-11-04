# TikTok LIVE Studio

> **Standalone TikTok LIVE RTMP Streamer & Tabler Admin Dashboard (No OBS Needed)**

[![Platform](https://img.shields.io/badge/platform-Linux-blue.svg)](https://www.debian.org/)
[![Python](https://img.shields.io/badge/python-3.10%2B-brightgreen.svg)](https://www.python.org/)
[![GStreamer](https://img.shields.io/badge/gstreamer-1.0-orange.svg)](https://gstreamer.freedesktop.org/)
[![UI](https://img.shields.io/badge/ui-Tabler%20Admin%20Dashboard-blue.svg)](https://tabler.io/)
[![License](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)

**TikTok LIVE Studio** adalah aplikasi siaran langsung mandiri (*standalone*) berbasis Linux untuk menyiarkan video dan audio langsung ke server RTMP TikTok **tanpa memerlukan OBS Studio**. Aplikasi ini dilengkapi antarmuka web modern berbasis **Tabler Admin Dashboard** untuk memantau metrik siaran, melihat preview vertikal 9:16 secara *real-time*, dan mengontrol live streaming dengan satu klik.

---

## ✨ Fitur Utama

- 🎨 **Live Canvas Studio (Drag & Drop OBS / TikTok Live Studio Style)**:
  - **Visual Drag & Drop & Resize**: Susun tata letak visual overlay langsung di antarmuka ponsel 9:16 dengan drag mouse/touch dan resize handles di sudut elemen.
  - **Penambahan Teks Fleksibel**: Tambahkan teks statis (*Title/Rules*), **Running Text (Marquee Ticker)** berjalan horizontal, atau kartu banner pengumuman.
  - **Live Inspector Editor**: Klik elemen apa pun untuk mengubah teks, subtitle, ukuran font, dan warna teks secara instan.
  - **Hot-Reload Live Sync**: Perubahan layout dan teks otomatis terkirim dan ter-update secara *real-time* ke siaran live tanpa perlu mematikan stream.
  - **Smart Center Snapping & Safe Zone Guide**: Otomatis mengunci ke tengah (*center magnetic snap*) serta panduan batas aman antarmuka TikTok Mobile.
- 🚀 **Dual Streaming Engine (GStreamer & FFmpeg)**: Mendukung dua engine encoder handal:
  - **FFmpeg Engine (`x11grab` + `pulse`)**: Sangat direkomendasikan untuk siaran maraton berjam-jam (3+ jam hingga 24/7 non-stop). Menghilangkan risiko stuttering dan desinkronisasi audio/video.
  - **GStreamer 1.0 (Pipeline Teroptimasi)**: Menggunakan hardware audio master clock (`pulsesrc provide-clock=true`) dan `videorate` continuous frame-pacing untuk efisiensi CPU maksimal.
- 🔊 **Audio Lengkap Desktop & Musik**: Otomatis menangkap audio sistem utama (*Default Sink Monitor*). Musik dari Spotify, YouTube di browser lain, pemutar MP3, maupun suara dari overlay masuk secara jernih ke siaran live.
- 🔒 **Aman Tanpa Kebocoran Layar & Kursor (Zero Desktop Leakage)**: Menggunakan display virtual terisolasi (`Xvfb :99`) dan opsi `show-pointer=false`. Kursor mouse dan aktivitas desktop pribadi tidak akan pernah muncul di live.
- 🔑 **Autentikasi Otomatis (Zero Manual Stream Key)**: Otomatis membaca sesi login browser (Google Chrome, Chromium, Brave, Edge, Firefox) untuk membuat room dan mengambil RTMP Push URL resmi dari TikTok.
- 💾 **Simpan Setingan Otomatis & Permanen**: Menyimpan Judul Siaran, URL Web Overlay, Resolusi, dan Sumber Audio. Pengaturan Anda tersimpan aman dan otomatis terisi kembali saat dashboard dibuka.
- 🧹 **Pembersih Cache Overlay (Instant CSS Refresh)**: Tombol satu klik untuk menghapus cache browser overlay dan memuat ulang visual CSS/JS terbaru tanpa perlu restart aplikasi.
- 🌐 **Mendukung Segala Web Overlay & Template Bawaan**: Mampu merender website, dashboard, widget HTML5, atau template overlay vertikal 9:16 bawaan (`/overlay`).
- 🎛️ **Modern Tabler Admin Dashboard**:
  - Tampilan dashboard bersih berbasis Tabler UI (Bootstrap 5).
  - Mode Gelap (*Dark Mode*) & Mode Terang (*Light Mode*).
  - Kartu KPI real-time (Sesi TikTok, Status Encoder, Timer Live, Room ID).
  - Phone Mockup Monitor Preview vertikal 9:16 portrait.
  - Terminal logs interaktif untuk memantau proses GStreamer & API.
  - Tombol darurat **Force Stop** untuk mematikan proses background dan menutup room jika siaran gantung.

---

## 🏗️ Arsitektur Sistem

```
                                  ┌──────────────────────────────┐
                                  │   TikTok Web Session         │
                                  │   (Chrome / Chromium Cookie) │
                                  └──────────────┬───────────────┘
                                                 │
                                                 ▼
┌─────────────────────────┐          ┌───────────────────────────┐
│   Tabler Web Dashboard  │          │   TikTok Room Creator     │
│   (Flask / Port 8080)   ├─────────►│   (Python REST API)       │
└────────────┬────────────┘          └───────────┬───────────────┘
             │                                   │ RTMP Push URL
             ▼                                   ▼
┌─────────────────────────┐          ┌───────────────────────────┐
│ Browser Overlay Window  │          │  GStreamer Stream Engine  │
│ (720x1280 / 1080x1920)  ├─────────►│  ximagesrc + pulsesrc     ├─────► TikTok LIVE RTMP
└─────────────────────────┘          │  H.264 (x264) + AAC       │       (Ingest Servers)
                                     └───────────────────────────┘
```

---

## 📋 Kebutuhan Sistem & Dependensi

Pastikan sistem Linux Anda memiliki komponen berikut:

- **OS**: Linux (Debian 11/12/13, Ubuntu 20.04/22.04/24.04, Arch Linux, Fedora) atau Windows via **WSL2** dengan dukungan GUI (WSLg).
- **Python**: Versi 3.10 atau lebih baru dengan `python3-gi` (PyGObject).
- **Display Server**: Xvfb (X Virtual Framebuffer).
- **Browser**: Google Chrome atau Chromium (sudah login akun TikTok yang memiliki akses LIVE).
- **Audio Server**: PulseAudio atau PipeWire.

---

## 🛠️ Panduan Instalasi & Menjalankan

Ikuti langkah-langkah di bawah ini secara berurutan:

### Langkah 1: Install Paket Sistem Linux

Jalankan perintah berikut di terminal Linux Anda untuk menginstal dependensi GStreamer, virtual display, audio, dan Python bindings:

#### Untuk Ubuntu / Debian:
```bash
sudo apt update
sudo apt install -y \
  python3 \
  python3-pip \
  python3-venv \
  python3-gi \
  python3-gi-cairo \
  gir1.2-gtk-3.0 \
  gir1.2-gst-plugins-base-1.0 \
  gstreamer1.0-tools \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad \
  gstreamer1.0-plugins-ugly \
  gstreamer1.0-libav \
  ffmpeg \
  xvfb \
  google-chrome-stable \
  pulseaudio \
  pulseaudio-utils
```

> **Catatan Google Chrome**: Jika `google-chrome-stable` belum terpasang di Debian/Ubuntu:
> ```bash
> wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
> sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
> sudo apt update && sudo apt install -y google-chrome-stable
> ```

#### Untuk Arch Linux:
```bash
sudo pacman -Syu --needed \
  python \
  python-gobject \
  gstreamer \
  gst-plugins-base \
  gst-plugins-good \
  gst-plugins-bad \
  gst-plugins-ugly \
  gst-libav \
  ffmpeg \
  xorg-server-xvfb \
  google-chrome \
  pulseaudio
```

---

### Langkah 2: Login Akun TikTok di Browser

1. Buka browser **Google Chrome** di desktop Linux Anda.
2. Kunjungi [https://www.tiktok.com](https://www.tiktok.com).
3. Masuk (*Log in*) ke akun TikTok Anda (pastikan akun memenuhi syarat TikTok LIVE).
4. Biarkan browser tetap menyimpan cookies tersebut. Sistem `tiktok.py` akan otomatis membaca sesi login aktif tanpa perlu mengekspor cookie manual.

---

### Langkah 3: Setup Python Virtual Environment

Buka direktori project:

```bash
cd tiktok-live-interaction
```

Buat virtual environment dengan opsi `--system-site-packages` (wajib agar Python dapat memuat modul GStreamer `gi` dari sistem):

```bash
python3 -m venv --system-site-packages venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

---

### Langkah 4: Menjalankan Aplikasi

Anda dapat menjalankan aplikasi menggunakan salah satu cara berikut:

#### Opsi A: Menggunakan Launcher Script (Rekomendasi)
```bash
chmod +x start.sh
./start.sh
```

#### Opsi B: Menjalankan Server Python Langsung
```bash
source venv/bin/activate
python3 server.py
```

Jika berhasil, terminal akan menampilkan output:
```text
==================================================
🚀 TikTok LIVE Dashboard running!
👉 URL: http://localhost:8080
👉 Overlay: http://localhost:8080/overlay
==================================================
```

---

## 🎮 Cara Menggunakan Fitur Dashboard

1. **Akses Dashboard**: Buka browser di `http://localhost:8080`.
2. **Atur Siaran**:
   - Tentukan **Judul Siaran TikTok**.
   - Masukkan **URL Web Overlay** (default: `http://localhost:8080/overlay` atau URL custom).
   - Pilih **Resolusi** dan **FPS/Bitrate**.
   - Pilih **Sumber Audio Siaran**:
     - `Suara Desktop` (Rekomendasi): Menangkap audio musik YouTube, Spotify, atau pemutar musik apa pun yang sedang diputar di komputer.
3. **Susun Tata Letak Visual (Studio Editor)**:
   - Pada panel kanan **Live Canvas Studio**, pilih mode **Studio Editor**.
   - Klik dan geser elemen (Header, Jam & Wave, Banner) ke posisi yang diinginkan.
   - Klik tombol **+ Teks** untuk menambah judul/aturan baru, **+ Running Text** untuk teks pengumuman berjalan, atau **+ Banner** untuk kartu pesan.
   - Klik elemen untuk memunculkan panel **Edit Elemen** di bawah kanvas guna mengubah isi tulisan, warna, dan ukuran huruf.
   - Klik tombol **💾 Simpan** pada toolbar studio untuk menyimpan layout secara permanen.
   - Beralih ke tombol **📱 Live Preview** untuk melihat hasil akhir siaran.
4. **Simpan Pengaturan Siaran**:
   - Klik tombol **💾 Simpan Setingan**. Judul dan URL Anda akan tersimpan di file `settings.json` dan otomatis terisi saat dashboard dibuka kembali.
5. **Perbarui Styling CSS Overlay (Hapus Cache)**:
   - Jika Anda baru saja mengedit kode CSS atau HTML pada halaman overlay Anda, klik tombol **🧹 Hapus Cache Overlay**. Cache browser akan dibersihkan seketika.
6. **Mulai Siaran**:
   - Klik tombol hijau **🚀 Mulai Live Sekarang**.
   - Siaran akan otomatis mengalir ke server TikTok tanpa kursor mouse dan tanpa kebocoran desktop.
7. **Akhiri Siaran**:
   - Klik tombol merah **⏹️ Akhiri Siaran Live** saat selesai.
8. **Tindakan Darurat (Force Stop)**:
   - Jika siaran terputus tiba-tiba atau room di TikTok masih mengambang (*hanging*), klik tombol **Force Stop** pada navbar atau tab pengaturan.

---

## 📁 Struktur Direktori Project

```
tiktok-live-interaction/
├── static/
│   ├── app.css              # Custom styling, efek animasi & mockup smartphone 9:16
│   └── app.js               # Frontend controller (Tabler theme, polling, cache buster, settings)
├── templates/
│   ├── index.html           # Template antarmuka Tabler Admin Dashboard
│   └── overlay.html         # Template overlay vertikal 9:16 portrait bawaan
├── streamer.py              # Engine streaming GStreamer RTMP (Xvfb, Chrome Kiosk, H.264/AAC)
├── tiktok.py                # Modul ekstraksi cookie & integrasi TikTok Room Webcast API
├── server.py                # Backend REST API Flask (Port 8080)
├── start.sh                 # Launcher script satu klik
├── requirements.txt         # Daftar pustaka Python
├── LICENSE                  # Lisensi MIT
└── README.md                # Dokumentasi petunjuk penggunaan
```

---

## 🛡️ Lisensi

Project ini dilisensikan di bawah lisensi **MIT**. Silakan lihat berkas [LICENSE](LICENSE) untuk informasi lebih lanjut.
