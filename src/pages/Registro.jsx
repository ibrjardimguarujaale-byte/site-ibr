// src/pages/Registro.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import '../components/Login.css'; // ← corrigido aqui

export default function Registro() {
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const videoId = '7XqWVfI-UM8';

  async function handleRegistro(e) {
    e.preventDefault();
    const trimmedNome = String(nome || '').trim();
    const trimmedSenha = String(senha || '').trim();

    if (!trimmedNome) { alert('Digite seu nome.'); return; }
    if (!trimmedSenha) { alert('Digite uma senha.'); return; }
    if (trimmedSenha !== confirmarSenha.trim()) { alert('As senhas não coincidem.'); return; }
    if (trimmedSenha.length < 4) { alert('A senha deve ter pelo menos 4 caracteres.'); return; }

    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('members')
        .select('id')
        .ilike('nome', trimmedNome)
        .limit(1);

      if (existing && existing.length > 0) {
        alert('Este nome já está cadastrado. Tente fazer login.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('members')
        .insert([{ nome: trimmedNome, senha: trimmedSenha }])
        .select()
        .single();

      if (error) {
        console.error(error);
        alert('Erro ao registrar. Tente novamente.');
        setLoading(false);
        return;
      }

      localStorage.setItem('current_user', JSON.stringify(data));
      navigate('/');
    } catch (err) {
      console.error(err);
      alert('Erro inesperado ao registrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-root">
      <div className="video-background" aria-hidden="true">
        <iframe
          title="background-video"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1`}
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
        />
      </div>

      <main className="login-wrapper">
        <div className="login-card" role="main" aria-label="Tela de registro">
          <img src="/ibr.jpg" alt="IBR Logo" className="login-logo" />

          <h2 className="verse-title">Criar Conta</h2>

          <form onSubmit={handleRegistro} className="login-form">
            <label className="sr-only" htmlFor="nome">Nome</label>
            <input
              id="nome"
              type="text"
              className="login-input"
              placeholder="Digite seu nome e sobrenome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
            />

            <label className="sr-only" htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              className="login-input"
              placeholder="Crie uma senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
            />

            <label className="sr-only" htmlFor="confirmarSenha">Confirmar Senha</label>
            <input
              id="confirmarSenha"
              type="password"
              className="login-input"
              placeholder="Confirme sua senha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              autoComplete="new-password"
            />

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Registrando...' : 'REGISTRAR'}
            </button>
          </form>

          <p style={{ marginTop: 16, fontSize: 13, color: '#ccc', textAlign: 'center' }}>
            Já tem conta?{' '}
            <Link to="/login" style={{ color: '#fff', fontWeight: 700 }}>Entrar</Link>
          </p>
        </div>
      </main>
    </div>
  );
}