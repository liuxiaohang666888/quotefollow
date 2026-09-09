'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function InvoiceHelperPage() {
  const [email, setEmail] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      alert('Thanks! I\'ll notify you when the tool is ready.')
      setEmail('')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="max-w-4xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Stop Chasing Unpaid Invoices Manually
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Automatically follow up on overdue invoices. Friendly on day 3, firm on day 7, final notice on day 14. You focus on work, not collections.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 md:p-12 max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Join the Waitlist</h2>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Notify Me — $9/month (Early Access)
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            No credit card needed. Cancel anytime.
          </p>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-6 text-center">
          <div className="p-4">
            <div className="text-3xl font-bold text-blue-600 mb-2">Day 3</div>
            <div className="text-gray-600">Friendly reminder</div>
          </div>
          <div className="p-4">
            <div className="text-3xl font-bold text-orange-600 mb-2">Day 7</div>
            <div className="text-gray-600">Formal follow-up</div>
          </div>
          <div className="p-4">
            <div className="text-3xl font-bold text-red-600 mb-2">Day 14</div>
            <div className="text-gray-600">Final notice</div>
          </div>
        </div>

        <div className="mt-16 max-w-2xl mx-auto text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Why $9/month?</h3>
          <ul className="space-y-3 text-left text-gray-600">
            <li className="flex items-start gap-2"><span className="text-blue-600">✓</span> Connects to your email (Gmail/Outlook)</li>
            <li className="flex items-start gap-2"><span className="text-blue-600">✓</span> Detects unpaid invoices automatically</li>
            <li className="flex items-start gap-2"><span className="text-blue-600">✓</span> AI writes the follow-up emails for you</li>
            <li className="flex items-start gap-2"><span className="text-blue-600">✓</span> 3-stage sequence: friendly → firm → final</li>
            <li className="flex items-start gap-2"><span className="text-blue-600">✓</span> Dashboard to track all outstanding invoices</li>
            <li className="flex items-start gap-2"><span className="text-blue-600">✓</span> No hidden fees, no per-invoice charges</li>
          </ul>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/signup"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Already have QuoteFollow? → Add invoice follow-up to your account
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-200 py-8 text-center text-gray-500 text-sm">
        Built by QuoteFollow · <a href="/privacy" className="underline hover:text-gray-700">Privacy</a> · <a href="/terms" className="underline hover:text-gray-700">Terms</a>
      </footer>
    </main>
  )
}