# وسادة حماية رأس وظهر الطفل — النحلة | Landing Page

صفحة بيع مباشر (Landing Page) للمنتج، مصممة Mobile First وRTL، بثمن **149 درهم**، التوصيل مجاني والدفع عند الاستلام. مبنية بـ HTML/CSS/JS خفيفة بدون Frameworks، مع Backend آمن (Cloudflare Worker) لإرسال الطلبات إلى Telegram، وتتبع Meta Pixel لحدث الشراء بعد التأكيد فقط.

## 📁 بنية المشروع

```
project/
├── index.html              الصفحة الرئيسية
├── style.css                التصميم
├── script.js                 المنطق: التحقق، الإرسال، CTA، Sticky bar، Pixel
├── telegram-worker.js        Backend (Cloudflare Worker) — الخيار الأساسي للاستضافة Static
├── api/order.js              Backend بديل (Node/Vercel) إذا كانت الاستضافة تدعم Serverless Functions
├── .env.example               مثال لمتغيرات البيئة (بدون قيم حقيقية)
└── assets/images/
    ├── 01-hero-mobile.webp
    ├── 02-problem-mobile.webp
    └── 03-features-mobile.webp
```

> **ملاحظة على الصور:** الصور الأصلية اللي زدتي مرفوعة بصيغة `.webp` (جودة أفضل وحجم أخف من PNG لنفس المضمون). تم اعتماد نفس الأسماء المطلوبة مع امتداد `.webp` بدل `.png` حتى ما نديرش أي تحويل أو ضغط يأثر على الجودة أو النسبة الأصلية للصور. إيلا بغيتي PNG بالضبط، عطيني الملفات الأصلية بصيغة PNG وغادي نبدلها مباشرة.

## 🔐 خطوة 1 — إضافة Telegram Secrets ونشر الـ Worker

الـ Bot Token **ما كاينش** داخل أي ملف فهاد المشروع. غادي تزيدو بنفسك كـ Secret آمن.

### أ) تثبيت Wrangler (أداة Cloudflare)

```bash
npm install -g wrangler
wrangler login
```

### ب) إنشاء ملف `wrangler.toml` بسيط (إذا ماكانش)

```toml
name = "bee-baby-order-worker"
main = "telegram-worker.js"
compatibility_date = "2024-01-01"
```

### ج) إضافة الـ Secrets (ما كتبانش فالكود ولا فالـ Logs)

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
# غادي يطلب منك تدخل القيمة يدوياً فالـ Terminal

wrangler secret put TELEGRAM_CHAT_ID
# اختياري — إيلا ماديرتيهش، غادي يستعمل القيمة الافتراضية 6781508116

wrangler secret put ALLOWED_ORIGIN
# مثال: https://votredomaine.com
```

### د) نشر الـ Worker

```bash
wrangler deploy
```

بعد النشر، غادي تحصل على رابط شبيه بـ:

```
https://bee-baby-order-worker.YOUR-SUBDOMAIN.workers.dev
```

### هـ) ربط الواجهة بالـ Worker

افتح `script.js` وبدّل هاد السطر برابط الـ Worker ديالك:

```js
var ORDER_API_URL = 'https://your-worker-subdomain.workers.dev/api/order';
```

> إذا استعملتي `api/order.js` (Vercel أو منصة Node أخرى) بدل الـ Worker، دير نفس الخطوة: ضيف `TELEGRAM_BOT_TOKEN` و`ALLOWED_ORIGIN` كـ Environment Variables فلوحة تحكم الاستضافة، وبدّل `ORDER_API_URL` برابط `/api/order` ديال الدومين ديالك.

## 🚀 خطوة 2 — نشر الصفحة (Frontend)

الصفحة عبارة عن ملفات Static (`index.html`, `style.css`, `script.js`, `assets/`). يمكن نشرها على:

- **Cloudflare Pages**: اسحب المجلد مباشرة أو اربطو بـ Git.
- **Netlify / Vercel**: نفس المبدأ — رفع المجلد أو ربط المستودع.

تأكد فقط أن `ORDER_API_URL` فـ `script.js` محدّث برابط الـ Backend الصحيح قبل النشر.

## ✅ خطوة 3 — اختبار قبل الإطلاق

- [ ] جرب رقم هاتف خاطئ (مثلاً `0512345678`) وتأكد أن رسالة الخطأ بالدارجة كتبان تحت الخانة.
- [ ] جرب رقم صحيح بصيغتين: `0612345678` و`+212612345678`.
- [ ] عمر الفورم وضغط "أكد طلبي الآن" — تأكد أن الزر يتعطل، يبان Spinner، والنص يبدل لـ "جاري تسجيل الطلب…".
- [ ] تأكد أن رسالة النجاح ما كتبانش إلا إيلا الـ Worker رجع `success: true`.
- [ ] بدّل `ORDER_API_URL` برابط خاطئ مؤقتاً وتأكد أن رسالة الفشل كتبان والمعلومات ما كتمسحش من الفورم.
- [ ] تأكد أن Telegram كيوصلو الرسالة بالتنسيق المطلوب.
- [ ] ضغط زر الإرسال عدة مرات بسرعة وتأكد ما توصلش عدة رسائل مكررة لنفس الطلب.
- [ ] تأكد أن حدث `Purchase` فـ Meta Pixel كيصيفط مرة وحدة فقط بعد نجاح الطلب (Meta Events Manager > Test Events).
- [ ] جرب الصفحة على شاشة هاتف صغيرة (360px) وتأكد أن لوحة المفاتيح ما كتخفيش زر الإرسال.
- [ ] تأكد أن زر Sticky ما كيبانش فبداية الصفحة، ويبان غير بعدما يتجاوز الزائر نموذج الطلب، ويختفي ملي الفورم بان فالشاشة.
- [ ] تأكد أن جميع أزرار CTA كترجع لنفس `#order-form` بلا ما تنشئ فورم ثاني.

## 🖼️ Meta Pixel

- Pixel ID: `1766376541056154`
- `fbq('init')` و`PageView` يتصيفطو مرة وحدة فـ `<head>`.
- حدث `Purchase` كيتصيفط غير من دالة `trackPurchaseOnce(orderId)` جوج `script.js`، وغير بعد نجاح مؤكد من الـ Backend، مع منع التكرار بواسطة `localStorage`.

## ⚠️ ملاحظات أمان مهمة

- الـ Bot Token القديم (إيلا كان مكشوف من قبل) خاصو يتلغى من Telegram BotFather ويتعوض بواحد جديد.
- ما تكتبش أبداً `TELEGRAM_BOT_TOKEN` داخل `index.html`, `script.js`, ولا أي ملف كيوصل للزوار.
- `ALLOWED_ORIGIN` خاصو يكون بالضبط دومين المتجر ديالك (ماشي `*`) فالإنتاج، باش حتى موقع آخر ما يقدرش يستعمل الـ Backend ديالك.
