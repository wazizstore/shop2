/**
 * api/order.js
 * -----------------------------------------------------------
 * نسخة بديلة من الـ Backend، مخصصة للاستضافات اللي كتدعم
 * Serverless Functions بـ Node.js (مثلاً Vercel).
 *
 * إذا كانت الاستضافة Static فقط (بدون Backend)، استعمل
 * telegram-worker.js (Cloudflare Worker) بدل هاد الملف.
 *
 * Environment Variables المطلوبة (Secrets، ماشي داخل الكود):
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID   (اختياري، الافتراضي 6781508116)
 *   ALLOWED_ORIGIN
 * -----------------------------------------------------------
 */

const DEFAULT_CHAT_ID = '6781508116';

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

  if (body.website) errors.push('طلب مرفوض.');

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

module.exports = async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'الطريقة غير مسموحة.' });
    return;
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    res.status(400).json({ success: false, error: 'الطلب خاصو يكون بصيغة JSON.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      res.status(400).json({ success: false, error: 'تعذر قراءة بيانات الطلب.' });
      return;
    }
  }

  const errors = validateOrder(body);
  if (errors.length) {
    res.status(400).json({ success: false, error: errors.join(' ') });
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || DEFAULT_CHAT_ID;

  if (!botToken) {
    res.status(500).json({ success: false, error: 'الخادم غير مهيأ بعد. تواصل مع الدعم.' });
    return;
  }

  const orderId = String(body.orderId || generateOrderId());
  const dateStr = formatMoroccoDate(new Date());

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
        body: JSON.stringify({ chat_id: chatId, text: message })
      }
    );

    const tgResult = await tgResponse.json();

    if (!tgResponse.ok || !tgResult.ok) {
      res.status(502).json({ success: false, error: 'تعذر إرسال الطلب. حاول مرة أخرى.' });
      return;
    }

    res.status(200).json({ success: true, orderId });
  } catch (e) {
    res.status(502).json({ success: false, error: 'تعذر الاتصال بخدمة الإشعارات. حاول مرة أخرى.' });
  }
};
