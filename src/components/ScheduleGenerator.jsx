// src/components/ScheduleGenerator.jsx
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/* Helpers */
function isoDateString(d) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function rangeDates(start, end) {
  const s = new Date(start)
  const e = new Date(end)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return []
  const arr = []
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) arr.push(new Date(d))
  return arr
}

function normalizeFuncaoField(funcao) {
  if (!funcao) return []
  if (Array.isArray(funcao)) return funcao.map(f => String(f).trim()).filter(Boolean)
  return String(funcao).split(',').map(s => s.trim()).filter(Boolean)
}

/* Component */
export default function ScheduleGenerator({ defaultStart }) {
  const [members, setMembers] = useState([])
  const [restrictions, setRestrictions] = useState([])
  const [roles, setRoles] = useState([])

  const [loadingMembers, setLoadingMembers] = useState(false)
  const [loadingRestrictions, setLoadingRestrictions] = useState(false)

  const [startDate, setStartDate] = useState(defaultStart || isoDateString(new Date()))
  const [days, setDays] = useState(3)
  const [includeManha, setIncludeManha] = useState(true)
  const [includeNoite, setIncludeNoite] = useState(true)
  const [membersPerSlot, setMembersPerSlot] = useState(1)

  const [generatedSchedule, setGeneratedSchedule] = useState([]) // current (editable) preview
  const [originalSchedule, setOriginalSchedule] = useState(null) // snapshot to revert to
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editingCell, setEditingCell] = useState(null) // {date, period, role, slotIndex}
  const [rolesToUseCache, setRolesToUseCache] = useState([])

  useEffect(() => {
    fetchMembers()
    fetchRestrictions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchMembers() {
    setLoadingMembers(true)
    try {
      const { data, error } = await supabase.from('members').select('id, nome, funcao, is_leader').order('nome', { ascending: true })
      if (error) throw error
      const enriched = (data || []).map(m => ({ ...m, funcaoArr: normalizeFuncaoField(m.funcao) }))
      setMembers(enriched)
      // derive roles list
      const rolesSet = new Set()
      enriched.forEach(m => m.funcaoArr.forEach(f => rolesSet.add(f)))
      const arr = Array.from(rolesSet)
      setRoles(arr)
      setRolesToUseCache(arr.length > 0 ? arr : ['OBS', 'Holyrics', 'Som', 'Foto', 'Redes Sociais'])
    } catch (err) {
      console.error('Erro ao buscar members:', err)
      setMessage({ type: 'error', text: 'Erro ao carregar membros.' })
    } finally {
      setLoadingMembers(false)
    }
  }

  async function fetchRestrictions() {
    setLoadingRestrictions(true)
    try {
      const { data, error } = await supabase.from('restrictions').select('id, member_id, date, period, role')
      if (error) throw error
      const norm = (data || []).map(r => ({ ...r, dateIso: isoDateString(r.date) }))
      setRestrictions(norm)
    } catch (err) {
      console.error('Erro ao buscar restrictions:', err)
      setMessage({ type: 'error', text: 'Erro ao carregar restrições.' })
    } finally {
      setLoadingRestrictions(false)
    }
  }

  function isRestrictedForRole(memberId, dateIso, period, role) {
    return restrictions.some(r => {
      if (!r) return false
      if (String(r.member_id) !== String(memberId)) return false
      if (String(r.dateIso) !== String(dateIso)) return false
      if (String(r.period).toLowerCase() !== String(period).toLowerCase()) return false
      if (r.role == null || r.role === '') return true
      return String(r.role).toLowerCase() === String(role).toLowerCase()
    })
  }

  function generate() {
    setMessage(null)
    setGeneratedSchedule([])

    if (!startDate) { setMessage({ type: 'error', text: 'Informe a data de início.' }); return }
    const endDate = new Date(new Date(startDate).setDate(new Date(startDate).getDate() + Number(days) - 1))
    const datesObjs = rangeDates(startDate, endDate)
    if (datesObjs.length === 0) { setMessage({ type: 'error', text: 'Intervalo de datas inválido.' }); return }

    const periods = []
    if (includeManha) periods.push('Manha')
    if (includeNoite) periods.push('Noite')
    if (periods.length === 0) { setMessage({ type: 'error', text: 'Selecione ao menos um período.' }); return }

    const pool = members.map(m => ({ id: m.id, nome: m.nome, funcaoArr: m.funcaoArr || [], is_leader: m.is_leader }))
    const assignedCounts = {}
    pool.forEach(p => { assignedCounts[p.id] = 0 })

    const schedule = []
    const rolesToUse = rolesToUseCache.length > 0 ? rolesToUseCache : ['OBS', 'Holyrics', 'Som', 'Foto', 'Redes Sociais']

    for (const dateObj of datesObjs) {
      const dateIso = isoDateString(dateObj)
      for (const period of periods) {
        for (const role of rolesToUse) {
          // eligible with role
          let eligibleWithRole = pool.filter(p => (p.funcaoArr || []).map(f => f.toLowerCase()).includes(String(role).toLowerCase()))
          eligibleWithRole = eligibleWithRole.filter(p => !isRestrictedForRole(p.id, dateIso, period, role))

          let eligibleFallback = pool.filter(p => !isRestrictedForRole(p.id, dateIso, period, role) && !eligibleWithRole.find(x => x.id === p.id))

          eligibleWithRole.sort((a, b) => (assignedCounts[a.id] || 0) - (assignedCounts[b.id] || 0))
          eligibleFallback.sort((a, b) => (assignedCounts[a.id] || 0) - (assignedCounts[b.id] || 0))

          const candidates = [...eligibleWithRole, ...eligibleFallback]

          const selected = []
          for (let i = 0; i < candidates.length && selected.length < membersPerSlot; i++) {
            const c = candidates[i]
            if (!selected.find(s => s.id === c.id)) selected.push(c)
          }

          // if not enough, leave vago for remaining slots
          for (let slotIdx = 0; slotIdx < membersPerSlot; slotIdx++) {
            const sel = selected[slotIdx] || null
            schedule.push({
              date: dateIso,
              period,
              role,
              member_id: sel ? sel.id : null,
              member_name: sel ? sel.nome : null
            })
            if (sel) assignedCounts[sel.id] = (assignedCounts[sel.id] || 0) + 1
          }
        }
      }
    }

    setGeneratedSchedule(schedule)
    // save snapshot to allow revert
    setOriginalSchedule(JSON.parse(JSON.stringify(schedule)))
    setMessage({ type: 'success', text: `Gerado ${schedule.length} entradas.` })
  }

  // revert to the original generated schedule (undo edits)
  function revertEdits() {
    if (!originalSchedule) return
    setGeneratedSchedule(JSON.parse(JSON.stringify(originalSchedule)))
    setMessage({ type: 'success', text: 'Alterações revertidas para a sugestão original.' })
  }

  // Inline edit helpers
  function openEditor(date, period, role, slotIndex) {
    setEditingCell({ date, period, role, slotIndex })
  }

  function closeEditor() {
    setEditingCell(null)
  }

  // compute slot index among the role's slots in a given period array
  function computeRoleSlotIndex(rowsArray, idx) {
    const role = rowsArray[idx].role
    let count = 0
    for (let i = 0; i < idx; i++) {
      if (rowsArray[i].role === role) count++
    }
    return count
  }

  // get candidates prioritized by those having the funcao
  function getCandidatesForCell(date, period, role, currentMemberId = null) {
    const available = members.filter(m => !isRestrictedForRole(m.id, date, period, role))
    // mark hasRole
    const withRole = available.filter(m => (m.funcaoArr || []).map(f => f.toLowerCase()).includes(String(role).toLowerCase()))
    const withoutRole = available.filter(m => !withRole.includes(m))
    // put currentMember first if exists (so it remains visible)
    const ensureCurrentFirst = (arr) => {
      if (!currentMemberId) return arr
      const ix = arr.findIndex(a => String(a.id) === String(currentMemberId))
      if (ix > 0) {
        const [m] = arr.splice(ix, 1)
        arr.unshift(m)
      }
      return arr
    }
    return ensureCurrentFirst([...withRole, ...withoutRole])
  }

  function updateCellAssignment(date, period, role, slotIndex, newMemberId) {
    const updated = [...generatedSchedule]
    // all indices for this date+period+role in order
    const matchingIndices = []
    for (let i = 0; i < updated.length; i++) {
      const r = updated[i]
      if (r.date === date && r.period === period && String(r.role) === String(role)) matchingIndices.push(i)
    }
    if (matchingIndices.length === 0) return
    const targetIdx = matchingIndices[slotIndex]
    if (targetIdx == null) return
    if (!newMemberId) {
      updated[targetIdx] = { ...updated[targetIdx], member_id: null, member_name: null }
      setGeneratedSchedule(updated)
      closeEditor()
      return
    }
    const member = members.find(m => String(m.id) === String(newMemberId))
    if (!member) return
    updated[targetIdx] = { ...updated[targetIdx], member_id: member.id, member_name: member.nome }
    setGeneratedSchedule(updated)
    closeEditor()
  }

  async function saveToSchedules() {
    if (!generatedSchedule || generatedSchedule.length === 0) {
      setMessage({ type: 'error', text: 'Nenhuma escala gerada para salvar.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const currentUserRaw = localStorage.getItem('current_user') || sessionStorage.getItem('current_user')
      const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null
      const payload = generatedSchedule.map(s => ({
        title: `Escala gerada ${new Date().toISOString().slice(0,10)}`,
        date: s.date,
        period: s.period,
        member_id: s.member_id,
        member_name: s.member_name,
        member_funcao: s.role,
        created_by: currentUser ? (currentUser.nome || currentUser.id) : 'admin'
      }))

      const { data, error } = await supabase.from('schedules').insert(payload)
      if (error) {
        console.error('Erro insert schedules:', error)
        const msg = String(error.message || error.details || JSON.stringify(error))
        if (msg.toLowerCase().includes('could not find the table') || msg.toLowerCase().includes('not found')) {
          setMessage({ type: 'error', text: 'Tabela "schedules" não encontrada. Crie-a no Supabase antes de salvar.' })
        } else {
          setMessage({ type: 'error', text: 'Erro ao salvar: ' + msg })
        }
      } else {
        setMessage({ type: 'success', text: `Escala salva (${data.length} entradas).` })
        // update original snapshot to current published state
        setOriginalSchedule(JSON.parse(JSON.stringify(generatedSchedule)))
      }
    } catch (err) {
      console.error('Erro salvar schedule:', err)
      setMessage({ type: 'error', text: 'Erro de conexão ao salvar.' })
    } finally {
      setSaving(false)
    }
  }

  // grouped view helper
  function groupedSchedule() {
    const grouped = {}
    (generatedSchedule || []).forEach(r => {
      if (!grouped[r.date]) grouped[r.date] = { date: r.date, periods: {} }
      if (!grouped[r.date].periods[r.period]) grouped[r.date].periods[r.period] = []
      grouped[r.date].periods[r.period].push(r)
    })
    // ensure consistent date order
    const keys = Object.keys(grouped).sort((a,b) => new Date(a) - new Date(b))
    return keys.map(k => grouped[k])
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, Arial, sans-serif', maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <h2 style={{ marginTop: 0, color: '#4b0f0f' }}>Editar Sugestão (antes de publicar)</h2>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <label>
          Data início
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ marginLeft: 6, padding: 6, borderRadius: 6, border: '1px solid #ddd' }} />
        </label>

        <label style={{ marginLeft: 8 }}>
          Dias
          <input type="number" value={days} min={1} onChange={e => setDays(Number(e.target.value) || 1)} style={{ marginLeft: 6, padding: 6, width: 80, borderRadius: 6, border: '1px solid #ddd' }} />
        </label>

        <div style={{ marginLeft: 8 }}>
          <label style={{ marginRight: 6 }}><input type="checkbox" checked={includeManha} onChange={e => setIncludeManha(e.target.checked)} /> Manhã</label>
          <label><input type="checkbox" checked={includeNoite} onChange={e => setIncludeNoite(e.target.checked)} /> Noite</label>
        </div>

        <label style={{ marginLeft: 8 }}>
          Membros por vaga
          <input type="number" value={membersPerSlot} min={1} onChange={e => setMembersPerSlot(Number(e.target.value) || 1)} style={{ marginLeft: 6, padding: 6, width: 80, borderRadius: 6, border: '1px solid #ddd' }} />
        </label>

        <button onClick={generate} style={{ marginLeft: 'auto', background: '#7f1d1d', color: '#fff', padding: '8px 12px', borderRadius: 6, border: 'none' }}>
          Gerar Escala
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <button onClick={revertEdits} style={{ padding: '6px 10px', borderRadius: 6, background: '#fff', border: '1px solid #cbd5e1' }}>Reverter alterações</button>
        <button onClick={saveToSchedules} disabled={saving} style={{ padding: '6px 12px', borderRadius: 6, background: '#7f1d1d', color: '#fff', border: 'none' }}>{saving ? 'Salvando...' : 'Publicar edição'}</button>
      </div>

      {message && <div style={{ marginBottom: 12, color: message.type === 'error' ? '#b91c1c' : '#065f46' }}>{message.text}</div>}

      <div style={{ display: 'grid', gap: 12 }}>
        {groupedSchedule().length === 0 && <div style={{ color: '#64748b' }}>Nenhuma sugestão gerada. Clique em Gerar Escala.</div>}

        {groupedSchedule().map(group => (
          <div key={group.date} style={{ border: '1px solid #e6edf3', borderRadius: 6, padding: 12, background: '#fff' }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>{new Date(group.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {/* Manhã column */}
              <div style={{ flex: 1 }}>
                <div style={{ color: '#7f1d1d', fontWeight: 700, marginBottom: 8 }}>Manhã</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {(group.periods['Manha'] || []).map((row, idx) => {
                    const rowsArray = group.periods['Manha']
                    const roleSlotIndex = computeRoleSlotIndex(rowsArray, idx)
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: '#fbfbfb', borderRadius: 4, border: '1px solid #eee' }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <div style={{ fontWeight: 700 }}>{row.role}</div>
                          <div style={{ color: '#b91c1c', fontWeight: 700 }}>{row.member_name || 'Vago'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEditor(group.date, 'Manha', row.role, roleSlotIndex)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff' }}>Editar nome</button>
                          <button onClick={() => updateCellAssignment(group.date, 'Manha', row.role, roleSlotIndex, null)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #f87171', background: '#fff', color: '#b91c1c' }}>Remover função</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Noite column */}
              <div style={{ flex: 1 }}>
                <div style={{ color: '#7f1d1d', fontWeight: 700, marginBottom: 8 }}>Noite</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {(group.periods['Noite'] || []).map((row, idx) => {
                    const rowsArray = group.periods['Noite']
                    const roleSlotIndex = computeRoleSlotIndex(rowsArray, idx)
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: '#fbfbfb', borderRadius: 4, border: '1px solid #eee' }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <div style={{ fontWeight: 700 }}>{row.role}</div>
                          <div style={{ color: '#b91c1c', fontWeight: 700 }}>{row.member_name || 'Vago'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEditor(group.date, 'Noite', row.role, roleSlotIndex)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff' }}>Editar nome</button>
                          <button onClick={() => updateCellAssignment(group.date, 'Noite', row.role, roleSlotIndex, null)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #f87171', background: '#fff', color: '#b91c1c' }}>Remover função</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Inline Editor Modal */}
      {editingCell && (() => {
        // find current member for this cell to preselect
        const { date, period, role, slotIndex } = editingCell
        // find matching entries to get current member id
        const matching = generatedSchedule
          .map((r, i) => ({ r, i }))
          .filter(x => x.r.date === date && x.r.period === period && String(x.r.role) === String(role))
        const currentIdx = matching[slotIndex] ? matching[slotIndex].i : null
        const currentMemberId = currentIdx != null ? generatedSchedule[currentIdx].member_id : null
        const candidates = getCandidatesForCell(date, period, role, currentMemberId)

        return (
          <div key="editor-modal" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400
          }}>
            <div style={{ width: 540, background: '#fff', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{new Date(date).toLocaleDateString('pt-BR')}</div>
                  <div style={{ color: '#64748b' }}>{period} — {role}</div>
                </div>
                <div>
                  <button onClick={closeEditor} style={{ padding: '6px 10px' }}>Fechar</button>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 13, color: '#334155', display: 'block', marginBottom: 8 }}>Escolha o membro para atribuir</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select id="candidate-select" defaultValue={currentMemberId || ''} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ddd' }}>
                    <option value="">-- Deixar vago --</option>
                    {candidates.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nome}{c.funcaoArr && c.funcaoArr.length ? ` — ${c.funcaoArr.join(', ')}` : ''}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => {
                    const sel = document.getElementById('candidate-select').value
                    updateCellAssignment(date, period, role, slotIndex, sel || null)
                  }} style={{ padding: '8px 12px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none' }}>
                    Salvar
                  </button>
                </div>

                <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>
                  Apenas membros sem restrição para esta data/período aparecem. Os candidatos com a função aparecem primeiro.
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <div style={{ marginTop: 18 }}>
        <h4>Membros</h4>
        {loadingMembers && <div>Carregando membros...</div>}
        {!loadingMembers && members.length === 0 && <div style={{ color: '#94a3b8' }}>Nenhum membro cadastrado.</div>}
        {!loadingMembers && members.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #eef2f6', borderRadius: 8, padding: 8 }}>
            {members.map(m => {
              const hasRestriction = restrictions.some(r => String(r.member_id) === String(m.id))
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #f3f6f9' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{m.nome}</div>
                    <div style={{ color: '#64748b', fontSize: 13 }}>{(m.funcaoArr || []).join(', ')}</div>
                  </div>
                  <div style={{ alignSelf: 'center' }}>{hasRestriction ? <span style={{ color: '#ef4444' }}>Tem restrição</span> : null}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}