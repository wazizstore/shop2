(function () {
  "use strict";

  // ---------- إعدادات ثابتة ----------
  var UNIT_PRICE = 179;
  var MIN_QTY = 1;
  var MAX_QTY = 10;
  var PIXEL_SOURCE = "bee-order-api-v1";
  var CONFIRM_TIMEOUT_MS = 30000;

  // ---------- عناصر الصفحة ----------
  var form = document.getElementById("order-form");
  var qtyInput = document.getElementById("quantity");
  var qtyHidden = document.getElementById("quantity-hidden");
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
  var finalCtaBtn = document.getElementById("final-cta-btn");
  var stickyBar = document.getElementById("sticky-bar");
  var stickyCtaBtn = document.getElementById("sticky-cta-btn");
  var orderSection = document.getElementById("order-section");

  // التوافق مع نسخة HTML القديمة
  if (!qtyHidden) {
    qtyHidden = document.createElement("input");
    qtyHidden.type = "hidden";
    qtyHidden.name = "quantity";
    qtyHidden.id = "quantity-hidden";
    qtyHidden.value = "1";
    form.appendChild(qtyHidden);
  }

  // منع إرسال quantity مرتين
  qtyInput.removeAttribute("name");

  var fieldIds = ["fullName", "city", "phone", "address"];

  // ---------- حالة الطلب ----------
  var isSubmitting = false;
  var pendingOrderId = null;
  var pendingQuantity = MIN_QTY;
  var pendingTotal = UNIT_PRICE;
  var confirmTimeoutHandle = null;

  var confirmedOrderIds = loadSetFromStorage(
    "bee_confirmed_order_ids"
  );

  var purchaseTrackedOrderIds = loadSetFromStorage(
    "bee_purchase_tracked_order_ids"
  );

  // ---------- التخزين ----------
  function loadSetFromStorage(key) {
    try {
      var raw = sessionStorage.getItem(key);

      if (!raw) {
        return new Set();
      }

      var arr = JSON.parse(raw);

      if (Array.isArray(arr)) {
        return new Set(arr);
      }

      return new Set();
    } catch (e) {
      return new Set();
    }
  }

  function saveSetToStorage(key, set) {
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify(Array.from(set))
      );
    } catch (e) {
      // تجاهل الخطأ إذا كان التخزين غير متاح
    }
  }

  // ---------- إنشاء رقم فريد للطلب ----------
  function generateOrderId() {
    try {
      if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
      ) {
        return window.crypto.randomUUID();
      }
    } catch (e) {
      // استعمال الطريقة الاحتياطية
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        var r = (Math.random() * 16) | 0;
        var v =
          c === "x"
            ? r
            : (r & 0x3) | 0x8;

        return v.toString(16);
      }
    );
  }

  // ---------- الكمية والمجموع ----------
  function getQuantity() {
    var value = parseInt(qtyInput.value, 10);

    if (isNaN(value)) {
      return MIN_QTY;
    }

    if (value < MIN_QTY) {
      return MIN_QTY;
    }

    if (value > MAX_QTY) {
      return MAX_QTY;
    }

    return value;
  }

  function updateTotalsDisplay() {
    var quantity = getQuantity();
    var total = UNIT_PRICE * quantity;

    qtyHidden.value = String(quantity);
    totalHidden.value = String(total);

    totalLine.textContent =
      UNIT_PRICE +
      " درهم × " +
      quantity +
      " = " +
      total +
      " درهم";

    submitBtn.textContent =
      "أكد الطلب — " + total + " درهم";

    qtyMinusBtn.disabled =
      quantity <= MIN_QTY;

    qtyPlusBtn.disabled =
      quantity >= MAX_QTY;
  }

  qtyMinusBtn.addEventListener("click", function () {
    if (isSubmitting) {
      return;
    }

    var quantity = getQuantity();

    if (quantity > MIN_QTY) {
      qtyInput.value = String(quantity - 1);
      updateTotalsDisplay();
    }
  });

  qtyPlusBtn.addEventListener("click", function () {
    if (isSubmitting) {
      return;
    }

    var quantity = getQuantity();

    if (quantity < MAX_QTY) {
      qtyInput.value = String(quantity + 1);
      updateTotalsDisplay();
    }
  });

  updateTotalsDisplay();

  // ---------- تنظيف رقم الهاتف ----------
  function cleanPhone(raw) {
    return String(raw || "").replace(
      /[\s\-().]/g,
      ""
    );
  }

  function isValidMoroccanPhone(phone) {
    var localPattern =
      /^0[67][0-9]{8}$/;

    var internationalPattern =
      /^\+212[67][0-9]{8}$/;

    return (
      localPattern.test(phone) ||
      internationalPattern.test(phone)
    );
  }

  // ---------- رسائل الأخطاء ----------
  function setFieldError(id, message) {
    var errorElement =
      document.getElementById(id + "-error");

    var inputElement =
      document.getElementById(id);

    if (errorElement) {
      errorElement.textContent =
        message || "";
    }

    if (inputElement) {
      if (message) {
        inputElement.setAttribute(
          "aria-invalid",
          "true"
        );
      } else {
        inputElement.removeAttribute(
          "aria-invalid"
        );
      }
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

    var name =
      document
        .getElementById("fullName")
        .value.trim();

    var city =
      document
        .getElementById("city")
        .value.trim();

    var phoneRaw =
      document
        .getElementById("phone")
        .value;

    var phone = cleanPhone(phoneRaw);

    var address =
      document
        .getElementById("address")
        .value.trim();

    var quantity = getQuantity();

    if (!name) {
      setFieldError(
        "fullName",
        "خاصك تكتب الاسم الكامل"
      );

      valid = false;
    } else {
      setFieldError("fullName", "");
    }

    if (!city) {
      setFieldError(
        "city",
        "خاصك تكتب المدينة"
      );

      valid = false;
    } else {
      setFieldError("city", "");
    }

    if (!phone) {
      setFieldError(
        "phone",
        "خاصك تكتب رقم الهاتف"
      );

      valid = false;
    } else if (!isValidMoroccanPhone(phone)) {
      setFieldError(
        "phone",
        "الرقم خاصو يبدا بـ06 أو 07 أو +212"
      );

      valid = false;
    } else {
      setFieldError("phone", "");
    }

    if (!address) {
      setFieldError(
        "address",
        "خاصك تكتب العنوان بالتفصيل"
      );

      valid = false;
    } else {
      setFieldError("address", "");
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < MIN_QTY ||
      quantity > MAX_QTY
    ) {
      submitMessage.textContent =
        "الكمية خاصها تكون بين 1 و10";

      valid = false;
    }

    return {
      valid: valid,
      phone: phone,
      quantity: quantity
    };
  }

  // ---------- تعطيل أزرار الفورم ----------
  function setControlsDisabled(disabled) {
    submitBtn.disabled = disabled;

    qtyMinusBtn.disabled =
      disabled ||
      getQuantity() <= MIN_QTY;

    qtyPlusBtn.disabled =
      disabled ||
      getQuantity() >= MAX_QTY;
  }

  // ---------- إرسال الطلب ----------
  form.addEventListener(
    "submit",
    function (event) {
      event.preventDefault();

      if (isSubmitting) {
        return;
      }

      clearAllErrors();

      var result = validateForm();

      if (!result.valid) {
        return;
      }

      isSubmitting = true;
      setControlsDisabled(true);

      submitBtn.textContent =
        "جاري تأكيد الطلب...";

      submitMessage.textContent = "";

      if (!pendingOrderId) {
        pendingOrderId =
          generateOrderId();
      }

      pendingQuantity =
        result.quantity;

      pendingTotal =
        UNIT_PRICE *
        pendingQuantity;

      orderIdHidden.value =
        pendingOrderId;

      qtyHidden.value =
        String(pendingQuantity);

      totalHidden.value =
        String(pendingTotal);

      document.getElementById(
        "phone"
      ).value = result.phone;

      if (confirmTimeoutHandle) {
        clearTimeout(
          confirmTimeoutHandle
        );
      }

      confirmTimeoutHandle =
        setTimeout(function () {
          if (isSubmitting) {
            isSubmitting = false;

            setControlsDisabled(false);

            submitBtn.textContent =
              "أكد الطلب — " +
              pendingTotal +
              " درهم";

            submitMessage.textContent =
              "تعذر علينا تأكيد تسجيل الطلب. حاول مرة أخرى.";
          }
        }, CONFIRM_TIMEOUT_MS);

      // إرسال الفورم إلى Google Apps Script
      form.submit();
    }
  );

  // ---------- استقبال تأكيد Google ----------
  window.addEventListener(
    "message",
    function (event) {
      var origin =
        event.origin || "";

      var isGoogleOrigin =
        /^https:\/\/([a-z0-9-]+\.)*googleusercontent\.com$/i.test(
          origin
        ) ||
        origin ===
          "https://script.google.com";

      if (!isGoogleOrigin) {
        return;
      }

      var data = event.data;

      if (
        !data ||
        typeof data !== "object"
      ) {
        return;
      }

      if (
        data.source !== PIXEL_SOURCE
      ) {
        return;
      }

      if (
        !pendingOrderId ||
        data.orderId !== pendingOrderId
      ) {
        return;
      }

      if (confirmTimeoutHandle) {
        clearTimeout(
          confirmTimeoutHandle
        );

        confirmTimeoutHandle = null;
      }

      if (
        data.success === true &&
        data.saved === true
      ) {
        handleConfirmedOrder(
          data.orderId,
          data.quantity,
          data.total
        );
      } else {
        isSubmitting = false;

        setControlsDisabled(false);

        submitBtn.textContent =
          "أكد الطلب — " +
          pendingTotal +
          " درهم";

        submitMessage.textContent =
          "تعذر تسجيل الطلب. حاول مرة أخرى من فضلك.";
      }
    }
  );

  // ---------- الطلب المؤكد ----------
  function handleConfirmedOrder(
    orderId,
    serverQuantity,
    serverTotal
  ) {
    if (
      confirmedOrderIds.has(orderId)
    ) {
      isSubmitting = false;
      return;
    }

    confirmedOrderIds.add(orderId);

    saveSetToStorage(
      "bee_confirmed_order_ids",
      confirmedOrderIds
    );

    isSubmitting = false;

    var confirmedQuantity =
      parseInt(serverQuantity, 10);

    if (
      !Number.isInteger(
        confirmedQuantity
      ) ||
      confirmedQuantity < MIN_QTY ||
      confirmedQuantity > MAX_QTY
    ) {
      confirmedQuantity =
        pendingQuantity;
    }

    var confirmedTotal =
      Number(serverTotal);

    if (
      !Number.isFinite(
        confirmedTotal
      ) ||
      confirmedTotal !==
        UNIT_PRICE *
          confirmedQuantity
    ) {
      confirmedTotal =
        UNIT_PRICE *
        confirmedQuantity;
    }

    form.hidden = true;
    successPanel.hidden = false;

    successQty.textContent =
      String(confirmedQuantity);

    successTotal.textContent =
      String(confirmedTotal);

    fireMetaPurchase(
      orderId,
      confirmedQuantity
    );
  }

  // ---------- Meta Pixel Purchase ----------
  function fireMetaPurchase(
    orderId,
    quantity
  ) {
    if (
      purchaseTrackedOrderIds.has(
        orderId
      )
    ) {
      return;
    }

    var purchaseValue =
      UNIT_PRICE * quantity;

    purchaseTrackedOrderIds.add(
      orderId
    );

    saveSetToStorage(
      "bee_purchase_tracked_order_ids",
      purchaseTrackedOrderIds
    );

    if (
      typeof window.fbq ===
      "function"
    ) {
      window.fbq(
        "track",
        "Purchase",
        {
          value: purchaseValue,
          currency: "MAD",
          content_name:
            "وسادة حماية رأس وظهر الطفل - النحلة",
          content_type: "product",
          content_ids: [
            "bee-baby-head-protector"
          ],
          num_items: quantity
        },
        {
          eventID: orderId
        }
      );
    }
  }

  // ---------- أزرار الطلب ----------
  function scrollToOrderSection() {
    orderSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  finalCtaBtn.addEventListener(
    "click",
    scrollToOrderSection
  );

  stickyCtaBtn.addEventListener(
    "click",
    scrollToOrderSection
  );

  // ---------- شريط الطلب الثابت ----------
  if (
    "IntersectionObserver" in window
  ) {
    var observer =
      new IntersectionObserver(
        function (entries) {
          entries.forEach(
            function (entry) {
              stickyBar.hidden =
                entry.isIntersecting;
            }
          );
        },
        {
          threshold: 0.15
        }
      );

    observer.observe(orderSection);
  }
})();
