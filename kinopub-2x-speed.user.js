// ==UserScript==
// @name         Kinopub 2x Speed Button
// @namespace    https://github.com/petrmelnikov
// @version      1.0.0
// @description  Кнопка переключения скорости 2x на панели управления плеера kino.pub
// @author       petrmelnikov
// @match        *://kino.pub/*
// @match        *://*.kino.pub/*
// @match        *://kino.watch/*
// @match        *://*.kino.watch/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var BTN_CLASS = 'btn-speed2x';
  // скорость, на которую вернёмся при выключении 2x
  var restoreRate = 1;

  var style = document.createElement('style');
  style.textContent = [
    '.' + BTN_CLASS + ' { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; color: currentColor; }',
    '.' + BTN_CLASS + '.is-active { background-color: rgba(0, 255, 128, 0.2); color: #26d78b; }',
  ].join('\n');
  document.head.appendChild(style);

  function getPlayer() {
    return document.getElementById('player'); // <media-player> (Vidstack)
  }

  function isAt2x(player) {
    return Math.abs((player.playbackRate || 1) - 2) < 0.01;
  }

  function toggleSpeed() {
    var player = getPlayer();
    if (!player) return;
    if (isAt2x(player)) {
      player.playbackRate = restoreRate;
    } else {
      restoreRate = (typeof player.playbackRate === 'number' && !isNaN(player.playbackRate))
        ? player.playbackRate : 1;
      if (Math.abs(restoreRate - 2) < 0.01) restoreRate = 1;
      player.playbackRate = 2;
    }
  }

  function syncButtonState() {
    var player = getPlayer();
    var btn = document.querySelector('.' + BTN_CLASS);
    if (player && btn) btn.classList.toggle('is-active', isAt2x(player));
  }

  function createButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'control-button ' + BTN_CLASS;
    btn.setAttribute('aria-label', 'Скорость 2x');
    btn.textContent = '2×';
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      toggleSpeed();
    });
    return btn;
  }

  function insertButton() {
    var row = document.querySelector('.player-controls-row');
    if (!row || row.querySelector('.' + BTN_CLASS)) return;

    var btn = createButton();
    // ставим слева от кнопки настроек; если её нет — в конец панели
    var settingsBtn = row.querySelector('.btn-settings');
    row.insertBefore(btn, settingsBtn || null);

    var player = getPlayer();
    if (player) {
      // rate-change приходит и при смене скорости через меню настроек сайта
      player.addEventListener('rate-change', syncButtonState);
      syncButtonState();
    }
  }

  insertButton();

  // плеер строится скриптами после загрузки страницы — ждём появления панели
  var observer = new MutationObserver(function () {
    insertButton();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
