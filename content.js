(() => {
  if (window.__ytClipLooperLoaded) return;
  window.__ytClipLooperLoaded = true;

  const state = {
    loop: null,
    overlay: null,
    rafId: null,
    lastUrl: location.href,
    lastVideoId: null,
  };

  function log(...args) {
    console.debug('[ClipLooper]', ...args);
  }

  function getVideoElement() {
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  }

  function getVideoId() {
    try {
      const url = new URL(location.href);
      if (!['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname)) return null;
      return url.searchParams.get('v');
    } catch {
      return null;
    }
  }

  function isWatchPage() {
    return location.pathname === '/watch' && !!getVideoId();
  }

  function getTitle() {
    const playerTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
    if (playerTitle?.textContent?.trim()) return playerTitle.textContent.trim();
    if (document.title) return document.title.replace(/ - YouTube$/i, '').trim();
    return 'YouTube video';
  }

  function ensureOverlay() {
    if (state.overlay && document.contains(state.overlay)) return state.overlay;
    const overlay = document.createElement('div');
    overlay.id = 'yt-clip-looper-overlay';
    overlay.innerHTML = `
      <div class="ytcl-inner">
        <div>
          <div class="ytcl-label">CLIP LOOP</div>
          <div class="ytcl-range" id="ytclRange">00:00 → 00:00</div>
        </div>
        <button id="ytclStop" type="button">Stop</button>
      </div>`;
    const style = document.createElement('style');
    style.textContent = `
      #yt-clip-looper-overlay { position: fixed; right: 18px; bottom: 82px; z-index: 2147483647; display: none; font-family: Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      #yt-clip-looper-overlay .ytcl-inner { display:flex; align-items:center; gap:12px; padding:10px 11px; background:rgba(16,18,23,.96); color:#fff; border:1px solid rgba(255,255,255,.12); border-radius:12px; box-shadow:0 18px 50px rgba(0,0,0,.35); backdrop-filter:blur(10px); }
      #yt-clip-looper-overlay .ytcl-label { font-size:9px; letter-spacing:.14em; color:#aab0ba; font-weight:800; }
      #yt-clip-looper-overlay .ytcl-range { margin-top:2px; font-size:11px; font-weight:750; }
      #yt-clip-looper-overlay button { border:1px solid rgba(255,255,255,.12); background:#252a32; color:#fff; border-radius:8px; padding:6px 9px; font-size:10px; font-weight:800; cursor:pointer; }
      #yt-clip-looper-overlay button:hover { background:#313741; }
    `;
    document.documentElement.appendChild(style);
    document.body.appendChild(overlay);
    overlay.querySelector('#ytclStop').addEventListener('click', stopLoop);
    state.overlay = overlay;
    return overlay;
  }

  function renderOverlay() {
    const overlay = ensureOverlay();
    if (!state.loop) {
      overlay.style.display = 'none';
      return;
    }
    overlay.style.display = 'block';
    overlay.querySelector('#ytclRange').textContent = `${formatTime(state.loop.startTime)} → ${formatTime(state.loop.endTime)}`;
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  function loopTick() {
    if (!state.loop) return;
    const video = getVideoElement();
    if (!video) {
      state.rafId = requestAnimationFrame(loopTick);
      return;
    }
    if (video.readyState >= 1) {
      const { startTime, endTime } = state.loop;
      if (video.currentTime >= endTime - 0.03 || video.currentTime < startTime - 0.5) {
        try {
          video.currentTime = startTime;
          if (video.paused && !state.loop.wasPausedByUser) video.play().catch(() => {});
        } catch {}
      }
      if (video.paused && state.loop.shouldKeepPlaying) {
        video.play().catch(() => {});
      }
    }
    state.rafId = requestAnimationFrame(loopTick);
  }

  function startLoop(startTime, endTime, clipId) {
    const video = getVideoElement();
    const duration = video?.duration;
    if (!video) throw new Error('VIDEO_NOT_FOUND');
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime || startTime < 0) throw new Error('INVALID_RANGE');
    if (Number.isFinite(duration) && endTime > duration + 0.25) throw new Error('OUT_OF_RANGE');

    stopLoop(false);
    state.loop = {
      startTime,
      endTime,
      clipId: clipId || null,
      shouldKeepPlaying: true,
      wasPausedByUser: false,
    };
    video.currentTime = startTime;
    video.play().catch(() => {});
    renderOverlay();
    state.rafId = requestAnimationFrame(loopTick);
    log('Loop started', state.loop);
  }

  function stopLoop(showLog = true) {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = null;
    state.loop = null;
    renderOverlay();
    if (showLog) log('Loop stopped');
  }

  function observeNavigation() {
    if (location.href !== state.lastUrl) {
      state.lastUrl = location.href;
      const newVideoId = getVideoId();
      if (newVideoId !== state.lastVideoId) {
        state.lastVideoId = newVideoId;
        if (state.loop) stopLoop(false);
      }
    }
  }

  const observer = new MutationObserver(() => {
    observeNavigation();
    ensureOverlay();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(observeNavigation, 700);

  document.addEventListener('pause', (event) => {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement) || !state.loop) return;
    if (video.currentTime < state.loop.endTime - 0.2) {
      state.loop.wasPausedByUser = true;
      state.loop.shouldKeepPlaying = false;
    }
  }, true);

  document.addEventListener('play', (event) => {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement) || !state.loop) return;
    state.loop.wasPausedByUser = false;
    state.loop.shouldKeepPlaying = true;
  }, true);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      if (message.action === 'PING') {
        sendResponse({ ok: true });
        return;
      }
      if (message.action === 'GET_VIDEO_INFO') {
        const video = getVideoElement();
        sendResponse({
          ok: true,
          isWatchPage: isWatchPage(),
          videoId: getVideoId(),
          title: getTitle(),
          currentTime: video?.currentTime ?? 0,
          duration: video?.duration ?? NaN,
          paused: video?.paused ?? true,
        });
        return;
      }
      if (message.action === 'START_CLIP_LOOP') {
        if (message.targetVideoId && message.targetVideoId !== getVideoId()) {
          sendResponse({ ok: false, error: 'WRONG_VIDEO' });
          return;
        }
        startLoop(Number(message.startTime), Number(message.endTime), message.clipId);
        sendResponse({ ok: true });
        return;
      }
      if (message.action === 'SET_START_FROM_COMMAND') {
        const video = getVideoElement();
        if (!video || !isWatchPage()) {
          sendResponse({ ok: false, error: 'NO_VIDEO' });
          return;
        }
        chrome.storage.local.set({ quickCapture: { videoId: getVideoId(), videoTitle: getTitle(), startTime: Number(message.time) || 0, updatedAt: Date.now() } });
        sendResponse({ ok: true, time: Number(message.time) || 0 });
        return;
      }
      if (message.action === 'SET_END_FROM_COMMAND') {
        const video = getVideoElement();
        if (!video || !isWatchPage()) {
          sendResponse({ ok: false, error: 'NO_VIDEO' });
          return;
        }
        chrome.storage.local.set({ quickCaptureEnd: { videoId: getVideoId(), endTime: video.currentTime, updatedAt: Date.now() } });
        sendResponse({ ok: true, time: video.currentTime });
        return;
      }
      if (message.action === 'TOGGLE_LOOP') {
        if (state.loop) {
          stopLoop();
          sendResponse({ ok: true, active: false });
        } else {
          sendResponse({ ok: false, error: 'NO_ACTIVE_SAVED_CLIP' });
        }
        return;
      }
      if (message.action === 'STOP_LOOP') {
        stopLoop();
        sendResponse({ ok: true });
        return;
      }
      sendResponse({ ok: false, error: 'UNKNOWN_ACTION' });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || 'UNKNOWN_ERROR' });
    }
    return true;
  });

  state.lastVideoId = getVideoId();
  ensureOverlay();
})();