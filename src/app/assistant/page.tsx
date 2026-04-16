'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Send, Bot, User, Sparkles, MapPin, Utensils, Wallet, HelpCircle } from 'lucide-react'
import { useTrip } from '@/contexts/TripContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const QUICK_ACTIONS = [
  { label: 'מה כדאי לעשות?', icon: MapPin, prompt: 'מה כדאי לעשות ביעד הנסיעה שלי? תן לי 5 המלצות' },
  { label: 'איפה לאכול?', icon: Utensils, prompt: 'תמליץ על מסעדות טובות ביעד שלי' },
  { label: 'סיכום הוצאות', icon: Wallet, prompt: 'תן לי סיכום של ההוצאות שלי עד עכשיו' },
  { label: 'טיפים מקומיים', icon: HelpCircle, prompt: 'מה חשוב לדעת על היעד שלי? טיפים מקומיים' },
]

export default function AssistantPage() {
  const router = useRouter()
  const { currentTrip } = useTrip()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          tripId: currentTrip?.id,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'סליחה, משהו השתבש. נסה שוב.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-gray-100 active:scale-95">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
        >
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold">Tripix AI</h1>
          <p className="text-[10px] text-gray-400">
            {currentTrip ? `${currentTrip.name} · ${currentTrip.destination}` : 'עוזר נסיעה חכם'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="text-center pt-8">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
            >
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h2 className="font-black text-xl mb-1 text-gray-800">שלום! אני Tripix AI</h2>
            <p className="text-sm text-gray-400 mb-8 leading-relaxed">
              אני מכיר את הנסיעה שלך ויכול לעזור<br />עם כל שאלה — שאל אותי!
            </p>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(action.prompt)}
                  className="bg-white rounded-2xl p-4 text-right shadow-sm border border-gray-100 hover:shadow-md active:scale-[0.97] transition-all"
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
                    style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
                  >
                    <action.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                  style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
                >
                  {msg.role === 'user' ? (
                    <User className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'text-white rounded-br-md'
                      : 'bg-white shadow-sm rounded-bl-md text-gray-800'
                  }`}
                  style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : {}}
                >
                  {msg.content.split('\n').map((line, j) => (
                    <p key={j} className={j > 0 ? 'mt-1.5' : ''}>{line}</p>
                  ))}
                </div>
              </motion.div>
            ))}

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
                >
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#9B7BFF', animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#7F5FFF', animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#6C47FF', animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t px-4 py-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="שאל אותי כל דבר על הנסיעה..."
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 disabled:opacity-40 transition-all"
            style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
