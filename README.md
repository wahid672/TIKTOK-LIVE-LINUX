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

- 🚀 **Streaming Langsung Tanpa OBS Studio**: Menggunakan pipeline GStreamer teroptimasi untuk mengenkode video H.264 dan audio AAC langsung ke RTMP ingest server TikTok.
- 🔒 **Aman Tanpa Kebocoran Layar (Zero Desktop Leakage)**: Menggunakan display virtual terisolasi (`Xvfb :99`). Aktivitas desktop dan jendela pribadi Anda tidak akan pernah bocor ke siaran live.
- 🔑 **Autentikasi Otomatis (Zero Manual Stream Key)**: Otomatis membaca sesi login browser (Google Chrome, Chromium, Brave, Edge, Firefox) untuk membuat room dan mengambil RTMP Push URL resmi dari TikTok.
- 🌐 **Mendukung Segala Web Overlay**: Mampu merender website, dashboard, aplikasi web, atau widget interaktif HTML5 ke dalam tampilan live portrait (720×1280 atau 1080×1920).
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
- **Audio Server**: PulseAudio atau PipeWire (dengan virtual sink audio).

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
  xorg-server-xvfb \
  google-chrome \
  pulseaudio
```

---

### Langkah 2: Konfigurasi Virtual Audio Sink

GStreamer membutuhkan virtual sink audio (`Virtual_Sink.monitor`) untuk menangkap suara browser overlay tanpa menimbulkan loopback suara mikrofon:

```bash
# Cek apakah virtual sink sudah aktif
pactl list short sinks | grep Virtual_Sink || \
pactl load-module module-null-sink sink_name=Virtual_Sink sink_properties=device.description=Virtual_Sink
```

> **Tips Otomatisasi**: Tambahkan perintah `pactl load-module ...` di atas ke file `~/.bashrc` atau `~/.profile` Anda agar virtual sink otomatis dibuat setiap kali sistem menyala.

---

### Langkah 3: Login Akun TikTok di Browser

1. Buka browser **Google Chrome** di desktop Linux Anda.
2. Kunjungi [https://www.tiktok.com](https://www.tiktok.com).
3. Masuk (*Log in*) ke akun TikTok Anda (pastikan akun memenuhi syarat TikTok LIVE).
4. Biarkan browser tetap menyimpan cookies tersebut. Sistem `tiktok.py` akan otomatis membaca sesi login aktif tanpa perlu mengekspor cookie manual.

---

### Langkah 4: Setup Python Virtual Environment

Clone repository ini (atau buka direktori project):

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

### Langkah 5: Menjalankan Aplikasi

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
==================================================
```

---

## 🎮 Cara Melakukan Live Streaming via Dashboard

1. **Akses Dashboard**:
   Buka browser dan buka:
   ```
   http://localhost:8080
   ```
2. **Cek Indikator Sesi**:
   Perhatikan status di navbar atas atau kartu **Sesi Akun TikTok**. Pastikan muncul status hijau bertuliskan nama browser yang terdeteksi (contoh: `TikTok: Chrome`).
3. **Atur Siaran**:
   - **Judul Siaran TikTok**: Masukkan judul siaran Anda (contoh: `Live Santai Musik & Ngobrol`).
   - **URL Web Overlay**: Masukkan tautan web yang ingin ditampilkan di siaran (contoh: URL dashboard Streamlabs, website interaktif, atau `https://www.tiktok.com`).
   - **Resolusi**: Pilih `720 × 1280 (HD Portrait)` untuk siaran stabil atau `1080 × 1920 (Full HD)`.
   - **FPS & Bitrate**: Pilih `30 FPS — 2500 Kbps` (standar) atau `60 FPS — 4500 Kbps`.
4. **Mulai Live**:
   - Klik tombol hijau **🚀 Mulai Live Sekarang**.
   - Sistem akan otomatis meminta RTMP URL ke server TikTok, menjalankan display virtual `Xvfb :99`, membuka Google Chrome Kiosk pada tampilan overlay, dan mengalirkan H.264/AAC ke server TikTok.
   - Timer siaran akan mulai berjalan dan status berubah menjadi **🔴 LIVE TIKTOK**.
