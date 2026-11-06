(function () {
  'use strict';

  var STORAGE_KEY = 'am_vi_bookmarks';
  var EVENT_NAME = 'amvi:bookmarks-changed';
  var TYPES = ['dishes', 'chefs', 'ingredients'];
  var MAX_PER_TYPE = 200;

  function emptyState() {
    return { dishes: [], chefs: [], ingredients: [] };
  }

  function normalizeIds(value) {
    if (!Array.isArray(value)) return [];
    var ids = value
      .map(function (id) { return Number(id); })
      .filter(function (id) { return Number.isInteger(id) && id > 0; });
    return Array.from(new Set(ids)).slice(0, MAX_PER_TYPE);
  }

  function normalizeState(value) {
    var state = emptyState();
    if (!value || typeof value !== 'object') return state;
    TYPES.forEach(function (type) {
      state[type] = normalizeIds(value[type]);
    });
    return state;
  }

  function readState() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch (error) {
      return emptyState();
    }
  }

  var state = readState();

  function getState() {
    return {
      dishes: state.dishes.slice(),
      chefs: state.chefs.slice(),
      ingredients: state.ingredients.slice()
    };
  }

  function isBookmarked(type, id) {
    return TYPES.indexOf(type) !== -1 && state[type].indexOf(Number(id)) !== -1;
  }

  function emit() {
    document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: getState() }));
  }

  function updateCounts() {
    var total = state.dishes.length + state.chefs.length + state.ingredients.length;

    document.querySelectorAll('[data-bookmark-count]').forEach(function (el) {
      el.textContent = String(total);
      el.classList.toggle('hidden', total === 0);
    });

    document.querySelectorAll('[data-bookmark-count-type]').forEach(function (el) {
      var type = el.getAttribute('data-bookmark-count-type');
      el.textContent = String(TYPES.indexOf(type) !== -1 ? state[type].length : 0);
    });
  }

  function updateButton(button) {
    var type = button.getAttribute('data-bookmark-type');
    var id = Number(button.getAttribute('data-bookmark-id'));
    var active = isBookmarked(type, id);

    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');

    var icon = button.querySelector('.bookmark-icon');
    if (icon) icon.textContent = active ? '♥' : '♡';

    var label = button.querySelector('[data-bookmark-label]');
    if (label) label.textContent = active ? 'Đã lưu' : 'Lưu';
  }

  function hydrate(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-bookmark-btn]').forEach(updateButton);
    if (scope.matches && scope.matches('[data-bookmark-btn]')) updateButton(scope);
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Private mode or quota errors must not break the in-memory UI.
    }
    updateCounts();
    emit();
  }

  function setBookmark(type, id, next) {
    if (TYPES.indexOf(type) === -1) return getState();
    var numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) return getState();

    var exists = state[type].indexOf(numericId) !== -1;
    if (next && !exists && state[type].length < MAX_PER_TYPE) state[type].push(numericId);
    if (!next && exists) {
      state[type] = state[type].filter(function (value) { return value !== numericId; });
    }

    persist();
    hydrate();
    return getState();
  }

  function toggle(type, id) {
    return setBookmark(type, id, !isBookmarked(type, id));
  }

  function remove(type, id) {
    return setBookmark(type, id, false);
  }

  function prune(validIds) {
    if (!validIds || typeof validIds !== 'object') return getState();
    var changed = false;

    TYPES.forEach(function (type) {
      if (!Array.isArray(validIds[type])) return;
      var allowed = new Set(normalizeIds(validIds[type]));
      var next = state[type].filter(function (id) { return allowed.has(id); });
      if (next.length !== state[type].length) {
        state[type] = next;
        changed = true;
      }
    });

    if (changed) persist();
    return getState();
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-bookmark-btn]');
    if (!button) return;
    event.preventDefault();
    toggle(button.getAttribute('data-bookmark-type'), button.getAttribute('data-bookmark-id'));
  });

  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY) return;
    try {
      state = normalizeState(JSON.parse(event.newValue || '{}'));
    } catch (error) {
      state = emptyState();
    }
    hydrate();
    updateCounts();
    emit();
  });

  window.AmViBookmarks = {
    STORAGE_KEY: STORAGE_KEY,
    EVENT_NAME: EVENT_NAME,
    MAX_PER_TYPE: MAX_PER_TYPE,
    getState: getState,
    isBookmarked: isBookmarked,
    toggle: toggle,
    remove: remove,
    prune: prune,
    hydrate: hydrate,
    updateCounts: updateCounts,
    refresh: function () {
      state = readState();
      hydrate();
      updateCounts();
      emit();
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    state = readState();
    hydrate();
    updateCounts();
  });

  if (document.readyState !== 'loading') {
    hydrate();
    updateCounts();
  }
})();
