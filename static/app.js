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

  // Safe fetch helper that guarantees clean JSON parsing and human-readable errors
  async function safeFetchJson(url, options = {}) {
    const res = await fetch(url, options);
    let data;
    try {
      data = await res.json();
    } catch (err) {
      const text = await res.text().catch(() => '');
      throw new Error(`Server (${res.status}): ${text.substring(0, 120) || 'Respon bukan format JSON'}`);
    }
    return { ok: res.ok, status: res.status, data };
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
      const { ok, data } = await safeFetchJson('/api/settings', {
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
      if (ok && data && data.ok) {
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
        alert('Gagal menyimpan pengaturan: ' + ((data && data.error) || 'Terjadi kesalahan'));
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
      const { data } = await safeFetchJson('/api/clear-cache', { method: 'POST' });

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
      const { ok, data } = await safeFetchJson('/api/settings');
      if (ok && data && data.ok && data.settings) {
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
      const { ok, data } = await safeFetchJson('/api/audio-sources');
      if (ok && data && data.ok && Array.isArray(data.sources) && streamAudioSource) {
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
      const { ok, data } = await safeFetchJson('/api/status');
      if (!ok || !data || !data.ok) return;

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
      const { ok, data } = await safeFetchJson('/api/logs');
      if (ok && data && data.ok && Array.isArray(data.logs)) {
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
      const { data } = await safeFetchJson('/api/stream/start', {
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

      if (!data || !data.ok) {
        alert('Gagal memulai LIVE:\n\n' + ((data && data.error) || 'Terjadi kesalahan tidak dikenal'));
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
      const { data } = await safeFetchJson('/api/stream/stop', { method: 'POST' });

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
      const { data } = await safeFetchJson('/api/stream/force-stop', { method: 'POST' });
      alert((data && data.message) || 'Proses Force Stop berhasil dijalankan.');

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

  // 13. Visual Drag & Drop Canvas Studio Controller (OBS / TikTok Studio Style)
  const btnModeStudio = document.getElementById('btnModeStudio');
  const btnModePreview = document.getElementById('btnModePreview');
  const studioCanvas = document.getElementById('studioCanvas');
  const studioToolbar = document.getElementById('studioToolbar');
  const btnAddText = document.getElementById('btnAddText');
  const btnAddMarquee = document.getElementById('btnAddMarquee');
  const btnAddBanner = document.getElementById('btnAddBanner');
  const btnSaveLayout = document.getElementById('btnSaveLayout');
  const btnResetLayout = document.getElementById('btnResetLayout');

  // Inspector Elements
  const studioInspector = document.getElementById('studioInspector');
  const inspectorItemLabel = document.getElementById('inspectorItemLabel');
  const inspectorTitleInput = document.getElementById('inspectorTitleInput');
  const inspectorSubtitleGroup = document.getElementById('inspectorSubtitleGroup');
  const inspectorSubtitleInput = document.getElementById('inspectorSubtitleInput');
  const inspectorFontSizeSelect = document.getElementById('inspectorFontSizeSelect');
  const inspectorColorSelect = document.getElementById('inspectorColorSelect');
  const inspectorDeleteBtn = document.getElementById('inspectorDeleteBtn');
  const inspectorCloseBtn = document.getElementById('inspectorCloseBtn');

  // Studio State
  let currentLayout = { elements: [] };
  let selectedElementId = null;
  let activeInteraction = null; // { type: 'move'|'resize', id, startX, startY, origX, origY, origW, origH, canvasRect }
  let studioBroadcastChannel = null;

  try {
    studioBroadcastChannel = new BroadcastChannel('tiktok_overlay_channel');
  } catch (err) {}

  function notifyOverlayChannel() {
    if (studioBroadcastChannel) {
      try {
        studioBroadcastChannel.postMessage({ type: 'LAYOUT_UPDATED', layout: currentLayout });
      } catch (e) {}
    }
  }

  // A. Mode Switching (Studio vs Preview)
  btnModeStudio?.addEventListener('click', () => {
    btnModeStudio.className = 'btn btn-primary';
    btnModePreview.className = 'btn btn-outline-primary';
    studioCanvas?.classList.remove('d-none');
    previewIframe?.classList.add('d-none');
    studioToolbar?.classList.remove('d-none');
  });

  btnModePreview?.addEventListener('click', () => {
    btnModePreview.className = 'btn btn-primary';
    btnModeStudio.className = 'btn btn-outline-primary';
    studioCanvas?.classList.add('d-none');
    previewIframe?.classList.remove('d-none');
    studioToolbar?.classList.add('d-none');
    studioInspector?.classList.add('d-none');
    deselectAllElements();
    updatePreview(true);
  });

  // B. Load Layout from Server
  async function loadStudioLayout() {
    try {
      const { ok, data } = await safeFetchJson('/api/overlay/layout?_t=' + Date.now());
      if (ok && data && data.ok && data.layout && Array.isArray(data.layout.elements)) {
        currentLayout = data.layout;
        renderStudioCanvas();
      }
    } catch (e) {
      console.warn('Notice loading overlay layout:', e);
    }
  }

  // C. Render Elements in Studio Canvas
  function renderStudioCanvas() {
    if (!studioCanvas) return;
    studioCanvas.innerHTML = '';

    currentLayout.elements.forEach(item => {
      if (item.visible === false) return;

      const el = document.createElement('div');
      el.className = 'studio-item' + (item.id === selectedElementId ? ' selected' : '');
      el.id = 'studio_item_' + item.id;
      el.style.left = `${item.x}%`;
      el.style.top = `${item.y}%`;
      el.style.width = `${item.w}%`;
      el.style.height = `${item.h}%`;
      if (item.bgColor && item.bgColor !== 'transparent') {
        el.style.background = item.bgColor;
      }

      // Badge label
      const badge = document.createElement('div');
      badge.className = 'studio-badge';
      let typeLabel = 'Teks';
      if (item.type === 'header') typeLabel = 'Header Live';
      else if (item.type === 'clock') typeLabel = 'Jam & Audio';
      else if (item.type === 'banner') typeLabel = 'Banner';
      else if (item.type === 'marquee') typeLabel = 'Running Text';
      badge.textContent = typeLabel;
      el.appendChild(badge);

      // Inner Content
      const content = document.createElement('div');
      content.className = 'studio-inner-content';
      content.style.color = item.color || '#ffffff';
      content.style.fontSize = `${Math.max(10, Math.round((item.fontSize || 16) * 0.45))}px`; // Scale down for phone mockup preview

      if (item.type === 'header') {
        content.innerHTML = `
          <div style="font-size: 8px; font-weight:800; color:#fca5a5; letter-spacing:1px;">🔴 TIKTOK LIVE</div>
          <div style="font-weight:800; text-truncate; max-width:95%;">${escapeHtml(item.subtitle || 'Live Broadcast')}</div>
        `;
      } else if (item.type === 'clock') {
        content.innerHTML = `
          <div style="font-weight:800; font-size:16px;">12:00:00</div>
          <div style="font-size:8px; opacity:0.8;">▂▃▅▆▇ (Wave)</div>
        `;
      } else if (item.type === 'banner') {
        content.innerHTML = `
          <div style="font-weight:700; color:${item.color || '#38bdf8'};">${escapeHtml(item.title)}</div>
          ${item.subtitle ? `<div style="font-size:9px; opacity:0.8;">${escapeHtml(item.subtitle)}</div>` : ''}
        `;
      } else if (item.type === 'marquee') {
        content.innerHTML = `
          <div style="white-space:nowrap; overflow:hidden; font-weight:600;">
            <i class="ti ti-marquee me-1"></i> ${escapeHtml(item.title)}
          </div>
        `;
      } else {
        content.innerHTML = `<div style="font-weight:700;">${escapeHtml(item.title)}</div>`;
      }
      el.appendChild(content);

      // Resize Handle
      const handle = document.createElement('div');
      handle.className = 'studio-resize-handle';
      handle.setAttribute('data-handle', 'se');
      el.appendChild(handle);

      // Pointer event for selection, dragging, and resizing
      el.addEventListener('pointerdown', (e) => onElementPointerDown(e, item.id));

      studioCanvas.appendChild(el);
    });
  }

  // D. Pointer Event Handling (Smooth Zero-Dependency Drag & Resize)
  function onElementPointerDown(e, itemId) {
    e.preventDefault();
    e.stopPropagation();

    const isHandle = e.target.classList.contains('studio-resize-handle');
    const targetItem = currentLayout.elements.find(el => el.id === itemId);
    if (!targetItem) return;

    selectElement(itemId);

    const canvasRect = studioCanvas.getBoundingClientRect();
    activeInteraction = {
      type: isHandle ? 'resize' : 'move',
      id: itemId,
      startX: e.clientX,
      startY: e.clientY,
      origX: targetItem.x,
      origY: targetItem.y,
      origW: targetItem.w,
      origH: targetItem.h,
      canvasRect
    };

    const targetEl = document.getElementById('studio_item_' + itemId);
    if (targetEl) {
      targetEl.setPointerCapture(e.pointerId);
      if (activeInteraction.type === 'move') {
        targetEl.classList.add('dragging');
      }
    }
  }

  window.addEventListener('pointermove', (e) => {
    if (!activeInteraction) return;

    const { type, id, startX, startY, origX, origY, origW, origH, canvasRect } = activeInteraction;
    const targetItem = currentLayout.elements.find(el => el.id === id);
    if (!targetItem) return;

    const deltaXPixels = e.clientX - startX;
    const deltaYPixels = e.clientY - startY;

    // Convert pixel delta to percentage of canvas
    const deltaXPercent = (deltaXPixels / canvasRect.width) * 100;
    const deltaYPercent = (deltaYPixels / canvasRect.height) * 100;

    if (type === 'move') {
      let newX = Math.round((origX + deltaXPercent) * 10) / 10;
      let newY = Math.round((origY + deltaYPercent) * 10) / 10;

      // Bound to canvas edges
      newX = Math.max(0, Math.min(100 - targetItem.w, newX));
      newY = Math.max(0, Math.min(100 - targetItem.h, newY));

      // Magnetic Smart Center Snap (OBS style)
      const centerTarget = (100 - targetItem.w) / 2;
      if (Math.abs(newX - centerTarget) < 2.5) {
        newX = Math.round(centerTarget * 10) / 10;
      }

      targetItem.x = newX;
      targetItem.y = newY;

      const domEl = document.getElementById('studio_item_' + id);
      if (domEl) {
        domEl.style.left = `${newX}%`;
        domEl.style.top = `${newY}%`;
      }
    } else if (type === 'resize') {
      let newW = Math.round((origW + deltaXPercent) * 10) / 10;
      let newH = Math.round((origH + deltaYPercent) * 10) / 10;

      // Minimum and maximum constraints
      newW = Math.max(15, Math.min(100 - targetItem.x, newW));
      newH = Math.max(4, Math.min(100 - targetItem.y, newH));

      targetItem.w = newW;
      targetItem.h = newH;

      const domEl = document.getElementById('studio_item_' + id);
      if (domEl) {
        domEl.style.width = `${newW}%`;
        domEl.style.height = `${newH}%`;
      }
    }
  });

  window.addEventListener('pointerup', () => {
    if (!activeInteraction) return;

    const { id } = activeInteraction;
    const domEl = document.getElementById('studio_item_' + id);
    if (domEl) {
      domEl.classList.remove('dragging');
    }

    activeInteraction = null;
    notifyOverlayChannel();
  });

  // Canvas click outside element to deselect
  studioCanvas?.addEventListener('pointerdown', (e) => {
    if (e.target === studioCanvas) {
      deselectAllElements();
    }
  });

  // E. Element Selection & Inspector Panel
  function selectElement(itemId) {
    selectedElementId = itemId;
    document.querySelectorAll('.studio-item').forEach(el => {
      if (el.id === 'studio_item_' + itemId) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });

    const item = currentLayout.elements.find(el => el.id === itemId);
    if (!item || !studioInspector) return;

    studioInspector.classList.remove('d-none');
    let label = 'Teks';
    if (item.type === 'header') label = 'Header Siaran';
    else if (item.type === 'clock') label = 'Jam & Audio Equalizer';
    else if (item.type === 'banner') label = 'Banner Info';
    else if (item.type === 'marquee') label = 'Running Text';

    inspectorItemLabel.textContent = `Edit ${label}`;
    inspectorTitleInput.value = item.title || '';

    if (item.type === 'header' || item.type === 'banner') {
      inspectorSubtitleGroup.classList.remove('d-none');
      inspectorSubtitleInput.value = item.subtitle || '';
    } else {
      inspectorSubtitleGroup.classList.add('d-none');
    }

    inspectorFontSizeSelect.value = String(item.fontSize || 18);
    inspectorColorSelect.value = item.color || '#ffffff';
  }

  function deselectAllElements() {
    selectedElementId = null;
    document.querySelectorAll('.studio-item').forEach(el => el.classList.remove('selected'));
    if (studioInspector) studioInspector.classList.add('d-none');
  }

  inspectorCloseBtn?.addEventListener('click', deselectAllElements);

  // F. Inspector Live Update Listeners
  inspectorTitleInput?.addEventListener('input', () => {
    if (!selectedElementId) return;
    const item = currentLayout.elements.find(el => el.id === selectedElementId);
    if (item) {
      item.title = inspectorTitleInput.value;
      renderStudioCanvas();
      notifyOverlayChannel();
    }
  });

  inspectorSubtitleInput?.addEventListener('input', () => {
    if (!selectedElementId) return;
    const item = currentLayout.elements.find(el => el.id === selectedElementId);
    if (item) {
      item.subtitle = inspectorSubtitleInput.value;
      renderStudioCanvas();
      notifyOverlayChannel();
    }
  });

  inspectorFontSizeSelect?.addEventListener('change', () => {
    if (!selectedElementId) return;
    const item = currentLayout.elements.find(el => el.id === selectedElementId);
    if (item) {
      item.fontSize = parseInt(inspectorFontSizeSelect.value, 10);
      renderStudioCanvas();
      notifyOverlayChannel();
    }
  });

  inspectorColorSelect?.addEventListener('change', () => {
    if (!selectedElementId) return;
    const item = currentLayout.elements.find(el => el.id === selectedElementId);
    if (item) {
      item.color = inspectorColorSelect.value;
      renderStudioCanvas();
      notifyOverlayChannel();
    }
  });

  inspectorDeleteBtn?.addEventListener('click', () => {
    if (!selectedElementId) return;
    const item = currentLayout.elements.find(el => el.id === selectedElementId);
    if (!item) return;

    if (!confirm(`Hapus elemen "${item.title || item.type}" dari kanvas?`)) return;

    currentLayout.elements = currentLayout.elements.filter(el => el.id !== selectedElementId);
    deselectAllElements();
    renderStudioCanvas();
    notifyOverlayChannel();
  });

  // G. Add New Elements Buttons
  btnAddText?.addEventListener('click', () => {
    const newId = 'text_' + Date.now();
    currentLayout.elements.push({
      id: newId,
      type: 'text',
      title: 'TEKS JUDUL BARU',
      subtitle: '',
      x: 10,
      y: 52,
      w: 80,
      h: 8,
      fontSize: 20,
      color: '#ffffff',
      bgColor: 'rgba(0, 0, 0, 0.65)',
      visible: true
    });
    renderStudioCanvas();
    selectElement(newId);
    notifyOverlayChannel();
  });

  btnAddMarquee?.addEventListener('click', () => {
    const newId = 'marquee_' + Date.now();
    currentLayout.elements.push({
      id: newId,
      type: 'marquee',
      title: 'Follow & tap layar untuk support live ini! Selamat datang semuanya! 🌟',
      subtitle: '',
      x: 5,
      y: 82,
      w: 90,
      h: 7,
      fontSize: 14,
      color: '#38bdf8',
      bgColor: 'rgba(15, 23, 42, 0.85)',
      visible: true
    });
    renderStudioCanvas();
    selectElement(newId);
    notifyOverlayChannel();
  });

  btnAddBanner?.addEventListener('click', () => {
    const newId = 'banner_' + Date.now();
    currentLayout.elements.push({
      id: newId,
      type: 'banner',
      title: '📢 PENGUMUMAN PENTING',
      subtitle: 'Jangan lupa follow & share siaran ini!',
      x: 5,
      y: 25,
      w: 90,
      h: 10,
      fontSize: 16,
      color: '#facc15',
      bgColor: 'rgba(30, 41, 59, 0.75)',
      visible: true
    });
    renderStudioCanvas();
    selectElement(newId);
    notifyOverlayChannel();
  });

  // H. Save Layout to Server Action
  btnSaveLayout?.addEventListener('click', async () => {
    btnSaveLayout.disabled = true;
    btnSaveLayout.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Menyimpan...';

    try {
      const { ok, data } = await safeFetchJson('/api/overlay/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentLayout)
      });
      if (ok && data && data.ok) {
        notifyOverlayChannel();
        btnSaveLayout.className = 'btn btn-sm btn-success';
        btnSaveLayout.innerHTML = '<i class="ti ti-check me-1"></i> Tersimpan!';
        setTimeout(() => {
          btnSaveLayout.className = 'btn btn-sm btn-primary';
          btnSaveLayout.innerHTML = '<i class="ti ti-device-floppy me-1"></i> Simpan';
          btnSaveLayout.disabled = false;
        }, 2000);
      } else {
        alert('Gagal menyimpan layout: ' + ((data && data.error) || 'Terjadi kesalahan'));
        btnSaveLayout.disabled = false;
        btnSaveLayout.innerHTML = '<i class="ti ti-device-floppy me-1"></i> Simpan';
      }
    } catch (err) {
      alert('Koneksi gagal saat menyimpan layout: ' + err.message);
      btnSaveLayout.disabled = false;
      btnSaveLayout.innerHTML = '<i class="ti ti-device-floppy me-1"></i> Simpan';
    }
  });

  // I. Reset Layout Action
  btnResetLayout?.addEventListener('click', async () => {
    if (!confirm('Kembalikan tata letak overlay ke pengaturan bawaan?')) return;

    btnResetLayout.disabled = true;
    try {
      const { ok, data } = await safeFetchJson('/api/overlay/reset', { method: 'POST' });
      if (ok && data && data.ok && data.layout) {
        currentLayout = data.layout;
        deselectAllElements();
        renderStudioCanvas();
        notifyOverlayChannel();
      }
    } catch (err) {
      alert('Gagal mereset layout: ' + err.message);
    } finally {
      btnResetLayout.disabled = false;
    }
  });

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
  loadStudioLayout();
  loadAudioSources();
  checkStatus();
  fetchLogs();
  setInterval(checkStatus, 2500);
  setInterval(fetchLogs, 2500);
});
