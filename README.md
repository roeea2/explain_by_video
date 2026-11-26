<div align="center">

<pre>
   _______
  /       \      ____                             _      ___
 /  \ | /  \    |  _ \    ___     ___    ___     / \    |_ _|
|  -- O --  |   | |_) |  / _ \   / _ \  / _ \   / _ \    | |
 \  / | \  /    |  _ &lt;  | (_) | |  __/ |  __/  / ___ \   | |
  \_______/     |_| \_\  \___/   \___|  \___| /_/   \_\ |___|
</pre>

# Animation Explainer Creator

**A Claude Code skill that turns a topic, a lab brief or your notes into a narrated animated explainer film: every frame drawn in code, a natural recorded voice that stays in sync with the picture, a ready web page with chapters, captions and transcript, and an MP4 with subtitles.**

![License: MIT](https://img.shields.io/badge/License-MIT-4a2a7f.svg)
![Claude Code skill](https://img.shields.io/badge/Claude%20Code-skill-d97757.svg)
![Hebrew RTL](https://img.shields.io/badge/Hebrew-RTL-2b8a3e.svg)
![MP4 export](https://img.shields.io/badge/export-MP4%20%2B%20SRT-3776ab.svg)

**[Live demo and install page](https://animation-explainer-creator.vercel.app)** · **[Demo film (MP4)](https://animation-explainer-creator.vercel.app/demo/pendulum.mp4)**

</div>

<div dir="rtl">

## מה צריך לעשות? שלושה צעדים

1. **מתקינים פעם אחת** בתוך תיקיית הפרויקט (ההוראות בהמשך).
2. **מבקשים סרטון.** למשל: "תעשה סרטון הסבר על חוק אוהם לכיתה י', שתי דקות, עם קריינות". אפשר לצרף קובץ:
   תדריך מעבדה, דף עבודה או סיכום.
3. **מאשרים את התסריט** (רשימת הפרקים ומה הקריין אומר), והסקיל מצייר, מקליט, בודק ומוסר סרטון מוכן.

## מה מקבלים

| | מה זה |
|---|---|
| 🎬 עמוד אינטרנט | נגן עם פרקים, כתוביות, מהירות ניגון, מסך מלא ותמליל שאפשר לקפוץ ממנו לכל משפט. עובד גם בלי אינטרנט, וגם בהעלאה לכל אתר |
| 🗣️ קריינות טבעית | קול נוירוני (Gemini TTS) בעברית טבעית. כל קטע מתומלל בחזרה ומושווה לטקסט, וקטע לא תקין מוקלט מחדש |
| 📼 MP4 | וידאו 1080p עם הכתוביות וקובץ כתוביות SRT, לוואטסאפ, ליוטיוב או למצגת |
| 📐 עברית ונוסחאות | עברית מימין לשמאל עם מספרים, יחידות ונוסחאות בסדר הנכון, אינדקסים וחזקות |
| 🔬 מודל מול מציאות | בנושאי מדע, פרק סיום שמראה מה המודל מניח ואיפה המעבדה האמיתית שונה |

## איך זה עובד

</div>

```mermaid
flowchart LR
    A[נושא או חומר] --> B[תסריט: פרקים, כתוביות, טקסט לקריין]
    B --> C[ציור הסצנות בקוד]
    C --> D[בדיקה: שגיאות, טקסט חופף, יציאה מהמסגרת]
    D --> E[הקלטת קריינות ובדיקת תמלול]
    E --> F[תזמון: האנימציה מחכה לקול]
    F --> G[עמוד אינטרנט ו-MP4]
```

<div dir="rtl">

* **כל פריים מצויר בקוד:** כל סצנה היא פונקציה של הזמן, ולכן אפשר לקפוץ לכל רגע, לשנות מספר אחד ולקבל סרטון
  מעודכן, ולייצא MP4 שזהה בדיוק לנגן.
* **הקול הוא השעון:** כל כתובית פותחת קטע, וכשההקלטה ארוכה מהקטע, הקטע נמתח. הבודק מציע תזמון חדש כך ששום
  אנימציה לא מואטת.
* **בדיקה אוטומטית:** טקסט שיוצא מהמסגרת, טקסט שחופף לטקסט אחר, שגיאות ציור, גלישה בטלפון, וקובצי שמע חסרים.
  הבודק גם מצייר את סוף כל כתובית לגיליונות תמונות, ו-Claude מסתכל עליהם לפני שהוא מוסר.
* **שינויים זולים:** כל קטע קול נשמר לפי תוכן המשפט, כך שתיקון משפט אחד מקליט רק אותו.

## התקנה (בתוך הפרויקט, לא גלובלית)

מהטרמינל, מתוך תיקיית הפרויקט:

</div>

```bash
mkdir -p .claude/skills && curl -fsSL -o aec.zip https://animation-explainer-creator.vercel.app/animation-explainer-creator.zip && unzip -q aec.zip -d .claude/skills && rm aec.zip
```

<div dir="rtl">

או עם git, ישר מהמאגר הזה:

</div>

```bash
git clone --depth 1 https://github.com/roeea2/explain_by_video.git aec-src && mkdir -p .claude/skills && cp -R aec-src/skill/animation-explainer-creator .claude/skills/ && rm -rf aec-src
```

<div dir="rtl">

או להדביק ב-Claude Code, מתוך תיקיית הפרויקט:

</div>

```text
התקן בפרויקט הזה את הסקיל animation-explainer-creator: הורד את
https://animation-explainer-creator.vercel.app/animation-explainer-creator.zip ופתח אותו לתוך .claude/skills
של הפרויקט (לא בהתקנה גלובלית). בדוק ש-Node 18+, Python 3.10+ ו-ffmpeg מותקנים, ואמור לי אם חסר משהו.
```

<div dir="rtl">

אחר כך פותחים מחדש את Claude Code בתיקיית הפרויקט.

## שימוש

</div>

```text
תעשה סרטון הסבר מונפש על חוק שני של ניוטון לכיתה י"א, עם קריינות
תהפוך את תדריך המעבדה בקובץ הזה לסרטון של שתי דקות
סרטון קצר באנגלית על מחזור המים, לכיתה ה', בלי קריינות
תייצא את הסרטון ל-MP4
/animation-explainer-creator
```

<div dir="rtl">

## דרישות

Node 18 ומעלה · Python 3.10 ומעלה · ffmpeg · Playwright לבדיקות ולייצוא MP4 (הסקיל מוצא עותק קיים או מסביר
איך להתקין בשורה אחת) · לקריינות: מפתח Gemini API משלכם (`GEMINI_API_KEY`). בלי מפתח הסרטון שקט עם כתוביות.
הסקיל שואל לפני שהוא שולח את טקסט הקריינות ל-Google.

## מבנה המאגר

</div>

```text
skill/animation-explainer-creator/   הסקיל עצמו: זו התיקייה שנכנסת ל-.claude/skills
  SKILL.md                           ההוראות ל-Claude: שאלות, תסריט, ציור, קריינות, בדיקה, מסירה
  engine/                            הנגן, ערכת הציור ובניית העמוד
  scripts/                           יצירת סרטון, קריינות, בדיקה וייצוא MP4
  references/, templates/, examples/ ערכת הציור, כתיבת סצנות, עברית ונוסחאות, וסרטון לדוגמה
site/                                האתר ש-Vercel מפרסם: עמוד הנחיתה וסרטון ההדגמה
site/demo/                           סרטון ההדגמה המלא: המטוטלת הפשוטה, עם הקריינות וה-MP4
tools/build_zip.cjs                  בונה את ה-zip של הסקיל (רץ ב-Vercel בכל פרסום)
tools/                               גם: תמונת התצוגה המקדימה, צילומי מסך של האתר ובדיקת ניגון באתר החי
build_site.sh                        מעתיק את הסקיל והדמו מסביבת העבודה אל המאגר
```

<div dir="rtl">

כל דחיפה ל-`main` מתפרסמת אוטומטית ב-Vercel מתוך התיקייה `site/`, וה-zip נבנה שם מחדש מתוך `skill/`,
כך שהוא תמיד תואם לקוד שבמאגר.

</div>

## In English

Animation Explainer Creator is a project-scoped [Claude Code](https://claude.com/claude-code) skill that makes
narrated explainer films drawn in code on an HTML canvas, with no video model and no footage. Claude writes the
script (chapters, on-screen captions and spoken lines) for your approval, draws each scene as a function of time
with a kit of helpers (text, labels, bullets, callouts, math typesetting, plots, tables and science apparatus),
checks every frame for errors, text outside the frame and overlapping text, records the narration with Gemini TTS
and verifies each clip by transcribing it back, and stretches the timeline so the picture waits for the voice.
You get a web page with a player, chapters, captions and a clickable transcript, and an MP4 with captions and an
SRT file. Hebrew and other right-to-left languages are first-class.

Install it inside a project (not globally):

```bash
mkdir -p .claude/skills && curl -fsSL -o aec.zip https://animation-explainer-creator.vercel.app/animation-explainer-creator.zip && unzip -q aec.zip -d .claude/skills && rm aec.zip
```

The skill lives in `skill/animation-explainer-creator/`; the website (landing page and demo film) is `site/`,
deployed by Vercel on every push to `main`. The skill zip is built during that deploy by `tools/build_zip.cjs`,
so it always matches the skill in the repo.

## License

[MIT](LICENSE) © 2026 RoeeAI.
