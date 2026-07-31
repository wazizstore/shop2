/**
 * Bee Baby Head Protector — Order API
 * ------------------------------------
 * يستقبل طلبات POST من الفورم (Native Form POST إلى Hidden iframe)
 * ويرجع HtmlOutput صغيراً ينفذ postMessage إلى الصفحة الأم.
 */

var SPREADSHEET_ID = "1k1U86PtxqOCcutPHRGYbV65p9dLwn50SFm8-2A5L0J4";
var SHEET_NAME = "Orders";
var UNIT_PRICE = 149;
var PIXEL_SOURCE = "bee-order-api-v1";

// أعمدة الشيت (1-indexed)
var COL_NAME = 1;
var COL_PHONE = 2;
var COL_CITY = 3;
var COL_ADDRESS = 4;
var COL_PRODUCT = 5;
var COL_COLOR = 6;
var COL_SIZE = 7;
var COL_TOTAL = 8;
var COL_DATE = 9;
var COL_QUANTITY = 10;
var COL_ORDER_ID = 11;
var COL_UNIT_PRICE = 12;

function doPost(e) {
  var lock = LockService.getScriptLock();
  var lockAcquired = false;

  try {
    lockAcquired = lock.tryLock(10000);
    if (!lockAcquired) {
      return createIframeResponse({
        source: PIXEL_SOURCE,
        success: false,
        saved: false,
        orderId: (e && e.parameter && e.parameter.order_id) || "",
        message: "الخادم مشغول، حاول مرة أخرى"
      });
    }

    var data = (e && e.parameter) || {};
    var orderId = cleanValue(data.order_id);

    // ---------- التحقق الأساسي من المعلومات ----------
    var name = cleanValue(data.name);
    var phone = cleanValue(data.phone);
    var city = cleanValue(data.city);
    var address = cleanValue(data.address);
    // quantity هو الاسم الحالي. البدائل تحافظ على التوافق مع أي نسخة قديمة من الفورم.
    var quantityRaw = data.quantity || data.qty || data["الكمية"];

    if (!orderId || !name || !phone || !city || !address) {
      return createIframeResponse({
        source: PIXEL_SOURCE,
        success: false,
        saved: false,
        orderId: orderId || "",
        message: "معلومات ناقصة"
      });
    }

    var quantity = Number(quantityRaw);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return createIframeResponse({
        source: PIXEL_SOURCE,
        success: false,
        saved: false,
        orderId: orderId,
        message: "كمية غير صحيحة"
      });
    }

    // إعادة التحقق من رقم الهاتف المغربي
    if (!isValidMoroccanPhone(phone)) {
      return createIframeResponse({
        source: PIXEL_SOURCE,
        success: false,
        saved: false,
        orderId: orderId,
        message: "رقم هاتف غير صحيح"
      });
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }

    ensureHeaders(sheet);

    // ---------- التحقق من عدم تكرار order_id ----------
    var existingRow = findRowByOrderId(sheet, orderId);
    if (existingRow > 0) {
      // أصلح الكمية/السعر إذا كان الطلب قد سُجّل سابقاً بنسخة قديمة تركتهما فارغين.
      var savedQuantity = Number(sheet.getRange(existingRow, COL_QUANTITY).getValue());
      if (!Number.isInteger(savedQuantity) || savedQuantity < 1 || savedQuantity > 10) {
        savedQuantity = quantity;
        sheet.getRange(existingRow, COL_QUANTITY).setValue(savedQuantity);
      }

      var savedTotal = Number(sheet.getRange(existingRow, COL_TOTAL).getValue());
      if (!Number.isFinite(savedTotal) || savedTotal <= 0) {
        savedTotal = UNIT_PRICE * savedQuantity;
        sheet.getRange(existingRow, COL_TOTAL).setValue(savedTotal);
      }

      if (!sheet.getRange(existingRow, COL_UNIT_PRICE).getValue()) {
        sheet.getRange(existingRow, COL_UNIT_PRICE).setValue(UNIT_PRICE);
      }

      SpreadsheetApp.flush();

      return createIframeResponse({
        source: PIXEL_SOURCE,
        success: true,
        saved: true,
        duplicate: true,
        orderId: orderId,
        quantity: savedQuantity,
        total: savedTotal
      });
    }

    // احسب المجموع في السيرفر، لا تثق بالقيمة القادمة من المتصفح
    var total = UNIT_PRICE * quantity;

    sheet.appendRow([
      name,
      phone,
      city,
      address,
      "وسادة حماية رأس وظهر الطفل - النحلة",
      "أصفر",
      "قابل للتعديل",
      total,
      new Date(),
      quantity,
      orderId,
      UNIT_PRICE
    ]);

    SpreadsheetApp.flush();

    return createIframeResponse({
      source: PIXEL_SOURCE,
      success: true,
      saved: true,
      duplicate: false,
      orderId: orderId,
      quantity: quantity,
      total: total
    });
  } catch (err) {
    // لا تعرض تفاصيل حساسة للزبون
    var orderIdSafe = (e && e.parameter && cleanValue(e.parameter.order_id)) || "";
    return createIframeResponse({
      source: PIXEL_SOURCE,
      success: false,
      saved: false,
      orderId: orderIdSafe,
      message: "تعذر تسجيل الطلب"
    });
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}

function doGet(e) {
  return ContentService.createTextOutput(
    "Bee Order API is running."
  ).setMimeType(ContentService.MimeType.TEXT);
}

/**
 * ينشئ صفوف العناوين فقط إذا كانت الخلايا فارغة، بدون حذف أي بيانات موجودة.
 */
function ensureHeaders(sheet) {
  var headers = [
    ["A1", "الاسم"],
    ["B1", "الهاتف"],
    ["C1", "المدينة"],
    ["D1", "العنوان"],
    ["E1", "المنتج"],
    ["F1", "اللون"],
    ["G1", "المقاس"],
    ["H1", "المجموع"],
    ["I1", "التاريخ"],
    ["J1", "الكمية"],
    ["K1", "رقم الطلب"],
    ["L1", "سعر الوحدة"]
  ];

  headers.forEach(function (pair) {
    var range = sheet.getRange(pair[0]);
    if (!range.getValue()) {
      range.setValue(pair[1]);
    }
  });
}

/**
 * يبحث عن order_id داخل عمود K. يرجع رقم الصف إذا وجد، وإلا يرجع -1.
 */
function findRowByOrderId(sheet, orderId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var values = sheet.getRange(2, COL_ORDER_ID, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(orderId)) {
      return i + 2;
    }
  }
  return -1;
}

function cleanValue(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function isValidMoroccanPhone(cleanedPhone) {
  var local = /^0[67][0-9]{8}$/;
  var intl = /^\+212[67][0-9]{8}$/;
  return local.test(cleanedPhone) || intl.test(cleanedPhone);
}

/**
 * ينشئ HtmlOutput صغيراً يرسل postMessage إلى أعلى نافذة (صفحة المتجر).
 * Apps Script قد يضع الصفحة داخل iframe وسيط، لذلك window.parent قد يشير
 * إلى غلاف Google فقط ولا تصل الرسالة إلى المتجر. window.top يحل هذه الحالة.
 * يحمي البيانات من HTML injection عبر JSON.stringify واستبدال '<' بـ '\u003c'.
 */
function createIframeResponse(payload) {
  var safeJson = JSON.stringify(payload).replace(/</g, "\\u003c");

  var html =
    "<!doctype html><html><body>" +
    "<script>window.top.postMessage(" +
    safeJson +
    ', "*");</scr' +
    "ipt>" +
    "</body></html>";

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
