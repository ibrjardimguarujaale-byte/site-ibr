// src/pages/Restricoes.jsx
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Restricoes() {
  const [usuarioLogado, setUsuarioLogado] = useState(null)
  const [data, setData] = useState('')
  const [periodos, setPeriodos] = useState([])
  const [restricoes, setRestricoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  // novos estados
  const [membros, setMembros] = useState([])
  const [selectedMemberId, setSelectedMemberId] = useState(null)

  // modal "Todos os Sábados"
  const [showTodosSabadosModal, setShowTodosSabadosModal] = useState(false)
  const [todosSabadosMonth, setTodosSabadosMonth] = useState('') // formato YYYY-MM
  const [todosSabadosMemberId, setTodosSabadosMemberId] = useState(null)
  const [todosSabadosProcessing, setTodosSabadosProcessing] = useState(false)

  const carregarMembros = async () => {
    try {
      const { data, error } = await supabase
        .from('membros')
        .select('id, nome, funcao')
        .order('nome', { ascending: true })

      if (error) throw error
      setMembros(data || [])
    } catch (err) {
      console.error('Erro ao carregar membros:', err)
      setMembros([])
    }
  }

  const carregarRestricoes = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('restricoes')
        .select('id, responsavel, data, periodo, member_id, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRestricoes(data || [])
    } catch (error) {
      console.error('Erro ao buscar restrições:', error)
      alert('Não foi possível carregar as restrições do Supabase.')
      setRestricoes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('current_user')
      if (!raw) {
        // não interrompear execuções, só informa
        console.warn('current_user não encontrado no localStorage')
        return
      }
      const user = JSON.parse(raw)
      if (!user?.id || !user?.nome) {
        console.warn('Usuário no localStorage sem id/nome')
        setUsuarioLogado(null)
        return
      }
      setUsuarioLogado(user)
      // default temporário — será atualizado quando membros carregarem
      setSelectedMemberId(user.id)
    } catch (error) {
      console.error('Erro ao obter usuário logado:', error)
      setUsuarioLogado(null)
    }

    carregarMembros()
    carregarRestricoes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // quando membros carregarem, se o selectedMemberId não estiver setado, coloque o próprio usuário (se presente)
  useEffect(() => {
    if (!selectedMemberId && usuarioLogado && membros.length > 0) {
      const encontrado = membros.find((m) => String(m.id) === String(usuarioLogado.id))
      if (encontrado) setSelectedMemberId(encontrado.id)
    }
  }, [membros, usuarioLogado, selectedMemberId])

  const togglePeriodo = (periodo) => {
    setPeriodos((atual) =>
      atual.includes(periodo) ? atual.filter((item) => item !== periodo) : [...atual, periodo]
    )
  }

  // detector robusto para identificar se o usuário é líder/adm
  const isLeaderOrAdmin = useMemo(() => {
    if (!usuarioLogado) return false

    // 1) verificar flags diretas no objeto de sessão (ex.: is_admin, role, roles)
    try {
      if (usuarioLogado.is_admin === true || usuarioLogado.admin === true || usuarioLogado.isAdmin === true) {
        return true
      }

      const rolesCandidates = []
      if (usuarioLogado.role) rolesCandidates.push(String(usuarioLogado.role))
      if (usuarioLogado.roles && Array.isArray(usuarioLogado.roles)) rolesCandidates.push(...usuarioLogado.roles)
      if (usuarioLogado.perfis && Array.isArray(usuarioLogado.perfis)) rolesCandidates.push(...usuarioLogado.perfis)

      for (const r of rolesCandidates) {
        if (!r) continue
        const s = String(r).toLowerCase()
        if (s.includes('admin') || s.includes('adm') || s.includes('líder') || s.includes('lider') || s.includes('coordenador')) {
          return true
        }
      }
    } catch (e) {
      // continue para a próxima checagem
      console.warn('Erro checando roles no usuarioLogado', e)
    }

    // 2) fallback: buscar este usuário na lista de membros e verificar o campo funcao
    try {
      const membro = membros.find((m) => String(m.id) === String(usuarioLogado.id))
      if (!membro) return false
      const funcs = Array.isArray(membro.funcao) ? membro.funcao : [membro.funcao]
      for (const f of funcs) {
        if (!f) continue
        const s = String(f).toLowerCase()
        if (s.includes('líder') || s.includes('lider') || s.includes('admin') || s.includes('adm') || s.includes('administrador') || s.includes('coordenador') || s.includes('pastor')) {
          return true
        }
      }
    } catch (e) {
      console.warn('Erro checando funcao em membros', e)
    }

    return false
  }, [usuarioLogado, membros])

  const enviarRestricao = async (event) => {
    event.preventDefault()

    if (!usuarioLogado?.id || !usuarioLogado?.nome) {
      alert('Não foi possível identificar seu usuário. Faça login novamente.')
      return
    }

    if (!data || periodos.length === 0) {
      alert('Escolha uma data e ao menos um período.')
      return
    }

    // alvo: se for líder/adm e escolheu outro membro, usar esse; senao usar id do próprio usuário
    const alvoId = isLeaderOrAdmin && selectedMemberId ? String(selectedMemberId) : String(usuarioLogado.id)
    const alvoMembro = membros.find((m) => String(m.id) === String(alvoId))
    const responsavelNome = alvoMembro ? String(alvoMembro.nome).trim() : String(usuarioLogado.nome).trim()

    setEnviando(true)
    try {
      const novaRestricao = {
        responsavel: responsavelNome,
        member_id: alvoId,
        data,
        periodo: periodos
      }

      const { data: restricaoSalva, error } = await supabase
        .from('restricoes')
        .insert([novaRestricao])
        .select('id, responsavel, data, periodo, member_id, created_at')
        .single()

      if (error) {
        // possivel RLS bloqueando
        console.error('Erro do Supabase ao inserir restrição:', error)
        throw error
      }

      setRestricoes((listaAtual) => [restricaoSalva, ...listaAtual])
      setData('')
      setPeriodos([])
    } catch (error) {
      console.error('Erro ao salvar restrição:', error)
      alert(
        'Não foi possível salvar sua restrição no Supabase. Verifique as políticas da tabela restricoes (RLS) e se você tem permissão para criar em nome de outro membro.'
      )
    } finally {
      setEnviando(false)
    }
  }

  // --- helpers para "Todos os Sábados" ---
  function pad2(n) {
    return String(n).padStart(2, '0')
  }

  function dateToYMD(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  }

  function monthLabelFromYYYYMM(yyyymm) {
    if (!yyyymm) return ''
    try {
      const [y, m] = yyyymm.split('-').map(Number)
      const d = new Date(y, m - 1, 1)
      return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    } catch {
      return yyyymm
    }
  }

  const openTodosSabadosModal = (prefillMemberId = null) => {
    // preenche o mês com o mês atual por padrão
    const d = new Date()
    setTodosSabadosMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    setTodosSabadosMemberId(prefillMemberId ?? selectedMemberId ?? usuarioLogado?.id ?? null)
    setShowTodosSabadosModal(true)
  }

  const handleSaveTodosSabados = async () => {
    if (!usuarioLogado?.id || !usuarioLogado?.nome) {
      alert('Não foi possível identificar seu usuário. Faça login novamente.')
      return
    }
    if (!todosSabadosMonth) {
      alert('Escolha o mês (YYYY-MM).')
      return
    }

    // alvo: se for líder/adm e escolheu outro membro, usar esse; senao usar o próprio usuário
    const alvoId = isLeaderOrAdmin && todosSabadosMemberId ? String(todosSabadosMemberId) : String(usuarioLogado.id)
    const alvoMembro = membros.find((m) => String(m.id) === String(alvoId))
    const responsavelNome = alvoMembro ? String(alvoMembro.nome).trim() : String(usuarioLogado.nome).trim()

    // calcular todos os sábados do mês
    const [y, m] = todosSabadosMonth.split('-').map(Number)
    if (!y || !m) {
      alert('Formato de mês inválido.')
      return
    }

    const datasSabados = []
    const dt = new Date(y, m - 1, 1, 12, 0, 0)
    while (dt.getMonth() === m - 1) {
      if (dt.getDay() === 6) {
        datasSabados.push(dateToYMD(new Date(dt)))
      }
      dt.setDate(dt.getDate() + 1)
    }

    if (datasSabados.length === 0) {
      alert('Nenhum sábado encontrado para o mês selecionado.')
      return
    }

    // montar payloads (todos os períodos: Manhã e Noite)
    const payloads = datasSabados.map((dataStr) => ({
      responsavel: responsavelNome,
      member_id: alvoId,
      data: dataStr,
      periodo: ['Manhã', 'Noite']
    }))

    setTodosSabadosProcessing(true)
    try {
      // inserir em lote
      const { data: inserted, error } = await supabase
        .from('restricoes')
        .insert(payloads)
        .select('id, responsavel, data, periodo, member_id, created_at')

      if (error) {
        console.error('Erro inserindo restrições em lote:', error)
        throw error
      }

      // atualizar UI: adiciona as restrições inseridas no topo
      if (Array.isArray(inserted) && inserted.length > 0) {
        setRestricoes((prev) => [...inserted, ...prev])
      }

      setShowTodosSabadosModal(false)
      setTodosSabadosMonth('')
      setTodosSabadosMemberId(null)
      alert(`Restrição criada para ${datasSabados.length} sábados de ${monthLabelFromYYYYMM(todosSabadosMonth)}.`)
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar restrições: ' + (err?.message || err))
    } finally {
      setTodosSabadosProcessing(false)
    }
  }

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '24px auto',
        padding: '0 16px',
        fontFamily:
          'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
      }}
    >
      <h2 style={{ color: '#7f1d1d', marginBottom: 6 }}>
        Enviar Restrição
      </h2>

      <p style={{ color: '#6b7280', marginTop: 0 }}>
        Selecione a data e os períodos que você não poderá estar disponível.
      </p>
      <p style={{ color: '#7f1d1d', marginTop: 0 }}>
        !Para quem não puder ir no ensaio de manhã, colocar: Nome, Data (Todos os sábados que não puder ir), Períodos (Noite). Por favor e obrigado.
      </p>

      <form
        onSubmit={enviarRestricao}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 220px',
          gap: 12,
          background: '#ffffff',
          padding: 16,
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
          border: '1px solid #eef2f6'
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6
            }}
          >
            Seu nome
          </label>

          <div
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 8,
              border: '1px solid #e6e9ee',
              background: '#f8fafc',
              color: '#111827',
              fontWeight: 600
            }}
          >
            {usuarioLogado?.nome || 'Carregando usuário...'}
          </div>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6
            }}
          >
            Data
          </label>

          <input
            type="date"
            value={data}
            onChange={(event) => setData(event.target.value)}
            disabled={!usuarioLogado || enviando}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 8,
              border: '1px solid #e6e9ee',
              background: enviando ? '#f3f4f6' : '#fff'
            }}
          />
        </div>

        {/* Se for líder/adm, mostrar select para escolher outro membro */}
        {isLeaderOrAdmin && (
          <div style={{ gridColumn: '1 / span 2' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Criar restrição em nome de
            </label>

            <select
              value={selectedMemberId ?? ''}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              disabled={enviando}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 8,
                border: '1px solid #e6e9ee',
                background: '#fff'
              }}
            >
              <option value="">{usuarioLogado?.nome} (eu)</option>
              {membros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} {m.funcao ? `— ${Array.isArray(m.funcao) ? m.funcao.join(', ') : m.funcao}` : ''}
                </option>
              ))}
            </select>

            <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>
              Você é lider/administrador — pode criar restrições em nome de qualquer membro.
            </div>
          </div>
        )}

        {!isLeaderOrAdmin && (
          <div style={{ gridColumn: '1 / span 2' }}>
            <div style={{ height: 8 }} />
          </div>
        )}

        <div style={{ gridColumn: '1 / span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>
              Períodos
            </label>

            {/* Botão "Todos os Sábados" ao lado do label */}
            <button
              type="button"
              onClick={() => openTodosSabadosModal()}
              disabled={todosSabadosProcessing}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #f0e68c',
                background: '#fde68a',
                color: '#7f1d1d',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13
              }}
            >
              Todos os Sábados
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {['Manhã', 'Noite'].map((periodo) => (
              <button
                key={periodo}
                type="button"
                disabled={!usuarioLogado || enviando}
                onClick={() => togglePeriodo(periodo)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: periodos.includes(periodo) ? '1px solid #7f1d1d' : '1px solid #e6e9ee',
                  background: periodos.includes(periodo) ? '#7f1d1d' : '#fff',
                  color: periodos.includes(periodo) ? '#fff' : '#111',
                  cursor: enviando ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  opacity: enviando ? 0.65 : 1
                }}
              >
                {periodo}
              </button>
            ))}
          </div>
        </div>

        <div style={{ gridColumn: '1 / span 2', textAlign: 'right' }}>
          <button
            type="submit"
            className="btn-vinho"
            disabled={!usuarioLogado || enviando}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              cursor: enviando ? 'not-allowed' : 'pointer',
              opacity: enviando ? 0.65 : 1
            }}
          >
            {enviando ? 'Enviando...' : 'Enviar restrição'}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 18 }}>
        <div
          style={{
            background: '#fff',
            padding: 12,
            borderRadius: 12,
            boxShadow: '0 8px 20px rgba(15,23,42,0.04)',
            border: '1px solid #eef2f6',
            maxHeight: 600,
            overflow: 'auto'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 8px'
            }}
          >
            <h3 style={{ margin: 0, color: '#111', fontSize: 15 }}>
              Restrições Pendentes
            </h3>

            <div style={{ color: '#6b7280', fontSize: 12 }}>
              {restricoes.length} itens
            </div>
          </div>

          <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
            {loading ? (
              <div
                style={{
                  padding: 12,
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: 13
                }}
              >
                Carregando restrições...
              </div>
            ) : restricoes.length === 0 ? (
              <div
                style={{
                  padding: 12,
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: 13
                }}
              >
                Nenhuma restrição enviada.
              </div>
            ) : (
              restricoes.map((restricao) => (
                <div
                  key={restricao.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid #f3f4f6',
                    background: '#fff'
                  }}
                >
                  <div style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 700 }}>
                      {restricao.responsavel}
                    </div>

                    <div style={{ color: '#6b7280', fontSize: 12 }}>
                      {new Date(`${restricao.data}T00:00:00`).toLocaleDateString('pt-BR')}{' '}
                      •{' '}
                      {Array.isArray(restricao.periodo) ? restricao.periodo.join(', ') : restricao.periodo}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ---- Modal: Todos os Sábados ---- */}
      {showTodosSabadosModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Bloquear todos os sábados</h3>
              <button onClick={() => setShowTodosSabadosModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ fontSize: 13, color: '#374151' }}>Membro</label>

              {isLeaderOrAdmin ? (
                <select
                  value={todosSabadosMemberId ?? ''}
                  onChange={(e) => setTodosSabadosMemberId(e.target.value)}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #e6e9ee' }}
                >
                  <option value="">-- Escolha um membro --</option>
                  {membros.map(mem => <option key={mem.id} value={mem.id}>{mem.nome}</option>)}
                </select>
              ) : (
                <div style={{ padding: 10, borderRadius: 8, border: '1px solid #e6e9ee', background: '#f8fafc', fontWeight: 600 }}>
                  {usuarioLogado?.nome || 'Carregando usuário...'}
                </div>
              )}

              <label style={{ fontSize: 13, color: '#374151' }}>Mês (referência)</label>
              <input
                type="month"
                value={todosSabadosMonth}
                onChange={(e) => setTodosSabadosMonth(e.target.value)}
                style={{ padding: 10, borderRadius: 8, border: '1px solid #e6e9ee' }}
              />

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                <button onClick={() => setShowTodosSabadosModal(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff' }}>Cancelar</button>
                <button onClick={handleSaveTodosSabados} disabled={todosSabadosProcessing} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#6b1515', color: '#fff' }}>
                  {todosSabadosProcessing ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}