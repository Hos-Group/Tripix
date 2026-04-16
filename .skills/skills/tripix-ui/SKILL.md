---
name: tripix-ui
description: |
  Tripix UI/UX & design skill. Use whenever working on the user interface of the Tripix app — designing new pages, fixing layout issues, improving mobile responsiveness, handling RTL/Hebrew layout, adding animations, or tweaking the visual design. Trigger on: "עיצוב", "ממשק", "UI", "UX", "RTL", "רספונסיבי", "אנימציה", "עמוד חדש", "קומפוננטה", "צבעים", "layout", "component", "responsive", "mobile", "bottom nav", "header", "toast", "modal", "empty state", or any request to make the app look better, fix visual glitches, or design new screens. Also trigger when the user shares screenshots of UI bugs or wants to change the look and feel.
---

# Tripix UI/UX & Design Skill

Tripix is a **Hebrew-first, mobile-first PWA** for travel management. This skill helps you build beautiful, consistent, accessible UI that works perfectly in RTL and on mobile devices.

## Design System

### Brand Colors

```
Primary:     #185FA5 (deep blue)
Primary Light: #378ADD (lighter blue)
Gradient:    from-[#185FA5] to-[#378ADD] (main card gradient)
```

**Category Colors** (from `CATEGORY_META` in types):
| Category | Color | Hex |
|----------|-------|-----|
| Flight | Blue | #378ADD |
| Ferry | Green | #1D9E75 |
| Taxi | Orange | #EF9F27 |
| Hotel | Olive | #639922 |
| Activity | Purple | #7F77DD |
| Food | Pink | #D4537E |
| Shopping | Red-orange | #D85A30 |
| Other | Gray | #888780 |

Always reuse these colors. Don't invent new category colors.

### Typography
- System fonts: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Hebrew text renders beautifully with these system fonts
- Sizes follow Tailwind defaults: `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-lg` (18px), `text-xl` (20px), `text-2xl` (24px)

### Spacing & Layout
- **Container**: `max-w-lg mx-auto px-4` (mobile-optimized width)
- **Top padding**: `pt-16` (for fixed header)
- **Bottom padding**: `pb-24` (for bottom nav + safe area)
- **Card gap**: `space-y-4` between sections
- **Grid**: `grid grid-cols-2 gap-3` for stat cards

### Border Radius Scale
- Cards: `rounded-2xl` (16px)
- Buttons: `rounded-2xl` (16px)
- Icons containers: `rounded-xl` (12px)
- Pill badges: `rounded-full`
- The app uses generous radius — everything is soft and rounded

## Component Patterns

### Card
The standard card used throughout the app:
```tsx
<div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
  <h3 className="text-sm font-bold mb-3">כותרת</h3>
  {/* Content */}
</div>
```

### Hero Card (Gradient)
Used for the main dashboard summary:
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="bg-gradient-to-br from-[#185FA5] to-[#378ADD] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden"
>
  {/* Decorative circles */}
  <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
  {/* Content */}
</motion.div>
```

### Stat Card
Small metric display:
```tsx
<div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
  <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center mb-2">
    <Icon className="w-4 h-4 text-primary" />
  </div>
  <p className="text-lg font-bold">₪1,234</p>
  <span className="text-xs text-gray-400">תווית</span>
</div>
```

### List Item
Standard expense/document row:
```tsx
<div className="flex items-center gap-3">
  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
    style={{ backgroundColor: color + '20' }}>
    {emoji}
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium truncate">כותרת</p>
    <p className="text-xs text-gray-400">תיאור</p>
  </div>
  <div className="text-left">
    <p className="text-sm font-bold">₪100</p>
  </div>
</div>
```

### Empty State
When there's no data to show:
```tsx
<div className="bg-white rounded-2xl p-8 shadow-sm text-center">
  <div className="text-4xl mb-3">✈️</div>
  <p className="font-bold mb-1">אין נתונים</p>
  <p className="text-sm text-gray-500">הסבר מה לעשות</p>
</div>
```

### Loading State
```tsx
<div className="flex items-center justify-center h-[60vh]">
  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
</div>
```

### Button Styles
Primary action:
```tsx
<button className="w-full bg-primary text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md">
  <Plus className="w-5 h-5" />
  טקסט הכפתור
</button>
```

Secondary/ghost:
```tsx
<button className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
  ביטול
