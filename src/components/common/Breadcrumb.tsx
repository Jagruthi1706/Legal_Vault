import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export const Breadcrumb: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => (
  <nav className="mb-4 flex items-center gap-1 overflow-x-auto py-1 text-xs text-foreground-muted">
    <Link to="/app" className="inline-flex items-center gap-1 hover:text-foreground">
      <Home className="h-3.5 w-3.5" />
      <span>Vault</span>
    </Link>
    {items.map((item, idx) => (
      <React.Fragment key={idx}>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-border-strong" />
        {item.href && idx < items.length - 1 ? (
          <Link to={item.href} className="whitespace-nowrap hover:text-foreground">{item.label}</Link>
        ) : (
          <span className="max-w-[220px] truncate font-medium text-foreground">{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </nav>
);
