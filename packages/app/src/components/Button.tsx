import Link from "next/link";
import { Icon, type IconName } from "@/components/icons/Icons";

type ButtonVariant = "primary" | "secondary" | "tertiary";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: IconName;
  iconPosition?: "left" | "right";
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

interface ButtonAsButton extends ButtonBaseProps {
  href?: undefined;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  target?: undefined;
  rel?: undefined;
}

interface ButtonAsLink extends ButtonBaseProps {
  href: string;
  type?: undefined;
  onClick?: undefined;
  target?: string;
  rel?: string;
}

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-curtn-coral text-curtn-deep hover:bg-curtn-red active:scale-[0.98] font-bold dog-ear dog-ear-dark",
  secondary:
    "bg-transparent text-curtn-cream border border-curtn-cream/30 hover:border-curtn-cream/60 active:scale-[0.98]",
  tertiary:
    "bg-transparent text-curtn-muted hover:text-curtn-cream border border-curtn-dark hover:border-curtn-muted/50",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-[var(--spacing-2)] py-[var(--spacing-1)] text-[11px] gap-1",
  md: "px-[var(--spacing-3)] py-[var(--spacing-1_5)] text-[13px] gap-1.5",
  lg: "px-[var(--spacing-4)] py-[var(--spacing-2_5)] text-[14px] gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  icon,
  iconPosition = "left",
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const iconSize = size === "sm" ? 12 : size === "md" ? 14 : 16;

  const content = (
    <>
      {icon && iconPosition === "left" && <Icon name={icon} size={iconSize} />}
      {children}
      {icon && iconPosition === "right" && <Icon name={icon} size={iconSize} />}
    </>
  );

  const classes = `
    inline-flex items-center justify-center
    font-display uppercase tracking-wide
    transition-all duration-150 cursor-pointer
    disabled:opacity-40 disabled:cursor-not-allowed
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${fullWidth ? "w-full" : ""}
    ${className}
  `.trim();

  if (props.href != null) {
    const { href, target, rel } = props as ButtonAsLink;
    return (
      <Link href={href} target={target} rel={rel} className={classes}>
        {content}
      </Link>
    );
  }

  const { type = "button", onClick } = props as ButtonAsButton;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {content}
    </button>
  );
}
