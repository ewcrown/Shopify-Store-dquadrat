/**
 * Free gift chooser: when cart total reaches threshold, show 3 product options.
 * User chooses one to add as free gift. Free gift is removed if cart drops below threshold.
 */
(function () {
  if (!window.theme || !window.theme.freeGift) return;
  var config = window.theme.freeGift;
  if (config.thresholdCents <= 0) return;

  var thresholdCents = config.thresholdCents;
  var variantIds = config.variantIds || [];
  var products = config.products || [];
  var cartAddUrl = (window.theme.routes && window.theme.routes.cart_add_url) ? window.theme.routes.cart_add_url + '.js' : '/cart/add.js';
  var cartUrl = (window.theme.routes && window.theme.routes.cart_url) ? window.theme.routes.cart_url + '.js' : '/cart.js';
  var cartChangeUrl = ((window.theme.routes && window.theme.routes.cart_url) ? window.theme.routes.cart_url.replace(/\/?$/, '') : '/cart') + '/change.js';

  var containerId = 'free-gift-chooser';
  var progressBarId = 'free-gift-progress-bar';
  var headlineText = 'Wähle dein Gratisgeschenk';

  function formatMoney(cents) {
    var val = (cents / 100).toFixed(2).replace('.', ',');
    return '€' + val;
  }

  function buildProgressBarHTML(cart) {
    var totalCents = cart.total_price || 0;
    var progress = thresholdCents > 0 ? Math.min(100, Math.round((totalCents / thresholdCents) * 100)) : 0;
    var qualified = totalCents >= thresholdCents;
    var currentStr = formatMoney(totalCents);
    var goalStr = formatMoney(thresholdCents);
    var remainingCents = Math.max(0, thresholdCents - totalCents);
    var remainingStr = formatMoney(remainingCents);

    var msg = qualified
      ? 'Du hast dich für ein Gratisgeschenk qualifiziert!'
      : 'Noch ' + remainingStr + ' bis zum Gratisgeschenk';

    var html = '<div id="' + progressBarId + '" class="free-gift-progress">';
    html += '<div class="free-gift-progress__text">' + currentStr + ' / ' + goalStr + '</div>';
    html += '<div class="free-gift-progress__bar"><span class="free-gift-progress__fill" style="width:' + progress + '%"></span></div>';
    html += '<div class="free-gift-progress__msg">' + msg + '</div>';
    html += '</div>';
    return html;
  }

  function updateProgressBars(cart) {
    if (!cart || config.thresholdCents <= 0) return;
    var html = buildProgressBarHTML(cart);

    var cartSection = document.querySelector('[data-section-type="cart-template"]');
    if (cartSection) {
      var existing = cartSection.querySelector('#' + progressBarId);
      if (existing) {
        existing.outerHTML = html;
      } else {
        var wrap = document.createElement('div');
        wrap.className = 'free-gift-progress-wrapper';
        wrap.innerHTML = html;
        cartSection.insertBefore(wrap, cartSection.firstChild);
      }
    }

    var modalInner = document.querySelector('#added-to-cart .inner');
    if (modalInner) {
      var existingInModal = modalInner.querySelector('#' + progressBarId);
      if (existingInModal) {
        existingInModal.outerHTML = html;
      } else {
        var wrapModal = document.createElement('div');
        wrapModal.className = 'free-gift-progress-wrapper free-gift-progress-wrapper--modal';
        wrapModal.innerHTML = html;
        modalInner.insertBefore(wrapModal, modalInner.firstChild);
      }
    }
  }

  function getCart() {
    return fetch(cartUrl).then(function (res) { return res.json(); });
  }

  function addToCart(variantId, quantity) {
    quantity = quantity || 1;
    return fetch(cartAddUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: quantity })
    }).then(function (res) { return res.json(); });
  }

  function removeFromCart(lineItemKey) {
    return fetch(cartChangeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: lineItemKey, quantity: 0 })
    }).then(function (res) { return res.json(); });
  }

  function isFreeGiftVariant(variantId) {
    return variantIds.indexOf(variantId) !== -1;
  }

  function refreshCartUI() {
    if (window.location.pathname === '/cart' || window.location.pathname === '/cart/') {
      setTimeout(function () { window.location.reload(); }, 200);
    } else {
      document.dispatchEvent(new CustomEvent('cart:refresh'));
    }
  }

  function freeGiftVariantInCart(cart) {
    if (!cart || !cart.items) return null;
    for (var i = 0; i < cart.items.length; i++) {
      if (isFreeGiftVariant(cart.items[i].variant_id)) return cart.items[i];
    }
    return null;
  }

  function buildChooserHTML(cart) {
    var totalCents = cart.total_price || 0;
    var qualified = totalCents >= thresholdCents;
    var existing = freeGiftVariantInCart(cart);
    var existingVariantId = existing ? existing.variant_id : null;

    var html = '<div class="free-gift-chooser" data-qualified="' + qualified + '">';
    html += '<p class="free-gift-chooser__headline">' + headlineText + '</p>';
    html += '<div class="free-gift-chooser__products">';
    products.forEach(function (p) {
      var inCart = existingVariantId === p.variantId;
      var disabled = existing !== null && !inCart;
      html += '<div class="free-gift-chooser__product' + (inCart ? ' is-added' : '') + '">';
      html += '<a href="' + (p.productUrl || '#') + '" class="free-gift-chooser__image-wrap">';
      html += '<img src="' + (p.imageUrl || '') + '" alt="" class="free-gift-chooser__image" loading="lazy">';
      html += '</a>';
      html += '<p class="free-gift-chooser__title">' + (p.title || '') + '</p>';
      if (inCart) {
        html += '<span class="free-gift-chooser__btn free-gift-chooser__btn--added">Hinzugefügt</span>';
      } else if (disabled) {
        html += '<span class="free-gift-chooser__btn free-gift-chooser__btn--disabled">Nur eines wählbar</span>';
      } else {
        html += '<button type="button" class="free-gift-chooser__btn" data-variant-id="' + p.variantId + '">Als Geschenk hinzufügen</button>';
      }
      html += '</div>';
    });
    html += '</div></div>';

    return html;
  }

  function showOrHideChooser(cart) {
    var totalCents = cart.total_price || 0;
    var qualified = totalCents >= thresholdCents;
    var container = document.getElementById(containerId);
    if (!container) return;

    if (qualified) {
      var existing = freeGiftVariantInCart(cart);
      if (existing) {
        container.classList.remove('free-gift-chooser--visible');
        container.innerHTML = '';
        return;
      }
      container.innerHTML = buildChooserHTML(cart);
      container.classList.add('free-gift-chooser--visible');
      container.querySelectorAll('.free-gift-chooser__btn[data-variant-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var variantId = parseInt(btn.getAttribute('data-variant-id'), 10);
          btn.disabled = true;
          btn.textContent = '…';
          addToCart(variantId, 1).then(function () {
            refreshCartUI();
            getCart().then(function (updatedCart) {
              showOrHideChooser(updatedCart);
            });
          }).catch(function () {
            btn.disabled = false;
            btn.textContent = 'Als Geschenk hinzufügen';
          });
        });
      });
    } else {
      container.classList.remove('free-gift-chooser--visible');
      container.innerHTML = '';
    }
  }

  function removeFreeGiftIfBelowThreshold(cart) {
    var totalCents = cart.total_price || 0;
    if (totalCents >= thresholdCents) return;
    var item = freeGiftVariantInCart(cart);
    if (!item) return;
    removeFromCart(item.key).then(refreshCartUI).catch(function () {});
  }

  function updateFreeGiftUI() {
    getCart().then(function (cart) {
      removeFreeGiftIfBelowThreshold(cart);
      updateProgressBars(cart);
      if (!products.length) return;
      var container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'free-gift-chooser-wrapper';
        document.body.appendChild(container);
      }
      showOrHideChooser(cart);
    }).catch(function () {});
  }

  (function injectStyles() {
    var css = [
      '.free-gift-chooser-wrapper{position:fixed;bottom:0;left:0;right:0;z-index:9999;padding:12px 16px;background:#fff;box-shadow:0 -4px 20px rgba(0,0,0,.12);transform:translateY(100%);transition:transform .3s ease;}',
      '.free-gift-chooser-wrapper.free-gift-chooser--visible{transform:translateY(0);}',
      '.free-gift-chooser__headline{margin:0 0 12px;font-size:1rem;font-weight:600;text-align:center;}',
      '.free-gift-chooser__products{display:flex;flex-wrap:wrap;justify-content:center;gap:16px;max-width:900px;margin:0 auto;}',
      '.free-gift-chooser__product{flex:0 0 auto;width:140px;text-align:center;}',
      '.free-gift-chooser__image-wrap{display:block;margin-bottom:8px;}',
      '.free-gift-chooser__image{width:100%;height:140px;object-fit:cover;border-radius:6px;}',
      '.free-gift-chooser__title{margin:0 0 8px;font-size:13px;line-height:1.3;}',
      '.free-gift-chooser__btn{display:inline-block;padding:8px 12px;font-size:12px;cursor:pointer;border:1px solid #e50051;color:#e50051;background:#fff;border-radius:4px;}',
      '.free-gift-chooser__btn:hover:not(:disabled){background:#e50051;color:#fff;}',
      '.free-gift-chooser__btn--added,.free-gift-chooser__btn--disabled{cursor:default;border-color:#ccc;color:#666;background:#f5f5f5;}',
      '.free-gift-progress-wrapper{margin-bottom:1.25rem;}',
      '.free-gift-progress-wrapper--modal{margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #eee;}',
      '.free-gift-progress{font-size:14px;}',
      '.free-gift-progress__text{font-weight:600;margin-bottom:6px;}',
      '.free-gift-progress__bar{height:10px;background:#e8e8e8;border-radius:5px;overflow:hidden;}',
      '.free-gift-progress__fill{display:block;height:100%;background:#e50051;border-radius:5px;transition:width .3s ease;}',
      '.free-gift-progress__msg{margin-top:6px;font-size:13px;color:#555;}',
      '@media (min-width:768px){.free-gift-chooser-wrapper{padding:16px 24px;} .free-gift-chooser__product{width:160px;} .free-gift-chooser__image{height:160px;}}'
    ].join('');
    var style = document.createElement('style');
    style.id = 'free-gift-chooser-styles';
    style.textContent = css;
    if (!document.getElementById(style.id)) document.head.appendChild(style);
  })();

  updateFreeGiftUI();

  var runs = 0;
  var interval = setInterval(function () {
    updateFreeGiftUI();
    if (++runs >= 4) clearInterval(interval);
  }, 2500);

  document.addEventListener('cart:updated', updateFreeGiftUI);
  document.addEventListener('theme:cart:updated', updateFreeGiftUI);

  (function observeAddedToCartModal() {
    var observer = new MutationObserver(function () {
      if (document.getElementById('added-to-cart')) {
        getCart().then(updateProgressBars);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  })();
})();
