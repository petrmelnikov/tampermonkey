// ==UserScript==
// @name         YouTube Open Local With Timestamp
// @namespace    https://youtube.com/
// @version      1.5.0
// @description  Open current YouTube video on local site with current timestamp (desktop & mobile)
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @match        https://m.youtube.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const DEFAULT_LOCAL_HOST = 'http://192.168.0.164:3000';
  const LOCAL_HOST_STORAGE_KEY = 'tm-open-local-host';
  const BUTTON_ID = 'tm-open-local-video-button';
  const LONG_PRESS_MS = 600;

  function getLocalHost() {
    try {
      return localStorage.getItem(LOCAL_HOST_STORAGE_KEY) || DEFAULT_LOCAL_HOST;
    } catch (e) {
      return DEFAULT_LOCAL_HOST;
    }
  }

  function setLocalHost(value) {
    try {
      if (value === null) {
        localStorage.removeItem(LOCAL_HOST_STORAGE_KEY);
      } else {
        localStorage.setItem(LOCAL_HOST_STORAGE_KEY, value);
      }
    } catch (e) {
      // localStorage недоступен — работаем с дефолтом
    }
  }

  function normalizeHostInput(input) {
    const value = input.trim().replace(/\/+$/, '');
    if (!value) return null;

    const withProtocol = /^https?:\/\//i.test(value) ? value : `http://${value}`;

    try {
      const parsed = new URL(withProtocol);
      if (!/^[a-z0-9.-]+$/i.test(parsed.hostname) && !/^\[[0-9a-f:]+\]$/i.test(parsed.hostname)) {
        return undefined;
      }
      return withProtocol;
    } catch (e) {
      return undefined;
    }
  }

  function editLocalHost() {
    const input = prompt('URL локального сайта:', getLocalHost());
    if (input === null) return;

    const normalized = normalizeHostInput(input);

    if (normalized === undefined) {
      alert('Некорректный URL: ' + input);
      return;
    }

    // пустой ввод или дефолтное значение — возвращаемся к дефолту
    setLocalHost(normalized === null || normalized === DEFAULT_LOCAL_HOST ? null : normalized);
  }

  function isWatchPage() {
    return location.pathname === '/watch' && new URLSearchParams(location.search).has('v');
  }

  function isFullscreen() {
    if (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    ) {
      return true;
    }

    // iOS Safari: полноэкранное видео не выставляет document.fullscreenElement
    const video = document.querySelector('video');
    return Boolean(video && video.webkitDisplayingFullscreen);
  }

  function getVideoId() {
    return new URLSearchParams(location.search).get('v');
  }

  function getMainVideo() {
    // основной плеер; на странице могут быть и другие <video> (превью и т.п.)
    return (
      document.querySelector('#movie_player video.html5-main-video') ||
      document.querySelector('video.html5-main-video') ||
      document.querySelector('video')
    );
  }

  function getCurrentTimeSeconds() {
    const video = getMainVideo();
    return video ? Math.floor(video.currentTime || 0) : 0;
  }

  function pauseVideo() {
    const video = getMainVideo();
    if (video && !video.paused) video.pause();
  }

  function buildLocalUrl() {
    const videoId = getVideoId();
    if (!videoId) return null;

    const currentTime = getCurrentTimeSeconds();

    const url = new URL('/watch', getLocalHost());
    url.searchParams.set('v', videoId);

    if (currentTime > 0) {
      url.searchParams.set('t', `${currentTime}s`);
    }

    return url.toString();
  }

  function openLocalVideo() {
    const url = buildLocalUrl();

    if (!url) {
      alert('Не удалось определить video ID');
      return;
    }

    window.open(url, '_blank');
    pauseVideo();
  }

  function isCompactLayout() {
    return Boolean(
      window.matchMedia && window.matchMedia('(max-width: 600px)').matches
    );
  }

  function applyButtonLayout(button) {
    const compact = isCompactLayout();

    button.style.cssText = `
      position: fixed;
      right: calc(16px + env(safe-area-inset-right, 0px));
      bottom: calc(16px + env(safe-area-inset-bottom, 0px));
      z-index: 999999;
      max-width: calc(100vw - 32px);
      padding: ${compact ? '12px 16px' : '10px 14px'};
      border: none;
      border-radius: 20px;
      background: #ff0000;
      color: white;
      font-size: ${compact ? '16px' : '14px'};
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      touch-action: manipulation;
    `;
  }

  function createFloatingButton() {
    if (!document.body || document.getElementById(BUTTON_ID)) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Open local';
    applyButtonLayout(button);

    // долгое нажатие (мышь/тач) — редактирование URL, обычный клик — открытие
    let longPressTimer = null;
    let longPressFired = false;

    function startLongPress() {
      cancelLongPress();
      longPressFired = false;
      longPressTimer = setTimeout(() => {
        longPressFired = true;
        editLocalHost();
      }, LONG_PRESS_MS);
    }

    function cancelLongPress() {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    if (typeof window.PointerEvent !== 'undefined') {
      button.addEventListener('pointerdown', startLongPress);

      ['pointerup', 'pointerleave', 'pointercancel'].forEach((event) => {
        button.addEventListener(event, cancelLongPress);
      });
    } else {
      // fallback для старых мобильных браузеров без PointerEvent
      button.addEventListener('touchstart', startLongPress, { passive: true });
      button.addEventListener('mousedown', startLongPress);

      ['touchend', 'touchcancel', 'touchmove', 'mouseup', 'mouseleave'].forEach((event) => {
        button.addEventListener(event, cancelLongPress);
      });
    }

    button.addEventListener('click', () => {
      if (longPressFired) return;
      openLocalVideo();
    });

    // долгий тап на мобильных вызывает контекстное меню — глушим
    button.addEventListener('contextmenu', (ev) => ev.preventDefault());

    document.body.appendChild(button);
  }

  function removeFloatingButton() {
    document.getElementById(BUTTON_ID)?.remove();
  }

  function updateButtonVisibility() {
    if (isWatchPage() && !isFullscreen()) {
      createFloatingButton();
    } else {
      removeFloatingButton();
    }
  }

  function updateButtonLayout() {
    const button = document.getElementById(BUTTON_ID);
    if (button) applyButtonLayout(button);
    updateButtonVisibility();
  }

  function init() {
    // на мобильной версии body может появиться позже — ждём DOMContentLoaded
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', init, { once: true });
      return;
    }

    updateButtonVisibility();

    const observer = new MutationObserver(updateButtonVisibility);

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.addEventListener('yt-navigate-finish', updateButtonVisibility);
    window.addEventListener('yt-page-data-updated', updateButtonVisibility);
    window.addEventListener('popstate', updateButtonVisibility);
    window.addEventListener('resize', updateButtonLayout);
    window.addEventListener('orientationchange', updateButtonLayout);

    document.addEventListener('fullscreenchange', updateButtonVisibility);
    document.addEventListener('webkitfullscreenchange', updateButtonVisibility);
    document.addEventListener('mozfullscreenchange', updateButtonVisibility);
    document.addEventListener('MSFullscreenChange', updateButtonVisibility);

    setInterval(updateButtonVisibility, 1000);
  }

  init();
})();
