// src/components/BottomNav.jsx
import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function BottomNav() {
  const navigate = useNavigate()

  const items = [
    { key: 'inicio', label: 'Início', path: '/' , icon: '🏠'},
    { key: 'escala_do_mes', label: 'ESCALA DO MES', path: '/escala-do-mes' , icon: '📅'},
    { key: 'tutoriais', label: 'Tutoriais', path: '/tutoriais' , icon: '🎓'},
  ]

  return (
    <nav style={{
      position: 'fixed',
      bottom: 12,
      left: 12,
      right: 12,
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      zIndex: 50,
    }}>
      {items.map(it => (
        <button
          key={it.key}
          onClick={() => navigate(it.path)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            padding: '10px 12px',
            borderRadius: 12,
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.04)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 16 }}>{it.icon}</div>
          <div style={{ fontWeight: 600 }}>{it.label}</div>
        </button>
      ))}
    </nav>
  )
}