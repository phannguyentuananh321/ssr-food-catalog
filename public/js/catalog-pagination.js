(function () {
  'use strict';

  function initControls(controls) {
    var grid = document.querySelector('[data-catalog-grid]');
    if (!grid) return;

    var apiBase = controls.getAttribute('data-api-base');
    var button = controls.querySelector('[data-load-more]');
    var sentinel = controls.querySelector('[data-infinite-sentinel]');
    var endNote = controls.querySelector('[data-catalog-end]');
    var errorNote = controls.querySelector('[data-catalog-error]');
    var statusNote = controls.querySelector('[data-catalog-status]');

    var nextPage = parseInt(controls.getAttribute('data-next-page'), 10) || 0;
    var loading = false;
    var done = nextPage < 1;
    var observer = null;

    function buildUrl(page) {
      var params = new URLSearchParams(window.location.search);
      params.set('page', String(page));
      return apiBase + '?' + params.toString();
    }

    function setUrlPage(page) {
      var url = new URL(window.location.href);
      url.searchParams.set('page', String(page));
      window.history.replaceState({}, '', url);
    }

    function showError(message) {
      if (!errorNote) return;
      errorNote.textContent = message;
      errorNote.classList.remove('hidden');
    }

    function clearError() {
      if (!errorNote) return;
      errorNote.textContent = '';
      errorNote.classList.add('hidden');
    }

    function setLoading(value) {
      loading = value;
      if (button) button.disabled = value;
      if (statusNote) statusNote.classList.toggle('hidden', !value);
    }

    function finish() {
      done = true;
      if (button) button.classList.add('hidden');
      if (sentinel) sentinel.classList.add('hidden');
      if (endNote) endNote.classList.remove('hidden');
      if (statusNote) statusNote.classList.add('hidden');
      if (observer) observer.disconnect();
    }

    function loadNext() {
      if (loading || done || !nextPage) return;

      clearError();
      setLoading(true);

      fetch(buildUrl(nextPage), { headers: { Accept: 'application/json' } })
        .then(function (response) {
          if (!response.ok) throw new Error('Request failed with status ' + response.status);
          return response.json();
        })
        .then(function (data) {
          if (data.html) {
            grid.insertAdjacentHTML('beforeend', data.html);
            if (window.AmViBookmarks) window.AmViBookmarks.hydrate(grid);
          }

          var pagination = data.pagination || {};
          setUrlPage(pagination.page || nextPage);

          nextPage = pagination.hasNext ? pagination.nextPage : 0;
          controls.setAttribute('data-next-page', nextPage ? String(nextPage) : '');

          if (!nextPage) finish();
        })
        .catch(function () {
          showError('Không thể tải thêm dữ liệu. Vui lòng thử lại.');
          if (button) button.classList.remove('hidden');
        })
        .then(function () {
          setLoading(false);
        });
    }

    if (button) button.addEventListener('click', loadNext);

    if (done) {
      finish();
      return;
    }

    if (sentinel && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) loadNext();
        });
      }, { rootMargin: '240px 0px' });
      observer.observe(sentinel);
    } else if (sentinel && button) {
      button.classList.remove('hidden');
    }
  }

  document.querySelectorAll('[data-catalog-controls]').forEach(initControls);
})();