</button>
```

## RTL (Right-to-Left) Guidelines

The app is fully RTL. This affects layout in important ways:

### What RTL Handles Automatically
- Text alignment (right by default)
- Flexbox direction (reversed — `flex` puts first child on the right)
- `gap` works correctly
- `space-y-*` works correctly

### What You Must Handle Manually
1. **Icons that imply direction**: Arrows should point left for "forward" (opposite of LTR). Use `rotate-180` on forward arrows, or use RTL-aware icons.

2. **Absolute positioning**: `left` and `right` are NOT swapped automatically in Tailwind. When you write `-left-8`, it stays on the left. For RTL, you often want decorative elements on the left (which is the "end" side in RTL).

3. **Text alignment overrides**: If you need `text-left` for numbers/prices (common for amount columns), it's correct — numbers align left in Hebrew UIs for readability.

4. **Padding/margin direction**: `pr-2` means "padding right" which in RTL is the start side. Use `ps-2`/`pe-2` (start/end) for direction-aware spacing when it matters. But Tailwind + RTL usually handles `pl/pr` correctly with `dir="rtl"`.

5. **Gradients**: `bg-gradient-to-br` goes bottom-right even in RTL. This is usually fine.

### Common RTL Patterns
```tsx
{/* Price aligned to left (end in RTL) — correct for financial data */}
<div className="text-left">
  <p className="text-sm font-bold">₪1,234</p>
</div>

{/* Currency symbol before number in Hebrew */}
<span>₪{amount.toLocaleString('he-IL')}</span>

{/* Truncation in RTL */}
<p className="truncate" dir="rtl">טקסט ארוך שיקוצר...</p>
```

## Animation Patterns

Use `framer-motion` for all animations. The app uses subtle, quick animations:

### Page Enter
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
```

### Staggered List
```tsx
{items.map((item, i) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.05 }}
  >
```

### Bottom Sheet (Modal)
```tsx
{/* Backdrop */}
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="fixed inset-0 bg-black/40 z-50"
  onClick={onClose}
/>
{/* Sheet */}
<motion.div
  initial={{ y: '100%' }}
  animate={{ y: 0 }}
  exit={{ y: '100%' }}
  transition={{ type: 'spring', damping: 25 }}
  className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl p-6 z-50"
>
```

### Press Feedback
```tsx
<button className="active:scale-95 transition-transform">
```

## Mobile-First Design

### Safe Areas (Notch/Home Indicator)
The app uses iOS safe area insets:
```css
padding-bottom: calc(env(safe-area-inset-bottom) + 80px);
padding-top: env(safe-area-inset-top);
```

### Bottom Navigation
- Fixed at bottom with backdrop blur
- 5 tabs: Dashboard, Expenses, Scan, Documents, More
- Active tab: primary color, slightly larger icon
- Safe area padding for home indicator

### Touch Targets
- Minimum 44x44px for all interactive elements
- Use `py-4` on buttons for comfortable tap targets
- List items have `gap-3` for finger-friendly spacing

### Scroll Behavior
- Custom scrollbar hidden (`scrollbar-width: none`)
- `-webkit-overflow-scrolling: touch` for momentum scrolling
- Pull-to-refresh via native PWA behavior

## Icon Usage

Use `lucide-react` for all interactive icons:
```tsx
import { Plane, Wallet, TrendingUp, CalendarDays, Plus, ChevronDown } from 'lucide-react'

<Plane className="w-4 h-4 text-primary" />
```

For decorative category indicators, use emojis from `CATEGORY_META`:
```tsx
const meta = CATEGORY_META[expense.category]
<span className="text-lg">{meta.icon}</span>  // ✈️, 🍜, 🚕, etc.
```

## Charts

Use `recharts` for data visualization:
```tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

<ResponsiveContainer width="50%" height={160}>
  <PieChart>
    <Pie data={data} dataKey="value" cx="50%" cy="50%"
      innerRadius={40} outerRadius={65} paddingAngle={3}>
      {data.map((entry, i) => (
        <Cell key={i} fill={entry.color} />
      ))}
    </Pie>
    <Tooltip formatter={(val) => formatMoney(Number(val))} />
  </PieChart>
</ResponsiveContainer>
```

## Toast Notifications

Use `react-hot-toast` for feedback:
```tsx
import toast from 'react-hot-toast'

toast.success('ההוצאה נוספה בהצלחה')
toast.error('שגיאה בשמירת הנתונים')
toast.loading('שומר...')
```

Toasts are configured in `layout.tsx` with:
- Position: top-center
- Duration: 3000ms
- RTL direction
- Rounded: 12px

## Creating New Pages

Follow this template for new pages:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { IconName } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTrip } from '@/contexts/TripContext'

export default function NewFeaturePage() {
  const { currentTrip } = useTrip()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentTrip) return
    // Fetch data
    setLoading(false)
  }, [currentTrip])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">כותרת העמוד</h1>

      {data.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="text-4xl mb-3">📦</div>
          <p className="font-bold mb-1">אין נתונים</p>
          <p className="text-sm text-gray-500">הסבר</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50"
            >
              {/* Item content */}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
```

## Accessibility Notes

- Use semantic HTML: `<button>` for actions, `<a>` for navigation
- Include `aria-label` on icon-only buttons
- Ensure color contrast meets WCAG AA (the primary blue #185FA5 passes on white)
- Touch targets minimum 44px
- Loading states should be visible (not just invisible spinners)
- Error messages should be clear in Hebrew
