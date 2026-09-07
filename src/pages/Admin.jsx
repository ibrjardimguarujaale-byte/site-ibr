// src/pages/Admin.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import html2canvas from 'html2canvas'

// ---------------- helpers ----------------
function normalizeText(s) {
  if (!s) return ''
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/gi, '')
    .trim()
    .toLowerCase()
}
function namesMatch(memberName, responsavel) {
  const a = normalizeText(memberName)
  const b = normalizeText(responsavel)
  return a === b || a.includes(b) || b.includes(a)
}
function normalizeDateStr(s) {
  if (!s) return ''
  const value = String(s).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return value
}
function dateToYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function parseYMDLocal(dateStr) {
  const normalized = normalizeDateStr(dateStr)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null
  const [year, month, day] = normalized.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}
function normalizePeriod(p) {
  const n = normalizeText(p)
  if (n.includes('manha')) return 'Manhã'
  if (n.includes('noite')) return 'Noite'
  return p
}
function monthLabelFromDateStr(dStr) {
  try {
    const d = new Date(dStr + 'T00:00:00')
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  } catch { return '' }
}
// novo helper: converte "YYYY-MM" => "julho de 2026"
function monthLabelFromYYYYMM(yyyyMm) {
  if (!yyyyMm) return ''
  const [y, m] = String(yyyyMm).split('-').map(Number)
  if (!y || !m) return ''
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
function getPeriodosDaRestricao(periodo) {
  if (!periodo) return []
  if (Array.isArray(periodo)) return periodo.map(normalizePeriod)
  const str = String(periodo).trim()
  if (str.startsWith('[') || str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str)
      if (Array.isArray(parsed)) return parsed.map(normalizePeriod)
    } catch {}
  }
  return str
    .replace(/[{}\[\]"']/g, '')
    .split(',')
    .map((item) => normalizePeriod(item.trim()))
    .filter(Boolean)
}
function pessoaTemRestricaoNoPeriodo({ nomePessoa, dataEscala, periodoEscala, membros, restricoes }) {
  const membro = membros.find((item) => namesMatch(item.nome, nomePessoa))
  return restricoes.some((restricao) => {
    const mesmaPessoa =
      String(restricao.member_id || '') === String(membro?.id || '') ||
      namesMatch(nomePessoa, restricao.responsavel)
    if (!mesmaPessoa) return false
    const dataRestricao = normalizeDateStr(restricao.data)
    const periodosRestricao = getPeriodosDaRestricao(restricao.periodo)
    const restricaoNoMesmoDia =
      dataRestricao === normalizeDateStr(dataEscala) && periodosRestricao.includes(periodoEscala)
    const dataDaEscala = parseYMDLocal(dataEscala)
    const dataDoSabadoAnterior = new Date(dataDaEscala)
    dataDoSabadoAnterior.setDate(dataDoSabadoAnterior.getDate() - 1)
    const restricaoNoSabadoAnterior =
      dataRestricao === dateToYMD(dataDoSabadoAnterior) && periodosRestricao.includes(periodoEscala)
    return restricaoNoMesmoDia || restricaoNoSabadoAnterior
  })
}

// ---------------- Admin component ----------------
export default function Admin() {
  const [authorized, setAuthorized] = useState(true)
  const [checked, setChecked] = useState(true)
  const [viewMode, setViewMode] = useState('full')

  const [membros, setMembros] = useState([])
  const [restricoes, setRestricoes] = useState([])
  const [informativos, setInformativos] = useState([])
  const [escalaMensal, setEscalaMensal] = useState(null)
  const [album, setAlbum] = useState([])

  const [tutoriais, setTutoriais] = useState([])
  const [showTutoriaisPanel, setShowTutoriaisPanel] = useState(false)
  const [tutorialTitulo, setTutorialTitulo] = useState('')
  const [tutorialPdfFile, setTutorialPdfFile] = useState(null)
  const [tutorialPdfNome, setTutorialPdfNome] = useState('')
  const [editingTutorial, setEditingTutorial] = useState(null)
  const [editingTutorialPdfFile, setEditingTutorialPdfFile] = useState(null)
  const tutorialPdfInputRef = useRef(null)
  const editTutorialPdfInputRef = useRef(null)

  const [showMembrosPanel, setShowMembrosPanel] = useState(false)
  const [showInformativosPanel, setShowInformativosPanel] = useState(false)
  const [showAlbumPanel, setShowAlbumPanel] = useState(false)

  const [membroNome, setMembroNome] = useState('')
  const [funcoesSelecionadas, setFuncoesSelecionadas] = useState([])
  const [isOpenFuncoes, setIsOpenFuncoes] = useState(false)
  const dropdownRef = useRef(null)
  const funcoesOpcoes = ['Líder', 'Som', 'OBS', 'Holyrics', 'Foto', 'Redes Sociais']

  const [editingMember, setEditingMember] = useState(null)

  const [informativoTitulo, setInformativoTitulo] = useState('')
  const [informativoConteudo, setInformativoConteudo] = useState('')
  const [informativoImagem, setInformativoImagem] = useState(null)
  const [informativoImagemFile, setInformativoImagemFile] = useState(null)
  const [editingInformativo, setEditingInformativo] = useState(null)
  const [editingInformativoImagemFile, setEditingInformativoImagemFile] = useState(null)
  const fileInputRef = useRef(null)
  const editFileInputRef = useRef(null)

  const [sugestaoEditada, setSugestaoEditada] = useState(null)
  const [editingDay, setEditingDay] = useState(null)
  const periodos = ['Manhã', 'Noite']

  const albumInputRef = useRef(null)

  const [showShareModal, setShowShareModal] = useState(false)
  const [shareBgImage, setShareBgImage] = useState(null)
  const shareCardRef = useRef(null)
  const shareBgInputRef = useRef(null)

  // novo estado: mês de referência para publicação (formato "YYYY-MM")
  const [publishMonth, setPublishMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const containerStyle = { background: '#f7f6f5', minHeight: '100vh', padding: '40px 20px', paddingBottom: '100px' }
  const cardStyle = { background: '#fff', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)', padding: 18 }
  const addBtnStyle = { background: '#6b1515', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer' }
  const secondaryBtnStyle = { background: '#7b1d1d', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer' }

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase.from('membros').select('id, nome, funcao, created_at').order('created_at', { ascending: false })
      if (error) throw error
      const norm = (data || []).map(d => ({ id: d.id, nome: d.nome, funcao: d.funcao || [] }))
      setMembros(norm)
      localStorage.setItem('membros_ibr', JSON.stringify(norm))
      return norm
    } catch {
      const fallback = JSON.parse(localStorage.getItem('membros_ibr') || '[]')
      setMembros(fallback)
      return fallback
    }
  }

  const fetchInformativos = async () => {
    try {
      const { data, error } = await supabase
        .from('informativos')
        .select('id, titulo, conteudo, imagem_url, fixado, created_at')
        .order('fixado', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      const norm = (data || []).map(d => ({ id: d.id, titulo: d.titulo, conteudo: d.conteudo, imagemDataUrl: d.imagem_url || null, fixado: !!d.fixado }))
      setInformativos(norm)
      localStorage.setItem('informativos_ibr', JSON.stringify(norm))
      return norm
    } catch {
      const fallback = JSON.parse(localStorage.getItem('informativos_ibr') || '[]')
      setInformativos(fallback)
      return fallback
    }
  }

  const fetchEscalaMensal = async () => {
    try {
      const { data, error } = await supabase.from('escala_mensal').select('id, month_label, data, created_at').order('created_at', { ascending: false }).limit(1)
      if (error) throw error
      if (data && data.length > 0) {
        const head = data[0]
        const obj = { id: head.id, monthLabel: head.month_label, data: head.data, createdAt: head.created_at }
        setEscalaMensal(obj)
        localStorage.setItem('escala_mensal', JSON.stringify(obj))
        return obj
      } else {
        const fallback = JSON.parse(localStorage.getItem('escala_mensal') || 'null')
        if (fallback) setEscalaMensal(fallback)
        return fallback
      }
    } catch {
      const fallback = JSON.parse(localStorage.getItem('escala_mensal') || 'null')
      if (fallback) setEscalaMensal(fallback)
      return fallback
    }
  }

  const fetchRestricoes = async () => {
    try {
      const { data, error } = await supabase.from('restricoes').select('id, responsavel, data, periodo, member_id, created_at').order('created_at', { ascending: false })
      if (error) throw error
      setRestricoes(data || [])
      localStorage.setItem('restricoes_ibr_list', JSON.stringify(data || []))
      return data || []
    } catch {
      const fallback = JSON.parse(localStorage.getItem('restricoes_ibr_list') || '[]')
      setRestricoes(fallback)
      return fallback
    }
  }

  const fetchAlbum = async () => {
    try {
      const { data, error } = await supabase.from('album').select('id, title, image_url, created_at').order('created_at', { ascending: false })
      if (error) throw error
      setAlbum((data || []).map(d => ({ id: d.id, title: d.title, dataUrl: d.image_url })))
      localStorage.setItem('album_ibr', JSON.stringify(data || []))
      return data || []
    } catch {
      const fallback = JSON.parse(localStorage.getItem('album_ibr') || '[]')
      setAlbum(fallback)
      return fallback
    }
  }

  const fetchTutoriais = async () => {
    try {
      const { data, error } = await supabase
        .from('tutoriais')
        .select('id, titulo, pdf_url, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      setTutoriais(data || [])
      localStorage.setItem('tutoriais_ibr', JSON.stringify(data || []))
      return data || []
    } catch {
      const fallback = JSON.parse(localStorage.getItem('tutoriais_ibr') || '[]')
      setTutoriais(fallback)
      return fallback
    }
  }

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchMembers(), fetchInformativos(), fetchEscalaMensal(), fetchRestricoes(), fetchAlbum(), fetchTutoriais()])
  }, [])

  const addMember = async (payload) => {
    try {
      const { data, error } = await supabase.from('membros').insert([payload]).select().single()
      if (error) throw error
      await fetchMembers()
      return data
    } catch {
      const local = JSON.parse(localStorage.getItem('membros_ibr') || '[]')
      const novo = { id: String(Date.now()), nome: payload.nome, funcao: payload.funcao || [] }
      localStorage.setItem('membros_ibr', JSON.stringify([novo, ...local]))
      setMembros([novo, ...local])
      return novo
    }
  }

  const updateMember = async (id, payload) => {
    try {
      const { data, error } = await supabase.from('membros').update(payload).eq('id', id).select().single()
      if (error) throw error
      await fetchMembers()
      return data
    } catch {
      const local = JSON.parse(localStorage.getItem('membros_ibr') || '[]').map(m => (m.id === id ? { ...m, ...payload } : m))
      localStorage.setItem('membros_ibr', JSON.stringify(local))
      setMembros(local)
      return payload
    }
  }

  const deleteMember = async (id) => {
    try {
      const { error } = await supabase.from('membros').delete().eq('id', id)
      if (error) throw error
      await fetchMembers()
    } catch {
      const local = JSON.parse(localStorage.getItem('membros_ibr') || '[]').filter(m => m.id !== id)
      localStorage.setItem('membros_ibr', JSON.stringify(local))
      setMembros(local)
    }
  }

  const addInformativo = async (payload) => {
    try {
      const { data, error } = await supabase.from('informativos').insert([payload]).select().single()
      if (error) throw error
      await fetchInformativos()
      return data
    } catch {
      const local = JSON.parse(localStorage.getItem('informativos_ibr') || '[]')
      const novo = { id: String(Date.now()), titulo: payload.titulo, conteudo: payload.conteudo, imagemDataUrl: payload.imagem_url || null, fixado: payload.fixado || false }
      localStorage.setItem('informativos_ibr', JSON.stringify([novo, ...local]))
      setInformativos([novo, ...local])
      return novo
    }
  }

  const updateInformativo = async (id, payload) => {
    try {
      const { data, error } = await supabase.from('informativos').update(payload).eq('id', id).select().single()
      if (error) throw error
      await fetchInformativos()
      return data
    } catch {
      const local = JSON.parse(localStorage.getItem('informativos_ibr') || '[]').map(i => (i.id === id ? { ...i, ...payload } : i))
      localStorage.setItem('informativos_ibr', JSON.stringify(local))
      setInformativos(local)
      return payload
    }
  }

  const deleteInformativo = async (id) => {
    try {
      const { error } = await supabase.from('informativos').delete().eq('id', id)
      if (error) throw error
      await fetchInformativos()
    } catch {
      const local = JSON.parse(localStorage.getItem('informativos_ibr') || '[]').filter(i => i.id !== id)
      localStorage.setItem('informativos_ibr', JSON.stringify(local))
      setInformativos(local)
    }
  }

  const handleFixarInformativo = async (id, atualFixado) => {
    try {
      await updateInformativo(id, { fixado: !atualFixado })
    } catch (error) {
      alert('Erro ao fixar/desfixar: ' + (error.message || error))
    }
  }

  const uploadPdfTutorial = async (file) => {
    if (!file) return null
    const ext = file.name.split('.').pop() || 'pdf'
    const nomeArquivo = `tutorial-${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`
    const { error: uploadError } = await supabase.storage.from('tutoriais').upload(nomeArquivo, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    })
    if (uploadError) throw new Error(uploadError.message)
    const { data: publicUrlData } = supabase.storage.from('tutoriais').getPublicUrl(nomeArquivo)
    return publicUrlData?.publicUrl || null
  }

  const addTutorial = async (payload) => {
    try {
      const { data, error } = await supabase.from('tutoriais').insert([payload]).select().single()
      if (error) throw error
      await fetchTutoriais()
      return data
    } catch {
      const local = JSON.parse(localStorage.getItem('tutoriais_ibr') || '[]')
      const novo = { id: String(Date.now()), titulo: payload.titulo, pdf_url: payload.pdf_url || null }
      localStorage.setItem('tutoriais_ibr', JSON.stringify([novo, ...local]))
      setTutoriais([novo, ...local])
      return novo
    }
  }

  const updateTutorial = async (id, payload) => {
    try {
      const { data, error } = await supabase.from('tutoriais').update(payload).eq('id', id).select().single()
      if (error) throw error
      await fetchTutoriais()
      return data
    } catch {
      const local = JSON.parse(localStorage.getItem('tutoriais_ibr') || '[]').map(t => (t.id === id ? { ...t, ...payload } : t))
      localStorage.setItem('tutoriais_ibr', JSON.stringify(local))
      setTutoriais(local)
      return payload
    }
  }

  const deleteTutorial = async (id) => {
    try {
      const { error } = await supabase.from('tutoriais').delete().eq('id', id)
      if (error) throw error
      await fetchTutoriais()
    } catch {
      const local = JSON.parse(localStorage.getItem('tutoriais_ibr') || '[]').filter(t => t.id !== id)
      localStorage.setItem('tutoriais_ibr', JSON.stringify(local))
      setTutoriais(local)
    }
  }

  const handleAddTutorial = async () => {
    const titulo = tutorialTitulo.trim()
    if (!titulo) { alert('Digite um título para o tutorial.'); return }
    try {
      let pdf_url = null
      if (tutorialPdfFile) pdf_url = await uploadPdfTutorial(tutorialPdfFile)
      await addTutorial({ titulo, pdf_url })
      setTutorialTitulo('')
      setTutorialPdfFile(null)
      setTutorialPdfNome('')
      setShowTutoriaisPanel(false)
    } catch (error) { alert(`Erro ao salvar tutorial: ${error.message}`) }
  }

  const handleSaveEditTutorial = async () => {
    if (!editingTutorial) return
    const titulo = editingTutorial.titulo?.trim()
    if (!titulo) { alert('Digite um título para o tutorial.'); return }
    try {
      let pdf_url = editingTutorial.pdf_url || null
      if (editingTutorialPdfFile) pdf_url = await uploadPdfTutorial(editingTutorialPdfFile)
      await updateTutorial(editingTutorial.id, { titulo, pdf_url })
      setEditingTutorial(null)
      setEditingTutorialPdfFile(null)
    } catch (error) { alert(`Erro ao atualizar tutorial: ${error.message}`) }
  }

  const addRestricao = async (payload) => {
    try {
      const { data, error } = await supabase.from('restricoes').insert([payload]).select().single()
      if (error) throw error
      await fetchRestricoes()
      return data
    } catch {
      const local = JSON.parse(localStorage.getItem('restricoes_ibr_list') || '[]')
      const novo = { id: String(Date.now()), ...payload }
      localStorage.setItem('restricoes_ibr_list', JSON.stringify([novo, ...local]))
      setRestricoes([novo, ...local])
      return novo
    }
  }

  const deleteRestricao = async (id) => {
    try {
      const { error } = await supabase.from('restricoes').delete().eq('id', id)
      if (error) throw error
      await fetchRestricoes()
    } catch {
      const local = JSON.parse(localStorage.getItem('restricoes_ibr_list') || '[]').filter(r => r.id !== id)
      localStorage.setItem('restricoes_ibr_list', JSON.stringify(local))
      setRestricoes(local)
    }
  }

  const publishEscalaMensal = async (obj) => {
    try {
      const payload = { month_label: obj.monthLabel, data: obj.data }
      const { data, error } = await supabase.from('escala_mensal').insert([payload]).select().single()
      if (error) throw error
      await fetchEscalaMensal()
      return data
    } catch {
      const localObj = { id: String(Date.now()), monthLabel: obj.monthLabel, data: obj.data, createdAt: new Date().toISOString() }
      localStorage.setItem('escala_mensal', JSON.stringify(localObj))
      setEscalaMensal(localObj)
      return localObj
    }
  }

  const deleteEscalaMensal = async (id) => {
    try {
      const { error } = await supabase.from('escala_mensal').delete().eq('id', id)
      if (error) throw error
      setEscalaMensal(null)
      localStorage.removeItem('escala_mensal')
    } catch {
      setEscalaMensal(null)
      localStorage.removeItem('escala_mensal')
    }
  }

  const uploadAlbumFiles = async (files) => {
    const resultRows = []
    for (const file of files) {
      try {
        const fileExt = (file.name && file.name.split('.').pop()) || 'jpg'
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('album_ibr').upload(fileName, file, { cacheControl: '3600', upsert: false })
        if (uploadError) { alert(`Erro ao enviar ${file.name}: ${uploadError.message}`); continue }
        const { data: publicData } = await supabase.storage.from('album_ibr').getPublicUrl(fileName)
        const publicUrl = publicData?.publicUrl || null
        const { data: row, error: insertErr } = await supabase.from('album').insert([{ title: file.name, image_url: publicUrl }]).select().single()
        if (insertErr) { alert(`Erro ao criar registro: ${insertErr.message}`); continue }
        resultRows.push(row)
      } catch (err) { alert('Erro inesperado: ' + (err.message || err)) }
    }
    if (resultRows.length) await fetchAlbum()
    return resultRows
  }

  const deleteAlbumRow = async (id) => {
    try {
      const { error } = await supabase.from('album').delete().eq('id', id)
      if (error) throw error
      await fetchAlbum()
    } catch {
      const local = JSON.parse(localStorage.getItem('album_ibr') || '[]').filter(a => a.id !== id)
      localStorage.setItem('album_ibr', JSON.stringify(local))
      setAlbum(local)
    }
  }

  const uploadImagemInformativo = async (file) => {
    if (!file) return null
    const extensaoOriginal = file.name.split('.').pop() || 'jpg'
    const nomeArquivo = `informativo-${Date.now()}-${Math.random().toString(36).substring(2)}.${extensaoOriginal}`
    const { error: uploadError } = await supabase.storage.from('informativos').upload(nomeArquivo, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    })
    if (uploadError) throw new Error(uploadError.message)
    const { data: publicUrlData } = supabase.storage.from('informativos').getPublicUrl(nomeArquivo)
    return publicUrlData?.publicUrl || null
  }

  const toggleFuncao = (f) => setFuncoesSelecionadas(prev => (prev.includes(f) ? prev.filter(i => i !== f) : [...prev, f]))

  const handleAddMemberClick = async () => {
    const nome = membroNome.trim()
    if (!nome) return
    await addMember({ nome, funcao: funcoesSelecionadas })
    setMembroNome('')
    setFuncoesSelecionadas([])
    setIsOpenFuncoes(false)
  }

  const startEditMember = (m) => setEditingMember({ ...m, funcao: Array.isArray(m.funcao) ? [...m.funcao] : (m.funcao ? [m.funcao] : []) })

  const handleSaveEditedMember = async () => {
    if (!editingMember) return
    const { id, nome, funcao } = editingMember
    await updateMember(id, { nome, funcao })
    setEditingMember(null)
  }

  const handleFundoClick = () => { if (fileInputRef.current) fileInputRef.current.click() }

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Por favor, selecione somente uma imagem.'); e.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = () => { setInformativoImagem(reader.result); setInformativoImagemFile(file) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleEditInformativoFileChange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Por favor, selecione somente uma imagem.'); e.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = () => { setEditingInformativo(prev => ({ ...prev, imagemDataUrl: reader.result })); setEditingInformativoImagemFile(file) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function gerarEscalaAutomatica() {
    // usa publishMonth (formato "YYYY-MM") se estiver definido; senão usa mês atual
    let baseDate = null
    if (publishMonth && /^\d{4}-\d{2}$/.test(publishMonth)) {
      const [y, m] = publishMonth.split('-').map(Number)
      baseDate = new Date(y, m - 1, 1, 12, 0, 0)
    } else {
      const hoje = new Date()
      baseDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 12, 0, 0)
    }

    const domingos = []
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1, 12, 0, 0)
    while (d.getMonth() === baseDate.getMonth()) {
      if (d.getDay() === 0) domingos.push(dateToYMD(d))
      d.setDate(d.getDate() + 1)
    }

    const funcoesEscala = ['Som', 'OBS', 'Holyrics', 'Foto', 'Redes Sociais']
    const escala = domingos.map(dataRaw => {
      const dataDomingo = normalizeDateStr(dataRaw)
      const turnos = {}
      const assignedKeys = new Set()
      periodos.forEach(periodoAtual => {
        const alocados = {}
        funcoesEscala.forEach(funcao => {
          // define se esta funcao deve respeitar restricao (somente Holyrics e OBS)
          const isRestrictedRole = ['holyrics', 'obs'].includes(String(funcao).toLowerCase())

          const candidatos = membros.filter(membro => {
            const temFuncao = Array.isArray(membro.funcao) ? membro.funcao.includes(funcao) : membro.funcao === funcao
            if (!temFuncao || assignedKeys.has(membro.id)) return false

            // verifica restricao para este membro nesta data/periodo
            const temRestricao = pessoaTemRestricaoNoPeriodo({
              nomePessoa: membro.nome,
              dataEscala: dataDomingo,
              periodoEscala: periodoAtual,
              membros,
              restricoes
            })

            // para funções restritas, exclui quem tem restrição; para as outras, permite mesmo com restrição
            if (isRestrictedRole && temRestricao) return false
            return true
          })

          const escolhido = candidatos.length ? candidatos[Math.floor(Math.random() * candidatos.length)] : null
          if (escolhido) { alocados[funcao] = escolhido.nome; assignedKeys.add(escolhido.id) }
          else alocados[funcao] = 'Vago'
        })
        turnos[periodoAtual] = alocados
      })
      return { data: dataRaw, turnos }
    })

    setSugestaoEditada(escala)
  }

  // handlePublishEscala agora utiliza publishMonth (se fornecido)
  const handlePublishEscala = async (escalaArr) => {
    if (!Array.isArray(escalaArr) || escalaArr.length === 0) return
    // usar label a partir do selector publishMonth; se não existir, fallback para data do primeiro dia
    const monthLabelFromSelector = monthLabelFromYYYYMM(publishMonth)
    const monthLabel = monthLabelFromSelector || monthLabelFromDateStr(escalaArr[0].data) || new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    await publishEscalaMensal({ monthLabel, data: escalaArr })
    setSugestaoEditada(null)
  }

  const handleShareBgChange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setShareBgImage(reader.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleGenerateShareImage = async () => {
    if (!shareCardRef.current) return
    try {
      const canvas = await html2canvas(shareCardRef.current, { useCORS: true, scale: 2, backgroundColor: null })
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = url
      link.download = 'escala.png'
      link.click()
    } catch (err) { alert('Erro ao gerar imagem: ' + err.message) }
  }

  const handleAlbumFileInput = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    await uploadAlbumFiles(files)
    e.target.value = ''
  }

  useEffect(() => { setChecked(true) }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  // sincroniza publishMonth automaticamente quando a sugestão de escala for carregada
  useEffect(() => {
    if (!sugestaoEditada || !Array.isArray(sugestaoEditada) || sugestaoEditada.length === 0) return
    try {
      const primeiro = sugestaoEditada[0].data
      const parsed = new Date(primeiro + 'T00:00:00')
      if (!isNaN(parsed.getTime())) {
        setPublishMonth(`${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`)
      }
    } catch (e) {
      // silencioso — não interrompe a UI
    }
  }, [sugestaoEditada])

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpenFuncoes(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!checked) return null
  if (!authorized) return <div style={{ padding: 20 }}>Acesso negado.</div>

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: '0 0 12px 0', fontSize: 22 }}>Painel ADM</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setViewMode(v => v === 'full' ? 'escala' : 'full')} style={{ ...secondaryBtnStyle, flex: '1 1 auto', minWidth: 100 }}>
              {viewMode === 'full' ? 'Escala' : 'Fechar Escala'}
            </button>
            {viewMode === 'full' && (
              <button onClick={() => { setShowMembrosPanel(s => !s); setShowInformativosPanel(false); setShowAlbumPanel(false); setShowTutoriaisPanel(false) }} style={{ ...secondaryBtnStyle, flex: '1 1 auto', minWidth: 100 }}>
                {showMembrosPanel ? 'Fechar Membros' : 'Membros'}
              </button>
            )}
            {viewMode === 'full' && (
              <button onClick={() => { setShowInformativosPanel(s => !s); setShowMembrosPanel(false); setShowAlbumPanel(false); setShowTutoriaisPanel(false) }} style={{ ...secondaryBtnStyle, flex: '1 1 auto', minWidth: 100 }}>
                {showInformativosPanel ? 'Fechar Informativos' : 'Informativos'}
              </button>
            )}
            {viewMode === 'full' && (
              <button onClick={() => { setShowAlbumPanel(s => !s); setShowInformativosPanel(false); setShowMembrosPanel(false); setShowTutoriaisPanel(false) }} style={{ ...secondaryBtnStyle, flex: '1 1 auto', minWidth: 100, background: showAlbumPanel ? '#5a1515' : secondaryBtnStyle.background }}>
                {showAlbumPanel ? 'Fechar Álbum' : 'Álbum'}
              </button>
            )}
            {viewMode === 'full' && (
              <button onClick={() => { setShowTutoriaisPanel(s => !s); setShowMembrosPanel(false); setShowInformativosPanel(false); setShowAlbumPanel(false) }} style={{ ...secondaryBtnStyle, flex: '1 1 auto', minWidth: 100, background: showTutoriaisPanel ? '#5a1515' : secondaryBtnStyle.background }}>
                {showTutoriaisPanel ? 'Fechar Tutoriais' : 'Tutoriais'}
              </button>
            )}
            {viewMode === 'escala' && (
              <button onClick={gerarEscalaAutomatica} style={{ ...addBtnStyle, background: '#111', flex: '1 1 auto', minWidth: 100 }}>Criar Escala</button>
            )}
          </div>
        </div>

        <div style={cardStyle}>

          {/* ---- Membros Panel ---- */}
          {viewMode === 'full' && showMembrosPanel && (
            <>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Cadastrar Membro</h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap' }}>
                <input placeholder="Nome" value={membroNome} onChange={e => setMembroNome(e.target.value)} style={{ padding: 10, flex: 1, minWidth: 150, borderRadius: 6, border: '1px solid #e6e6e6' }} />
                <div ref={dropdownRef} style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
                  <div onClick={() => setIsOpenFuncoes(!isOpenFuncoes)} style={{ padding: 10, borderRadius: 6, border: '1px solid #e6e6e6', background: '#fff', cursor: 'pointer', color: funcoesSelecionadas.length ? '#000' : '#9ca3af' }}>
                    {funcoesSelecionadas.length ? funcoesSelecionadas.join(', ') : 'Selecione as funções...'}
                  </div>
                  {isOpenFuncoes && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e6e9ee', borderRadius: 6, zIndex: 10, padding: 10, boxShadow: '0 6px 18px rgba(0,0,0,0.06)', marginTop: 6 }}>
                      {funcoesOpcoes.map(f => (
                        <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={funcoesSelecionadas.includes(f)} onChange={() => toggleFuncao(f)} />
                          <span style={{ marginLeft: 6 }}>{f}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={handleAddMemberClick} style={{ ...addBtnStyle, padding: '10px 18px' }}>Adicionar</button>
              </div>
              <div style={{ borderTop: '1px solid #f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
                {membros.length === 0
                  ? <div style={{ padding: 16, color: '#9ca3af' }}>Nenhum membro cadastrado.</div>
                  : membros.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 8px', borderBottom: '1px solid #f0f0f0', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 40, height: 40, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: (Array.isArray(m.funcao) ? m.funcao.includes('Líder') : m.funcao === 'Líder') ? '#ffecb5' : 'transparent', color: (Array.isArray(m.funcao) ? m.funcao.includes('Líder') : m.funcao === 'Líder') ? '#b8860b' : '#374151', fontWeight: 800 }}>
                          {String(m.nome || '').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nome}</div>
                          <div style={{ color: '#4b5563', fontSize: 13 }}>{Array.isArray(m.funcao) ? m.funcao.join(', ') : m.funcao}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                        <button onClick={() => startEditMember(m)} style={{ background: 'none', border: '1px solid #f3f4f6', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap' }}>Editar</button>
                        <button onClick={() => deleteMember(m.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>Remover</button>
                      </div>
                    </div>
                  ))
                }
              </div>
              {editingMember && (
                <div style={{ marginTop: 12, padding: 12, border: '1px solid #e6e6e6', borderRadius: 8 }}>
                  <h4 style={{ marginTop: 0 }}>Editar Membro</h4>
                  <input value={editingMember.nome} onChange={e => setEditingMember(prev => ({ ...prev, nome: e.target.value }))} style={{ padding: 10, borderRadius: 6, border: '1px solid #e6e6e6', marginBottom: 8, width: '100%' }} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    {funcoesOpcoes.map(f => (
                      <label key={f} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="checkbox" checked={editingMember.funcao && editingMember.funcao.includes(f)} onChange={() => setEditingMember(prev => ({ ...prev, funcao: prev.funcao.includes(f) ? prev.funcao.filter(x => x !== f) : [...prev.funcao, f] }))} />
                        <span>{f}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingMember(null)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff' }}>Cancelar</button>
                    <button onClick={handleSaveEditedMember} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#6b1515', color: '#fff' }}>Salvar</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ---- Album Panel ---- */}
          {viewMode === 'full' && showAlbumPanel && (
            <div style={{ padding: 20, textAlign: 'center', background: '#f9f9f9', borderRadius: 10, border: '2px dashed #ddd' }}>
              <h3 style={{ marginTop: 0 }}>Painel do Álbum</h3>
              <p>Aqui você poderá gerenciar as fotos do Álbum.</p>
              <input id="album-file-input" ref={albumInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleAlbumFileInput} />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
                <button onClick={() => document.getElementById('album-file-input').click()} style={{ background: '#6b1515', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer' }}>Adicionar Foto</button>
              </div>
              <div style={{ marginTop: 25, borderTop: '1px solid #eee', paddingTop: 15 }}>
                <h4 style={{ marginBottom: 15 }}>Fotos no servidor:</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                  {album.length === 0
                    ? <p style={{ color: '#999', gridColumn: '1/-1' }}>Nenhuma foto ainda.</p>
                    : album.map(foto => (
                      <div key={foto.id} style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', height: 100, border: '1px solid #ddd' }}>
                        <img src={foto.dataUrl || foto.image_url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button onClick={() => deleteAlbumRow(foto.id)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(255,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12 }}>×</button>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}

          {/* ---- Informativos Panel ---- */}
          {viewMode === 'full' && showInformativosPanel && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Adicionar Informativo</h3>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'auto 1fr', alignItems: 'center', marginBottom: 12 }}>
                <button onClick={handleFundoClick} style={{ background: '#f3f4f6', border: '1px solid #e6e6e6', padding: '8px 12px', borderRadius: 8 }}>Fundo</button>
                <input placeholder="Título do informativo" value={informativoTitulo} onChange={e => setInformativoTitulo(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #e6e6e6' }} />
                <textarea placeholder="Conteúdo (curto)" value={informativoConteudo} onChange={e => setInformativoConteudo(e.target.value)} style={{ gridColumn: '1 / span 2', padding: 10, borderRadius: 6, border: '1px solid #e6e6e6', minHeight: 100 }} />
                <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8 }}>
                  <button onClick={handleAddInformativo} style={{ ...addBtnStyle, padding: '10px 12px' }}>Adicionar</button>
                  <button onClick={() => { setInformativoTitulo(''); setInformativoConteudo(''); setInformativoImagem(null); setInformativoImagemFile(null); setShowInformativosPanel(false) }} style={{ background: '#e5e7eb', border: 'none', padding: '10px 12px', borderRadius: 8 }}>Cancelar</button>
                </div>
                {informativoImagem && (
                  <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <img src={informativoImagem} alt="preview" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #e6e6e6' }} />
                    <button onClick={() => { setInformativoImagem(null); setInformativoImagemFile(null) }} style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '6px 10px', borderRadius: 8 }}>Remover Foto</button>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 12 }}>
                <h3 style={{ marginBottom: 8 }}>Informativos Publicados</h3>
                {informativos.length === 0 ? (
                  <div style={{ color: '#9ca3af' }}>Nenhum informativo cadastrado.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {informativos.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '1px solid #e6e6e6', borderRadius: 8, background: '#fff', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 56, height: 44, borderRadius: 8, overflow: 'hidden', background: '#f3f3f3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {item.imagemDataUrl ? <img src={item.imagemDataUrl} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#999', fontSize: 12 }}>sem foto</span>}
                          </div>
                          <div style={{ fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.titulo}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button onClick={() => handleFixarInformativo(item.id, item.fixado)} style={{ padding: '8px 12px', borderRadius: 8, border: item.fixado ? '1px solid #93c5fd' : '1px solid #d1d5db', background: item.fixado ? '#dbeafe' : '#f9fafb', color: item.fixado ? '#1e40af' : '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {item.fixado ? 'Desfixar' : 'Fixar'}
                          </button>
                          <button onClick={() => handleStartEditInformativo(item)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}>Editar</button>
                          <button onClick={() => deleteInformativo(item.id)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fee2e2', color: '#991b1b', cursor: 'pointer' }}>Apagar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {editingInformativo && (
                  <div style={{ marginTop: 16, padding: 14, border: '1px solid #e6e6e6', borderRadius: 8, background: '#fafafa' }}>
                    <h4 style={{ marginTop: 0 }}>Editar Informativo</h4>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <input value={editingInformativo.titulo} onChange={e => setEditingInformativo(prev => ({ ...prev, titulo: e.target.value }))} placeholder="Título" style={{ padding: 10, borderRadius: 6, border: '1px solid #e6e6e6' }} />
                      <textarea value={editingInformativo.conteudo} onChange={e => setEditingInformativo(prev => ({ ...prev, conteudo: e.target.value }))} placeholder="Conteúdo" style={{ padding: 10, borderRadius: 6, border: '1px solid #e6e6e6', minHeight: 100 }} />
                      <input ref={editFileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditInformativoFileChange} />
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        {editingInformativo.imagemDataUrl && <img src={editingInformativo.imagemDataUrl} alt="preview" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #e6e6e6' }} />}
                        <button onClick={() => editFileInputRef.current && editFileInputRef.current.click()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}>Alterar Foto</button>
                        <button onClick={() => { setEditingInformativo(prev => ({ ...prev, imagemDataUrl: null })); setEditingInformativoImagemFile(null) }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fee2e2', color: '#991b1b', cursor: 'pointer' }}>Remover Foto</button>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditingInformativo(null)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff' }}>Cancelar</button>
                        <button onClick={handleSaveEditInformativo} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#6b1515', color: '#fff' }}>Salvar</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---- ✅ ESCALA PUBLICADA — novo estilo ---- */}
          {viewMode === 'escala' && escalaMensal && (
            <div style={{ marginBottom: 14 }}>
              {/* Cabeçalho */}
              <div style={{ textAlign: 'center', marginBottom: 20, padding: '16px 0 8px' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1a2a5e', letterSpacing: 0.5 }}>
                  📢 Escala — {escalaMensal.monthLabel.replace(/^\w/, c => c.toUpperCase())}
                </div>
              </div>

              {/* Botão remover */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => deleteEscalaMensal(escalaMensal.id)} style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', color: '#991b1b', fontWeight: 600 }}>
                  Remover Escala do Mês
                </button>
              </div>

              {/* Cards dos dias */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Array.isArray(escalaMensal.data) && escalaMensal.data.map(dia => (
                  <div key={dia.data} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #ece9e0' }}>
                    {/* Data do dia */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #e8a020' }}>
                      <span style={{ fontSize: 18 }}>📅</span>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#1a2a5e', textTransform: 'capitalize' }}>
                        {new Date(dia.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                      </span>
                    </div>

                    {/* Manhã e Noite lado a lado */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {periodos.map(p => (
                        <div key={p}>
                          <div style={{ fontWeight: 800, fontSize: 12, color: '#1a2a5e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, borderBottom: '1px solid #e8e8e8', paddingBottom: 4 }}>
                            {p}
                          </div>
                          {dia.turnos && dia.turnos[p]
                            ? Object.entries(dia.turnos[p]).map(([f, n]) => (
                              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                                <span style={{ fontWeight: 700, color: '#374151', minWidth: 90 }}>{f}:</span>
                                <span style={{ color: '#111', fontWeight: 500 }}>{n}</span>
                                {/* ✅ BOTÃO SÁBADO */}
                                {(f === 'Som' || f === 'Holyrics') && p === 'Noite' && (
                                  <button
                                    onClick={() => alert('Você deverá ir ao ensaio no sábado as 09:00, por favor.')}
                                    style={{ marginLeft: 4, padding: '2px 8px', borderRadius: 6, background: '#7f1d1d', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    Sábado
                                  </button>
                                )}
                              </div>
                            ))
                            : <div style={{ color: '#9ca3af', fontSize: 13 }}>Sem dados</div>
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---- Sugestão de escala ---- */}
          {viewMode === 'escala' && sugestaoEditada && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Sugestão de Escala</h3>

                {/* --- AQUI: substituímos somente este bloco para incluir selector de mês ao lado do botão Publicar --- */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label htmlFor="publish-month" style={{ fontSize: 13, color: '#374151', fontWeight: 700 }}>Mês referência</label>
                  <input
                    id="publish-month"
                    type="month"
                    value={publishMonth}
                    onChange={(e) => setPublishMonth(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e6e9ee', background: '#fff', color: '#111827' }}
                  />

                  <button onClick={() => handlePublishEscala(sugestaoEditada)} style={secondaryBtnStyle}>Publicar Agora</button>

                  <button onClick={() => setShowShareModal(true)} style={{ ...secondaryBtnStyle, background: '#1a6b3c' }}>Compartilhar</button>

                  <button onClick={() => setSugestaoEditada(null)} style={{ background: '#e5e7eb', border: 'none', padding: '8px 12px', borderRadius: 8 }}>Descartar</button>

                  <button
                    onClick={() => {
                      // ajustar publishMonth para o mês da sugestão (primeiro dia)
                      try {
                        if (!sugestaoEditada || !Array.isArray(sugestaoEditada) || sugestaoEditada.length === 0) return
                        const primeiro = sugestaoEditada[0].data
                        const parsed = new Date(primeiro + 'T00:00:00')
                        if (!isNaN(parsed.getTime())) {
                          setPublishMonth(`${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`)
                        }
                      } catch (e) { /* ignore */ }
                    }}
                    style={{ background: '#1a2a5e', color: '#fff', padding: '8px 10px', borderRadius: 8, fontWeight: 700 }}
                  >
                    Usar mês da sugestão
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                {sugestaoEditada.map(dia => (
                  <div key={dia.data} style={{ padding: 12, background: '#fff', borderRadius: 6, border: '1px solid #f3f3f3', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <strong>{new Date(dia.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</strong>
                      <button onClick={() => setEditingDay(dia)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd' }}>Editar</button>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                      {periodos.map(p => (
                        <div key={p} style={{ flex: 1, minWidth: 120 }}>
                          <div style={{ fontWeight: 700, color: '#7f1d1d', marginBottom: 6 }}>{p}</div>
                          {Object.entries(dia.turnos[p]).map(([f, n]) => {
                            const roleName = f
                            const diaYMD = dia.data

                            // candidatos: pessoas que têm essa função
                            let candidatos = membros.filter(m => Array.isArray(m.funcao) ? m.funcao.includes(f) : m.funcao === f)

                            // se a função é Holyrics ou OBS, excluímos membros que têm restrição para esta data/periodo
                            const isRestrictedRole = ['holyrics', 'obs'].includes(String(f).toLowerCase())
                            if (isRestrictedRole) {
                              candidatos = candidatos.filter(mem => !pessoaTemRestricaoNoPeriodo({
                                nomePessoa: mem.nome,
                                dataEscala: diaYMD,
                                periodoEscala: p,
                                membros,
                                restricoes
                              }))
                            }

                            const selectedName = n
                            const hasRestriction = pessoaTemRestricaoNoPeriodo({
                              nomePessoa: selectedName,
                              dataEscala: diaYMD,
                              periodoEscala: p,
                              membros,
                              restricoes
                            })

                            return (
                              <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                                <div style={{ width: 120, fontSize: 13 }}>{f}</div>

                                <select
                                  value={selectedName}
                                  onChange={e => {
                                    const novoValor = e.target.value
                                    const novo = sugestaoEditada.map(sd =>
                                      sd.data === dia.data
                                        ? { ...sd, turnos: { ...sd.turnos, [p]: { ...sd.turnos[p], [f]: novoValor } } }
                                        : sd
                                    )
                                    setSugestaoEditada(novo)
                                  }}
                                  style={{
                                    padding: 8,
                                    border: hasRestriction ? '1px solid #f87171' : '1px solid #ddd',
                                    borderRadius: 6,
                                    flex: 1,
                                    minWidth: 100
                                  }}
                                >
                                  <option value="Vago">Vago</option>
                                  {candidatos.map(mem => <option key={mem.id} value={mem.nome}>{mem.nome}</option>)}

                                  {/*
                                    Se o nome atual não está entre os candidatos mostramos opção (atual),
                                    EXCETO quando a função é Holyrics/OBS e a pessoa tem restrição (neste caso NÃO mostramos).
                                  */}
                                  {!candidatos.some(mem => mem.nome === selectedName) && selectedName !== 'Vago' && selectedName && ! (isRestrictedRole && hasRestriction) && (
                                    <option value={selectedName}>{selectedName} (atual)</option>
                                  )}
                                </select>

                                {/* aviso de restrição (aparece somente quando há restrição e o período é Noite) */}
                                {(f === 'Som' || f === 'Holyrics') && p === 'Noite' && hasRestriction && (
                                  <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 6, fontWeight: 700 }}>
                                    ⚠️ Esta pessoa tem restrição neste dia (sábado anterior ou no próprio domingo).
                                  </div>
                                )}

                                {/* ✅ BOTÃO SÁBADO - sugestão */}
                                {(f === 'Som' || f === 'Holyrics') && n && n !== 'Vago' && p === 'Noite' && (
                                  <button
                                    onClick={() => alert('Você deverá ir ao ensaio no sábado as 09:00, por favor.')}
                                    style={{ padding: '4px 10px', borderRadius: 6, background: '#7f1d1d', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    Sábado
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    const novoDia = { ...dia, turnos: { ...dia.turnos, [p]: { ...dia.turnos[p] } } }
                                    delete novoDia.turnos[p][f]
                                    setSugestaoEditada(sugestaoEditada.map(sd => sd.data === dia.data ? novoDia : sd))
                                  }}
                                  style={{ padding: '6px 8px', borderRadius: 6, background: '#fee2e2', border: '1px solid #fca5a5', fontSize: 12 }}
                                >
                                  Remover
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---- Restrições ---- */}
          {viewMode === 'escala' && (
            <div>
              <h4 style={{ marginTop: 0 }}>Restrições do Mês</h4>
              {restricoes.length === 0
                ? <p style={{ color: '#9ca3af' }}>Nenhuma restrição.</p>
                : restricoes.map(r => (
                  <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div><strong>{r.responsavel}</strong> - {r.data} ({Array.isArray(r.periodo) ? r.periodo.join(', ') : r.periodo})</div>
                    <button onClick={() => deleteRestricao(r.id)} style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '6px 10px', borderRadius: 8 }}>Remover</button>
                  </div>
                ))
              }
            </div>
          )}

        </div>
      </div>

      {/* ---- Modal Compartilhar ---- */}
      {showShareModal && sugestaoEditada && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>Compartilhar Escala</h3>
              <button onClick={() => setShowShareModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <input ref={shareBgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleShareBgChange} />
            <button onClick={() => shareBgInputRef.current && shareBgInputRef.current.click()} style={{ background: '#f3f4f6', border: '1px solid #e6e6e6', padding: '8px 14px', borderRadius: 8, marginBottom: 14, cursor: 'pointer', width: '100%' }}>
              {shareBgImage ? 'Trocar imagem de fundo' : 'Escolher imagem de fundo'}
            </button>
            <div ref={shareCardRef} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', backgroundColor: shareBgImage ? 'transparent' : '#f5f0e8', padding: '20px 18px', minHeight: 300 }}>
              {shareBgImage && <img src={shareBgImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, zIndex: 0 }} />}
              {shareBgImage && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.82)', borderRadius: 10, zIndex: 1 }} />}
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: '#1a2a5e' }}>
                    ESCALA —{' '}
                    {sugestaoEditada[0] && new Date(sugestaoEditada[0].data + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                  </span>
                </div>
                {sugestaoEditada.map(dia => (
                  <div key={dia.data} style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 8, padding: '10px 14px', marginBottom: 10, borderLeft: '4px solid #e8a020' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#1a2a5e', marginBottom: 8 }}>
                      {new Date(dia.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {periodos.map(p => (
                        <div key={p} style={{ flex: 1, minWidth: 100 }}>
                          <div style={{ fontWeight: 700, color: '#1a2a5e', fontSize: 12, marginBottom: 4, borderBottom: '1px solid #e8a020', paddingBottom: 2 }}>{p}</div>
                          {Object.entries(dia.turnos[p] || {}).map(([f, n]) => (
                            <div key={f} style={{ fontSize: 12, color: '#222', lineHeight: 1.8 }}>
                              <span style={{ fontWeight: 700, color: '#1a2a5e' }}>{f}:</span> {n}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button onClick={handleGenerateShareImage} style={{ ...secondaryBtnStyle, flex: 1 }}>Baixar Imagem</button>
              <button onClick={() => setShowShareModal(false)} style={{ background: '#e5e7eb', border: 'none', padding: '8px 14px', borderRadius: 8, flex: 1, cursor: 'pointer' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}