'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function BookingPaymentPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, product: 'booking-payment' }),
      })
      if (res.ok) {
        setStatus('done')
        setEmail('')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="max-w-4xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Simple Booking + Payment for Service Pros
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            No hidden fees. No per-booking charges. Just $15/month — clients book, pay online, you get paid. Built for hair stylists, massage therapists, trainers, consultants.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 md:p-12 max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Join the Waitlist</h2>
          {status === 'done' ? (
            <div className="text-center py-6">
              <p className="text-lg font-medium text-green-700 mb-2">You&apos;re on the list!</p>
              <p className="text-gray-600">We&apos;ll email you when the tool is ready.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Your email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourbusiness.com"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                {status === 'loading' ? 'Joining...' : 'Notify Me — $15/month (Early Access)'}
              </button>
              {status === 'error' && (
                <p className="text-sm text-red-600 text-center">Something went wrong. Please try again.</p>
              )}
            </form>
          )}
          <p className="text-center text-sm text-gray-500 mt-4">
            No credit card needed. Cancel anytime.
          </p>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-6 text-center">
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <div className="text-3xl font-bold text-green-600 mb-2">$15/mo</div>
            <div className="text-gray-600 text-sm">Flat rate — no surprises</div>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <div className="text-3xl font-bold text-green-600 mb-2">0%</div>
            <div className="text-gray-600 text-sm">Per-booking fees</div>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <div className="text-3xl font-bold text-green-600 mb-2">∞</div>
            <div className="text-gray-600 text-sm">Unlimited bookings</div>
          </div>
        </div>

        <div className="mt-16 max-w-2xl mx-auto text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">What you get</h3>
          <ul className="space-y-3 text-left text-gray-600">
            <li className="flex items-start gap-2"><span className="text-green-600">✓</span> Custom booking page (yourname.book)</li>
            <li className="flex items-start gap-2"><span className="text-green-600">✓</span> Clients book + pay in one flow (Stripe)</li>
            <li className="flex items-start gap-2"><span className="text-green-600">✓</span> Packages & memberships (sell 5-session packs)</li>
            <li className="flex items-start gap-2"><span className="text-green-600">✓</span> Automatic reminders (email + SMS)</li>
            <li className="flex items-start gap-2"><span className="text-green-600">✓</span> Calendar sync (Google/Outlook)</li>
            <li className="flex items-start gap-2"><span className="text-green-600">✓</span> Dashboard: revenue, clients, utilization</li>
          </ul>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/signup"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Already have QuoteFollow? → Add booking to your account
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-200 py-8 text-center text-gray-500 text-sm">
        Built by QuoteFollow · <a href="/privacy" className="underline hover:text-gray-700">Privacy</a> · <a href="/terms" className="underline hover:text-gray-700">Terms</a>
      </footer>
    </main>
  )
}
