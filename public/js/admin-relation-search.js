(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initBlock(block) {
    var type = block.getAttribute('data-type');
    var endpoint = block.getAttribute('data-endpoint');
    var inputName = block.getAttribute('data-input-name');
    var sourceId = block.getAttribute('data-selected-source');

    var input = block.querySelector('[data-relation-input]');
    var results = block.querySelector('[data-relation-results]');
    var selectedWrap = block.querySelector('[data-relation-selected]');
    var selectedEmpty = block.querySelector('[data-relation-selected-empty]');
    var hiddenWrap = block.querySelector('[data-relation-hidden]');
    var status = block.querySelector('[data-relation-status]');

    if (!type || !endpoint || !inputName || !input || !results || !selectedWrap || !hiddenWrap) {
      return;
    }

    var selected = new Map();
    var source = sourceId ? document.getElementById(sourceId) : null;
    if (source) {
      try {
        var parsed = JSON.parse(source.textContent || '[]');
        if (Array.isArray(parsed)) {
          parsed.forEach(function (item) {
            var id = item ? Number(item.id) : NaN;
            if (Number.isInteger(id) && id > 0) selected.set(id, item);
          });
        }
      } catch (error) {
        selected = new Map();
      }
    }

    var controller = null;
    var timer = null;
    var requestSeq = 0;

    function summaryFor(item) {
      if (type === 'ingredients') return item.unit || item.category || 'Nguyên liệu';
      return item.title || item.experience || 'Đầu bếp';
    }

    function setStatus(message, variant) {
      if (!status) return;
      status.textContent = message || '';
      status.className = 'relation-status' + (variant ? ' is-' + variant : '');
      status.classList.toggle('hidden', !message);
    }

    function renderSelected() {
      hiddenWrap.innerHTML = '';
      selectedWrap.innerHTML = '';

      Array.from(selected.values()).forEach(function (item) {
        var hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = inputName;
        hidden.value = String(item.id);
        hiddenWrap.appendChild(hidden);

        var chip = document.createElement('span');
        chip.className = 'relation-chip';
        chip.innerHTML =
          '<span class="relation-chip-name">' + escapeHtml(item.name) + '</span>' +
          '<button type="button" class="relation-chip-remove" data-relation-remove="' + item.id + '" aria-label="Bỏ chọn ' + escapeHtml(item.name) + '">×</button>';
        selectedWrap.appendChild(chip);
      });

      if (selectedEmpty) selectedEmpty.classList.toggle('hidden', selected.size > 0);
    }

    function markResult(button, active) {
      button.classList.toggle('is-selected', active);
      var mark = button.querySelector('.relation-result-mark');
      if (mark) mark.textContent = active ? '✓ Đã chọn' : '+ Chọn';
    }

    function renderResults(items) {
      if (!items.length) {
        results.innerHTML = '<p class="relation-empty">Không tìm thấy kết quả phù hợp.</p>';
        results.classList.remove('hidden');
        return;
      }

      results.innerHTML = items.map(function (item) {
        var active = selected.has(Number(item.id));
        var imageUrl = item.imageUrl || '/images/placeholder.svg';
        return '<button type="button" class="relation-result' + (active ? ' is-selected' : '') + '" data-relation-result="' + Number(item.id) + '">' +
          '<img src="' + escapeHtml(imageUrl) + '" alt="" class="relation-result-thumb" onerror="this.src=\'/images/placeholder.svg\'" />' +
          '<span class="relation-result-main">' +
            '<span class="relation-result-name">' + escapeHtml(item.name) + '</span>' +
            '<span class="relation-result-meta">' + escapeHtml(summaryFor(item)) + '</span>' +
          '</span>' +
          '<span class="relation-result-mark">' + (active ? '✓ Đã chọn' : '+ Chọn') + '</span>' +
        '</button>';
      }).join('');

      results.classList.remove('hidden');
    }

    function search(term) {
      var q = String(term || '').trim();

      if (!q) {
        if (controller) controller.abort();
        requestSeq++;
        results.innerHTML = '';
        results.classList.add('hidden');
        setStatus('');
        return;
      }

      var seq = ++requestSeq;
      if (controller) controller.abort();
      controller = new AbortController();

      setStatus('Đang tìm kiếm…', 'loading');

      fetch(endpoint + '?q=' + encodeURIComponent(q), {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      })
        .then(function (response) {
          if (!response.ok) throw new Error('Request failed with status ' + response.status);
          return response.json();
        })
        .then(function (data) {
          if (seq !== requestSeq) return;
          var items = Array.isArray(data.items) ? data.items : [];
          items.forEach(function (item) {
            var id = Number(item.id);
            if (selected.has(id)) selected.set(id, item);
          });
          renderResults(items);
          setStatus('');
        })
        .catch(function (error) {
          if (error.name === 'AbortError' || seq !== requestSeq) return;
          results.innerHTML = '';
          results.classList.add('hidden');
          setStatus('Không thể tìm kiếm lúc này. Vui lòng thử lại.', 'error');
        });
    }

    input.addEventListener('input', function () {
      window.clearTimeout(timer);
      var value = input.value;
      timer = window.setTimeout(function () { search(value); }, 300);
    });

    results.addEventListener('click', function (event) {
      var button = event.target.closest('[data-relation-result]');
      if (!button) return;

      var id = Number(button.getAttribute('data-relation-result'));
      if (selected.has(id)) {
        selected.delete(id);
      } else {
        var image = button.querySelector('img');
        selected.set(id, {
          id: id,
          name: button.querySelector('.relation-result-name').textContent,
          imageUrl: image ? image.getAttribute('src') : ''
        });
      }

      renderSelected();
      markResult(button, selected.has(id));
    });

    selectedWrap.addEventListener('click', function (event) {
      var button = event.target.closest('[data-relation-remove]');
      if (!button) return;

      var id = Number(button.getAttribute('data-relation-remove'));
      selected.delete(id);
      renderSelected();

      var result = results.querySelector('[data-relation-result="' + id + '"]');
      if (result) markResult(result, false);
    });

    document.addEventListener('click', function (event) {
      if (!block.contains(event.target)) results.classList.add('hidden');
    });

    renderSelected();
  }

  document.querySelectorAll('[data-relation-search]').forEach(initBlock);
})();
