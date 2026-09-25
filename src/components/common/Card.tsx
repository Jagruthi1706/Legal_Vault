import React from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  bordered?: boolean;
  highlightGold?: boolean;
  highlightAI?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  hoverEffect = false,
  bordered = true,
  highlightGold = false,
  highlightAI = false,
  children,
  className,
  ...props
}) => (
  <div
    className={clsx(
      'rounded-[8px] bg-surface p-4 transition-colors duration-150',
      bordered && 'border border-border',
      highlightGold && 'border-l-2 border-l-primary',
      highlightAI && 'border-l-2 border-l-ai',
      hoverEffect && 'hover:border-border-strong',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);
