(function () {
  'use strict';

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; });
    }

    var input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();

    var copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      copied = false;
    }
    document.body.removeChild(input);
    return Promise.resolve(copied);
  }

  function flashLabel(button, text) {
    var original = button.getAttribute('data-original-label');
    if (original === null) {
      original = button.textContent;
      button.setAttribute('data-original-label', original);
    }
    button.textContent = text;
    window.setTimeout(function () {
      button.textContent = original;
    }, 2000);
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-share-page]');
    if (!button) return;
    event.preventDefault();

    var url = window.location.href;

    if (navigator.share) {
      navigator.share({ title: document.title, url: url }).catch(function (error) {
        if (!error || error.name !== 'AbortError') flashLabel(button, 'Không thể chia sẻ');
      });
      return;
    }

    copyText(url)
      .then(function (copied) {
        flashLabel(button, copied ? 'Đã sao chép liên kết' : 'Không thể sao chép');
      })
      .catch(function () {
        flashLabel(button, 'Không thể sao chép');
      });
  });
})();
