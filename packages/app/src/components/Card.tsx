interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`
        bg-curtn-surface rounded-xl border border-curtn-dark/30
        p-[var(--spacing-4)]
        ${className}
      `}
    >
      {children}
    </div>
  );
}
