// TikTok LIVE Studio - Tabler Admin Dashboard Controller

document.addEventListener('DOMContentLoaded', () => {
  // Elements - Badges & Stats
  const tiktokStatusBadge = document.getElementById('tiktokStatusBadge');
  const streamStatusBadge = document.getElementById('streamStatusBadge');
  const streamTimer = document.getElementById('streamTimer');
  
  // Top Metric Cards
  const cardTiktokAccount = document.getElementById('cardTiktokAccount');
  const cardTiktokExpiry = document.getElementById('cardTiktokExpiry');
  const cardEncoderStatus = document.getElementById('cardEncoderStatus');
  const cardEncoderDetails = document.getElementById('cardEncoderDetails');
  const cardEncoderIconBg = document.getElementById('cardEncoderIconBg');
  const cardResolution = document.getElementById('cardResolution');
  const cardFpsBitrate = document.getElementById('cardFpsBitrate');
  const cardRoomId = document.getElementById('cardRoomId');
  const cardRoomStatus = document.getElementById('cardRoomStatus');

  // Preview elements
  const reloadPreviewBtn = document.getElementById('reloadPreviewBtn');
  const useDefaultOverlayBtn = document.getElementById('useDefaultOverlayBtn');
  const previewIframe = document.getElementById('previewIframe');
  const openOverlayLink = document.getElementById('openOverlayLink');
  const previewUrlLabel = document.getElementById('previewUrlLabel');
  const previewRoomMeta = document.getElementById('previewRoomMeta');
  const previewLiveBadge = document.getElementById('previewLiveBadge');
  const previewClearCacheBtn = document.getElementById('previewClearCacheBtn');

  // Form & Action Buttons
  const streamTitle = document.getElementById('streamTitle');
  const overlayUrl = document.getElementById('overlayUrl');
  const streamResolution = document.getElementById('streamResolution');
  const streamFps = document.getElementById('streamFps');
  const streamAudioSource = document.getElementById('streamAudioSource');
  const streamEngine = document.getElementById('streamEngine');
  const startStreamBtn = document.getElementById('startStreamBtn');
  const stopStreamBtn = document.getElementById('stopStreamBtn');
  const navForceStopBtn = document.getElementById('navForceStopBtn');
  const forceStopStreamBtn = document.getElementById('forceStopStreamBtn');
  const refreshStatusBtn = document.getElementById('refreshStatusBtn');

  // Save Settings & Clear Cache Buttons
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const saveStatusBadge = document.getElementById('saveStatusBadge');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const clearCacheStatusBadge = document.getElementById('clearCacheStatusBadge');

  // Terminal & Logs
  const logsTerminal = document.getElementById('logsTerminal');
  const clearLogsBtn = document.getElementById('clearLogsBtn');
  const logBadgeCount = document.getElementById('logBadgeCount');

  // Theme Toggle
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIconSun = document.getElementById('themeIconSun');
  const themeIconMoon = document.getElementById('themeIconMoon');

  // State
  let isStreaming = false;

  // 1. Theme Management (Dark / Light)
  function initTheme() {
    const savedTheme = localStorage.getItem('tiktok-live-theme') || 'dark';
    setTheme(savedTheme);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem('tiktok-live-theme', theme);
    if (theme === 'dark') {
      themeIconSun.classList.add('d-none');
      themeIconMoon.classList.remove('d-none');
    } else {
      themeIconMoon.classList.add('d-none');
      themeIconSun.classList.remove('d-none');
    }
  }

  themeToggleBtn?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'dark';
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  initTheme();

  // 2. Format Duration Timer
  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  // 3. Preview URL Synchronizer & Cache Buster
  function getDefaultOverlayUrl() {
    return window.location.origin + '/overlay';
  }

  function buildCacheBustUrl(rawUrl) {
    let url = (rawUrl || '').trim();
    if (!url || url === 'https://www.tiktok.com') {
      url = getDefaultOverlayUrl();
    }
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}_cb=${Date.now()}`;
  }

  function updatePreview(cacheBust = false) {
    let url = (overlayUrl.value || '').trim();
    if (!url || url === 'https://www.tiktok.com') {
      url = getDefaultOverlayUrl();
      overlayUrl.value = url;
    }
    const targetUrl = cacheBust ? buildCacheBustUrl(url) : url;
    previewIframe.src = targetUrl;
    openOverlayLink.href = targetUrl;
    if (previewUrlLabel) {
      previewUrlLabel.innerHTML = `Sumber: <span class="fw-semibold text-reset font-monospace">${escapeHtml(url)}</span>`;
    }
  }

  useDefaultOverlayBtn?.addEventListener('click', () => {
    overlayUrl.value = getDefaultOverlayUrl();
    updatePreview();
  });

  reloadPreviewBtn?.addEventListener('click', () => updatePreview(false));
  overlayUrl?.addEventListener('change', () => updatePreview(false));

  // 4. Save Settings Feature
  async function saveSettingsAction() {
    if (!saveSettingsBtn) return;
    const title = (streamTitle.value || '').trim() || 'TikTok LIVE Broadcast';
    const url = (overlayUrl.value || '').trim() || getDefaultOverlayUrl();
    const resolution = streamResolution ? streamResolution.value : '720x1280';
    const fps_bitrate = streamFps ? streamFps.value : '30|2500';
    const audio_source = streamAudioSource ? streamAudioSource.value : 'desktop';
    const engine = streamEngine ? streamEngine.value : 'gstreamer';

    saveSettingsBtn.disabled = true;
    saveSettingsBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-1" role="status"></span>
      <span>Menyimpan...</span>
    `;

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          overlay_url: url,
          resolution,
          fps_bitrate,
          audio_source,
          engine
        })
      });
      const data = await res.json();
      if (data.ok) {
        // Also save to localStorage as instant offline cache
        localStorage.setItem('tiktok-live-settings', JSON.stringify({
          title, overlay_url: url, resolution, fps_bitrate, audio_source, engine
        }));

        if (saveStatusBadge) {
          saveStatusBadge.classList.remove('d-none');
          setTimeout(() => {
            saveStatusBadge.classList.add('d-none');
          }, 3500);
        }
      } else {
        alert('Gagal menyimpan pengaturan: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Terjadi kesalahan saat menyimpan pengaturan: ' + e.message);
    } finally {
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.innerHTML = `
        <i class="ti ti-device-floppy fs-3"></i>
        <span class="fw-semibold">Simpan Setingan</span>
      `;
    }
  }

  saveSettingsBtn?.addEventListener('click', saveSettingsAction);

  // 5. Clear Cache Feature
  async function clearCacheAction() {
    const btns = [clearCacheBtn, previewClearCacheBtn].filter(Boolean);
    btns.forEach(b => {
      b.disabled = true;
      b.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Membersihkan...';
    });

    try {
      const res = await fetch('/api/clear-cache', { method: 'POST' });
      const data = await res.json();

      // Force reload preview with cache busting query param
      updatePreview(true);

      if (clearCacheStatusBadge) {
        clearCacheStatusBadge.classList.remove('d-none');
        setTimeout(() => {
          clearCacheStatusBadge.classList.add('d-none');
        }, 3500);
      }
      fetchLogs();
    } catch (e) {
      alert('Gagal membersihkan cache: ' + e.message);
    } finally {
      if (clearCacheBtn) {
        clearCacheBtn.disabled = false;
        clearCacheBtn.innerHTML = `
          <i class="ti ti-broom fs-3"></i>
          <span class="fw-semibold">Hapus Cache Overlay</span>
        `;
      }
      if (previewClearCacheBtn) {
        previewClearCacheBtn.disabled = false;
        previewClearCacheBtn.innerHTML = `
          <i class="ti ti-broom me-1"></i> Hapus Cache
        `;
      }
    }
  }

  clearCacheBtn?.addEventListener('click', clearCacheAction);
  previewClearCacheBtn?.addEventListener('click', clearCacheAction);

  // 5.1 Safe Zone Guide Toggle
  const toggleSafeZoneBtn = document.getElementById('toggleSafeZoneBtn');
  const safeZoneGuide = document.getElementById('safeZoneGuide');

  toggleSafeZoneBtn?.addEventListener('click', () => {
    if (!safeZoneGuide) return;
    const isHidden = safeZoneGuide.classList.contains('d-none');
    if (isHidden) {
      safeZoneGuide.classList.remove('d-none');
      toggleSafeZoneBtn.classList.remove('btn-outline-info');
      toggleSafeZoneBtn.classList.add('btn-info');
    } else {
      safeZoneGuide.classList.add('d-none');
      toggleSafeZoneBtn.classList.remove('btn-info');
      toggleSafeZoneBtn.classList.add('btn-outline-info');
    }
  });

  // 6. Load Saved Settings on Startup
  async function loadSettingsOnStartup() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.ok && data.settings) {
        const s = data.settings;
        if (s.title && streamTitle) streamTitle.value = s.title;
        if (s.overlay_url && overlayUrl) overlayUrl.value = s.overlay_url;
        if (s.resolution && streamResolution) streamResolution.value = s.resolution;
        if (s.fps_bitrate && streamFps) streamFps.value = s.fps_bitrate;
        if (s.audio_source && streamAudioSource) streamAudioSource.value = s.audio_source;
        if (s.engine && streamEngine) streamEngine.value = s.engine;
        updatePreview(false);
      }
    } catch (e) {
      // Fallback to localStorage
      try {
        const local = JSON.parse(localStorage.getItem('tiktok-live-settings') || '{}');
        if (local.title && streamTitle) streamTitle.value = local.title;
        if (local.overlay_url && overlayUrl) overlayUrl.value = local.overlay_url;
        if (local.resolution && streamResolution) streamResolution.value = local.resolution;
        if (local.fps_bitrate && streamFps) streamFps.value = local.fps_bitrate;
        if (local.audio_source && streamAudioSource) streamAudioSource.value = local.audio_source;
        if (local.engine && streamEngine) streamEngine.value = local.engine;
        updatePreview(false);
      } catch (err) {}
    }
  }

  // 7. Fetch Audio Sources
  async function loadAudioSources() {
    try {
      const res = await fetch('/api/audio-sources');
      const data = await res.json();
      if (data.ok && Array.isArray(data.sources) && streamAudioSource) {
        const currentVal = streamAudioSource.value;
        streamAudioSource.innerHTML = data.sources.map(s => {
          const selected = s.id === currentVal ? 'selected' : (s.default && !currentVal ? 'selected' : '');
          return `<option value="${escapeHtml(s.id)}" ${selected}>${escapeHtml(s.name)}</option>`;
        }).join('');
      }
    } catch (e) {
      // Keep static options if error
    }
  }

  // 8. Status Polling & UI Synchronization
  async function checkStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (!data.ok) return;

      // A. TikTok Session Status
      const tt = data.tiktok;
      if (tt && tt.ok) {
        tiktokStatusBadge.className = 'badge bg-success-lt d-flex align-items-center gap-2 px-3 py-2 fs-5';
        tiktokStatusBadge.innerHTML = `
          <span class="status-dot status-dot-animated status-green"></span>
          <span class="status-label">TikTok: ${escapeHtml(tt.browser)}</span>
        `;
        cardTiktokAccount.textContent = tt.browser || 'Terhubung';
        cardTiktokAccount.className = 'fs-3 fw-bold text-truncate text-success';
        cardTiktokExpiry.textContent = tt.expires ? `Berlaku s/d: ${tt.expires}` : 'Sesi Aktif';
      } else {
        tiktokStatusBadge.className = 'badge bg-danger-lt d-flex align-items-center gap-2 px-3 py-2 fs-5';
        tiktokStatusBadge.innerHTML = `
          <span class="status-dot status-red"></span>
          <span class="status-label">TikTok Belum Login</span>
        `;
        cardTiktokAccount.textContent = 'Belum Login';
        cardTiktokAccount.className = 'fs-3 fw-bold text-truncate text-danger';
        cardTiktokExpiry.textContent = 'Buka Chrome & login di tiktok.com';
      }

      // B. Live Stream Status
      const streamer = data.streamer;
      const room = data.active_room || (streamer && streamer.room_id ? { room_id: streamer.room_id, title: streamer.stream_title } : null);

      if (streamer && streamer.is_streaming) {
        if (!isStreaming) {
          isStreaming = true;
          startStreamBtn.classList.add('d-none');
          stopStreamBtn.classList.remove('d-none');
        }

        streamStatusBadge.className = 'badge bg-danger text-white d-flex align-items-center gap-2 px-3 py-2 fs-5';
        streamStatusBadge.innerHTML = `
          <span class="status-dot status-dot-animated status-red bg-white"></span>
          <span class="status-label fw-bold">🔴 LIVE TIKTOK</span>
        `;
        streamTimer.textContent = formatTime(streamer.duration || 0);

        // Encoder Card
        cardEncoderStatus.textContent = 'LIVE STREAMING';
        cardEncoderStatus.className = 'fs-3 fw-bold text-truncate text-danger';
        const engineLabel = (streamer.engine === 'ffmpeg' ? 'FFmpeg' : 'GStreamer');
        const audioDevStr = streamer.active_audio_device ? ` • Audio: ${streamer.active_audio_device}` : '';
        cardEncoderDetails.textContent = `${engineLabel} → RTMP${audioDevStr}`;
        cardEncoderIconBg.className = 'avatar bg-danger text-white rounded-3';

        // Quality Card
        if (streamer.width && streamer.height) {
          cardResolution.textContent = `${streamer.width} × ${streamer.height} (9:16)`;
        }
        if (streamer.fps && streamer.bitrate) {
          cardFpsBitrate.textContent = `${streamer.fps} FPS • ${streamer.bitrate} Kbps`;
        }

        // Room Card
        if (room && room.room_id) {
          cardRoomId.textContent = room.room_id;
          cardRoomStatus.textContent = room.title || 'Siaran Berjalan';
          previewRoomMeta.textContent = `Room ID: ${room.room_id}`;
          previewLiveBadge.className = 'badge bg-red text-white';
          previewLiveBadge.textContent = 'LIVE BROADCASTING';
        }
      } else {
        if (isStreaming) {
          isStreaming = false;
          startStreamBtn.classList.remove('d-none');
          stopStreamBtn.classList.add('d-none');
        }

        streamStatusBadge.className = 'badge bg-secondary-lt d-flex align-items-center gap-2 px-3 py-2 fs-5';
        streamStatusBadge.innerHTML = `
          <span class="status-dot status-gray"></span>
          <span class="status-label">OFFLINE</span>
        `;
        streamTimer.textContent = '00:00:00';

        // Encoder Card
        cardEncoderStatus.textContent = 'OFFLINE';
        cardEncoderStatus.className = 'fs-3 fw-bold text-truncate text-muted';
        cardEncoderDetails.textContent = (streamEngine && streamEngine.value === 'ffmpeg' ? 'FFmpeg Siap' : 'GStreamer Siap');
        cardEncoderIconBg.className = 'avatar bg-secondary text-white rounded-3';

        // Room Card
        if (data.has_active_room && data.active_room) {
          cardRoomId.textContent = data.active_room.room_id || 'Tersimpan';
          cardRoomStatus.textContent = 'Room aktif terdeteksi (Gunakan Force Stop jika perlu)';
        } else {
          cardRoomId.textContent = 'Tidak Ada';
          cardRoomStatus.textContent = 'Standby';
        }

        previewRoomMeta.textContent = 'Status: Siap Memulai Siaran';
        previewLiveBadge.className = 'badge bg-green-lt';
        previewLiveBadge.textContent = 'STANDBY';
      }
    } catch (err) {
      console.warn('Status poll error:', err);
    }
  }

  // 9. Fetch & Render Logs
  async function fetchLogs() {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (data.ok && Array.isArray(data.logs)) {
        if (logBadgeCount) {
          logBadgeCount.textContent = data.logs.length;
        }

        if (data.logs.length === 0) {
          logsTerminal.innerHTML = '<div class="text-muted">[00:00:00] Menunggu aktivitas sistem...</div>';
          return;
        }

        const formatted = data.logs.map(line => {
          let lineClass = 'log-line';
          if (line.includes('ERROR') || line.includes('FAIL') || line.includes('Failed') || line.includes('error')) {
            lineClass += ' log-error';
          } else if (line.includes('started') || line.includes('created') || line.includes('PASS') || line.includes('OBTAINED')) {
            lineClass += ' log-success';
          } else if (line.includes('Warning') || line.includes('warn') || line.includes('notice')) {
            lineClass += ' log-warn';
          } else if (line.includes('Request') || line.includes('Starting') || line.includes('Audio capture') || line.includes('Pengaturan disimpan') || line.includes('Cache overlay')) {
            lineClass += ' log-info';
          }
          return `<div class="${lineClass}">${escapeHtml(line)}</div>`;
        }).join('');

        logsTerminal.innerHTML = formatted;
        logsTerminal.scrollTop = logsTerminal.scrollHeight;
      }
    } catch (e) {
      // Ignore network hiccup
    }
  }

  clearLogsBtn?.addEventListener('click', () => {
    logsTerminal.innerHTML = '<div class="text-muted">Tampilan log dibersihkan.</div>';
  });

  refreshStatusBtn?.addEventListener('click', () => {
    checkStatus();
    fetchLogs();
  });

  // 10. Start Live Stream Action
  startStreamBtn?.addEventListener('click', async () => {
    const title = (streamTitle.value || '').trim() || 'TikTok LIVE Broadcast';
    const url = (overlayUrl.value || '').trim() || getDefaultOverlayUrl();
    const [w, h] = streamResolution.value.split('x').map(Number);
    const [fps, bitrate] = streamFps.value.split('|').map(Number);
    const audioSource = streamAudioSource ? streamAudioSource.value : 'desktop';
    const engine = streamEngine ? streamEngine.value : 'gstreamer';

    startStreamBtn.disabled = true;
    startStreamBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      <span>Menghubungkan ke TikTok...</span>
    `;

    try {
      const res = await fetch('/api/stream/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          overlay_url: url,
          width: w,
          height: h,
          fps,
          bitrate,
          audio_source: audioSource,
          engine
        })
      });

      const data = await res.json();
      if (!data.ok) {
        alert('Gagal memulai LIVE:\n' + (data.error || 'Terjadi kesalahan tidak dikenal'));
        startStreamBtn.disabled = false;
        startStreamBtn.innerHTML = `
          <i class="ti ti-rocket fs-2"></i>
          <span class="fs-3 fw-bold">Mulai Live Sekarang</span>
        `;
        return;
      }

      // Success
      isStreaming = true;
      startStreamBtn.classList.add('d-none');
      stopStreamBtn.classList.remove('d-none');
      startStreamBtn.disabled = false;
      startStreamBtn.innerHTML = `
        <i class="ti ti-rocket fs-2"></i>
        <span class="fs-3 fw-bold">Mulai Live Sekarang</span>
      `;
      checkStatus();
      fetchLogs();
    } catch (err) {
      alert('Terjadi kesalahan koneksi ke server dashboard: ' + err.message);
      startStreamBtn.disabled = false;
      startStreamBtn.innerHTML = `
        <i class="ti ti-rocket fs-2"></i>
        <span class="fs-3 fw-bold">Mulai Live Sekarang</span>
      `;
    }
  });

  // 11. Stop Live Stream Action
  stopStreamBtn?.addEventListener('click', async () => {
    if (!confirm('Apakah Anda yakin ingin mengakhiri siaran langsung TikTok?')) return;

    stopStreamBtn.disabled = true;
    stopStreamBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      <span>Mengakhiri Siaran...</span>
    `;

    try {
      const res = await fetch('/api/stream/stop', { method: 'POST' });
      const data = await res.json();

      isStreaming = false;
      startStreamBtn.classList.remove('d-none');
      stopStreamBtn.classList.add('d-none');
      stopStreamBtn.disabled = false;
      stopStreamBtn.innerHTML = `
        <i class="ti ti-player-stop fs-2"></i>
        <span class="fs-3 fw-bold">Akhiri Siaran Live</span>
      `;
      checkStatus();
      fetchLogs();
    } catch (err) {
      alert('Gagal menghentikan live: ' + err.message);
      stopStreamBtn.disabled = false;
      stopStreamBtn.innerHTML = `
        <i class="ti ti-player-stop fs-2"></i>
        <span class="fs-3 fw-bold">Akhiri Siaran Live</span>
      `;
    }
  });

  // 12. Emergency Force Stop Action
  async function handleForceStop() {
    const confirmMsg = '⚠️ PAKSA HENTIKAN SIARAN (FORCE STOP)?\n\n' +
      'Tindakan ini akan:\n' +
      '1. Mengirim sinyal resmi penutupan room ke server TikTok agar siaran tidak mengambang.\n' +
      '2. Mematikan seluruh proses background (GStreamer, Chrome Kiosk, Xvfb :99).\n\n' +
      'Lanjutkan?';

    if (!confirm(confirmMsg)) return;

    const btns = [navForceStopBtn, forceStopStreamBtn].filter(Boolean);
    btns.forEach(b => {
      b.disabled = true;
      b.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Menghentikan...';
    });

    try {
      const res = await fetch('/api/stream/force-stop', { method: 'POST' });
      const data = await res.json();
      alert(data.message || 'Proses Force Stop berhasil dijalankan.');

      isStreaming = false;
      startStreamBtn.classList.remove('d-none');
      stopStreamBtn.classList.add('d-none');
      checkStatus();
      fetchLogs();
    } catch (err) {
      alert('Terjadi kesalahan saat force stop: ' + err.message);
    } finally {
      if (navForceStopBtn) {
        navForceStopBtn.disabled = false;
        navForceStopBtn.innerHTML = '<i class="ti ti-bolt fs-3"></i><span class="d-none d-md-inline fw-semibold">Force Stop</span>';
      }
      if (forceStopStreamBtn) {
        forceStopStreamBtn.disabled = false;
        forceStopStreamBtn.innerHTML = '<i class="ti ti-bolt me-1"></i> Paksa Hentikan';
      }
    }
  }

  navForceStopBtn?.addEventListener('click', handleForceStop);
  forceStopStreamBtn?.addEventListener('click', handleForceStop);

  // Helper
  function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial Startup Execution
  loadSettingsOnStartup();
  loadAudioSources();
  checkStatus();
  fetchLogs();
  setInterval(checkStatus, 2500);
  setInterval(fetchLogs, 2500);
});