5. **Mengakhiri Live**:
   - Klik tombol merah **⏹️ Akhiri Siaran Live** saat selesai. Sistem akan mengirim sinyal resmi penutupan room ke server TikTok dan mematikan encoder.
6. **Tindakan Darurat (Force Stop)**:
   - Jika siaran terputus tiba-tiba atau room di TikTok masih mengambang (*hanging*), klik tombol **Force Stop** pada navbar atau tab pengaturan untuk membersihkan seluruh proses background dan memaksa room ditutup di server TikTok.

---

## 📁 Struktur Direktori Project

```
tiktok-live-interaction/
├── static/
│   ├── app.css              # Custom styling, efek animasi & mockup smartphone 9:16
│   └── app.js               # Frontend controller (Tabler theme, polling, stream control)
├── templates/
│   └── index.html           # Template antarmuka Tabler Admin Dashboard
├── streamer.py              # Engine streaming GStreamer RTMP (Xvfb, Chrome Kiosk, H.264/AAC)
├── tiktok.py                # Modul ekstraksi cookie & integrasi TikTok Room Webcast API
├── server.py                # Backend REST API Flask (Port 8080)
├── start.sh                 # Launcher script satu klik
├── requirements.txt         # Daftar pustaka Python
├── LICENSE                  # Lisensi MIT
└── README.md                # Dokumentasi petunjuk penggunaan
```

---

## ⚙️ Spesifikasi & Konfigurasi Streaming

| Pengaturan | Nilai Default | Opsi Tersedia | Keterangan |
| :--- | :--- | :--- | :--- |
| **Port Dashboard** | `8080` | Ubah via `PORT=8080` | Port antarmuka web Tabler |
| **Resolusi Canvas** | `720x1280` | `720x1280`, `1080x1920` | Rasio vertikal 9:16 standar TikTok Mobile |
| **Frame Rate** | `30 FPS` | `25`, `30`, `60` | 30 FPS direkomendasikan untuk stabilitas uplink |
| **Bitrate Video** | `2500 kbps` | `1800` – `4500 kbps` | Menggunakan encoder `x264enc` (*veryfast preset*) |
| **Audio Pipeline** | `Virtual_Sink` | PulseAudio monitor | Format AAC stereo 48.000 Hz 160 kbps |

---

## ❓ Troubleshooting (Tanya Jawab Kendala)

### 1. Muncul pesan "TikTok Belum Login di Chrome"?
* Buka Google Chrome di lingkungan desktop Linux Anda.
* Kunjungi `https://www.tiktok.com` dan login ulang.
* Pastikan browser ditutup atau tetap terbuka dengan profile default agar SQLite database cookie tersimpan.

### 2. GStreamer error: "Pipeline set_state(PLAYING) returned FAILURE"?
* Pastikan semua plugin GStreamer terpasang lengkap:
  ```bash
  sudo apt install gstreamer1.0-plugins-ugly gstreamer1.0-plugins-bad gstreamer1.0-libav
  ```
* Periksa apakah codec H.264 tersedia dengan perintah: `gst-inspect-1.0 x264enc`.

### 3. Layar virtual konflik ("Failed to start Xvfb: ... :99")?
* Bersihkan sisa lock file display Xvfb sebelumnya:
  ```bash
  sudo rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
  pkill -9 -f "Xvfb :99"
  ```

### 4. Menjalankan di Windows melalui WSL2?
* Pasang WSL2 dengan Ubuntu 22.04/24.04: `wsl --install -d Ubuntu-24.04`.
* Manfaatkan fitur **WSLg** bawaan Windows 11 untuk menjalankan Xvfb dan PulseAudio secara terintegrasi.

---

## 🛡️ Lisensi

Project ini dilisensikan di bawah lisensi **MIT**. Silakan lihat berkas [LICENSE](LICENSE) untuk informasi lebih lanjut.
