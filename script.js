(function () {
  'use strict';

  // =========================================================
  // إعدادات
  // =========================================================
  // رابط Google Apps Script المنشور كـ Web App.
  var GOOGLE_SHEETS_URL =
    'https://script.google.com/macros/s/AKfycbxmAevpMmwH96qzFe5SgQ9qN1bKKnZcVMWJ_I2FqvmeNW2IBEXE9Hp04kytOo20YST8/exec';

  var PRODUCT_PRICE = 149;
  var PRODUCT_NAME = 'وسادة حماية رأس وظهر الطفل — النحلة';
  var PRODUCT_ID = 'bee-baby-protector';

  // =========================================================
  // عناصر DOM
  // =========================================================
  var form = document.getElementById('order-form');
  var submitBtn = document.getElementById('submit-btn');
  var resultBox = document.getElementById('form-result');
  var stickyCta = document.getElementById('sticky-cta');
  var orderSection = document.querySelector('.order-section');

  var fields = {
    'full-name': {
      el: document.getElementById('full-name'),
      err: document.getElementById('err-full-name'),
      validate: function (v) {
        if (!v.trim()) return 'خاصك تكتب سميتك الكاملة.';
        if (v.trim().length < 3) return 'السمية قصيرة بزاف، تأكد منها.';
        return '';
      }
    },
    phone: {
      el: document.getElementById('phone'),
      err: document.getElementById('err-phone'),
      validate: function (v) {
        var clean = v.replace(/[\s-]/g, '');
        if (!clean) return 'خاصك تكتب رقم الهاتف ديالك.';
        var re = /^(?:\+212|0)[67]\d{8}$/;
        if (!re.test(clean)) return 'رقم الهاتف خاصو يبدا بـ06 أو 07 (ولا +212).';
        return '';
      }
    },
    city: {
      el: document.getElementById('city'),
      err: document.getElementById('err-city'),
      validate: function (v) {
        if (!v.trim()) return 'خاصك تكتب المدينة ديالك.';
        return '';
      }
    },
    address: {
      el: document.getElementById('address'),
      err: document.getElementById('err-address'),
      validate: function (v) {
        if (!v.trim()) return 'خاصك تكتب العنوان بالتفصيل.';
        if (v.trim().length < 6) return 'زيد شوية تفاصيل باش نوصلو ليك بسهولة.';
        return '';
      }
    }
  };

  var isSubmitting = false;
  var lastSubmittedOrderId = null;

  // =========================================================
  // Utility: توليد orderId فريد
  // =========================================================
  function generateOrderId() {
    var rand = Math.random().toString(36).slice(2, 10);
    var time = Date.now().toString(36);
    return 'ord_' + time + '_' + rand;
  }

  // =========================================================
  // التحقق من الحقول
  // =========================================================
  function validateField(name) {
    var f = fields[name];
    var msg = f.validate(f.el.value);
    f.err.textContent = msg;
    f.el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }

  function validateAll() {
    var ok = true;
    Object.keys(fields).forEach(function (name) {
      if (!validateField(name)) ok = false;
    });
    return ok;
  }

  Object.keys(fields).forEach(function (name) {
    var f = fields[name];
    f.el.addEventListener('blur', function () {
      validateField(name);
    });
    f.el.addEventListener('input', function () {
      if (f.el.getAttribute('aria-invalid') === 'true') {
        validateField(name);
      }
    });
  });

  // =========================================================
  // تنظيف بسيط للمدخلات قبل الإرسال
  // =========================================================
  function cleanInput(str) {
    return String(str).trim().slice(0, 500);
  }

  // =========================================================
  // حالة الزر (تحميل / تعطيل)
  // =========================================================
  function setLoading(loading) {
    isSubmitting = loading;
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('is-loading', loading);
    var label = submitBtn.querySelector('.btn-label');
    if (label) {
      label.textContent = loading
        ? 'جاري تسجيل الطلب…'
        : 'أكد طلبي الآن — 149 درهم فقط';
    }
  }

  function showResult(type, message) {
    resultBox.textContent = message;
    resultBox.className = 'form-result ' + type;
  }

  // =========================================================
  // Meta Pixel: Purchase (مرة واحدة لكل orderId)
  // =========================================================
  function trackPurchaseOnce(orderId) {
    if (!orderId || typeof window.fbq !== 'function') return;

    var storageKey = 'meta_purchase_tracked_' + orderId;

    try {
      if (localStorage.getItem(storageKey)) return;
    } catch (e) {
      // في حالة عدم توفر localStorage، نكمل بدون تخزين (احتياط فقط)
    }

    fbq(
      'track',
      'Purchase',
      {
        value: PRODUCT_PRICE,
        currency: 'MAD',
        content_name: PRODUCT_NAME,
        content_type: 'product',
        content_ids: [PRODUCT_ID]
      },
      {
        eventID: orderId
      }
    );

    try {
      localStorage.setItem(storageKey, '1');
    } catch (e) {
      /* ignore */
    }
  }

  // =========================================================
  // إرسال الطلب
  // =========================================================
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (isSubmitting) return;

    // Honeypot: إذا تعمرت، نتجاهلو الطلب بصمت (بوت غالبا)
    var honeypot = document.getElementById('website');
    if (honeypot && honeypot.value) {
      return;
    }

    if (!validateAll()) {
      var firstInvalid = Object.keys(fields).find(function (name) {
        return fields[name].el.getAttribute('aria-invalid') === 'true';
      });
      if (firstInvalid) fields[firstInvalid].el.focus();
      return;
    }

    var orderId = generateOrderId();

    // Google Apps Script كيقرا هاد القيم من e.parameter.
    var payload = new URLSearchParams();
    payload.append('orderId', orderId);
    payload.append('name', cleanInput(fields['full-name'].el.value));
    payload.append('phone', cleanInput(fields.phone.el.value));
    payload.append('city', cleanInput(fields.city.el.value));
    payload.append('address', cleanInput(fields.address.el.value));
    payload.append('product', PRODUCT_NAME);
    payload.append('color', '');
    payload.append('size', '');
    payload.append('total', PRODUCT_PRICE + ' درهم');
    payload.append('price', String(PRODUCT_PRICE));
    payload.append('currency', 'MAD');
    payload.append('delivery', 'مجاني');
    payload.append('payment', 'عند الاستلام');
    payload.append('createdAt', new Date().toISOString());

    setLoading(true);
    showResult('', '');

    fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: payload.toString()
    })
      .then(function () {
        setLoading(false);
        lastSubmittedOrderId = orderId;
        showResult('success', 'تم تسجيل طلبك بنجاح ✅ غادي نتاصلو بيك فالقريب باش نأكدوه.');
        trackPurchaseOnce(orderId);
        form.reset();
        Object.keys(fields).forEach(function (name) {
          fields[name].err.textContent = '';
          fields[name].el.setAttribute('aria-invalid', 'false');
        });
      })
      .catch(function () {
        setLoading(false);
        showResult('error', 'وقع مشكل أثناء تسجيل الطلب. تأكد من الإنترنت وحاول مرة أخرى.');
      });
  });

  // =========================================================
  // أزرار CTA: الرجوع لنموذج الطلب
  // =========================================================
  function focusFirstEmptyField() {
    var order = ['full-name', 'phone', 'city', 'address'];
    for (var i = 0; i < order.length; i++) {
      var f = fields[order[i]];
      if (!f.el.value.trim()) {
        f.el.focus();
        return;
      }
    }
    // إذا كلشي معمر، نركزو على الاسم
    fields['full-name'].el.focus();
  }

  document.querySelectorAll('.cta-to-form').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      form.scrollIntoView({
        behavior: prefersReduced ? 'auto' : 'smooth',
        block: 'start'
      });
      window.setTimeout(focusFirstEmptyField, prefersReduced ? 0 : 350);
    });
  });

  // =========================================================
  // Sticky CTA: يظهر فقط بعد تجاوز نموذج الطلب
  // ويختفي إذا كان الفورم ظاهر على الشاشة
  // =========================================================
  if ('IntersectionObserver' in window && orderSection) {
    var passedForm = false;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var rect = entry.boundingClientRect;
          var scrolledPast = rect.bottom < 0;

          if (entry.isIntersecting) {
            // الفورم ظاهر على الشاشة -> نخبيو الزر
            stickyCta.hidden = true;
            stickyCta.classList.remove('is-visible');
            passedForm = true;
          } else if (scrolledPast || passedForm) {
            // تجاوزنا الفورم -> نبينو الزر
            passedForm = true;
            stickyCta.hidden = false;
            stickyCta.classList.add('is-visible');
          } else {
            stickyCta.hidden = true;
          }
        });
      },
      { threshold: 0 }
    );

    observer.observe(orderSection);
  }
})();
