// src/components/Login.jsx
import React from 'react';
import logo from '../assets/ibr.jpg'; // certifique-se de copiar ibr.jpg para src/assets/

export default function Login({ onLogin }) {
  const versiculo = 'Lâmpada para os meus pés é a tua palavra e luz para o meu caminho.';
  const referencia = 'Salmos 119:105';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      backgroundColor: '#4a0f12', // cor base caso a textura não carregue
      backgroundImage: `url('/src/assets/ibr.jpg')`, // fallback — não é crítico; mantém textura se quiser adaptar
      backgroundBlendMode: 'overlay',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
      fontFamily: '"Merriweather", serif, Georgia, serif'
    }}>
      <div style={{
        width: 340,
        maxWidth: '92%',
        padding: '36px 26px',
        borderRadius: 12,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.0), rgba(0,0,0,0.08))',
        color: '#efe6db',
        textAlign: 'center',
        boxShadow: '0 10px 40px rgba(0,0,0,0.6)'
      }}>
        <img src={logo} alt="IBR Logo" style={{ width: 140, height: 'auto', marginBottom: 18 }} />

        <h2 style={{
          margin: '4px 0 12px',
          fontSize: 20,
          color: '#efe6db',
          letterSpacing: 1,
          fontWeight: 700
        }}>
          Versículo do Dia
        </h2>

        <p style={{
          margin: '0 0 18px',
          color: '#f5e9df',
          lineHeight: 1.45,
          fontSize: 16,
          textShadow: '0 1px 0 rgba(0,0,0,0.25)'
        }}>
          {versiculo}
          <br />
          <span style={{ display: 'block', marginTop: 12, color: '#f0dfd0', fontSize: 14, fontWeight: 700 }}>{referencia}</span>
        </p>

        <button
          onClick={() => onLogin && onLogin()}
          style={{
            width: '100%',
            padding: '14px 18px',
            background: '#f5efe0',
            color: '#6b1515',
            border: 'none',
            borderRadius: 999,
            fontWeight: 800,
            letterSpacing: 2,
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(107,21,21,0.18)'
          }}
        >
          ENTRAR
        </button>
      </div>
    </div>
  );
}