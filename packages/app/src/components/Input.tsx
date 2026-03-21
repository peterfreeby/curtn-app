interface InputProps {
  label: string;
  id?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  className?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function Input({ label, className = "", id, ...props }: InputProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-[var(--spacing-1)]">
      <label
        htmlFor={inputId}
        className="font-mono text-[10px] uppercase tracking-[1px] text-curtn-muted"
      >
        {label}
      </label>
      <input
        id={inputId}
        className={`
          bg-transparent border-b border-curtn-dark
          text-curtn-cream placeholder:text-curtn-dark
          py-[var(--spacing-1)] text-sm outline-none
          focus:border-curtn-coral transition-colors duration-200
          ${className}
        `}
        {...props}
      />
    </div>
  );
}
