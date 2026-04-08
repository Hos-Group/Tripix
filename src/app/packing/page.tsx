'use client'

import { useState, useEffect } from 'react'
import { Check, Plus, Trash2, ChevronLeft, Luggage } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface PackingItem {
  id: string
  text: string
  checked: boolean
  category: string
}

const SUGGESTIONS: Record<string, string[]> = {
  'מסמכים': ['דרכון', 'ביטוח נסיעות', 'כרטיסי טיסה', 'הזמנות מלון', 'צילום מסמכים בענן'],
  'בגדים': ['חולצות', 'מכנסיים קצרים', 'בגד ים', 'סנדלים', 'נעלי הליכה', 'כובע', 'חולצה ארוכה למקדשים'],
  'היגיינה': ['קרם הגנה SPF50', 'דאודורנט', 'מברשת שיניים', 'תרופות אישיות', 'מגבת מיקרופייבר', 'דוחה יתושים'],
  'טכנולוגיה': ['מטען + כבל', 'פאוור בנק', 'אוזניות', 'מתאם חשמל', 'כרטיס SIM מקומי'],
  'תינוק': ['חיתולים', 'מגבונים', 'בקבוק', 'מזון תינוק', 'בגדי החלפה', 'כובע שמש', 'עגלה קלה', 'תרופות ילדים'],
  'כללי': ['כסף מזומן (THB)', 'כרטיס אשראי', 'מנעול מזוודה', 'שקית רטובה', 'ספר / קינדל'],
}

const STORAGE_KEY = 'tripix_packing_list'

export default function PackingPage() {
  const [items, setItems] = useState<PackingItem[]>([])
  const [newItem, setNewItem] = useState('')
  const [newCategory, setNewCategory] = useState('כללי')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setItems(JSON.parse(saved))
    } else {
      // Auto-generate from suggestions
      const generated: PackingItem[] = []
      Object.entries(SUGGESTIONS).forEach(([cat, list]) => {
        list.forEach(text => {
          generated.push({ id: `${cat}_${text}`, text, checked: false, category: cat })
        })
      })
      setItems(generated)
    }
  }, [])

  useEffect(() => {
    if (items.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i))
  }

  const addItem = () => {
    if (!newItem.trim()) return
    setItems(prev => [...prev, { id: Date.now().toString(), text: newItem.trim(), checked: false, category: newCategory }])
    setNewItem('')
    toast.success('נוסף!')
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const categories = Array.from(new Set(items.map(i => i.category)))
  const totalItems = items.length
  const checkedItems = items.filter(i => i.checked).length
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold">רשימת אריזה</h1>
      </div>

      {/* Progress */}
      <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Luggage className="w-5 h-5" />
            <span className="text-sm font-medium">{checkedItems} / {totalItems} פריטים</span>
          </div>
          <span className="text-2xl font-bold">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
          <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }}
            className="h-full bg-white rounded-full" />
        </div>
      </div>

      {/* Add Item */}
      <div className="flex gap-2">
        <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)}
          placeholder="הוסף פריט..."
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          className="flex-1 bg-white rounded-xl px-4 py-3 text-sm shadow-sm outline-none" />
        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
          className="bg-white rounded-xl px-3 py-3 text-xs shadow-sm outline-none w-24">
          {Object.keys(SUGGESTIONS).map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <button onClick={addItem}
          className="bg-primary text-white rounded-xl px-4 active:scale-95 transition-transform">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Items by Category */}
      {categories.map(cat => {
        const catItems = items.filter(i => i.category === cat)
        const catChecked = catItems.filter(i => i.checked).length
        return (
          <div key={cat} className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-gray-600">{cat}</span>
              <span className="text-[10px] text-gray-400">{catChecked}/{catItems.length}</span>
            </div>
            <AnimatePresence>
              {catItems.map(item => (
                <motion.div key={item.id} layout
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                  className={`bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3 ${item.checked ? 'opacity-60' : ''}`}>
                  <button onClick={() => toggleItem(item.id)}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 active:scale-90 transition-all ${item.checked ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                    {item.checked && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                  <span className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-400' : ''}`}>{item.text}</span>
                  <button onClick={() => removeItem(item.id)}
                    className="text-gray-300 hover:text-red-400 active:scale-95">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
