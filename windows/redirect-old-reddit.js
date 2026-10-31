// ==UserScript==
// @name         Reddit -> old.reddit.com
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Redirect modern Reddit to old.reddit.com
// @match        *://www.reddit.com/*
// @match        *://reddit.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  var domain = 'old.reddit.com';
  var current = window.location.hostname;

  if (current === domain || current.endsWith('.' + domain)) {
    return;
  }

  var target = window.location.href
    .replace(/^https?:\/\/(www\.)?reddit\.com/, 'https://' + domain)
    .replace(/\/$/, '') + '/';

  window.location.replace(target);
})();
