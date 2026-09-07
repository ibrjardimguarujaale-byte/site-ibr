// src/components/Album.jsx
import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient' // Certifique-se de que este arquivo existe

export default function Album({ albumImages = [], onChange }) {
  const [loadingAlbum, setLoadingAlbum] = useState(false)
  const [busy, setBusy] = useState(false)
  const [isSupabaseReady, setIsSupabaseReady] = useState(false)
  const fileRef = useRef(null)

  const BUCKET_NAME = 'album_ibr'

  // Verifica se o usuário logado tem permissão de ADM no localStorage
  function isAdminUser() {
    try {
      const m = JSON.parse(localStorage.getItem('membros_ibr') || '[]')
      return m.some(x => {
        const funcs = Array.isArray(x.funcao) ? x.funcao : (x.funcao ? [x.funcao] : [])
        const admKeywords = ['ADM', 'Adm', 'adm', 'ADMIN', 'Admin', 'admin']
        return funcs.some(f => admKeywords.includes(String(f).trim()))
      })
    } catch (e) {
      return false
    }
  }

  // Carrega a lista de arquivos do Supabase Storage
  async function loadFromSupabase() {
    if (!supabase?.storage) return
    setLoadingAlbum(true)
    try {
      const res = await supabase.storage.from(BUCKET_NAME).list('', { 
        limit: 500, 
        sortBy: { column: 'name', order: 'desc' } 
      })
      
      if (res?.error) {
        setIsSupabaseReady(false)
        console.warn('Supabase bucket não encontrado ou sem acesso:', res.error)
        return
      }

      const files = res.data || []
      const formatted = files.map(f => {
        const pub = supabase.storage.from(BUCKET_NAME).getPublicUrl(f.name)
        const publicUrl = pub?.data?.publicUrl || ''
        return { 
          id: f.name, 
          title: f.name, 
          dataUrl: publicUrl, 
          createdAt: f.created_at || new Date().toISOString() 
        }
      })
      
      if (typeof onChange === 'function') onChange(formatted)
    } catch (err) {
      console.error('Erro ao carregar do Supabase:', err)
      setIsSupabaseReady(false)
    } finally {
      setLoadingAlbum(false)
    }
  }

  useEffect(() => {
    // Tenta detectar se o Supabase está configurado corretamente
    (async () => {
      try {
        if (!supabase?.storage) { setIsSupabaseReady(false); return }
        const test = await supabase.storage.from(BUCKET_NAME).list('', { limit: 1 })
        if (!test?.error) {
          setIsSupabaseReady(true)
          await loadFromSupabase()
        } else {
          setIsSupabaseReady(false)
        }
      } catch (e) {
        setIsSupabaseReady(false)
      }
    })()
  }, [])

  function triggerFileInput() {
    if (fileRef.current) fileRef.current.click()
  }

  // Auxiliar para converter arquivo em Base64 (fallback local)
  async function fileToDataUrl(file) {
    return await new Promise((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result)
      fr.onerror = rej
      fr.readAsDataURL(file)
    })
  }

  async function handleFiles(e) {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (!isAdminUser()) {
      alert('Somente Administradores podem adicionar fotos ao álbum.')
      e.target.value = ''
      return
    }

    setBusy(true)
    const selected = Array.from(files)
    const newItems = []

    try {
      for (const file of selected) {
        const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`

        if (isSupabaseReady) {
          // Upload para o Supabase
          const { error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file)
          if (error) {
            console.error('Erro de upload Supabase:', error)
            // Fallback para local se o upload falhar
            const dataUrl = await fileToDataUrl(file)
            newItems.push({ id: Date.now() + Math.random(), title: file.name, dataUrl, createdAt: new Date().toISOString() })
          } else {
            const pub = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName)
            newItems.push({ id: fileName, title: file.name, dataUrl: pub.data.publicUrl, createdAt: new Date().toISOString() })
          }
        } else {
          // Fallback total: salva em Base64 no LocalStorage
          const dataUrl = await fileToDataUrl(file)
          newItems.push({ id: Date.now() + Math.random(), title: file.name, dataUrl, createdAt: new Date().toISOString() })
        }
      }

      const merged = [...newItems, ...albumImages]
      if (typeof onChange === 'function') onChange(merged)
      alert(`${newItems.length} foto(s) adicionada(s)!`)
      
    } catch (err) {
      console.error('Erro no processamento das imagens:', err)
      alert('Erro ao processar imagens.')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  async function removeImage(id) {
    if (!confirm('Deseja excluir esta foto?')) return
    
    try {
      if (isSupabaseReady && typeof id === 'string' && id.includes('_')) {
        const { error } = await supabase.storage.from(BUCKET_NAME).remove([id])
        if (error) throw error
        await loadFromSupabase()
      } else {
        const novo = albumImages.filter(i => i.id !== id)
        if (typeof onChange === 'function') onChange(novo)
      }
    } catch (err) {
      alert('Erro ao remover imagem.')
    }
  }

  return (
    <div className="mt-4 p-4 bg-white rounded-lg shadow-sm border">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button 
          onClick={triggerFileInput} 
          disabled={busy}
          className="bg-red-900 text-white px-5 py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Processando...' : 'Adicionar Fotos'}
        </button>

        <button 
          onClick={() => confirm('Limpar álbum local?') && onChange([])}
          className="text-red-700 bg-red-50 border border-red-200 px-5 py-2 rounded-lg hover:bg-red-100 transition-colors"
        >
          Limpar Álbum
        </button>

        <span className="text-sm text-gray-500 ml-auto">
          {isSupabaseReady ? '🟢 Supabase Ativado' : '🟡 Armazenamento Local'}
        </span>
      </div>

      <input 
        ref={fileRef} 
        type="file" 
        accept="image/*" 
        multiple 
        hidden 
        onChange={handleFiles} 
      />

      {loadingAlbum ? (
        <div className="text-center py-10 text-gray-400">Carregando álbum...</div>
      ) : albumImages.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-xl text-gray-400">
          O álbum está vazio. Adicione fotos para começar.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {albumImages.map(img => (
            <div key={img.id} className="group relative bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
              <img 
                src={img.dataUrl} 
                alt={img.title} 
                className="w-full h-32 object-cover" 
              />
              <div className="p-2 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-600 truncate max-w-[80px]">
                  {img.title || 'Foto'}
                </span>
                <button 
                  onClick={() => removeImage(img.id)}
                  className="bg-white border border-red-100 text-red-500 p-1.5 rounded-lg hover:bg-red-50"
                  title="Excluir"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}