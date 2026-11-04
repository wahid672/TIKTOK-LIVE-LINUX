#!/usr/bin/env python3
"""TikTok LIVE Web Dashboard Server.
Provides full web controls for standalone streaming without OBS
and automated TikTok room creation.
"""
import collections
import glob
import json
import os
import shutil
import subprocess
import time
import urllib.parse
from pathlib import Path
from flask import Flask, jsonify, render_template, request, send_file
from flask_cors import CORS
import tiktok
from streamer import Streamer

PORT = int(os.environ.get("PORT", 8080))
BASE_DIR = Path(__file__).resolve().parent
SETTINGS_FILE = BASE_DIR / "settings.json"

DEFAULT_SETTINGS = {
    "title": "TikTok LIVE Broadcast",
    "overlay_url": f"http://localhost:{PORT}/overlay",
    "resolution": "720x1280",
    "fps_bitrate": "30|2500",
    "audio_source": "desktop",
    "engine": "gstreamer"
}

def load_settings():
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                return {**DEFAULT_SETTINGS, **saved}
        except Exception as e:
            print(f"Error loading settings: {e}")
    return DEFAULT_SETTINGS.copy()

def save_settings(data):
    current = load_settings()
    current.update({
        "title": (data.get("title") or current["title"]).strip(),
        "overlay_url": (data.get("overlay_url") or current["overlay_url"]).strip(),
        "resolution": str(data.get("resolution") or current["resolution"]).strip(),
        "fps_bitrate": str(data.get("fps_bitrate") or current["fps_bitrate"]).strip(),
        "audio_source": str(data.get("audio_source") or current["audio_source"]).strip(),
        "engine": str(data.get("engine") or current.get("engine", "gstreamer")).strip().lower()
    })
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=2, ensure_ascii=False)
        return True, "Pengaturan berhasil disimpan."
    except Exception as e:
        return False, str(e)

LAYOUT_FILE = BASE_DIR / "overlay_layout.json"

DEFAULT_LAYOUT = {
    "canvas": {"width": 720, "height": 1280},
    "elements": [
        {
            "id": "el_header",
            "type": "header",
            "title": "TIKTOK LIVE",
            "subtitle": "Live Broadcast",
            "x": 5, "y": 12, "w": 90, "h": 9,
            "fontSize": 24,
            "color": "#ffffff",
            "bgColor": "rgba(0, 0, 0, 0)",
            "visible": True
        },
        {
            "id": "el_clock",
            "type": "clock",
            "title": "Jam & Wave",
            "subtitle": "",
            "x": 10, "y": 38, "w": 80, "h": 14,
            "fontSize": 44,
            "color": "#ffffff",
            "bgColor": "rgba(0, 0, 0, 0)",
            "visible": True
        },
        {
            "id": "el_footer",
            "type": "banner",
            "title": "✨ Selamat Datang di Siaran Live!",
            "subtitle": "Tap-tap layar & tinggalkan komentar ya!",
            "x": 5, "y": 66, "w": 90, "h": 9,
            "fontSize": 15,
            "color": "#38bdf8",
            "bgColor": "rgba(30, 41, 59, 0.7)",
            "visible": True
        }
    ]
}

