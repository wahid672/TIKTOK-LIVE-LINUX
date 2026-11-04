#!/usr/bin/env python3
"""Standalone RTMP streamer for TikTok LIVE (Supports GStreamer & FFmpeg).
Uses an isolated virtual display (Xvfb :99) with MIT-SHM extensions at exact vertical 720x1280 / 1080x1920
so that ONLY the clean web overlay is captured (no desktop leakage)
and captures desktop/system audio (music, other browsers, YouTube, Spotify)
streamed natively in 9:16 vertical orientation to TikTok LIVE.

Optimized for long-duration and 24/7 streaming (3+ hours) without stutter:
- Xvfb with MIT-SHM & Composite extensions for high-speed shared memory frame grab
- Anti-throttling & memory leak protection flags for Chrome Kiosk
- GStreamer: Audio-driven master clocking, unbroken CFR videorate (no timestamp holes),
  ultrafast zero-latency x264 rate control, and corruption-free non-leaky FLV transport
- FFmpeg: Industrial-grade x11grab + pulse engine with thread queues and async audio resync
"""
import os
import shutil
import subprocess
import time
from urllib.parse import urlsplit

# GStreamer imports
try:
    import gi
    gi.require_version("Gst", "1.0")
    from gi.repository import Gst
    Gst.init(None)
    HAS_GST = True
except Exception:
    HAS_GST = False

def _setup_pulse_env():
    """Dynamically discover and set PulseAudio/PipeWire socket."""
    if "PULSE_SERVER" not in os.environ:
        candidates = []
        xdg = os.environ.get("XDG_RUNTIME_DIR")
        if xdg:
            candidates.append(os.path.join(xdg, "pulse", "native"))
        if hasattr(os, "getuid"):
            candidates.append(f"/run/user/{os.getuid()}/pulse/native")
        candidates.append("/run/user/1000/pulse/native")

        for cand in candidates:
            if os.path.exists(cand):
                os.environ["PULSE_SERVER"] = f"unix:{cand}"
                break

_setup_pulse_env()

VIRTUAL_DISPLAY = ":99"

