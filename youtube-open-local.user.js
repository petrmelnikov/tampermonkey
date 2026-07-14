// ==UserScript==
// @name         YouTube Open Local With Timestamp
// @namespace    https://youtube.com/
// @version      1.3.0
// @description  Open current YouTube video on local site with current timestamp
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
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
    return Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  function getVideoId() {
    return new URLSearchParams(location.search).get('v');
  }

  function getCurrentTimeSeconds() {
    const video = document.querySelector('video');
    return video ? Math.floor(video.currentTime || 0) : 0;
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
  }

  function createFloatingButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.textContent = 'Open local';

    button.style.cssText = `
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 999999;
      padding: 10px 14px;
      border: none;
      border-radius: 20px;
      background: #ff0000;
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      touch-action: manipulation;
    `;

    // долгое нажатие (мышь/тач) — редактирование URL, обычный клик — открытие
    let longPressTimer = null;
    let longPressFired = false;

    button.addEventListener('pointerdown', () => {
      longPressFired = false;
      longPressTimer = setTimeout(() => {
        longPressFired = true;
        editLocalHost();
      }, LONG_PRESS_MS);
    });

    ['pointerup', 'pointerleave', 'pointercancel'].forEach((event) => {
      button.addEventListener(event, () => clearTimeout(longPressTimer));
    });

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

  function init() {
    updateButtonVisibility();

    const observer = new MutationObserver(updateButtonVisibility);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener('yt-navigate-finish', updateButtonVisibility);
    window.addEventListener('popstate', updateButtonVisibility);

    document.addEventListener('fullscreenchange', updateButtonVisibility);
    document.addEventListener('webkitfullscreenchange', updateButtonVisibility);
    document.addEventListener('mozfullscreenchange', updateButtonVisibility);
    document.addEventListener('MSFullscreenChange', updateButtonVisibility);

    setInterval(updateButtonVisibility, 1000);
  }

  init();
})();
