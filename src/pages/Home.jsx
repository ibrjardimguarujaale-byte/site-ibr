// src/pages/Home.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient'; 
import '../components/Home.css'; 

// Lista de versículos para alternar por hora
const VERSICULOS_LIST = [
  { texto: 'Lâmpada para os meus pés é a tua palavra e luz para o meu caminho.', referencia: 'Salmos 119:105' },
  { texto: 'O Senhor é o meu pastor; nada me faltará.', referencia: 'Salmos 23:1' },
  { texto: 'Tudo posso naquele que me fortalece.', referencia: 'Filipenses 4:13' },
  { texto: 'O Senhor te abençoe e te guarde.', referencia: 'Números 6:24' },
  { texto: 'Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.', referencia: 'Salmos 46:1' },
  { texto: 'Lancem sobre ele toda a sua ansiedade, porque ele tem cuidado de vocês.', referencia: '1 Pedro 5:7' },
  { texto: 'Mil cairão ao teu lado, e dez mil, à tua direita, mas tu não serás atingido.', referencia: 'Salmos 91:7' },
  { texto: 'Buscai primeiro o Reino de Deus, e todas estas coisas vos serão acrescentadas.', referencia: 'Mateus 6:33' },
  { texto: 'O amor é paciente, o amor é bondoso.', referencia: '1 Coríntios 13:4' },
  { texto: 'A alegria do Senhor é a nossa força.', referencia: 'Neemias 8:10' },
  { texto: 'Escondi a tua palavra no meu coração, para não pecar contra ti.', referencia: 'Salmos 119:11' },
  { texto: 'Se Deus é por nós, quem será contra nós?', referencia: 'Romanos 8:31' }
];

