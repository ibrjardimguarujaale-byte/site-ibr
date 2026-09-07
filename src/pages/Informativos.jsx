// src/pages/Informativos.jsx
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Informativos() {
  const [informativos, setInformativos] = useState([])
  const [loading, setLoading] = useState(true)
  const [informativoSelecionado, setInformativoSelecionado] = useState(null)

  useEffect(() => {
    fetchInformativos()
  }, [])

  useEffect(() => {
    function fecharComEsc(event) {
      if (event.key === 'Escape') {
        setInformativoSelecionado(null)
      }
    }

    document.addEventListener('keydown', fecharComEsc)

    return () => {
      document.removeEventListener('keydown', fecharComEsc)
    }
  }, [])

  async function fetchInformativos() {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('informativos')
        .select('id, titulo, conteudo, imagem_url, fixado, created_at')
        .order('fixado', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      setInformativos(data || [])
    } catch (error) {
      console.error('Erro ao buscar informativos:', error)

      const local = JSON.parse(
        localStorage.getItem('informativos_ibr') || '[]'
      )

      const informativosOrdenados = [...local].sort((a, b) => {
        if (Boolean(a.fixado) !== Boolean(b.fixado)) {
          return a.fixado ? -1 : 1
        }

        return 0
      })

      setInformativos(informativosOrdenados)
    } finally {
      setLoading(false)
    }
  }

  function fecharInformativo() {
    setInformativoSelecionado(null)
  }

  function formatarData(data) {
    if (!data) return ''

    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          color: '#666'
        }}
      >
        Carregando informativos...
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#f7f6f5',
        minHeight: '100vh',
        padding: '40px 20px 80px'
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#1a1a1a',
            margin: '0 0 30px',
            textAlign: 'center'
          }}
        >
          Informativos
        </h2>

        {informativos.length === 0 ? (
          <p
            style={{
              textAlign: 'center',
              color: '#999'
            }}
          >
            Nenhum informativo publicado no momento.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 24 }}>
            {informativos.map((item) => {
              const imagem = item.imagem_url || item.imagemDataUrl

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setInformativoSelecionado(item)}
                  style={{
                    width: '100%',
                    padding: 0,
                    textAlign: 'left',
                    background: '#fff',
                    borderRadius: 16,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: item.fixado
                      ? '2px solid #6b1515'
                      : '1px solid #eeeeee',
                    boxShadow: item.fixado
                      ? '0 10px 30px rgba(107, 21, 21, 0.12)'
                      : '0 4px 15px rgba(0,0,0,0.05)',
                    position: 'relative',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.transform = 'translateY(-3px)'
                    event.currentTarget.style.boxShadow =
                      '0 12px 28px rgba(0,0,0,0.12)'
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.transform = 'translateY(0)'
                    event.currentTarget.style.boxShadow = item.fixado
                      ? '0 10px 30px rgba(107, 21, 21, 0.12)'
                      : '0 4px 15px rgba(0,0,0,0.05)'
                  }}
                >
                  {item.fixado && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        background: '#6b1515',
                        color: '#fff',
                        padding: '5px 12px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: 1,
                        zIndex: 2,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
                      }}
                    >
                      IMPORTANTE
                    </div>
                  )}

                  {imagem && (
                    <div
                      style={{
                        width: '100%',
                        height: 240,
                        overflow: 'hidden',
                        background: '#f3f4f6'
                      }}
                    >
                      <img
                        src={imagem}
                        alt={item.titulo}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block'
                        }}
                      />
                    </div>
                  )}

                  <div style={{ padding: 24 }}>
                    <h3
                      style={{
                        margin: '0 0 10px',
                        fontSize: 20,
                        color: item.fixado ? '#6b1515' : '#1a1a1a',
                        fontWeight: 800
                      }}
                    >
                      {item.titulo}
                    </h3>

                    {item.conteudo && (
                      <p
                        style={{
                          margin: 0,
                          color: '#555',
                          lineHeight: 1.6,
                          fontSize: 15,
                          whiteSpace: 'pre-wrap',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {item.conteudo}
                      </p>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        marginTop: 18
                      }}
                    >
                      <span style={{ color: '#999', fontSize: 12 }}>
                        {formatarData(item.created_at)}
                      </span>

                      <span
                        style={{
                          color: '#6b1515',
                          fontWeight: 800,
                          fontSize: 13
                        }}
                      >
                        Ler mais →
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Tela cheia do informativo */}
      {informativoSelecionado && (
        <div
          onClick={fecharInformativo}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.78)',
            padding: 16,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 950,
              height: '100%',
              maxHeight: '95vh',
              background: '#fff',
              borderRadius: 16,
              overflowY: 'auto',
              position: 'relative',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)'
            }}
          >
            <button
              type="button"
              onClick={fecharInformativo}
              style={{
                position: 'sticky',
                top: 14,
                float: 'right',
                margin: '14px 14px 0 0',
                zIndex: 5,
                background: '#6b1515',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 14px',
                cursor: 'pointer',
                fontWeight: 800,
                boxShadow: '0 3px 10px rgba(0,0,0,0.2)'
              }}
            >
              × Fechar
            </button>

            {informativoSelecionado.fixado && (
              <div
                style={{
                  display: 'inline-block',
                  margin: '24px 24px 0',
                  background: '#6b1515',
                  color: '#fff',
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 1
                }}
              >
                IMPORTANTE
              </div>
            )}

            {(informativoSelecionado.imagem_url ||
              informativoSelecionado.imagemDataUrl) && (
              <img
                src={
                  informativoSelecionado.imagem_url ||
                  informativoSelecionado.imagemDataUrl
                }
                alt={informativoSelecionado.titulo}
                style={{
                  display: 'block',
                  width: '100%',
                  maxHeight: '65vh',
                  objectFit: 'contain',
                  background: '#111',
                  marginTop: informativoSelecionado.fixado ? 16 : 0
                }}
              />
            )}

            <div
              style={{
                padding: '28px 24px 40px',
                clear: 'both'
              }}
            >
              <h2
                style={{
                  margin: 0,
                  color: informativoSelecionado.fixado
                    ? '#6b1515'
                    : '#1a1a1a',
                  fontSize: 28,
                  lineHeight: 1.25,
                  fontWeight: 900
                }}
              >
                {informativoSelecionado.titulo}
              </h2>

              {informativoSelecionado.created_at && (
                <p
                  style={{
                    margin: '10px 0 24px',
                    color: '#888',
                    fontSize: 13
                  }}
                >
                  Publicado em {formatarData(informativoSelecionado.created_at)}
                </p>
              )}

              <div
                style={{
                  color: '#333',
                  fontSize: 17,
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap'
                }}
              >
                {informativoSelecionado.conteudo}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}