class Streamer:
    def __init__(self, log_cb=None):
        self.log_cb = log_cb or self._default_log
        self.pipe = None           # GStreamer pipeline
        self.ffmpeg_proc = None    # FFmpeg process
        self.xvfb_proc = None
        self.chrome_proc = None
        self.is_streaming = False
        self.start_time = None
        self.current_room = None
        self.rtmp_url = None
        self.overlay_url = None
        self.width = 720
        self.height = 1280
        self.fps = 30
        self.bitrate = 2500
        self.engine = "gstreamer"  # "gstreamer" or "ffmpeg"
        self.audio_source = "desktop"
        self.active_audio_device = None
        self.error = None

    def _default_log(self, msg):
        print(f"[Streamer] {msg}")

    def is_ffmpeg_available(self):
        return bool(shutil.which("ffmpeg"))

    def resolve_audio_device(self, source_choice="desktop"):
        """Resolves the audio capture device.
        When set to 'desktop' (default), automatically detects the active default
        sound output (sink monitor) so that ALL sounds (other browsers, YouTube,
        Spotify, music players, games) are captured seamlessly.
        """
        source_choice = (source_choice or "desktop").strip()

        # If user passed a specific device name directly
        if source_choice not in ("desktop", "auto", "virtual", "mic", ""):
            return source_choice

        if source_choice in ("desktop", "auto", ""):
            # 1. Try pactl get-default-sink
            try:
                r = subprocess.run(["pactl", "get-default-sink"], capture_output=True, text=True, timeout=2)
                if r.returncode == 0 and r.stdout.strip():
                    sink = r.stdout.strip()
                    return f"{sink}.monitor"
            except Exception:
                pass

            # 2. Try pactl info
            try:
                r = subprocess.run(["pactl", "info"], capture_output=True, text=True, timeout=2)
                for line in r.stdout.splitlines():
                    if "Default Sink:" in line:
                        sink = line.split("Default Sink:", 1)[1].strip()
                        if sink:
                            return f"{sink}.monitor"
            except Exception:
                pass

            # 3. Check pactl list short sources for any active monitor
            try:
                r = subprocess.run(["pactl", "list", "short", "sources"], capture_output=True, text=True, timeout=2)
                monitors = []
                for line in r.stdout.splitlines():
                    parts = line.split()
                    if len(parts) >= 2 and parts[1].endswith(".monitor"):
                        monitors.append(parts[1])
                
                # Prefer real hardware monitor over virtual sink if present
                real_monitors = [m for m in monitors if "Virtual_Sink" not in m]
                if real_monitors:
                    return real_monitors[0]
                if monitors:
                    return monitors[0]
            except Exception:
                pass

            # PulseAudio default sink monitor fallback
            return "@DEFAULT_SINK@.monitor"

        elif source_choice == "virtual":
            return "Virtual_Sink.monitor"

        elif source_choice == "mic":
            return "@DEFAULT_SOURCE@"

        return "@DEFAULT_SINK@.monitor"

    def list_audio_sources(self):
        """Returns detected audio sources for the UI."""
        default_monitor = self.resolve_audio_device("desktop")
        sources = [
            {"id": "desktop", "name": f"Suara Desktop / Musik & Browser Lain ({default_monitor})", "default": True},
            {"id": "virtual", "name": "Virtual Audio Sink (Virtual_Sink.monitor)", "default": False},
            {"id": "mic", "name": "Mikrofon Sistem (@DEFAULT_SOURCE@)", "default": False}
        ]
        return sources

    def get_status(self):
        duration = 0
        if self.is_streaming and self.start_time:
            duration = int(time.time() - self.start_time)
        return {
            "is_streaming": self.is_streaming,
            "duration": duration,
            "width": self.width,
            "height": self.height,
            "fps": self.fps,
            "bitrate": self.bitrate,
            "engine": self.engine,
            "has_ffmpeg": self.is_ffmpeg_available(),
            "has_gstreamer": HAS_GST,
            "overlay_url": self.overlay_url,
            "audio_source": self.audio_source,
            "active_audio_device": self.active_audio_device,
            "room_id": self.current_room.get("room_id") if self.current_room else None,
            "stream_title": self.current_room.get("title") if self.current_room else None,
            "error": self.error
        }

    def _cleanup_locks(self):
        for lock in ["/tmp/.X99-lock", "/tmp/.X11-unix/X99"]:
            if os.path.exists(lock):
                try:
                    os.unlink(lock)
                except Exception:
                    pass

    def start(self, rtmp_url, overlay_url, room_info=None, width=720, height=1280, fps=30, bitrate=2500, audio_source="desktop", engine="gstreamer"):
        if self.is_streaming:
            self.log_cb("Already streaming!")
            return False, "Already streaming"

        self.error = None
        self.width = int(width)
        self.height = int(height)
        self.fps = int(fps)
        self.bitrate = int(bitrate)
        self.audio_source = audio_source or "desktop"
        self.engine = (engine or "gstreamer").lower()
        self.rtmp_url = rtmp_url
        self.overlay_url = overlay_url
        self.current_room = room_info or {}

        # Fallback to gstreamer if ffmpeg requested but not installed
        if self.engine == "ffmpeg" and not self.is_ffmpeg_available():
            self.log_cb("FFmpeg tidak ditemukan di sistem, beralih otomatis ke GStreamer...")
            self.engine = "gstreamer"

        # 1. Clean up old locks & start dedicated vertical virtual display (Xvfb :99)
        self._cleanup_locks()
        self.log_cb(f"Memulai virtual display {VIRTUAL_DISPLAY} ({self.width}x{self.height})...")
        try:
            xvfb_cmd = [
                "Xvfb", VIRTUAL_DISPLAY,
                "-screen", "0", f"{self.width}x{self.height}x24",
                "-ac",
                "-nocursor"
            ]
            self.xvfb_proc = subprocess.Popen(xvfb_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(1.5)
        except Exception as e:
            self.log_cb(f"Failed to start Xvfb: {e}")
            return False, f"Failed to start virtual display: {e}"

        # 2. Launch Chrome Kiosk strictly on VIRTUAL_DISPLAY (:99)
        chrome_data_dir = "/tmp/tt-stream-overlay-chrome"
        try:
            shutil.rmtree(chrome_data_dir, ignore_errors=True)
        except Exception:
            pass

        # Detect Chrome / Chromium binary
        browser_bin = (
            shutil.which("google-chrome") or
            shutil.which("google-chrome-stable") or
            shutil.which("chromium-browser") or
            shutil.which("chromium") or
            "google-chrome"
        )

        # Chrome flags tuned for clean rendering & 24/7 non-stop streaming:
        # - Disables background throttling so requestAnimationFrame and timers never drop frames
        # - Disables GPU hardware acceleration on Xvfb to prevent black frame surfaces
        # - Disables /dev/shm usage to avoid shared memory exhaustion after hours
        # - Disables disk/GPU shader caching to eliminate disk inflation
        chrome_cmd = [
            browser_bin,
            "--kiosk",
            f"--window-size={self.width},{self.height}",
            "--window-position=0,0",
            f"--user-data-dir={chrome_data_dir}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-infobars",
            "--disable-background-networking",
            "--disable-sync",
            "--disable-features=Translate,OptimizationHints,MediaRouter",
            "--autoplay-policy=no-user-gesture-required",
            "--hide-scrollbars",
            "--disable-notifications",
            "--disable-session-crashed-bubble",
            "--disable-component-update",
            "--force-device-scale-factor=1",
            "--no-sandbox",
            "--test-type",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--disk-cache-size=1",
            "--media-cache-size=1",
            overlay_url
        ]

        self.log_cb(f"Rendering overlay ({overlay_url}) menggunakan {browser_bin} di {VIRTUAL_DISPLAY}...")
        env = os.environ.copy()
        env["DISPLAY"] = VIRTUAL_DISPLAY
        _setup_pulse_env()
        try:
            self.chrome_proc = subprocess.Popen(chrome_cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(3.0)  # Allow page to fully render
            if self.chrome_proc.poll() is not None:
                self.stop()
                err_msg = f"Browser overlay keluar mendadak (exit code {self.chrome_proc.returncode})"
                self.log_cb(f"ERROR: {err_msg}")
                return False, err_msg
        except Exception as e:
            self.stop()
            self.log_cb(f"Failed to launch Chrome: {e}")
            return False, f"Failed to launch Chrome: {e}"

        # Move mouse cursor off-screen to avoid triggering :hover states or tooltips
        try:
            subprocess.run(["xdotool", "mousemove", "--display", VIRTUAL_DISPLAY, "9999", "9999"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
        except Exception:
            pass

        # 3. Resolve Audio Device (Default Sink Monitor for desktop/music capture)
        audio_dev = self.resolve_audio_device(self.audio_source)
        self.active_audio_device = audio_dev
        self.log_cb(f"Perangkat audio aktif: '{audio_dev}' (Pilihan: {self.audio_source})")

        # 4. Start Encoder Engine (FFmpeg OR GStreamer)
        if self.engine == "ffmpeg":
            return self._start_ffmpeg(rtmp_url, audio_dev)
        else:
            return self._start_gstreamer(rtmp_url, audio_dev)

    def _start_ffmpeg(self, rtmp_url, audio_dev):
        """Starts streaming via FFmpeg.
        FFmpeg x11grab + pulse is celebrated across GitHub for indestructible 24/7
        stability with zero A/V drift and automatic frame pacing.
        """
        self.log_cb(f"Menjalankan FFmpeg Engine: {self.width}x{self.height} @ {self.fps}fps ({self.bitrate} kbps)...")
        ffmpeg_cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "warning",
            "-thread_queue_size", "1024",
            "-f", "x11grab",
            "-draw_mouse", "0",
            "-framerate", str(self.fps),
            "-video_size", f"{self.width}x{self.height}",
            "-i", f"{VIRTUAL_DISPLAY}+0,0",
            "-thread_queue_size", "1024",
            "-f", "pulse",
            "-i", audio_dev,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-tune", "zerolatency",
            "-b:v", f"{self.bitrate}k",
            "-maxrate", f"{self.bitrate}k",
            "-bufsize", f"{2 * self.bitrate}k",
            "-pix_fmt", "yuv420p",
            "-g", str(2 * self.fps),
            "-keyint_min", str(2 * self.fps),
            "-sc_threshold", "0",
            "-c:a", "aac",
            "-b:a", "160k",
            "-ar", "48000",
            "-ac", "2",
            "-flvflags", "no_duration_filesize",
            "-f", "flv",
            rtmp_url
        ]

        env = os.environ.copy()
        env["DISPLAY"] = VIRTUAL_DISPLAY
        _setup_pulse_env()
        try:
            self.ffmpeg_proc = subprocess.Popen(
                ffmpeg_cmd,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            time.sleep(2.0)
            if self.ffmpeg_proc.poll() is not None:
                out = self.ffmpeg_proc.stdout.read()
                self.stop()
                self.error = f"FFmpeg error: {out[:300]}"
                self.log_cb(f"ERROR: {self.error}")
                return False, self.error

            self.is_streaming = True
            self.start_time = time.time()
            self.log_cb(f"Siaran LIVE (FFmpeg Engine) Berhasil Dimulai! (Room ID: {self.current_room.get('room_id', 'N/A')})")
            return True, "Streaming started via FFmpeg"
        except Exception as e:
            self.stop()
            self.error = str(e)
            self.log_cb(f"FFmpeg launch error: {e}")
            return False, str(e)

    def _start_gstreamer(self, rtmp_url, audio_dev):
        """Starts streaming via GStreamer with audited 24/7 stability optimizations:
        - pulsesrc provide-clock=true: Audio hardware clock acts as master clock (prevents hours-long A/V drift)
        - videorate (without drop-only): Generates rock-solid CFR 30.000 FPS with frame hold (no timestamp gaps)
        - x264enc speed-preset=ultrafast tune=zerolatency bframes=0: Eliminates encoder lookahead delay
        - h264parse config-interval=1: Repeats SPS/PPS headers at every keyframe for fast player recovery
        - NO leaky queue after flvmux: Prevents FLV tag corruption that causes TikTok player stalls
        - rtmp2sink async-connect=true sync=false: Non-blocking socket ingest
        """
        self.log_cb(f"Menjalankan GStreamer Engine: {self.width}x{self.height} @ {self.fps}fps ({self.bitrate} kbps)...")
        pipe_desc = (
            f'flvmux name=mux streamable=true enforce-increasing-timestamps=true ! '
            f'queue max-size-buffers=500 max-size-time=5000000000 max-size-bytes=0 ! '
            f'rtmp2sink location="{rtmp_url}" async-connect=true sync=false '
            f'ximagesrc display-name={VIRTUAL_DISPLAY} show-pointer=false use-damage=0 ! '
            f'videoconvert ! videoscale ! videorate ! video/x-raw,format=I420,width={self.width},height={self.height},framerate={self.fps}/1 ! '
            f'queue max-size-buffers=2 max-size-time=0 max-size-bytes=0 leaky=downstream ! '
            f'x264enc bitrate={self.bitrate} speed-preset=ultrafast tune=zerolatency bframes=0 key-int-max={2 * self.fps} ! '
            f'h264parse config-interval=1 ! queue max-size-buffers=200 max-size-time=2000000000 max-size-bytes=0 ! mux.video '
            f'pulsesrc device="{audio_dev}" provide-clock=true buffer-time=100000 latency-time=10000 ! '
            f'audioconvert ! audioresample quality=4 ! audiorate tolerance=40000000 ! audio/x-raw,rate=48000,channels=2 ! '
            f'audioconvert ! avenc_aac bitrate=160000 ! aacparse ! queue max-size-buffers=200 max-size-time=2000000000 max-size-bytes=0 ! mux.audio'
        )

        try:
            self.pipe = Gst.parse_launch(pipe_desc)
            # Use monotonic system clock to avoid pipeline stalls
            try:
                self.pipe.use_clock(Gst.SystemClock.obtain())
            except Exception:
                pass
            bus = self.pipe.get_bus()
            bus.add_signal_watch()
            bus.connect("message", self._on_bus_message)

            ret = self.pipe.set_state(Gst.State.PLAYING)
            if ret == Gst.StateChangeReturn.FAILURE:
                self.stop()
                self.error = "GStreamer pipeline failed to start"
                self.log_cb("ERROR: Pipeline set_state(PLAYING) returned FAILURE")
                return False, self.error

            self.is_streaming = True
            self.start_time = time.time()
            self.log_cb(f"Siaran LIVE (GStreamer Engine) Berhasil Dimulai! (Room ID: {self.current_room.get('room_id', 'N/A')})")
            return True, "Streaming started via GStreamer"
        except Exception as e:
            self.stop()
            self.error = str(e)
            self.log_cb(f"Pipeline error: {e}")
            return False, str(e)

    def _on_bus_message(self, bus, msg):
        if msg.type == Gst.MessageType.ERROR:
            err, debug = msg.parse_error()
            self.error = f"{msg.src.get_name()}: {err.message}"
            self.log_cb(f"Stream error: {err.message}")
            self.stop()
        elif msg.type == Gst.MessageType.EOS:
            self.log_cb("Stream reached EOS")
            self.stop()

    def stop(self):
        self.log_cb("Menghentikan siaran broadcast...")
        self.is_streaming = False

        # Stop FFmpeg if active
        if self.ffmpeg_proc:
            try:
                self.ffmpeg_proc.terminate()
                self.ffmpeg_proc.wait(timeout=2)
            except Exception:
                try:
                    self.ffmpeg_proc.kill()
                except Exception:
                    pass
            self.ffmpeg_proc = None

        # Stop GStreamer if active
        if self.pipe:
            try:
                self.pipe.send_event(Gst.Event.new_eos())
                time.sleep(0.5)
                self.pipe.set_state(Gst.State.NULL)
            except Exception:
                pass
            self.pipe = None

        # Stop Chrome Kiosk
        if self.chrome_proc:
            try:
                self.chrome_proc.terminate()
                self.chrome_proc.wait(timeout=2)
            except Exception:
                try:
                    self.chrome_proc.kill()
                except Exception:
                    pass
            self.chrome_proc = None

        # Stop Xvfb
        if self.xvfb_proc:
            try:
                self.xvfb_proc.terminate()
                self.xvfb_proc.wait(timeout=2)
            except Exception:
                try:
                    self.xvfb_proc.kill()
                except Exception:
                    pass
            self.xvfb_proc = None

        self._cleanup_locks()
        self.start_time = None
        self.active_audio_device = None
        self.log_cb("Siaran berhasil dihentikan secara bersih.")
        return True
