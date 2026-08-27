import { BadgeDollarSign, ShoppingCart, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PortalHomePage() {
  return (
    <div className="portal-home">
      <style>{`
        .portal-home {
          --primary: #00AE9D;
          --secondary: #003641;
          --bg-body: #f5f7fa;
          --text-main: #003641;
          --text-muted: #666666;
          --border: #e0e0e0;
          overflow-y: auto;
          background-color: var(--bg-body);
          background-image:
            linear-gradient(135deg, rgba(0, 174, 157, 0.05) 25%, transparent 25%),
            linear-gradient(225deg, rgba(0, 174, 157, 0.05) 25%, transparent 25%),
            linear-gradient(45deg, rgba(0, 174, 157, 0.05) 25%, transparent 25%),
            linear-gradient(315deg, rgba(0, 174, 157, 0.05) 25%, transparent 25%);
          background-position: 10px 0, 10px 0, 0 0, 0 0;
          background-size: 40px 40px;
          background-repeat: repeat;
          background-attachment: fixed;
          min-height: 100vh;
          font-family: system-ui, 'Segoe UI', Roboto, sans-serif;
          color: var(--text-main);
        }

        .portal-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 40px 20px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }

        .portal-header {
          text-align: center;
          margin-bottom: 40px;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .portal-logo {
          max-width: 360px;
          width: min(360px, 88vw);
          margin-bottom: 0px;
          margin-left: auto;
          margin-right: auto;
          display: block;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.05));
        }

        .portal-header p {
          color: var(--text-muted);
          font-size: 1.1rem;
          max-width: 600px;
          margin: 0 auto;
          line-height: 1.1;
        }

        .portal-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          padding: 10px;
        }

        .module-card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 40px 30px;
          text-align: center;
          box-shadow: 0 10px 30px -5px rgba(0,0,0,0.05);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          text-decoration: none;
          color: var(--text-main);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 280px;
          border: 1px solid rgba(255,255,255,0.5);
          position: relative;
          overflow: hidden;
        }

        .module-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 4px;
          background: linear-gradient(90deg, var(--primary), var(--secondary));
          opacity: 0;
          transition: opacity 0.3s;
        }

        .module-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px -5px rgba(0,0,0,0.1);
          background: #ffffff;
        }

        .module-card:hover::before {
          opacity: 1;
        }

        .module-card.disabled {
          opacity: 0.72;
          filter: grayscale(0.25);
          cursor: not-allowed;
          pointer-events: none;
        }

        .module-card.disabled:hover {
          transform: none;
          box-shadow: 0 10px 30px -5px rgba(0,0,0,0.05);
          background: rgba(255, 255, 255, 0.9);
        }

        .module-card.disabled::before {
          opacity: 0;
        }

        .module-icon {
          width: 80px;
          height: 80px;
          margin-bottom: 24px;
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f0fdfc 0%, #e6fffa 100%);
          border-radius: 24px;
          transition: transform 0.3s ease;
        }

        .module-icon svg {
          width: 44px;
          height: 44px;
        }

        .module-card:hover .module-icon {
          transform: scale(1.1) rotate(5deg);
          background: var(--primary);
          color: white;
          box-shadow: 0 10px 20px rgba(0, 174, 157, 0.2);
        }

        .module-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 12px;
          color: var(--secondary);
        }

        .module-desc {
          color: var(--text-muted);
          font-size: 0.95rem;
          line-height: 1.5;
          margin-bottom: 20px;
        }

        .module-status {
          margin-top: auto;
          font-size: 0.85rem;
          font-weight: 600;
          padding: 6px 16px;
          border-radius: 20px;
          background: #f1f5f9;
          color: #64748b;
          transition: all 0.2s;
        }

        .module-status.active {
          background: #dcfce7;
          color: #166534;
        }

        .module-card:hover .module-status.active {
          background: #166534;
          color: white;
        }

        .module-status.unavailable {
          background: #fee2e2;
          color: #991b1b;
        }

        .portal-footer {
          text-align: center;
          margin-top: 40px;
          font-size: 0.85rem;
          color: var(--text-muted);
        }
      `}</style>

      <div className="portal-container">
        <header className="portal-header">
          <img
            src="/assets/portal_ADM_%20logo.svg"
            alt="Portal Administrativo"
            className="portal-logo"
            onError={(e) => {
              const img = e.currentTarget
              img.onerror = null
              img.src = '/assets/sicoob-juriscred_Logo Verde.png'
            }}
          />
          <p>Selecione o módulo que deseja acessar</p>
        </header>

        <div className="portal-grid">
          <Link to="/credito" className="module-card">
            <div className="module-icon">
              <BadgeDollarSign />
            </div>
            <div className="module-title">Recuperação de Crédito</div>
            <div className="module-desc">
              Consiliação de Empréstimos Consignados.
            </div>
            <div className="module-status active">Disponível</div>
          </Link>

          <div className="module-card disabled">
            <div className="module-icon">
              <ShoppingCart />
            </div>
            <div className="module-title">Compras</div>
            <div className="module-desc">
              Gestão de requisições, cotações e fornecedores.
            </div>
            <div className="module-status unavailable">Em Breve</div>
          </div>

          <div className="module-card disabled">
            <div className="module-icon">
              <Wrench />
            </div>
            <div className="module-title">Manutenção Predial</div>
            <div className="module-desc">
              Gestão de chamados, ordens de serviço e patrimônio.
            </div>
            <div className="module-status unavailable">Em Breve</div>
          </div>
        </div>

        <footer className="portal-footer">
          <div>© 2026 Sicoob Juriscred</div>
          <div>Desenvolvido por: Departamento de Tecnologia da Informação Juriscred.</div>
        </footer>
      </div>
    </div>
  )
}
