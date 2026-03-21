interface DogEarProps {
  size?: "sm" | "md" | "lg";
  dark?: boolean;
  className?: string;
}

const sizes = {
  sm: { fold: "w-[14px] h-[14px]", crease: "w-[16px] h-[16px]" },
  md: { fold: "w-[22px] h-[22px]", crease: "w-[24px] h-[24px]" },
  lg: { fold: "w-[28px] h-[28px]", crease: "w-[30px] h-[30px]" },
};

export function DogEar({ size = "md", dark = false, className = "" }: DogEarProps) {
  const foldColor = dark ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.07)";
  const creaseColor = dark ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)";
  const s = sizes[size];

  return (
    <span className={`absolute top-0 right-0 pointer-events-none z-3 ${className}`}>
      {/* Crease */}
      <span
        className={`absolute top-0 right-0 ${s.crease}`}
        style={{
          background: `linear-gradient(225deg, transparent 49%, ${creaseColor} 49%, ${creaseColor} 51%, transparent 51%)`,
        }}
      />
      {/* Fold */}
      <span
        className={`absolute top-0 right-0 ${s.fold}`}
        style={{
          background: `linear-gradient(225deg, var(--color-curtn-deep) 50%, transparent 50%), linear-gradient(225deg, transparent 50%, ${foldColor} 50%)`,
          backgroundSize: "100% 100%",
        }}
      />
    </span>
  );
}
