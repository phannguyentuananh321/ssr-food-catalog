(function () {
  'use strict';

  var root = document.querySelector('[data-bookmarks-root]');
  if (!root) return;

  var store = window.AmViBookmarks;
  if (!store) return;

  var TYPES = ['dishes', 'chefs', 'ingredients'];
  var loadingNote = root.querySelector('[data-bookmarks-loading]');
  var errorNote = root.querySelector('[data-bookmarks-error]');
  var tabs = Array.from(root.querySelectorAll('[data-bookmark-tab]'));
  var loaded = { dishes: false, chefs: false, ingredients: false };

  function state() {
    return store.getState();
  }

  function panel(type) {
    return root.querySelector('[data-bookmark-panel="' + type + '"]');
  }

  function list(type) {
    var el = panel(type);
    return el ? el.querySelector('[data-bookmark-list]') : null;
  }

  function emptyNote(type) {
    var el = panel(type);
    return el ? el.querySelector('[data-bookmark-empty]') : null;
  }

  function setTab(type, updateHash) {
    tabs.forEach(function (tab) {
      var active = tab.getAttribute('data-bookmark-tab') === type;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    TYPES.forEach(function (name) {
      var el = panel(name);
      if (el) el.classList.toggle('hidden', name !== type);
    });

    if (updateHash) {
      var url = new URL(window.location.href);
      url.hash = type;
      window.history.replaceState({}, '', url);
    }
  }

  function updateTabCounts() {
    var current = state();
    tabs.forEach(function (tab) {
      var type = tab.getAttribute('data-bookmark-tab');
      var count = tab.querySelector('[data-bookmark-tab-count]');
      if (count) count.textContent = String(current[type] ? current[type].length : 0);
    });
  }

  function syncEmptyStates() {
    var current = state();
    TYPES.forEach(function (type) {
      if (!loaded[type]) return;
      var note = emptyNote(type);
      var grid = list(type);
      var hasCards = !!(grid && grid.querySelector('[data-bookmark-item]'));
      if (note) note.classList.toggle('hidden', hasCards || current[type].length > 0);
    });
  }

  function removeUnbookmarkedCards() {
    var current = state();
    TYPES.forEach(function (type) {
      if (!loaded[type]) return;
      var grid = list(type);
      if (!grid) return;
      Array.from(grid.querySelectorAll('[data-bookmark-item]')).forEach(function (item) {
        var id = Number(item.getAttribute('data-bookmark-item-id'));
        if (current[type].indexOf(id) === -1) item.remove();
      });
    });
  }

  function showError() {
    if (errorNote) {
      errorNote.textContent = 'Không thể tải danh sách đã lưu. Vui lòng thử lại sau.';
      errorNote.classList.remove('hidden');
    }
    if (loadingNote) loadingNote.classList.add('hidden');
  }

  function loadBookmarks() {
    var current = state();
    var params = new URLSearchParams();

    TYPES.forEach(function (type) {
      if (current[type].length) params.set(type, current[type].join(','));
    });

    updateTabCounts();

    if (!params.toString()) {
      TYPES.forEach(function (type) { loaded[type] = true; });
      if (loadingNote) loadingNote.classList.add('hidden');
      syncEmptyStates();
      return;
    }

    fetch('/api/bookmarks?' + params.toString(), { headers: { Accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('Request failed with status ' + response.status);
        return response.json();
      })
      .then(function (data) {
        TYPES.forEach(function (type) {
          var grid = list(type);
          if (grid) grid.innerHTML = data.html && data.html[type] ? data.html[type] : '';
          loaded[type] = true;
        });

        if (window.AmViBookmarks) window.AmViBookmarks.hydrate(root);

        if (data.validIds) store.prune(data.validIds);

        removeUnbookmarkedCards();
        updateTabCounts();
        syncEmptyStates();

        if (loadingNote) loadingNote.classList.add('hidden');
        if (errorNote) errorNote.classList.add('hidden');
      })
      .catch(showError);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      setTab(tab.getAttribute('data-bookmark-tab'), true);
    });
  });

  document.addEventListener(store.EVENT_NAME, function () {
    updateTabCounts();
    removeUnbookmarkedCards();
    syncEmptyStates();
  });

  var initialTab = (window.location.hash || '').replace('#', '');
  if (TYPES.indexOf(initialTab) === -1) {
    var current = state();
    initialTab = TYPES.find(function (type) { return current[type].length > 0; }) || 'dishes';
  }
  setTab(initialTab, false);

  loadBookmarks();
})();
