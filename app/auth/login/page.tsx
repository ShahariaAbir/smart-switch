'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const appIcon =
    'https://ij78z9ah.ap-southeast.insforge.app/api/storage/buckets/uploads/objects/9990425d-bbf4-4fe8-a070-59559b4a50c7%2F1789130180555-5ae41b03-3959-4c50-b0da-140d752032a8.png?v=60925c43a7203c27d3d0edcd8bbc239f'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

    if (signInError) {
      setError('Invalid email or password.')
      setIsSubmitting(false)
      return
    }

    router.replace('/')
    router.refresh()
  }

  return (
    <main className="iot-shell auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-brand">
          <img
            src={appIcon}
            alt="Smart Switch"
            className="auth-mark"
          />

          <p className="auth-kicker">Smart Switch</p>
        </div>

        <h1 id="login-title">Welcome back</h1>

        <p className="auth-description">
          Sign in to control your shared switches.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="password">Password</label>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
