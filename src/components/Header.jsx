// src/components/Header.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import './Header.css';

export default function Header({ siteName = 'Jardim Guarujá' }) {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function verificarAdministrador() {
      try {
        const raw = localStorage.getItem('current_user');
        const currentUser = raw ? JSON.parse(raw) : null;
        const nome = String(currentUser?.nome || '').trim();

        if (!nome) {
          setIsAdmin(false);
          return;
        }

        const { data, error } = await supabase
          .from('members')
          .select('id, nome, role')
          .ilike('nome', nome)
          .eq('role', 'admin')
          .limit(1);

        if (error) {
          console.error('Erro ao verificar administrador:', error);
          setIsAdmin(false);
          return;
        }

        const usuarioAdmin = data && data.length > 0;

        setIsAdmin(usuarioAdmin);

        if (usuarioAdmin) {
          localStorage.setItem(
            'current_user',
            JSON.stringify({
              ...currentUser,
              role: 'admin'
            })
          );
        }
      } catch (error) {
        console.error('Erro ao ler usuário atual:', error);
        setIsAdmin(false);
      }
    }

    verificarAdministrador();
  }, []);

  return (
    <header className="app-header" role="banner">
      <div className="header-inner">
        <div className="logo">
          <img src="/ibr.jpg" alt="IBR" />
          <div className="brand">
            <div className="brand-sub">Jardim Guarujá</div>
          </div>
        </div>

        <nav
          className={`nav-buttons ${open ? 'is-open' : ''}`}
          aria-label="Navegação principal"
        >
          <a href="/" className="nav-link">Início</a>
          <a href="/escalas" className="nav-link">Escalas</a>
          <a href="/informativos" className="nav-link">Informativos</a>
          <a href="/album" className="nav-link">Álbum</a>

          {isAdmin && (
            <a
              href="/admin"
              className="nav-link"
              style={{ color: '#fca311', fontWeight: 800 }}
            >
              Painel ADM
            </a>
          )}
        </nav>

        <div className="header-right">
          <div className="user">Equipe</div>

          <button
            className={`hamburger ${open ? 'is-active' : ''}`}
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            onClick={() => setOpen((aberto) => !aberto)}
          >
            <span className="hamburger-box">
              <span className="hamburger-inner" />
            </span>
          </button>
        </div>
      </div>

      <div
        className={`mobile-menu ${open ? 'visible' : ''}`}
        role="menu"
        aria-hidden={!open}
      >
        <a className="mobile-link" href="/" onClick={() => setOpen(false)}>
          Início
        </a>

        <a className="mobile-link" href="/escalas" onClick={() => setOpen(false)}>
          Escalas
        </a>

        <a className="mobile-link" href="/informativos" onClick={() => setOpen(false)}>
          Informativos
        </a>

        <a className="mobile-link" href="/album" onClick={() => setOpen(false)}>
          Álbum
        </a>

        {isAdmin && (
          <a
            className="mobile-link"
            href="/admin"
            onClick={() => setOpen(false)}
            style={{ color: '#fca311', fontWeight: 800 }}
          >
            Painel ADM
          </a>
        )}
      </div>
    </header>
  );
}