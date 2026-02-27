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
    "bg-curtn-coral text-curtn-deep hover:bg-curtn-red active:scale-[0.98] font-semibold",
  secondary:
    "bg-curtn-surface text-curtn-cream border border-curtn-dark hover:border-curtn-muted",
  ghost:
    "bg-transparent text-curtn-muted hover:text-curtn-cream",
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
        rounded-lg px-6 py-3 text-sm tracking-wide
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
