interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: "h-[var(--spacing-4)] w-[var(--spacing-4)] text-xs",
  md: "h-[var(--spacing-5)] w-[var(--spacing-5)] text-sm",
  lg: "h-[var(--spacing-8)] w-[var(--spacing-8)] text-2xl",
  xl: "h-[var(--spacing-12)] w-[var(--spacing-12)] text-3xl",
};

export function Avatar({ src, name, size = "md", className = "" }: AvatarProps) {
  const initial = name.charAt(0).toUpperCase();

  return src ? (
    <img
      src={src}
      alt={name}
      className={`${sizes[size]} shrink-0 rounded-full object-cover ${className}`}
    />
  ) : (
    <div
      className={`${sizes[size]} shrink-0 rounded-full bg-curtn-coral text-curtn-deep font-bold flex items-center justify-center select-none ${className}`}
    >
      {initial}
    </div>
  );
}
