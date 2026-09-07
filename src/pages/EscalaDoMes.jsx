// src/pages/Escalas.jsx
import React, { useEffect, useState } from 'react'

export default function Escalas() {
  const [escalaMensal, setEscalaMensal] = useState(null)

  useEffect(() => {
    const carregarEscala = () => {
      const stored = localStorage.getItem('escala_mensal')
      if (stored) {
        setEscalaMensal(JSON.parse(stored))
      }
    }
    carregarEscala()
    window.addEventListener('storage', carregarEscala)
    return () => window.removeEventListener('storage', carregarEscala)
  }, [])

  const containerStyle = {
    background: '#f5f0e8',
    minHeight: '100vh',
    padding: '40px 20px',
    fontFamily: 'Inter, sans-serif'
  }

  const innerStyle = {
    maxWidth: 900,
    margin: '0 auto'
  }

  const cardStyle = {
    background: '#fff',
    borderRadius: '14px',
    padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    border: '1px solid #ece9e0'
  }

  return (
    <div style={containerStyle}>
      <div style={innerStyle}>

        {/* Título da página */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 28, color: '#1a2a5e', fontWeight: 900, letterSpacing: 0.5 }}>
            📢 Escala do Mês
          </h2>
        </div>

        <div style={cardStyle}>
          {!escalaMensal ? (
            <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
              A escala deste mês ainda não foi publicada pela administração.
            </p>
          ) : (
            <div>
              {/* Mês/Ano */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#1a2a5e', textTransform: 'capitalize' }}>
                  {escalaMensal.monthLabel}
                </span>
              </div>

              {/* Lista de dias */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {escalaMensal.data.map((dia, idx) => (
                  <div key={idx} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #ece9e0' }}>
                    
                    {/* Data */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #e8a020' }}>
                      <span style={{ fontSize: 18 }}>📅</span>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#1a2a5e', textTransform: 'capitalize' }}>
                        {new Date(dia.data + 'T00:00:00').toLocaleDateString('pt-BR', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long'
                        })}
                      </span>
                    </div>

                    {/* Manhã e Noite lado a lado */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {['Manhã', 'Noite'].map(periodo => (
                        <div key={periodo}>
                          {/* Título do período */}
                          <div style={{ fontWeight: 800, fontSize: 12, color: '#1a2a5e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, borderBottom: '1px solid #e8e8e8', paddingBottom: 4 }}>
                            {periodo}
                          </div>

                          {/* Itens da escala */}
                          {dia.turnos[periodo] && Object.entries(dia.turnos[periodo]).length > 0 ? (
                            Object.entries(dia.turnos[periodo]).map(([funcao, nome]) => {
                              const cleaned = String(nome || '').replace(/\u00A0/g, ' ').trim()
                              const isVago = cleaned === '' || cleaned.toLowerCase() === 'vago'
                              if (isVago) return null
                              return (
                                <div key={funcao} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                                  <span style={{ fontWeight: 700, color: '#374151', minWidth: 90 }}>{funcao}:</span>
                                  <span style={{ color: '#111', fontWeight: 500 }}>{cleaned}</span>
                                  {(funcao === 'Som' || funcao === 'Holyrics') && periodo === 'Noite' && (
                                    <button
                                      onClick={() => alert('Você deverá ir ao ensaio no sábado as 09:00, por favor.')}
                                      style={{
                                        marginLeft: 4,
                                        padding: '2px 8px',
                                        borderRadius: 6,
                                        background: '#7f1d1d',
                                        color: '#fff',
                                        border: 'none',
                                        fontSize: 11,
                                        cursor: 'pointer',
                                        fontWeight: 700
                                      }}
                                    >
                                      Sábado
                                    </button>
                                  )}
                                </div>
                              )
                            })
                          ) : (
                            <div style={{ color: '#9ca3af', fontSize: 13 }}>Sem escala</div>
                          )}
                        </div>
                      ))}
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}