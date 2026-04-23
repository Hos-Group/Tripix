'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, MapPin, Star, Coffee, UtensilsCrossed, Trees, Search, X } from 'lucide-react'
import Link from 'next/link'
import { useTrip } from '@/contexts/TripContext'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CuisineType = 'asian' | 'meat' | 'sushi' | 'ramen' | 'italian' | 'all'
type TabType     = 'restaurants' | 'cafes' | 'parks'

interface Place {
  id:          string
  name:        string
  emoji:       string
  description: string
  area:        string
  price?:      1 | 2 | 3 | 4
  cuisine?:    Exclude<CuisineType, 'all'>
  vibe?:       string
  mustTry?:    string
  tags?:       string[]
}

interface CityData {
  restaurants: Place[]
  cafes:       Place[]
  parks:       Place[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

const CITY_DATA: Record<string, CityData> = {

  // ── Bangkok / Thailand ────────────────────────────────────────────────────
  Bangkok: {
    restaurants: [
      {
        id: 'bkk-r1',
        name: 'Nahm',
        emoji: '🍛',
        description: 'מסעדת Fine Dining תאילנדית שזכתה בכוכב מישלן. השף David Thompson מגיש מנות עתיקות ומסורתיות שנעלמו מהמטבח הרחוב — חוויה אחת אל לשכוח.',
        area: 'סילום',
        price: 4,
        cuisine: 'asian',
        vibe: 'יוקרתי ומסורתי',
        mustTry: 'Gaeng Kiaw Wan (קארי ירוק)',
        tags: ['מישלן', 'Fine Dining', 'תאילנדי מסורתי'],
      },
      {
        id: 'bkk-r2',
        name: 'Jay Fai',
        emoji: '🦀',
        description: 'אגדת רחוב בנגקוקית עם כוכב מישלן — מסעדת רחוב שצריך להזמין מקום שבועות מראש. ג\'יי פאי עצמה בת 80+ עומדת על הווֹק בכל ערב. האומלט שלה עם פירות ים — חוויה פעם בחיים.',
        area: 'בנגלמפהו',
        price: 3,
        cuisine: 'asian',
        vibe: 'אייקוני ורחוב',
        mustTry: 'Crab Omelette',
        tags: ['מישלן', 'Street Food', 'אגדה'],
      },
      {
        id: 'bkk-r3',
        name: 'Sushi Masato',
        emoji: '🍣',
        description: 'עשרה מקומות בלבד, שף יפני שבישל בטוקיו 20 שנה. אומאקסה של 20+ מנות, כל דג נחתך מול העיניים. הרזרבציה נסגרת תוך דקות מפתיחת ההזמנות.',
        area: 'לאנגסואן',
        price: 4,
        cuisine: 'sushi',
        vibe: 'אינטימי ומדויק',
        mustTry: 'Otoro Nigiri',
        tags: ['אומאקסה', 'יפני', 'בוטיק'],
      },
      {
        id: 'bkk-r4',
        name: 'Fuji Ramen',
        emoji: '🍜',
        description: 'הראמן הכי טוב בבנגקוק לפי המקומיים. מרק עצמות חזיר מבושל 18 שעות, אטריות טריות, ביצה מרינדת בנוזל סויה. תמיד יש תור אבל שווה כל דקת המתנה.',
        area: 'סוקומביט 38',
        price: 2,
        cuisine: 'ramen',
        vibe: 'קז\'ואל ומלנושטק',
        mustTry: 'Tonkotsu Special',
        tags: ['אותנטי', 'שווה ערך', 'מקומי'],
      },
      {
        id: 'bkk-r5',
        name: 'Charcoal Tandoor & Smoke',
        emoji: '🥩',
        description: 'בית הבשר הכי שווה בבנגקוק — בשרים מבושלים בתנדור הודי וצ\'ארקול אמריקאי. Wagyu בלי פשרות, ובסביבת יין מרשימה. כיפה גדולה ואווירה אנרגטית.',
        area: 'סאת\'ורן',
        price: 3,
        cuisine: 'meat',
        vibe: 'אנרגטי ועסיסי',
        mustTry: 'A5 Wagyu Striploin',
        tags: ['בשרים', 'Wagyu', 'טנדור'],
      },
      {
        id: 'bkk-r6',
        name: 'Indus',
        emoji: '🔥',
        description: 'מסעדת בשרים בסגנון North Indian שמשלבת מסורת עם חדשנות. הטנדורי צ\'יקן מבושל בחרסינה ישנה מהודו. אחת מ-50 המסעדות הטובות באסיה.',
        area: 'סוקומביט סויי 26',
        price: 3,
        cuisine: 'meat',
        vibe: 'אלגנטי וחמים',
        mustTry: 'Tandoori Mixed Grill',
        tags: ['הודי', 'בשרים', 'מסורתי'],
      },
      {
        id: 'bkk-r7',
        name: 'Biscotti',
        emoji: '🍝',
        description: 'איטלקי קלאסי בתוך מלון Anantara. השף פיירו מגיע מבולוניה ומביא איתו פסטה טרייה ביתית, טרטופו שחור וצ\'יאנטי אמיתי. הטרסה מעל הנהר פנטסטית.',
        area: 'ריברסייד',
        price: 4,
        cuisine: 'italian',
        vibe: 'רומנטי ואלגנטי',
        mustTry: 'Tagliatelle al Tartufo',
        tags: ['איטלקי', 'פסטה טרייה', 'נוף לנהר'],
      },
      {
        id: 'bkk-r8',
        name: 'Sushi Ichiro',
        emoji: '🎌',
        description: 'סושי בסגנון אדו-מה קלאסי ביד שף שהתאמן בצוקיג\'י. דגים מגיעים ישירות מיפן פעמיים בשבוע. אווירה שקטה ומינימליסטית — בדיוק כמו בטוקיו.',
        area: 'אתריום',
        price: 3,
        cuisine: 'sushi',
        vibe: 'מינימליסטי ומדויק',
        mustTry: 'Omakase Set',
        tags: ['סושי', 'אדו-מה', 'יפני אותנטי'],
      },
      {
        id: 'bkk-r9',
        name: 'IPPUDO Bangkok',
        emoji: '🍥',
        description: 'הסניף הבנגקוקי של רשת הראמן האגדית מפוקואה. Hakata Tonkotsu עם מרק עשיר ואטריות דקות. הפלפל הגוצ\'ו ביד — חובה. השרות מהיר ויעיל יפני.',
        area: 'סיאם',
        price: 2,
        cuisine: 'ramen',
        vibe: 'יפני אותנטי',
        mustTry: 'Shiromaru Classic',
        tags: ['ראמן', 'Tonkotsu', 'רשת אגדית'],
      },
    ],

    cafes: [
      {
        id: 'bkk-c1',
        name: 'Graph Espresso',
        emoji: '☕',
        description: 'בית הקפה המוביל של בנגקוק — ספיישלטי מכל רחבי העולם, extraction מדויק כמו מעבדה. חלל תעשייתי עם אור טבעי מדהים. ה-Long Black שלהם — פרפקשן.',
        area: 'בנגרק',
        price: 2,
        mustTry: 'Single Origin Pour Over',
        tags: ['Third Wave', 'Single Origin', 'Espresso Bar'],
      },
      {
        id: 'bkk-c2',
        name: 'Roots Coffee',
        emoji: '🫘',
        description: 'מבשלת קפה מקומית-בנגקוקית שמקפידה על Direct Trade עם חקלאים בצפון תאילנד. הפלטה של פרי לייטים לצד אריזות עיצוב — לקחת הביתה כמזכרת.',
        area: 'חאי \'4 (פטפונג)',
        price: 2,
        mustTry: 'Thai Natural Light Roast',
        tags: ['Direct Trade', 'תאילנדי', 'מקומי'],
      },
      {
        id: 'bkk-c3',
        name: 'Gallery Drip Coffee',
        emoji: '🎨',
        description: 'גלריה ובית קפה בשילוב — אמנות מקומית על הקירות ואקולוגיה של V60 ו-Chemex. ידיים של ברייסטה שמסבירים על המוצא ורמת החמיצות. מרגיע ומוזר בדרך הכי טובה.',
        area: 'תאון',
        price: 2,
        mustTry: 'Chemex House Blend',
        tags: ['גלריה', 'Pour Over', 'אמנות'],
      },
      {
        id: 'bkk-c4',
        name: 'Ceresia Coffee Roasters',
        emoji: '🔬',
        description: 'מקצוענים ברמה הגבוהה ביותר. ה-espresso bar עם 8 זנים שנמצאים בגלגול — כל כוס היא ניסיון חדש. הברייסטה ילמד אתכם על terroir וקליית קפה.',
        area: 'לאנגסואן',
        price: 3,
        mustTry: 'Espresso Flight (x3)',
        tags: ['Roastery', 'Espresso', 'גבוה מאוד'],
      },
    ],

    parks: [
      {
        id: 'bkk-p1',
        name: 'Lumpini Park',
        emoji: '🌿',
        description: 'הריאות הירוקות של בנגקוק — 57 הקטר של שקט בלב העיר. בבוקר יש תרגילי Tai Chi ורצים, בצהריים משפחות ואוהבים, בערב הוואטרים. מוניטורים ענקיים חיים בשביל — מרתק.',
        area: 'סילום',
        tags: ['בוקר', 'ריצה', 'מוניטורים'],
      },
      {
        id: 'bkk-p2',
        name: 'Chatuchak Park',
        emoji: '🌳',
        description: 'הפארק ממש ליד שוק הסוף שבוע המפורסם — מושלם לפתיחת הבוקר לפני הקניות. אגם מלאכותי, עגלות אוכל, ואנשים שמפעילים ספינרים ועפיפונים ביום שישי.',
        area: 'צ\'טוצ\'אק',
        tags: ['עפיפונים', 'משפחות', 'שוק קרוב'],
      },
      {
        id: 'bkk-p3',
        name: 'Benchakitti Forest Park',
        emoji: '🏞️',
        description: 'הפארק הכי שווה לאחר השיפוץ ב-2022 — שבילי הליכה עילאיים מעל הביצות, גשרי עץ בתוך עצי ענק, ואחד מנופי השקיעה הכי יפים בבנגקוק. פחות מוכר = פחות עמוס.',
        area: 'סוקומביט',
        tags: ['שקיעה', 'שביל עילאי', 'שקט'],
      },
      {
        id: 'bkk-p4',
        name: 'Bang Krachao (Green Lung)',
        emoji: '🚴',
        description: '"הריאה הירוקה" — חצי אי ביחוד מהנהר שנראה כמו ג\'ונגל אמיתי בלב מטרופולין. שכרו אופניים מהנמל, רכבו בין הכפרים, וסיימו בשוק צף קטן. חוויה מחוץ לזמן.',
        area: 'פระประแดง',
        tags: ['אופניים', 'טבע', 'אותנטי'],
      },
    ],
  },

  // ── Tokyo / Japan ─────────────────────────────────────────────────────────
  Tokyo: {
    restaurants: [
      {
        id: 'tky-r1',
        name: 'Afuri Ramen',
        emoji: '🍜',
        description: 'המייסדים של ראמן Yuzu Shio — מרק עוף קל ומרענן עם פיצוץ של ציטרוס. לא כמו שום ראמן שאכלתם. הסניף בהאראג\'וקו קטן ואחוז ישיבה — הגיעו מוקדם.',
        area: 'הראג\'וקו',
        price: 2,
        cuisine: 'ramen',
        vibe: 'מיוחד ורענן',
        mustTry: 'Yuzu Shio Ramen',
        tags: ['Yuzu', 'חדשני', 'קל ומרענן'],
      },
      {
        id: 'tky-r2',
        name: 'Ichiran Ramen',
        emoji: '🎌',
        description: 'מסעדת ראמן בחדרים אישיים — אוכלים לבד בתא קטן ומתמקדים בקערה. אפשר להגדיר את עוצמת הקרם, כמות השום, ורמת העירנות של המרק. ניסיון יפני קוויינטסנציאלי.',
        area: 'שינג\'וקו',
        price: 2,
        cuisine: 'ramen',
        vibe: 'ייחודי ואישי',
        mustTry: 'Tonkotsu עם הגדרות מותאמות אישית',
        tags: ['חדרים אישיים', 'Tonkotsu', 'ייחודי'],
      },
      {
        id: 'tky-r3',
        name: 'Sushi Saito',
        emoji: '🍣',
        description: 'אחד מהמקומות הכי קשים להזמין בעולם — 3 כוכבי מישלן, 9 מקומות בלבד, רזרבציות ב-Lottery. אם הגעתם ליפן ויש לכם הזדמנות — זה הסושי הכי טוב על פני כדור הארץ.',
        area: 'מינאטו',
        price: 4,
        cuisine: 'sushi',
        vibe: 'אגדתי ומעורר יראה',
        mustTry: 'Omakase 20-course',
        tags: ['3 כוכבי מישלן', 'אומאקסה', 'בלתי ניתן להזמין'],
      },
      {
        id: 'tky-r4',
        name: 'Narisawa',
        emoji: '🌿',
        description: 'מספר 1 ביפן ו-Top 20 בעולם. שף יושיהירו נריסאווה מגיש "Satoyama Cuisine" — בישול היסטורי יפני עם חלקי צמח שנאסף ביד. כל מנה היא סיפור על הטבע היפני.',
        area: 'מינאמי-אויאמה',
        price: 4,
        cuisine: 'asian',
        vibe: 'Fine Dining יפני',
        mustTry: 'Live Forest',
        tags: ['Top 50 World', 'Fine Dining', 'חדשני'],
      },
      {
        id: 'tky-r5',
        name: 'Yakiniku Jumbo',
        emoji: '🔥',
        description: 'יאקיניקו יפני קלאסי עם בשרי Wagyu A5 — על הגריל בשולחן. ההפרש מסטייק-האוס רגיל: כאן אתם יושבים ובאה מנה אחרי מנה, כל חתיכה בת 2-3 ביסים. שייכות לפוקוקה.',
        area: 'שינג\'וקו',
        price: 3,
        cuisine: 'meat',
        vibe: 'אנרגטי ועסיסי',
        mustTry: 'A5 Wagyu Kalbi',
        tags: ['יאקיניקו', 'Wagyu', 'גריל'],
      },
      {
        id: 'tky-r6',
        name: 'Savoy',
        emoji: '🍕',
        description: 'פיצה נאפוליטנית בטוקיו שמתחרה עם האמיתית מנאפולי. טנדיר עץ, קמח 00 מיובא, עגבניות San Marzano. תור ארוך מחוץ לכניסה — אבל הם לא מקבלים הזמנות.',
        area: 'שינג\'וקו',
        price: 2,
        cuisine: 'italian',
        vibe: 'קז\'ואל ואותנטי',
        mustTry: 'Margherita',
        tags: ['פיצה', 'נאפוליטנית', 'ללא הזמנה'],
      },
    ],

    cafes: [
      {
        id: 'tky-c1',
        name: '% Arabica Kyoto Arashiyama',
        emoji: '☕',
        description: 'בית הקפה הכי צלום בעולם — על גב נהר Oi עם הרים בפרספקטיבה. ה-Single Origin Latte הכי instagrammable, אבל גם הכי טעים. Specialty coffee בלבד, קו ייצור מדויק.',
        area: 'Arashiyama / אראשייאמה',
        price: 2,
        mustTry: 'Kyoto Latte',
        tags: ['אייקוני', 'Single Origin', 'נוף'],
      },
      {
        id: 'tky-c2',
        name: 'Blue Bottle Coffee Tokyo',
        emoji: '💙',
        description: 'הסניף הטוקיואי של אייקון ה-Third Wave האמריקאי. ה-New Orleans Iced Coffee — קפה מרוכז עם חלב מתוק. כל סניף מעוצב ע\'י אדריכל שונה — אמנות ופוקוס.',
        area: 'שינג\'וקו / קיוטו',
        price: 2,
        mustTry: 'New Orleans Iced Coffee',
        tags: ['Third Wave', 'Design', 'New Orleans'],
      },
      {
        id: 'tky-c3',
        name: 'Fuglen Tokyo',
        emoji: '🦅',
        description: 'סניף של בית הקפה הנורוגי האגדי מאוסלו — קפה light roast מינימליסטי שמדגיש את הפרות והחמיצות. מסוף הצהריים הופך לבר קוקטיילים. מאוד ויינדהאם.',
        area: 'טומיגייה',
        price: 2,
        mustTry: 'V60 Single Origin',
        tags: ['נורוגי', 'Light Roast', 'קוקטיילים בלילה'],
      },
      {
        id: 'tky-c4',
        name: 'The Roastery by Nozy Coffee',
        emoji: '🏭',
        description: 'המקצוענים הטוקיואים של הSpring water brewing — אחד מהמקומות הספורים בעולם שמגישים קפה בהכנה של מים קפואים 24 שעה. גיקי, מדעי, ומושלם.',
        area: 'שיבויה',
        price: 3,
        mustTry: 'Cold Drip 24h Brew',
        tags: ['Cold Brew', 'Roastery', 'גיקי'],
      },
    ],

    parks: [
      {
        id: 'tky-p1',
        name: 'Shinjuku Gyoen',
        emoji: '🌸',
        description: 'הגן הלאומי של טוקיו — 58 הקטר עם שלושה אזורי גינון שונים (יפני, צרפתי, אנגלי). בעונת הסאקורה (מרץ-אפריל) זה המקום הכי יפה על פני כדור הארץ. אלכוהול אסור — ומפריד את המבקרים.',
        area: 'שינג\'וקו',
        tags: ['סאקורה', 'יפן רומנטית', 'גינות יפניות'],
      },
      {
        id: 'tky-p2',
        name: 'Yoyogi Park',
        emoji: '🎉',
        description: 'הפארק החי ביותר בטוקיו — בסופי שבוע יש קוספליי, בנדות רוק, ריקודי רחוב ורוקביליז. ביום חול — ריצה, יוגה, פיקניק. הרגשה של חופש טוטאלי בלב מגה-עיר.',
        area: 'הראג\'וקו / שיבויה',
        tags: ['קוספליי', 'חיים', 'כיף'],
      },
      {
        id: 'tky-p3',
        name: 'Inokashira Park',
        emoji: '🚣',
        description: 'אגם עם סירות בוגיות, נשיקות של ברווזים, ועצי דובדבן שיוצרים מנהרה ורודה. יש כאן מוזיאון ג\'יבלי ממש ליד. האווירה — כאילו נכנסתם לסרט אנימציה.',
        area: 'קיצ\'יג\'וג\'י',
        tags: ['אגם', 'ג\'יבלי', 'רומנטי'],
      },
    ],
  },

  // ── Paris / France ────────────────────────────────────────────────────────
  Paris: {
    restaurants: [
      {
        id: 'par-r1',
        name: 'Kei',
        emoji: '🎌',
        description: 'שף יפני קיי קובאיאשי משיג 3 כוכבי מישלן בפריז — המטבח הצרפתי הקלאסי בעיניים יפניות. מנות שנראות כמו ציורים עם טעמים שמשלבים שתי תרבויות בצורה מושלמת.',
        area: 'Rue du Coq Héron',
        price: 4,
        cuisine: 'asian',
        vibe: 'Fine Dining, יפן-פריז',
        mustTry: 'Menu Dégustation',
        tags: ['3 מישלן', 'Fusion', 'יפן-צרפת'],
      },
      {
        id: 'par-r2',
        name: 'Clover Grill',
        emoji: '🥩',
        description: 'שף Jean-François Piège מגיש בשרים של Simmental ו-Normande מגידול חופשי, צלויים על גחלים של ראשי גפן. פריז על בשר — אלגנטי ובלתי נשכח.',
        area: 'Saint-Germain',
        price: 3,
        cuisine: 'meat',
        vibe: 'אלגנטי ועשיר',
        mustTry: 'Entrecôte Simmental',
        tags: ['בשרים', 'Grillades', 'גחלים'],
      },
      {
        id: 'par-r3',
        name: 'Kinugawa',
        emoji: '🍱',
        description: 'סושי-בר עילי בלב פריז שמגיש אומאקסה עם דגי עונה מהאוקיינוס האטלנטי. קצב האירוח צרפתי — איטי וחגיגי — אבל הכישורים טהור-יפניים.',
        area: 'Vendôme',
        price: 4,
        cuisine: 'sushi',
        vibe: 'Luxe, פריז-יפן',
        mustTry: 'Omakase de Saison',
        tags: ['סושי', 'פריז', 'יפני'],
      },
      {
        id: 'par-r4',
        name: 'Chez l\'Ami Jean',
        emoji: '🍲',
        description: 'ביסטרו בסקית\'י קלאסי — ראז\'ו של עגל על לפת חורפית, ו-Rice Pudding במרכז השולחן בבין הכולם. שרות קולני ועם אהבה. פריז אמיתית.',
        area: 'Invalides (7ème)',
        price: 2,
        cuisine: 'meat',
        vibe: 'ביסטרו אותנטי',
        mustTry: 'Riz au Lait Grand-Mère',
        tags: ['ביסטרו', 'בסק', 'אותנטי'],
      },
      {
        id: 'par-r5',
        name: 'L\'Arpège',
        emoji: '🥦',
        description: 'אלן פסאר — שף עם 3 מישלן שהחליט לוותר על בשר ולהתמקד בירקות מהחווה שלו. כל מנה מוציאה קסמים ממה שגדל באדמה. המהפכה הירקונית של פריז.',
        area: 'Rue de Varenne',
        price: 4,
        cuisine: 'italian',
        vibe: 'Fine Dining, ירקוני',
        mustTry: 'L\'Œuf Chaud-Froid',
        tags: ['3 מישלן', 'ירקוני', 'רפובליקת ירק'],
      },
      {
        id: 'par-r6',
        name: 'Ramen Yūjō',
        emoji: '🍜',
        description: 'ה-Ramen Bar הפריזאי שצינן בשנת 2020 — מרק ברוסיה אינטנסיבי עם ביצת עמדה מושלמת. הפרסיז\'ה הצרפתית בשילוב הראמן היפני — שמיש.',
        area: 'Montorgueil',
        price: 2,
        cuisine: 'ramen',
        vibe: 'קז\'ואל ומרגש',
        mustTry: 'Tori Paitan',
        tags: ['ראמן', 'פריז', 'ייחודי'],
      },
    ],

    cafes: [
      {
        id: 'par-c1',
        name: 'Belleville Brûlerie',
        emoji: '☕',
        description: 'הפיאונר של הגל השלישי בפריז — בית הקפה שהביא ספיישלטי קפה לצרפת. תמיד יש בלנד ייחודי וסינגל אוריג\'ין מ-5 יבשות. V60, Chemex, AeroPress — הכל ידי אמן.',
        area: 'Belleville (20ème)',
        price: 2,
        mustTry: 'Filtre du Moment',
        tags: ['Third Wave Paris', 'Roastery', 'פיאונר'],
      },
      {
        id: 'par-c2',
        name: 'Ten Belles',
        emoji: '🌊',
        description: 'מקום אחד אבל שניים — קנאל סנט-מארטן שנפתח ב-2012 ועדיין הכי שווה. Flat White מושלם, breakfast בוקר רומנטי ליד התעלה. האנשים שמגיעים לכאן הם הכי cool בפריז.',
        area: 'Canal Saint-Martin',
        price: 2,
        mustTry: 'Flat White + Avocado Toast',
        tags: ['Canal', 'Specialty', 'בוקר'],
      },
      {
        id: 'par-c3',
        name: 'Fragments',
        emoji: '🔮',
        description: 'קפה שמטפל בכל אספקט של הגרעין — Sourcing, Roasting, Extraction. הברייסטה יסביר לכם את הסיפור מאחורי כל בלנד. המיקום: חצר מוסתרת במרה.',
        area: 'Le Marais (3ème)',
        price: 2,
        mustTry: 'Espresso Macchiato',
        tags: ['Marais', 'Hidden Gem', 'מקצועי'],
      },
    ],

    parks: [
      {
        id: 'par-p1',
        name: 'Jardin du Luxembourg',
        emoji: '🌷',
        description: 'הגן הפריזאי הכי אהוב על התושבים — כיסאות ירוקי מתכת ליד הבריכה, ילדים עם סירות מפרש קטנות, ותלמידי סורבון שקוראים ספרים. פריז נצחית.',
        area: 'Saint-Germain-des-Prés',
        tags: ['גן', 'פריז אייקוני', 'פיקניק'],
      },
      {
        id: 'par-p2',
        name: 'Bois de Vincennes',
        emoji: '🌲',
        description: 'היער הגדול של פריז — ממזרח. אגמים לספורט מים, גן חיות ובוטני, מסלולי ריצה ואופניים. פחות תיירותי מלוקסמבורג — יותר של התושבים.',
        area: 'Vincennes (12ème)',
        tags: ['יער', 'אגמים', 'ריצה'],
      },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Cuisine meta
// ─────────────────────────────────────────────────────────────────────────────

const CUISINE_META: Record<Exclude<CuisineType, 'all'>, { label: string; emoji: string; color: string; bg: string }> = {
  asian:   { label: 'אסייתי',  emoji: '🍜', color: '#D97706', bg: '#FEF3C7' },
  meat:    { label: 'בשרים',   emoji: '🥩', color: '#DC2626', bg: '#FEE2E2' },
  sushi:   { label: 'סושי',    emoji: '🍣', color: '#2563EB', bg: '#DBEAFE' },
  ramen:   { label: 'ראמן',    emoji: '🍥', color: '#7C3AED', bg: '#EDE9FE' },
  italian: { label: 'איטלקי',  emoji: '🍝', color: '#059669', bg: '#D1FAE5' },
}

const PRICE_LABEL: Record<number, string> = { 1: '₪', 2: '₪₪', 3: '₪₪₪', 4: '₪₪₪₪' }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveCityData(destination: string): { city: string; data: CityData } {
  const dest = (destination || '').toLowerCase()

  if (dest.includes('tokyo') || dest.includes('japan') || dest.includes('יפן') || dest.includes('טוקיו')) {
    return { city: 'Tokyo', data: CITY_DATA.Tokyo }
  }
  if (dest.includes('paris') || dest.includes('france') || dest.includes('פריז') || dest.includes('צרפת')) {
    return { city: 'Paris', data: CITY_DATA.Paris }
  }
  // Default: Bangkok
  return { city: 'Bangkok', data: CITY_DATA.Bangkok }
}

function PriceTag({ price }: { price?: number }) {
  if (!price) return null
  return (
    <span className="text-xs font-bold text-gray-400 tabular-nums">
      {PRICE_LABEL[price]}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Card Components
// ─────────────────────────────────────────────────────────────────────────────

function RestaurantCard({ place, index }: { place: Place; index: number }) {
  const cm = place.cuisine ? CUISINE_META[place.cuisine] : null
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      onClick={() => setExpanded(e => !e)}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-50 active:scale-[0.98] transition-transform cursor-pointer"
    >
      {/* Top row */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Emoji bubble */}
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: cm ? cm.bg : '#F5F3FF' }}>
            {place.emoji}
          </div>

          <div className="flex-1 min-w-0">
            {/* Name + price */}
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-gray-900 leading-tight">{place.name}</h3>
              <PriceTag price={place.price} />
            </div>

            {/* Cuisine badge + area */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {cm && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ color: cm.color, background: cm.bg }}>
                  {cm.emoji} {cm.label}
                </span>
              )}
              <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                <MapPin className="w-2.5 h-2.5" />
                {place.area}
              </span>
            </div>
          </div>
        </div>

        {/* Description — first 100 chars always visible */}
        <p className="text-xs text-gray-500 leading-relaxed mt-2.5">
          {expanded || place.description.length <= 100
            ? place.description
            : place.description.slice(0, 100) + '…'}
        </p>
      </div>

      {/* Expanded extras */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {place.mustTry && (
                <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
                  <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span className="text-xs font-semibold text-amber-700">Must Try: {place.mustTry}</span>
                </div>
              )}
              {place.vibe && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {place.tags?.map(tag => (
                    <span key={tag} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function CafeCard({ place, index }: { place: Place; index: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      onClick={() => setExpanded(e => !e)}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-50 active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-2xl flex-shrink-0">
            {place.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-gray-900">{place.name}</h3>
              <PriceTag price={place.price} />
            </div>
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400 mt-1">
              <MapPin className="w-2.5 h-2.5" />
              {place.area}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed mt-2.5">
          {expanded || place.description.length <= 100
            ? place.description
            : place.description.slice(0, 100) + '…'}
        </p>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {place.mustTry && (
                <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
                  <Coffee className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span className="text-xs font-semibold text-amber-700">הזמינו: {place.mustTry}</span>
                </div>
              )}
              {place.tags && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {place.tags.map(tag => (
                    <span key={tag} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ParkCard({ place, index }: { place: Place; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-2xl flex-shrink-0">
          {place.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-gray-900">{place.name}</h3>
          <span className="flex items-center gap-0.5 text-[10px] text-gray-400 mt-0.5">
            <MapPin className="w-2.5 h-2.5" />
            {place.area}
          </span>
          <p className="text-xs text-gray-500 leading-relaxed mt-2">{place.description}</p>

          {place.tags && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {place.tags.map(tag => (
                <span key={tag} className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LifestylePage() {
  const { currentTrip } = useTrip()
  const { city, data }   = resolveCityData(currentTrip?.destination || '')

  const [tab,           setTab]           = useState<TabType>('restaurants')
  const [cuisineFilter, setCuisineFilter] = useState<CuisineType>('all')
  const [search,        setSearch]        = useState('')

  const filteredRestaurants = data.restaurants.filter(r => {
    const matchCuisine = cuisineFilter === 'all' || r.cuisine === cuisineFilter
    const q = search.toLowerCase()
    const matchSearch = !q || r.name.toLowerCase().includes(q) || r.description.includes(q)
    return matchCuisine && matchSearch
  })

  const filteredCafes = data.cafes.filter(c => {
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || c.description.includes(q)
  })

  const filteredParks = data.parks.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || p.description.includes(q)
  })

  const TABS: { key: TabType; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'restaurants', label: 'מסעדות',  icon: UtensilsCrossed, count: data.restaurants.length },
    { key: 'cafes',       label: 'בתי קפה', icon: Coffee,          count: data.cafes.length },
    { key: 'parks',       label: 'פארקים',  icon: Trees,           count: data.parks.length },
  ]

  // Tab gradient colors
  const TAB_GRADIENT: Record<TabType, string> = {
    restaurants: 'from-orange-400 to-red-500',
    cafes:       'from-amber-400 to-orange-500',
    parks:       'from-green-400 to-emerald-600',
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className={`relative bg-gradient-to-br ${TAB_GRADIENT[tab]} px-5 pt-5 pb-6 overflow-hidden`}
      >
        {/* Blobs */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20 pointer-events-none"
          style={{ background: 'white', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full opacity-15 pointer-events-none"
          style={{ background: 'white', transform: 'translate(-25%, 40%)' }} />

        {/* Back */}
        <Link
          href="/dashboard"
          aria-label="חזרה לדשבורד"
          className="relative inline-flex items-center gap-1 text-white/90 text-sm mb-4 px-2 py-1 min-h-[44px] rounded-xl active:scale-95 focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
          חזרה
        </Link>

        <div className="relative">
          <p className="text-white/70 text-xs font-medium mb-0.5">המלצות ל</p>
          <h1 className="text-2xl font-black text-white tracking-tight">{city}</h1>
          <p className="text-white/60 text-xs mt-1">
            {data.restaurants.length} מסעדות · {data.cafes.length} בתי קפה · {data.parks.length} פארקים
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mt-4">
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-2xl px-3 py-2.5">
            <Search className="w-4 h-4 text-white/60 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חפש מסעדה, קפה או פארק..."
              className="flex-1 bg-transparent outline-none text-sm placeholder-white/50 text-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="active:scale-90">
                <X className="w-4 h-4 text-white/60" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        <div className="flex max-w-lg mx-auto">
          {TABS.map(t => {
            const Icon = t.icon
            const isActive = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setCuisineFilter('all') }}
                className={`flex-1 py-3.5 flex flex-col items-center gap-0.5 border-b-2 transition-all ${
                  isActive ? 'border-gray-800' : 'border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-gray-800' : 'text-gray-300'}`} />
                <span className={`text-[11px] font-semibold ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                  {t.label}
                </span>
                <span className={`text-[9px] font-bold rounded-full px-1.5 ${
                  isActive ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {t.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 max-w-lg mx-auto">

        {/* ── Restaurants ─────────────────────────────────────────────────── */}
        {tab === 'restaurants' && (
          <div className="space-y-3">
            {/* Cuisine filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setCuisineFilter('all')}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                  cuisineFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                הכל
              </button>
              {(Object.entries(CUISINE_META) as [Exclude<CuisineType, 'all'>, typeof CUISINE_META[keyof typeof CUISINE_META]][]).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setCuisineFilter(key)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                    cuisineFilter === key ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                  style={cuisineFilter === key ? { background: meta.color } : undefined}
                >
                  {meta.emoji} {meta.label}
                </button>
              ))}
            </div>

            {/* Result count */}
            {search && (
              <p className="text-xs text-gray-400">
                {filteredRestaurants.length} תוצאות עבור &ldquo;{search}&rdquo;
              </p>
            )}

            {filteredRestaurants.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">אין תוצאות לסינון זה</p>
              </div>
            ) : (
              filteredRestaurants.map((r, i) => (
                <RestaurantCard key={r.id} place={r} index={i} />
              ))
            )}
          </div>
        )}

        {/* ── Cafes ────────────────────────────────────────────────────────── */}
        {tab === 'cafes' && (
          <div className="space-y-3">
            {/* Specialty coffee header */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">☕</span>
              <div>
                <p className="text-xs font-bold text-amber-800">ספיישלטי קפה בלבד</p>
                <p className="text-[11px] text-amber-600">רק בתי קפה עם Third Wave ורמת מקצועיות גבוהה</p>
              </div>
            </div>

            {filteredCafes.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Coffee className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">אין תוצאות</p>
              </div>
            ) : (
              filteredCafes.map((c, i) => (
                <CafeCard key={c.id} place={c} index={i} />
              ))
            )}
          </div>
        )}

        {/* ── Parks ────────────────────────────────────────────────────────── */}
        {tab === 'parks' && (
          <div className="space-y-3">
            {filteredParks.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Trees className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">אין תוצאות</p>
              </div>
            ) : (
              filteredParks.map((p, i) => (
                <ParkCard key={p.id} place={p} index={i} />
              ))
            )}
          </div>
        )}

      </div>
    </div>
  )
}
