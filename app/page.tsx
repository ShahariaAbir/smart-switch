'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { LogOut, RefreshCw } from 'lucide-react'
import { LightSwitch } from '@/components/light-switch'
import { supabase, type Light } from '@/lib/supabase'

const nameCacheKey = (id: number) => `smart-switch-name-${id}`

const fetcher = async () => {
  const { data, error } = await supabase.from('lights').select('id, name, status').order('id', { ascending: true })
  if (error) throw error
  return (data ?? []).map((light) => ({
    ...light,
    name: typeof window !== 'undefined' ? window.localStorage.getItem(nameCacheKey(light.id)) ?? light.name : light.name,
  })) as Light[]
}

export default function Page() {
  const router = useRouter()
  const { data: fetchedLights, error, mutate } = useSWR('lights', fetcher, { revalidateOnFocus: true })
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (!session) router.replace('/auth/login')
      setIsCheckingAuth(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/auth/login')
      if (mounted) setIsCheckingAuth(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])
  const [lights, setLights] = useState<Light[]>([])
  const [connection, setConnection] = useState<'connecting' | 'Long press to customize button icon' | 'offline'>('connecting')
  const [pendingId, setPendingId] = useState<number | null>(null)

  useEffect(() => {
    if (fetchedLights) {
      setLights(fetchedLights)
    }
  }, [fetchedLights])

  const refresh = useCallback(async () => {
    await mutate()
  }, [mutate])

  useEffect(() => {
    let channel = supabase
      .channel('smart-switches-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lights' }, (payload) => {
        const next = payload.new as Partial<Light>
        if (payload.eventType === 'DELETE') {
          setLights((current) => current.filter((light) => light.id !== (payload.old as Light).id))
        } else if (typeof next.id === 'number') {
          setLights((current) => {
            const exists = current.some((light) => light.id === next.id)
            return exists ? current.map((light) => light.id === next.id ? { ...light, ...next } as Light : light) : [...current, next as Light].sort((a, b) => a.id - b.id)
          })
        }
        })
      .subscribe((status) => {
        setConnection(status === 'SUBSCRIBED' ? 'live' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'offline' : 'connecting')
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') refresh()
      })

    return () => { supabase.removeChannel(channel) }
  }, [refresh])

  const toggleLight = async (light: Light) => {
    setPendingId(light.id)
    const previous = lights
    setLights((current) => current.map((item) => item.id === light.id ? { ...item, status: !item.status } : item))
    const { error: rpcError } = await supabase.rpc('toggle_light', { light_id: light.id })
    if (rpcError) {
      setLights(previous)
      setConnection('offline')
    }
    setPendingId(null)
    await mutate()
  }

  const changeName = async (id: number, name: string) => {
    const nextName = name.trim()
    if (!nextName) return

    const previous = lights
    const previousName = lights.find((light) => light.id === id)?.name
    setLights((current) => current.map((light) => light.id === id ? { ...light, name: nextName } : light))
    window.localStorage.setItem(nameCacheKey(id), nextName)

    const { error: nameError } = await supabase.from('lights').update({ name: nextName }).eq('id', id)
    if (nameError) {
      setLights(previous)
      if (previousName) window.localStorage.setItem(nameCacheKey(id), previousName)
      setConnection('offline')
      return
    }

    await mutate()
  }

  const changeIcon = (id: number, icon: string) => {
    setLights((current) => current.map((light) => light.id === id ? { ...light, icon } : light))
    window.localStorage.setItem(`smart-switch-icon-${id}`, icon)
  }

  useEffect(() => {
    setLights((current) => current.map((light) => ({ ...light, icon: window.localStorage.getItem(`smart-switch-icon-${light.id}`) ?? light.icon ?? 'lightbulb' })))
  }, [fetchedLights])

  if (isCheckingAuth || !fetchedLights && !error) {
    return <main className="iot-shell auth-loading" aria-label="Loading Smart Switch">Checking access…</main>
  }

  return (
    <main className="iot-shell">
      <div className="iot-container">
        <header className="minimal-header">
          <h1>Smart Switch</h1>
          <div className="header-actions">
            <button type="button" className="refresh-button" onClick={refresh} aria-label="Refresh switch status"><RefreshCw aria-hidden="true" /></button>
            <button type="button" className="refresh-button" onClick={async () => { await supabase.auth.signOut(); router.replace('/auth/login') }} aria-label="Sign out"><LogOut aria-hidden="true" /></button>
          </div>
        </header>
        {error && <p className="error-banner">Unable to load switches. <button type="button" onClick={refresh}>Try again</button></p>}
        <section className="switch-grid" aria-label="Smart switch controls">
          {lights.map((light) => <LightSwitch key={light.id} light={light} isPending={pendingId === light.id} onToggle={toggleLight} onIconChange={(icon) => changeIcon(light.id, icon)} onNameChange={(name) => changeName(light.id, name)} />)}
        </section>
        <p className={`minimal-status ${connection}`}><span className="connection-dot" /> {connection === 'live' ? 'Long press to customize button icon' : connection === 'offline' ? 'Reconnecting' : 'Connecting'}</p>
      </div>
    </main>
  )
}
