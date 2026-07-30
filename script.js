(function () {
  'use strict';

  // =========================================================
  // إعدادات
  // =========================================================
  // رابط الـ Backend (Cloudflare Worker) المسؤول عن إرسال الطلب إلى Telegram.
  // بدّل هاد الرابط برابط الـ Worker ديالك بعد النشر.
  var ORDER_API_URL = 'https://your-worker-subdomain.workers.dev/api/order';

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
  // تنظيف المدخلات (منع حقن HTML/JS)
  // =========================================================
  function sanitize(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .trim();
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

    var payload = {
      orderId: orderId,
      fullName: sanitize(fields['full-name'].el.value),
      phone: sanitize(fields.phone.el.value),
      city: sanitize(fields.city.el.value),
      address: sanitize(fields.address.el.value),
      product: PRODUCT_NAME,
      price: PRODUCT_PRICE,
      currency: 'MAD',
      delivery: 'مجاني',
      payment: 'عند الاستلام',
      createdAt: new Date().toISOString()
    };

    setLoading(true);
    showResult('', '');

    fetch(ORDER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (result) {
            return { ok: response.ok, result: result };
          });
      })
      .then(function (data) {
        setLoading(false);

        if (data.ok && data.result && data.result.success === true && data.result.orderId) {
          lastSubmittedOrderId = data.result.orderId;
          showResult('success', 'تم تسجيل طلبك بنجاح ✅ غادي نتاصلو بيك فالقريب باش نأكدوه.');
          trackPurchaseOnce(data.result.orderId);
          form.reset();
          Object.keys(fields).forEach(function (name) {
            fields[name].err.textContent = '';
            fields[name].el.setAttribute('aria-invalid', 'false');
          });
        } else {
          showResult('error', 'وقع مشكل أثناء تسجيل الطلب. تأكد من الإنترنت وحاول مرة أخرى.');
        }
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
