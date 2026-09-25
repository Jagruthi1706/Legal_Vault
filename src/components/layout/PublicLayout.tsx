import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Scale, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '../common/Button';
import { useAuth } from '../../contexts/AuthContext';

export const PublicLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const navLinks = [
    { label: 'Features', href: '/features' },
    { label: 'About Platform', href: '/about' },
    { label: 'Documentation', href: '/documentation' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 px-4 py-3.5 backdrop-blur-md md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to={isAuthenticated ? "/app" : "/"} className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-primary text-white">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Legal Vault</div>
              <div className="text-[11px] text-foreground-muted">Judicial Intelligence Platform</div>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`text-xs font-medium tracking-tight transition-colors ${
                  location.pathname === link.href
                    ? 'border-b-2 border-b-primary pb-0.5 font-semibold text-foreground'
                    : 'text-foreground-muted hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/role-selection">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                Launch Platform
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Outlet */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface px-4 py-12 text-xs text-foreground md:px-8">
        <div className="mx-auto mb-12 grid max-w-7xl grid-cols-1 gap-10 md:grid-cols-5">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary text-white">
                <Scale className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">Legal Vault</span>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-foreground-muted">
              Judicial evidence workspace with case-scoped authorization, SHA-256 integrity, and Ethereum Sepolia custody.
            </p>
          </div>

          <div>
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              Platform
            </div>
            <ul className="space-y-2.5 text-foreground-muted">
              <li><Link to="/features" className="hover:text-foreground transition-colors">Features</Link></li>
              <li><Link to="/app/cases" className="hover:text-foreground transition-colors">Case Workspace</Link></li>
              <li><Link to="/app/blockchain" className="hover:text-foreground transition-colors">Blockchain Ledger</Link></li>
              <li><Link to="/app/research" className="hover:text-foreground transition-colors">Precedent Engine</Link></li>
            </ul>
          </div>

          <div>
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              Resources
            </div>
            <ul className="space-y-2.5 text-foreground-muted">
              <li><Link to="/documentation" className="hover:text-foreground transition-colors">Documentation</Link></li>
              <li><Link to="/about" className="hover:text-foreground transition-colors">About Judicial AI</Link></li>
              <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact Registry</Link></li>
            </ul>
          </div>

          <div>
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              Legal
            </div>
            <ul className="space-y-2.5 text-foreground-muted">
              <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><a href="https://ecourts.gov.in" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors inline-flex items-center gap-1">e-Courts India <ExternalLink className="w-3 h-3" /></a></li>
            </ul>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-border pt-8 text-[11px] text-foreground-muted md:flex-row">
          <div>
            © 2026 Legal Vault. Judicial Intelligence Platform.
          </div>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
