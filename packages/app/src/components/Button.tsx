type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  className?: string;
  children?: React.ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-curtn-coral text-curtn-deep hover:bg-curtn-red active:scale-[0.98] font-bold dog-ear dog-ear-dark",
  secondary:
    "bg-transparent text-curtn-cream border border-curtn-cream/30 hover:border-curtn-cream/60",
  ghost:
    "bg-transparent text-curtn-muted hover:text-curtn-cream border border-dashed border-curtn-dark hover:border-curtn-muted",
};

export function Button({
  variant = "primary",
  fullWidth = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        px-[var(--spacing-3)] py-[var(--spacing-1_5)] text-[13px] uppercase font-display tracking-wide
        transition-all duration-150 cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
