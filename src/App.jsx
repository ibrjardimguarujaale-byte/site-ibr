// src/App.jsx
import React, { useEffect, useState } from 'react'
import { Link, Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Restricoes from './pages/Restricoes.jsx'
import Login from './pages/Login.jsx'
import Admin from './pages/Admin.jsx'
import EscalaDoMes from './pages/EscalaDoMes.jsx'
import Tutoriais from './pages/Tutoriais.jsx'
import Informativos from './pages/Informativos.jsx'
import './index.css'
import Registro from './pages/Registro';

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('current_user') || sessionStorage.getItem('current_user')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function ProtectedRoute({ children, requireAdmin = false }) {
  const location = useLocation()
  const user = getCurrentUser()
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (requireAdmin && user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

const DEFAULT_LOGO = '/ibr.jpg'

function Header() {
  const navigate = useNavigate()
  const user = getCurrentUser()

  const [logoUrl, setLogoUrl] = useState(() => {
    try {
      return localStorage.getItem('ibr_logo_url') || DEFAULT_LOGO
    } catch {
      return DEFAULT_LOGO
    }
  })

  useEffect(() => {
    function onStorage(e) {
      if (!e || e.key === 'ibr_logo_url' || e.key === 'ibr_logo_url_sync') {
        try {
          setLogoUrl(localStorage.getItem('ibr_logo_url') || DEFAULT_LOGO)
        } catch {
          setLogoUrl(DEFAULT_LOGO)
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function handleLogoClick() {
    // DEPOIS
if (user && (user.role === 'admin')) {
      navigate('/admin')
    } else {
      navigate('/')
    }
  }

  function logout() {
    localStorage.removeItem('current_user')
    sessionStorage.removeItem('current_user')
    try { window.dispatchEvent(new StorageEvent('storage', { key: 'current_user', newValue: null })) } catch {}
    navigate('/')
  }

  return (
    <header className="app-header" style={{ position: 'sticky', top: 0, zIndex: 60, background: '#fff', borderBottom: '1px solid #eee' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px', boxSizing: 'border-box' }}>
        <div onClick={handleLogoClick} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none', minWidth: 0 }}>
          <img
            src={logoUrl}
            alt="Logo IBR"
            style={{ height: 40, width: 'auto', borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_LOGO }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#7f1d1d', fontSize: 16, lineHeight: 1 }}>{/* título truncável */}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Jardim Guarujá</div>
          </div>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/restricoes" style={headerBtnStyle}>Restrições</Link>
          <Link to="/informativos" style={headerBtnStyle}>Informativos</Link>
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {user ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{
                textAlign: 'right', padding: '6px 12px', borderRadius: '8px',
                border: user.role === 'lider' ? '2px solid #ffd700' : 'none',
                boxShadow: user.role === 'lider' ? '0 0 10px rgba(255, 215, 0, 0.35)' : 'none',
                background: user.role === 'lider' ? 'linear-gradient(to right, #fff, #fffaf0)' : 'transparent',
                minWidth: 0
              }}>
                <div style={{ fontWeight: 700, color: user.role === 'lider' ? '#b8860b' : 'inherit', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.nome} {user.role === 'lider' && '⭐'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {Array.isArray(user.funcao) ? user.funcao.join(', ') : user.funcao}
                </div>
              </div>
              <button onClick={logout} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 13 }}>Sair</button>
            </div>
          ) : (
            <Link to="/login" style={{ fontWeight: 600, color: '#7f1d1d', textDecoration: 'none' }}>Entrar</Link>
          )}
        </div>
      </div>
    </header>
  )
}

function BottomTabs() {
  const user = getCurrentUser()
  if (!user) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: '1px solid #e2e8f0',
      padding: '10px 0', zIndex: 100, boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Link to="/" style={btnStyle}>
          <span style={{ fontSize: 20 }}>🏠</span>
          <span style={{ fontSize: 11, fontWeight: 700 }}>INÍCIO</span>
        </Link>
        <Link to="/escala-do-mes" style={btnStyle}>
          <span style={{ fontSize: 20 }}>📅</span>
          <span style={{ fontSize: 11, fontWeight: 700 }}>ESCALA</span>
        </Link>
        <Link to="/tutoriais" style={btnStyle}>
          <span style={{ fontSize: 20 }}>🎓</span>
          <span style={{ fontSize: 11, fontWeight: 700 }}>TUTORIAIS</span>
        </Link>
      </div>
    </div>
  )
}

const headerBtnStyle = {
  background: '#4b0f0f',
  color: '#fff',
  padding: '8px 12px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '13px'
}

const btnStyle = {
  background: '#0f172a',
  color: '#fff',
  textDecoration: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '10px',
  borderRadius: '12px',
  gap: 4
}

export default function App() {
  return (
    <div style={{ paddingBottom: 120 }}>
      <Header />
      <main className="page-root" style={{ minHeight: '100vh' }}>
        <Routes>
          <Route path="/registro" element={<Registro />} />
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          <Route path="/restricoes" element={<ProtectedRoute><Restricoes /></ProtectedRoute>} />

          <Route path="/escala-do-mes" element={<ProtectedRoute><EscalaDoMes /></ProtectedRoute>} />
          <Route path="/tutoriais" element={<ProtectedRoute><Tutoriais /></ProtectedRoute>} />
          <Route path="/informativos" element={<ProtectedRoute><Informativos /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><Admin /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomTabs />
    </div>
  )
}