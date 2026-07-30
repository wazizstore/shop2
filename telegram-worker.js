/**
 * telegram-worker.js
 * -----------------------------------------------------------
 * Cloudflare Worker آمن لاستقبال طلبات الزبائن وإرسالها إلى Telegram.
 *
 * Environment Variables المطلوبة (تُضاف كـ Secrets، وليس داخل الكود):
 *   TELEGRAM_BOT_TOKEN   -> توكن البوت (سري، ما كيبانش فالواجهة)
 *   TELEGRAM_CHAT_ID     -> اختياري، الافتراضي 6781508116
 *   ALLOWED_ORIGIN       -> دومين المتجر المسموح له بإرسال الطلبات
 *
 * النشر (باستعمال wrangler):
 *   wrangler secret put TELEGRAM_BOT_TOKEN
 *   wrangler secret put TELEGRAM_CHAT_ID        (اختياري)
 *   wrangler secret put ALLOWED_ORIGIN
 *   wrangler deploy
 * -----------------------------------------------------------
 */

const DEFAULT_CHAT_ID = '6781508116';

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin'
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return json({ success: false, error: 'الطريقة غير مسموحة.' }, 405, corsHeaders);
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return json({ success: false, error: 'الطلب خاصو يكون بصيغة JSON.' }, 400, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ success: false, error: 'تعذر قراءة بيانات الطلب.' }, 400, corsHeaders);
    }

    // ---- تحقق من الحقول من جديد داخل الخادم ----
    const errors = validateOrder(body);
    if (errors.length) {
      return json({ success: false, error: errors.join(' ') }, 400, corsHeaders);
    }

    const botToken = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID || DEFAULT_CHAT_ID;

    if (!botToken) {
      return json(
        { success: false, error: 'الخادم غير مهيأ بعد. تواصل مع الدعم.' },
        500,
        corsHeaders
      );
    }

    const orderId = String(body.orderId || generateOrderId());
    const now = new Date();
    const dateStr = formatMoroccoDate(now);

    const message =
      '🛒 طلب جديد — وسادة حماية الطفل\n\n' +
      `👤 الاسم: ${sanitize(body.fullName)}\n\n` +
      `📞 الهاتف: ${sanitize(body.phone)}\n\n` +
      `🏙️ المدينة: ${sanitize(body.city)}\n\n` +
      `📍 العنوان: ${sanitize(body.address)}\n\n` +
      '📦 المنتج: وسادة حماية رأس وظهر الطفل — النحلة\n\n' +
      '💰 الثمن: 149 درهم\n\n' +
      '🚚 التوصيل: مجاني\n\n' +
      '💵 الدفع: عند الاستلام\n\n' +
      `🕒 التاريخ والوقت: ${dateStr}`;

    try {
      const tgResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message
          })
        }
      );

      const tgResult = await tgResponse.json();

      if (!tgResponse.ok || !tgResult.ok) {
        // لا نطبع أو نُرجع تفاصيل حساسة للزائر
        return json(
          { success: false, error: 'تعذر إرسال الطلب. حاول مرة أخرى.' },
          502,
          corsHeaders
        );
      }

      return json({ success: true, orderId }, 200, corsHeaders);
    } catch (e) {
      return json(
        { success: false, error: 'تعذر الاتصال بخدمة الإشعارات. حاول مرة أخرى.' },
        502,
        corsHeaders
      );
    }
  }
};

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {})
  });
}

function sanitize(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim()
    .slice(0, 500);
}

function validateOrder(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    errors.push('بيانات الطلب غير صالحة.');
    return errors;
  }

  const fullName = String(body.fullName || '').trim();
  const phone = String(body.phone || '').trim().replace(/[\s-]/g, '');
  const city = String(body.city || '').trim();
  const address = String(body.address || '').trim();

  if (fullName.length < 3) errors.push('الاسم الكامل غير صحيح.');
  if (!/^(?:\+212|0)[67]\d{8}$/.test(phone)) errors.push('رقم الهاتف غير صحيح.');
  if (city.length < 2) errors.push('المدينة غير صحيحة.');
  if (address.length < 6) errors.push('العنوان غير كافٍ.');

  // Honeypot check إذا تم إرساله من الواجهة
  if (body.website) {
    errors.push('طلب مرفوض.');
  }

  return errors;
}

function generateOrderId() {
  return 'ord_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function formatMoroccoDate(date) {
  try {
    return new Intl.DateTimeFormat('ar-MA', {
      timeZone: 'Africa/Casablanca',
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  } catch (e) {
    return date.toISOString();
  }
}
