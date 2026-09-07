// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import '../components/Login.css';

export default function Login() {
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const videoId = '7XqWVfI-UM8';

  async function handleLogin(e) {
    e.preventDefault();
    const trimmedNome = String(nome || '').trim();
    const trimmedSenha = String(senha || '').trim();

    if (!trimmedNome) { alert('Digite seu nome.'); return; }
    if (!trimmedSenha) { alert('Digite sua senha.'); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .ilike('nome', trimmedNome)
        .eq('senha', trimmedSenha)
        .limit(1);

      if (error) {
        console.error(error);
        alert('Erro ao consultar banco.');
        setLoading(false);
        return;
      }
      if (!data || data.length === 0) {
        alert('Nome ou senha incorretos.');
        setLoading(false);
        return;
      }

      localStorage.setItem('current_user', JSON.stringify(data[0]));
      navigate('/');
    } catch (err) {
      console.error(err);
      alert('Erro ao processar login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-root">
      {/* Vídeo de fundo (YouTube) */}
      <div className="video-background" aria-hidden="true">
        <iframe
          title="background-video"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1`}
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
        />
      </div>

      {/* Cartão de login */}
      <main className="login-wrapper">
        <div className="login-card" role="main" aria-label="Tela de login">
          <img src="/ibr.jpg" alt="IBR Logo" className="login-logo" />

          <h2 className="verse-title">Versículo do Dia</h2>
          <p className="verse-text">
            Lâmpada para os meus pés é a tua palavra e luz para o meu caminho.
            <span className="verse-ref">Salmos 119:105</span>
          </p>

          <form onSubmit={handleLogin} className="login-form">
            <label className="sr-only" htmlFor="nome">Nome</label>
            <input
              id="nome"
              type="text"
              className="login-input"
              placeholder="Digite seu nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              aria-label="Nome"
              autoComplete="name"
            />

            <label className="sr-only" htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              className="login-input"
              placeholder="Digite sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              aria-label="Senha"
              autoComplete="current-password"
            />

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Consultando...' : 'ENTRAR'}
            </button>
          </form>

          <p style={{ marginTop: 16, fontSize: 13, color: '#6b1515', textAlign: 'center' }}>
            Não tem conta? {''}
            <Link to="/registro" style={{ color: '#6b1515', fontWeight: 700 }}>Registrar</Link>
          </p>
        </div>
      </main>
    </div>
  );
}