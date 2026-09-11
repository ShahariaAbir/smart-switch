'use client'

import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bath,
  BedDouble,
  Blinds,
  LampCeiling,
  Lightbulb,
  Monitor,
  Moon,
  Music,
  PanelTop,
  Refrigerator,
  Settings2,
  Sparkles,
  Sun,
  Tv,
  Wifi,
  X,
} from 'lucide-react'
import type { Light } from '@/lib/supabase'

export type SwitchIcon = {
  id: string
  label: string
  icon: LucideIcon
}

export const switchIcons: SwitchIcon[] = [
  { id: 'lightbulb', label: 'Light', icon: Lightbulb },
  { id: 'lamp', label: 'Lamp', icon: LampCeiling },
  { id: 'bed', label: 'Bedroom', icon: BedDouble },
  { id: 'bath', label: 'Bathroom', icon: Bath },
  { id: 'blinds', label: 'Blinds', icon: Blinds },
  { id: 'tv', label: 'TV', icon: Tv },
  { id: 'monitor', label: 'Monitor', icon: Monitor },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'fridge', label: 'Kitchen', icon: Refrigerator },
  { id: 'wifi', label: 'Network', icon: Wifi },
  { id: 'sun', label: 'Daylight', icon: Sun },
  { id: 'moon', label: 'Night', icon: Moon },
]

interface LightSwitchProps {
  light: Light
  isPending?: boolean
  onToggle: (light: Light) => void
  onIconChange: (iconId: string) => void
  onNameChange: (name: string) => void
}

const LONG_PRESS_MS = 1000

export function LightSwitch({ light, isPending, onToggle, onIconChange, onNameChange }: LightSwitchProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [draftName, setDraftName] = useState(light.name)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)
  const selected = switchIcons.find((item) => item.id === light.icon) ?? switchIcons[0]
  const Icon = selected.icon

  useEffect(() => {
    if (isPickerOpen) setDraftName(light.name)
  }, [isPickerOpen, light.name])

  useEffect(() => () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }, [])

  const saveName = () => {
    onNameChange(draftName.trim() || light.name)
    setIsPickerOpen(false)
  }

  const startPress = () => {
    didLongPress.current = false
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setIsPickerOpen(true)
    }, LONG_PRESS_MS)
  }

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }

  const finishPress = () => {
    cancelPress()
  }

  return (
    <article className={`switch-card ${light.status ? 'is-on' : ''} ${isPending ? 'is-pending' : ''}`}>
      <button
        type="button"
        aria-label={`${light.name}, ${light.status ? 'on' : 'off'}. Press and hold to customize icon.`}
        aria-pressed={light.status}
        disabled={isPending}
        onPointerDown={startPress}
        onPointerUp={finishPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
        onClick={() => { if (!didLongPress.current && !isPending) onToggle(light) }}
        className="switch-trigger"
      >
        <span className="switch-card-topline">
          <span className="switch-index">{String(light.id).padStart(2, '0')}</span>
          <span className="switch-live-dot" aria-hidden="true" />
        </span>
        <span className="switch-icon-shell" aria-hidden="true">
          <Icon className="switch-icon" strokeWidth={1.6} />
          <span className="switch-icon-ring" />
        </span>
        <span className="switch-copy">
          <span className="switch-name">{light.name}</span>
          <span className="switch-state">{isPending ? 'SYNCING' : light.status ? 'ONLINE · ON' : 'ONLINE · OFF'}</span>
        </span>
        <span className="switch-toggle" aria-hidden="true">
          <span className="switch-toggle-thumb" />
        </span>
      </button>

      {isPickerOpen && (
        <div className="icon-picker" role="dialog" aria-label={`Choose an icon for ${light.name}`}>
          <div className="icon-picker-header">
            <span><Settings2 aria-hidden="true" /> Customize icon</span>
            <button type="button" onClick={() => setIsPickerOpen(false)} aria-label="Close icon picker"><X aria-hidden="true" /></button>
          </div>
          <label className="switch-name-editor">
            <span>Name</span>
            <input value={draftName} aria-label="Switch name" onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) saveName() }} />
            <button type="button" onClick={saveName}>Save</button>
          </label>
          <div className="icon-picker-scroll">
            {switchIcons.map(({ id, label, icon: PickerIcon }) => (
              <button
                type="button"
                key={id}
                className={`icon-option ${selected.id === id ? 'selected' : ''}`}
                onClick={() => { onIconChange(id); setIsPickerOpen(false) }}
                aria-label={label}
              >
                <PickerIcon aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <p className="icon-picker-hint">Swipe to explore icons</p>
        </div>
      )}
    </article>
  )
}