export default function Home() {
  const [album, setAlbum] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeLayer, setActiveLayer] = useState(0); 
  const [versiculo, setVersiculo] = useState(VERSICULOS_LIST[0]); // Estado para o versículo
  const layerRefs = useRef([null, null]);
  const intervalRef = useRef(null);

  // Função para pegar um versículo baseado na hora atual
  const updateVersiculoPorHora = useCallback(() => {
    const horaAtual = new Date().getHours();
    // Usa o resto da divisão para não estourar o tamanho da lista
    const indice = horaAtual % VERSICULOS_LIST.length;
    setVersiculo(VERSICULOS_LIST[indice]);
  }, []);

  const fetchSupabaseAlbum = useCallback(async () => {
    try {
      const { data, error: listError } = await supabase.storage
        .from('album_ibr')
        .list('', { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });

      if (listError) throw listError;
      if (!data || data.length === 0) return;

      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
      const blockedPrefixes = ['informativo-', 'tutorial-', 'escala-'];

      const photos = data
        .filter(file => {
          const name = file.name || '';
          const ext = name.split('.').pop()?.toLowerCase() || '';
          const isImage = imageExtensions.includes(ext) || file.metadata?.mimetype?.startsWith('image/');
          const isBlocked = blockedPrefixes.some(prefix => name.startsWith(prefix));
          return isImage && !isBlocked;
        })
        .map(file => {
          const { data: pub } = supabase.storage
            .from('album_ibr')
            .getPublicUrl(file.name);
          return { id: file.id, dataUrl: pub.publicUrl };
        });

      setAlbum(photos);
    } catch (e) {
      console.error('Erro ao buscar fotos do Supabase:', e);
    }
  }, []);

  useEffect(() => {
    fetchSupabaseAlbum();
    updateVersiculoPorHora(); // Define o versículo ao carregar

    // Opcional: Verifica a hora a cada minuto para trocar o versículo exatamente na virada da hora
    const vInterval = setInterval(updateVersiculoPorHora, 60000);
    return () => clearInterval(vInterval);
  }, [fetchSupabaseAlbum, updateVersiculoPorHora]);

  const applyImageStyle = (el, url) => {
    if (!el) return;
    el.style.backgroundImage = `url("${url}")`;
    el.style.backgroundPosition = 'center';
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundColor = 'rgba(0,0,0,0.8)'; 
  };

  useEffect(() => {
    if (!album || album.length === 0) return;

    if (layerRefs.current[0]) {
      applyImageStyle(layerRefs.current[0], album[0].dataUrl);
      layerRefs.current[0].style.opacity = '1';
    }

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        const nextIndex = (prev + 1) % album.length;
        const nextLayer = 1 - activeLayer;
        
        if (layerRefs.current[nextLayer]) {
          applyImageStyle(layerRefs.current[nextLayer], album[nextIndex].dataUrl);
          layerRefs.current[nextLayer].style.opacity = '0';
          void layerRefs.current[nextLayer].offsetHeight;
          layerRefs.current[nextLayer].style.opacity = '1';
        }
        
        setActiveLayer(nextLayer);
        return nextIndex;
      });
    }, 5000); 

    return () => clearInterval(intervalRef.current);
  }, [album, activeLayer]);

  const textHighlightStyle = {
    color: '#ffffff',
    textShadow: '2px 2px 8px rgba(0,0,0,0.8)',
    fontWeight: '600'
  };

  return (
    <div className="home-page" style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh', background: '#000' }}>
      
      {album.length > 0 && (
        <>
          <div
            ref={el => (layerRefs.current[0] = el)}
            style={{
              position: 'absolute', inset: 0, 
              transition: 'opacity 1.5s ease-in-out', opacity: 0, zIndex: 0, filter: 'brightness(0.5)'
            }}
          />
          <div
            ref={el => (layerRefs.current[1] = el)}
            style={{
              position: 'absolute', inset: 0, 
              transition: 'opacity 1.5s ease-in-out', opacity: 0, zIndex: 0, filter: 'brightness(0.5)'
            }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 1 }} />
        </>
      )}

      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', paddingTop: '10vh', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        <section className="verse-section">
          <div className="verse-card" style={{ background: 'transparent', padding: '0 20px' }}>
            <p className="verse-text" style={{ ...textHighlightStyle, fontSize: '1.5rem', fontStyle: 'italic' }}>
              “{versiculo.texto}”
            </p>
            <p className="verse-ref" style={{ ...textHighlightStyle, color: '#fca311', fontSize: '1.2rem' }}>
              {versiculo.referencia}
            </p>
          </div>
        </section>

        <div className="welcome-card" style={{ marginTop: '50px', flex: 1 }}>
          <h1 style={{ ...textHighlightStyle, fontSize: '3rem', marginBottom: '10px' }}>
            Bem-vindo à IBR Jardim Guarujá
          </h1>
          <p style={{ ...textHighlightStyle, fontSize: '1.3rem', color: '#e5e5e5' }}>
            Conectados em fé, servindo ao Senhor com amor.
          </p>

          <section className="content" style={{ background: 'transparent', marginTop: '40px' }}>
            <div className="container">
              <h2 style={{ ...textHighlightStyle, fontSize: '1.8rem', marginBottom: '20px' }}>Horários de Culto</h2>
              <div className="cards" style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <div className="card" style={{ background: 'rgba(255,255,255,0.15)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', color: 'white', backdropFilter: 'blur(4px)', minWidth: '200px' }}>
                  <strong style={{fontSize: '1.2rem'}}>Quarta-Feira</strong>
                  <p style={{marginTop: '10px', opacity: 0.9}}>20:00 - Culto de Oração</p>
                </div>
                <div className="card" style={{ background: 'rgba(255,255,255,0.15)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', color: 'white', backdropFilter: 'blur(4px)', minWidth: '200px' }}>
                  <strong style={{fontSize: '1.2rem'}}>Domingo</strong>
                  <p style={{marginTop: '10px', opacity: 0.9}}>09:00 - Escola Bíblica Dominical</p>
                  <p style={{marginTop: '10px', opacity: 0.9}}>18:00 - Culto de Celebração</p>
                </div>
              </div>
            </div>
          </section>

          <section className="content" style={{ background: 'transparent', marginTop: '40px' }}>
            <div className="container">
              <h2 style={{ ...textHighlightStyle, fontSize: '1.8rem', marginBottom: '20px' }}>Reuniões / Ensaios</h2>
              <div className="cards" style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <div className="card" style={{ background: 'rgba(255,255,255,0.15)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', color: 'white', backdropFilter: 'blur(4px)', minWidth: '200px' }}>
                  <strong style={{fontSize: '1.2rem'}}>Sábados</strong>
                  <p style={{marginTop: '10px', opacity: 0.9}}>09:00 - Ensaios</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}