# وسادة حماية رأس وظهر الطفل — النحلة

صفحة بيع مباشر Mobile First وRTL بثمن **149 درهم**، التوصيل مجاني والدفع عند الاستلام. الطلبات كتتمشى مباشرة من الفورم إلى Google Sheets بواسطة Google Apps Script، وMeta Pixel كيسجل `Purchase` مرة واحدة لكل طلب.

## بنية المشروع الجاهزة لـGitHub Pages

```text
project/
├── index.html
├── style.css
├── script.js
└── assets/images/
    ├── 01-hero-mobile.webp
    ├── 02-problem-mobile.webp
    └── 03-features-mobile.webp
```

ما كاين لا Telegram Worker لا Serverless Backend. رابط Google Apps Script موجود داخل `script.js` فالمتغير:

```js
var GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/.../exec';
```

## النشر على GitHub Pages

1. ارفع `index.html` و`style.css` و`script.js` إلى أصل المستودع.
2. ارفع الصور الثلاثة داخل `assets/images/` بنفس الأسماء.
3. من GitHub افتح **Settings → Pages**.
4. اختار **Deploy from a branch** ثم `main` و`/root`.
5. احفظ وانتظر حتى يظهر رابط الموقع.

## اختبار الطلبات

1. افتح الموقع المنشور، ماشي معاينة الملف داخل الحاسوب.
2. عمر الاسم والهاتف والمدينة والعنوان.
3. اضغط **أكد طلبي الآن** مرة واحدة.
4. تأكد أن سطراً جديداً تزاد داخل ورقة `Orders` في Google Sheets.
5. جرب رقم هاتف خاطئ وتأكد أن رسالة التحقق كتبان.
6. راقب Meta Events Manager وتأكد أن `Purchase` كيتسجل مرة واحدة.

## ملاحظات

- رابط Google Apps Script خاصو يبقى كيسالي بـ`/exec`.
- من Apps Script خاص **Execute as: Me** و**Who has access: Anyone**.
- إلى بدلت كود `Code.gs` خاصك تنشر **New version** من Manage deployments.
- ملفات `telegram-worker.js` و`order.js` و`.env.example` القديمة ما بقاتش مطلوبة.
