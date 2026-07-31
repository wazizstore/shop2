(function () {
  "use strict";

  // ---------- إعدادات ثابتة ----------
  var UNIT_PRICE = 149;
  var MIN_QTY = 1;
  var MAX_QTY = 10;
  var PIXEL_SOURCE = "bee-order-api-v1";
  var CONFIRM_TIMEOUT_MS = 15000; // مهلة معقولة لانتظار تأكيد Apps Script

  // ---------- عناصر DOM ----------
  var form = document.getElementById("order-form");
  var qtyInput = document.getElementById("quantity");
  var qtyMinusBtn = document.getElementById("qty-minus");
  var qtyPlusBtn = document.getElementById("qty-plus");
  var totalLine = document.getElementById("total-line");
  var totalHidden = document.getElementById("total-hidden");
  var orderIdHidden = document.getElementById("order-id-hidden");
  var submitBtn = document.getElementById("submit-btn");
  var submitMessage = document.getElementById("submit-message");
  var successPanel = document.getElementById("success-panel");
  var successQty = document.getElementById("success-qty");
  var successTotal = document.getElementById("success-total");
  var responseFrame = document.getElementById("order-response-frame");
  var finalCtaBtn = document.getElementById("final-cta-btn");
  var stickyBar = document.getElementById("sticky-bar");
  var stickyCtaBtn = document.getElementById("sticky-cta-btn");
  var orderSection = document.getElementById("order-section");

  var fieldIds = ["fullName", "city", "phone", "address"];

  // ---------- حالة الطلب ----------
  var isSubmitting = false;
  var pendingOrderId = null;
  var pendingQuantity = MIN_QTY;
  var pendingTotal = UNIT_PRICE;
  var confirmTimeoutHandle = null;

  var confirmedOrderIds = loadSetFromStorage("bee_confirmed_order_ids");
  var purchaseTrackedOrderIds = loadSetFromStorage("bee_purchase_tracked_order_ids");

  // ---------- تخزين آمن ----------
  function loadSetFromStorage(key) {
    try {
      var raw = sessionStorage.getItem(key);
      if (!raw) return new Set();
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
      return new Set();
    } catch (e) {
      return new Set();
    }
  }

  function saveSetToStorage(key, set) {
    try {
      sessionStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch (e) {
      /* تجاهل الخطأ إذا كان sessionStorage غير متاح */
    }
  }

  // ---------- توليد معرف فريد للطلب ----------
  function generateOrderId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
    } catch (e) {
      /* fallback بالأسفل */
    }
    // Fallback آمن للمتصفحات القديمة
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ---------- الكمية والمجموع ----------
  function getQuantity() {
    var v = parseInt(qtyInput.value, 10);
    if (isNaN(v)) return MIN_QTY;
    if (v < MIN_QTY) return MIN_QTY;
    if (v > MAX_QTY) return MAX_QTY;
    return v;
  }

  function updateTotalsDisplay() {
    var qty = getQuantity();
    var total = UNIT_PRICE * qty;
    totalLine.textContent = UNIT_PRICE + " درهم × " + qty + " = " + total + " درهم";
    totalHidden.value = String(total);
    submitBtn.textContent = "أكد الطلب — " + total + " درهم";
    qtyMinusBtn.disabled = qty <= MIN_QTY;
    qtyPlusBtn.disabled = qty >= MAX_QTY;
  }

  qtyMinusBtn.addEventListener("click", function () {
    if (isSubmitting) return;
    var qty = getQuantity();
    if (qty > MIN_QTY) {
      qtyInput.value = String(qty - 1);
      updateTotalsDisplay();
    }
  });

  qtyPlusBtn.addEventListener("click", function () {
    if (isSubmitting) return;
    var qty = getQuantity();
    if (qty < MAX_QTY) {
      qtyInput.value = String(qty + 1);
      updateTotalsDisplay();
    }
  });

  updateTotalsDisplay();

  // ---------- تنظيف رقم الهاتف ----------
  function cleanPhone(raw) {
    return String(raw || "").replace(/[\s\-().]/g, "");
  }

  function isValidMoroccanPhone(cleaned) {
    // يقبل 06XXXXXXXX / 07XXXXXXXX أو +2126XXXXXXXX / +2127XXXXXXXX
    var localPattern = /^0[67][0-9]{8}$/;
    var intlPattern = /^\+212[67][0-9]{8}$/;
    return localPattern.test(cleaned) || intlPattern.test(cleaned);
  }

  // ---------- رسائل الخطأ ----------
  function setFieldError(id, message) {
    var errEl = document.getElementById(id + "-error");
    var inputEl = document.getElementById(id);
    if (errEl) errEl.textContent = message || "";
    if (inputEl) {
      if (message) inputEl.setAttribute("aria-invalid", "true");
      else inputEl.removeAttribute("aria-invalid");
    }
  }

  function clearAllErrors() {
    fieldIds.forEach(function (id) {
      setFieldError(id, "");
    });
    submitMessage.textContent = "";
  }

  // ---------- التحقق من المعلومات ----------
  function validateForm() {
    var valid = true;

    var name = document.getElementById("fullName").value.trim();
    if (!name) {
      setFieldError("fullName", "خاصك تكتب الاسم الكامل");
      valid = false;
    } else {
      setFieldError("fullName", "");
    }

    var city = document.getElementById("city").value.trim();
    if (!city) {
      setFieldError("city", "خاصك تكتب المدينة");
      valid = false;
    } else {
      setFieldError("city", "");
    }

    var phoneRaw = document.getElementById("phone").value;
    var cleaned = cleanPhone(phoneRaw);
    if (!cleaned) {
      setFieldError("phone", "خاصك تكتب رقم الهاتف");
      valid = false;
    } else if (!isValidMoroccanPhone(cleaned)) {
      setFieldError("phone", "الرقم خاصو يبدا ب 06 أو 07 أو +212 وياخد 9 أرقام من بعد");
      valid = false;
    } else {
      setFieldError("phone", "");
    }

    var address = document.getElementById("address").value.trim();
    if (!address) {
      setFieldError("address", "خاصك تكتب العنوان بالتفصيل");
      valid = false;
    } else {
      setFieldError("address", "");
    }

    var qty = getQuantity();
    if (!Number.isInteger(qty) || qty < MIN_QTY || qty > MAX_QTY) {
      submitMessage.textContent = "الكمية خاصها تكون بين 1 و 10";
      valid = false;
    }

    return { valid: valid, cleanedPhone: cleaned, name: name, city: city, address: address, quantity: qty };
  }

  // ---------- تفعيل / تعطيل عناصر التحكم ----------
  function setControlsDisabled(disabled) {
    submitBtn.disabled = disabled;
    qtyMinusBtn.disabled = disabled || getQuantity() <= MIN_QTY;
    qtyPlusBtn.disabled = disabled || getQuantity() >= MAX_QTY;
  }

  // ---------- إرسال الفورم ----------
  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (isSubmitting) return; // منع الضغط المزدوج

    clearAllErrors();
    var result = validateForm();
    if (!result.valid) {
      return;
    }

    isSubmitting = true;
    setControlsDisabled(true);
    submitBtn.textContent = "جاري تأكيد الطلب...";
    submitMessage.textContent = "";

    // لا تنشئ order_id جديداً إذا كانت هذه إعادة محاولة لنفس الطلب المعلق
    if (!pendingOrderId) {
      pendingOrderId = generateOrderId();
    }
    pendingQuantity = result.quantity;
    pendingTotal = UNIT_PRICE * result.quantity;

    orderIdHidden.value = pendingOrderId;
    totalHidden.value = String(pendingTotal);

    // إعادة تعبئة الحقول المخفية بالقيم المنظفة
    document.getElementById("phone").value = result.cleanedPhone;

    // مهلة الانتظار: إذا لم يصل التأكيد، أعد تفعيل الزر بدون إنشاء order_id جديد
    if (confirmTimeoutHandle) clearTimeout(confirmTimeoutHandle);
    confirmTimeoutHandle = setTimeout(function () {
      if (isSubmitting) {
        isSubmitting = false;
        setControlsDisabled(false);
        submitBtn.textContent = "أكد الطلب — " + pendingTotal + " درهم";
        submitMessage.textContent = "تعذر علينا تأكيد تسجيل الطلب. تأكد من الإنترنت وحاول مرة أخرى.";
      }
    }, CONFIRM_TIMEOUT_MS);

    // إرسال Native Form POST إلى Hidden iframe
    form.submit();
  });

  // ---------- استقبال رسالة Apps Script عبر postMessage ----------
  window.addEventListener("message", function (event) {
    // تحقق من مصدر الرسالة: نفس iframe المخفي
    if (event.source !== responseFrame.contentWindow) return;

    // تحقق من أصل الرسالة (نطاق Google Apps Script)
    var origin = event.origin || "";
    var isGoogleOrigin =
      origin.indexOf("googleusercontent.com") !== -1 ||
      origin.indexOf("script.google.com") !== -1;
    if (!isGoogleOrigin) return;

    var data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.source !== PIXEL_SOURCE) return;
    if (!pendingOrderId || data.orderId !== pendingOrderId) return;

    // وصلت رسالة تخص طلبنا الحالي
    if (confirmTimeoutHandle) {
      clearTimeout(confirmTimeoutHandle);
      confirmTimeoutHandle = null;
    }

    if (data.success === true && data.saved === true) {
      handleConfirmedOrder(data.orderId);
    } else {
      // فشل حقيقي من السيرفر
      isSubmitting = false;
      setControlsDisabled(false);
      submitBtn.textContent = "أكد الطلب — " + pendingTotal + " درهم";
      submitMessage.textContent = "تعذر تسجيل الطلب. حاول مرة أخرى من فضلك.";
    }
  });

  // ---------- معالجة تأكيد ناجح (يشمل حالة duplicate) ----------
  function handleConfirmedOrder(orderId) {
    // إذا سبق تأكيد نفس الطلب، لا تكرر عرض النجاح ولا تكرر Purchase
    if (confirmedOrderIds.has(orderId)) {
      isSubmitting = false;
      return;
    }
    confirmedOrderIds.add(orderId);
    saveSetToStorage("bee_confirmed_order_ids", confirmedOrderIds);

    isSubmitting = false;

    // إخفاء الفورم وعرض رسالة النجاح
    form.hidden = true;
    successPanel.hidden = false;
    successQty.textContent = String(pendingQuantity);
    successTotal.textContent = String(pendingTotal);

    fireMetaPurchase(orderId, pendingQuantity, pendingTotal);
  }

  // ---------- إطلاق Meta Pixel Purchase مرة واحدة فقط ----------
  function fireMetaPurchase(confirmedOrderId, confirmedQuantity, confirmedTotalIgnored) {
    if (purchaseTrackedOrderIds.has(confirmedOrderId)) return;

    var purchaseValue = UNIT_PRICE * confirmedQuantity;

    // ضع orderId في Set قبل استدعاء fbq لمنع أي تكرار متزامن
    purchaseTrackedOrderIds.add(confirmedOrderId);
    saveSetToStorage("bee_purchase_tracked_order_ids", purchaseTrackedOrderIds);

    if (typeof fbq === "function") {
      fbq(
        "track",
        "Purchase",
        {
          value: purchaseValue,
          currency: "MAD",
          content_name: "وسادة حماية رأس وظهر الطفل - النحلة",
          content_type: "product",
          content_ids: ["bee-baby-head-protector"],
          num_items: confirmedQuantity
        },
        {
          eventID: confirmedOrderId
        }
      );
    }
  }

  // ---------- أزرار CTA: تنقل فقط ولا ترسل ولا تطلق Purchase ----------
  function scrollToOrderSection() {
    orderSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  finalCtaBtn.addEventListener("click", scrollToOrderSection);
  stickyCtaBtn.addEventListener("click", scrollToOrderSection);

  // ---------- شريط الطلب الثابت: يظهر عندما يخرج الفورم عن الشاشة ----------
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          stickyBar.hidden = entry.isIntersecting;
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(orderSection);
  }
})();