def load_layout():
    if LAYOUT_FILE.exists():
        try:
            with open(LAYOUT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "elements" in data:
                    return data
        except Exception as e:
            print(f"Error loading layout: {e}")
    return DEFAULT_LAYOUT.copy()

def save_layout(data):
    try:
        with open(LAYOUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True, "Layout overlay berhasil disimpan."
    except Exception as e:
        return False, str(e)

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

@app.errorhandler(Exception)
def handle_unexpected_error(e):
    log_event(f"Unhandled Server Error: {e}")
    return jsonify({
        "ok": False,
        "error": f"Server Error: {str(e)}"
    }), 500

@app.errorhandler(404)
def handle_not_found(e):
    return jsonify({
        "ok": False,
        "error": "Not Found"
    }), 404

logs_queue = collections.deque(maxlen=100)

def log_event(msg):
    timestamp = time.strftime("%H:%M:%S")
    entry = f"[{timestamp}] {msg}"
    print(entry)
    logs_queue.append(entry)

streamer = Streamer(log_cb=log_event)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/overlay")
def overlay():
    """Built-in clean 9:16 vertical stream overlay."""
    return render_template("overlay.html")

@app.route("/api/status", methods=["GET"])
def get_status():
    try:
        session = tiktok.session_status()
    except Exception as e:
        session = {"ok": False, "browser": None, "expires": None, "error": str(e)}

    try:
        stream_status = streamer.get_status()
    except Exception as e:
        stream_status = {
            "is_streaming": False,
            "duration": 0,
            "engine": "gstreamer",
            "has_ffmpeg": False,
            "has_gstreamer": False,
            "error": str(e)
        }

    try:
        persisted_room = tiktok.get_active_room()
    except Exception:
        persisted_room = None

    try:
        session_id = tiktok.get_session_id()
    except Exception:
        session_id = ""

    return jsonify({
        "ok": True,
        "tiktok": session,
        "streamer": stream_status,
        "has_active_room": bool(persisted_room),
        "active_room": persisted_room,
        "session_id": session_id,
        "port": PORT
    })

@app.route("/api/settings", methods=["GET", "POST"])
def handle_settings():
    if request.method == "POST":
        data = request.get_json() or {}
        ok, msg = save_settings(data)
        if ok:
            log_event(f"Pengaturan disimpan: Judul='{data.get('title')}', Overlay='{data.get('overlay_url')}'")
            return jsonify({"ok": True, "message": msg, "settings": load_settings()})
        return jsonify({"ok": False, "error": msg}), 500
    return jsonify({"ok": True, "settings": load_settings()})

@app.route("/api/clear-cache", methods=["POST"])
def handle_clear_cache():
    log_event("Membersihkan temporary cache browser overlay...")
    cleared = []
    # Clear Chrome temp profile directories
    for pattern in ["/tmp/tt-stream-overlay-chrome", "/tmp/stream-chrome*", "/tmp/.org.chromium.Chromium*"]:
        try:
            for p in glob.glob(pattern):
                if os.path.isdir(p):
                    shutil.rmtree(p, ignore_errors=True)
                    cleared.append(p)
                elif os.path.isfile(p):
                    os.unlink(p)
                    cleared.append(p)
        except Exception as e:
            log_event(f"Notice saat bersihkan cache {pattern}: {e}")

    log_event("✓ Cache overlay berhasil dibersihkan.")
    return jsonify({
        "ok": True,
        "message": "Cache overlay dan temporary browser profile berhasil dibersihkan.",
        "cleared": cleared,
        "timestamp": int(time.time() * 1000)
    })

@app.route("/api/overlay/layout", methods=["GET", "POST"])
def handle_overlay_layout():
    if request.method == "POST":
        data = request.get_json() or {}
        ok, msg = save_layout(data)
        if ok:
            log_event("Layout overlay Studio berhasil diperbarui & disimpan.")
            return jsonify({"ok": True, "message": msg, "layout": load_layout()})
        return jsonify({"ok": False, "error": msg}), 500
    return jsonify({"ok": True, "layout": load_layout()})

@app.route("/api/overlay/reset", methods=["POST"])
def handle_overlay_reset():
    ok, msg = save_layout(DEFAULT_LAYOUT)
    if ok:
        log_event("Layout overlay Studio berhasil direset ke standar.")
        return jsonify({"ok": True, "message": "Layout berhasil direset ke standar.", "layout": load_layout()})
    return jsonify({"ok": False, "error": msg}), 500

@app.route("/api/stream/snapshot", methods=["GET"])
def get_stream_snapshot():
    """Captures real-time image frame directly from virtual display :99."""
    path = streamer.capture_snapshot()
    if path and os.path.exists(path):
        return send_file(path, mimetype="image/jpeg", max_age=0)
    return jsonify({"ok": False, "error": "Snapshot display virtual tidak tersedia. Pastikan siaran aktif."}), 404

@app.route("/api/audio-sources", methods=["GET"])
def get_audio_sources():
    sources = streamer.list_audio_sources()
    return jsonify({
        "ok": True,
        "sources": sources
    })

@app.route("/api/logs", methods=["GET"])
def get_logs():
    return jsonify({
        "ok": True,
        "logs": list(logs_queue)
    })

@app.route("/api/stream/start", methods=["POST"])
def start_stream():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "TikTok LIVE Broadcast").strip()
    
    # Default to built-in clean overlay if empty or not provided
    default_overlay = f"http://127.0.0.1:{PORT}/overlay?title={urllib.parse.quote(title)}"
    overlay_url = (data.get("overlay_url") or "").strip()
    if not overlay_url:
        overlay_url = default_overlay

    width = int(data.get("width") or 720)
    height = int(data.get("height") or 1280)
    fps = int(data.get("fps") or 30)
    bitrate = int(data.get("bitrate") or 2500)
    audio_source = (data.get("audio_source") or "desktop").strip()
    engine = (data.get("engine") or "gstreamer").strip().lower()

    # Automatically save settings for persistence
    try:
        save_settings({
            "title": title,
            "overlay_url": overlay_url,
            "resolution": f"{width}x{height}",
            "fps_bitrate": f"{fps}|{bitrate}",
            "audio_source": audio_source,
            "engine": engine
        })
    except Exception as e:
        log_event(f"Notice on save settings: {e}")

    log_event(f"Request to start LIVE: '{title}' with overlay: {overlay_url} (audio: {audio_source}, engine: {engine})")

    # Check TikTok session first
    try:
        session = tiktok.session_status()
    except Exception as e:
        session = {"ok": False, "error": str(e)}

    if not session.get("ok"):
        return jsonify({
            "ok": False,
            "error": "Sesi login akun TikTok tidak terdeteksi di browser. Silakan buka browser Chrome/Chromium di Linux dan pastikan Anda sudah login ke tiktok.com."
        }), 400

    # 1. Create Room on TikTok
    try:
        log_event("Creating room on TikTok...")
        room = tiktok.create_room(log=log_event, title=title)
        log_event(f"Room created! Room ID: {room.get('room_id')}")
    except Exception as e:
        log_event(f"Failed to create TikTok room: {e}")
        return jsonify({
            "ok": False,
            "error": f"Gagal membuat room TikTok LIVE: {e}"
        }), 400

    rtmp_url = room.get("url") if isinstance(room, dict) else None
    if not rtmp_url:
        return jsonify({
            "ok": False,
            "error": "Server TikTok tidak memberikan URL push RTMP. Pastikan akun TikTok Anda telah memenuhi syarat izin siaran LIVE."
        }), 400

    # 2. Start Encoder Streamer (GStreamer / FFmpeg)
    try:
        success, msg = streamer.start(
            rtmp_url=rtmp_url,
            overlay_url=overlay_url,
            room_info=room,
            width=width,
            height=height,
            fps=fps,
            bitrate=bitrate,
            audio_source=audio_source,
            engine=engine
        )
    except Exception as e:
        log_event(f"Error launching streaming engine: {e}")
        return jsonify({
            "ok": False,
            "error": f"Gagal menjalankan encoder streaming: {e}"
        }), 500

    if not success:
        return jsonify({"ok": False, "error": msg}), 500

    return jsonify({
        "ok": True,
        "message": "Live stream started successfully!",
        "room": room
    })

@app.route("/api/stream/stop", methods=["POST"])
def stop_stream():
    room = streamer.current_room or tiktok.get_active_room()
    log_event("Request to stop LIVE stream")
    streamer.stop()

    closed_tiktok = False
    if room:
        try:
            log_event(f"Notifying TikTok that LIVE has ended (Room: {room.get('room_id')})...")
            closed_tiktok = tiktok.finish_room(log=log_event, room=room)
        except Exception as e:
            log_event(f"Notice on room finish: {e}")
    else:
        log_event("No active room record found to close.")

    tiktok.clear_active_room()
    streamer.current_room = None
    return jsonify({
        "ok": True,
        "closed_tiktok": closed_tiktok,
        "message": "Live stream stopped."
    })

@app.route("/api/stream/force-stop", methods=["POST"])
def force_stop_stream():
    log_event("⚡ [FORCE STOP] Request to forcefully terminate all live streams and close TikTok room!")

    # 1. Stop streamer class & kill all potential streaming processes
    streamer.stop()
    try:
        subprocess.run(["pkill", "-9", "-f", "Xvfb :99"], capture_output=True)
        subprocess.run(["pkill", "-9", "-f", "tt-stream-overlay-chrome"], capture_output=True)
        subprocess.run(["pkill", "-15", "obs"], capture_output=True)
        log_event("Cleaned up virtual display, chrome kiosk, and encoder processes.")
    except Exception as e:
        log_event(f"Process cleanup notice: {e}")

    # 2. Check and close room on TikTok server
    room = streamer.current_room or tiktok.get_active_room()
    closed_tiktok = False
    if room:
        try:
            log_event(f"Sending finish signal to TikTok server for Room ID: {room.get('room_id')}...")
            closed_tiktok = tiktok.finish_room(log=log_event, room=room)
            if closed_tiktok:
                log_event("✓ TikTok confirmed LIVE room has ended successfully!")
            else:
                log_event("TikTok finish ping sent.")
        except Exception as e:
            log_event(f"Error finishing TikTok room: {e}")
    else:
        log_event("No active room ID found. Cleaned up all local processes.")

    tiktok.clear_active_room()
    streamer.current_room = None
    streamer.is_streaming = False

    return jsonify({
        "ok": True,
        "closed_tiktok": closed_tiktok,
        "message": "Siaran live berhasil dihentikan secara paksa dan room TikTok telah ditutup."
    })

if __name__ == "__main__":
    print(f"==================================================")
    print(f"🚀 TikTok LIVE Dashboard running!")
    print(f"👉 URL: http://localhost:{PORT}")
    print(f"👉 Overlay: http://localhost:{PORT}/overlay")
    print(f"==================================================")
    app.run(host="0.0.0.0", port=PORT, debug=False)
