type IconWeight = "regular" | "bold" | "light" | "thin" | "fill" | "duotone";

const WEIGHT_FONT: Record<IconWeight, string> = {
  regular: "Phosphor",
  bold: "Phosphor-Bold",
  light: "Phosphor-Light",
  thin: "Phosphor-Thin",
  fill: "Phosphor-Fill",
  duotone: "Phosphor-Duotone",
};

const ICONS = {
  "magnifying-glass": "\uE30C",
  house: "\uE2C2",
  compass: "\uE1C8",
  "map-pin": "\uE316",
  plus: "\uE3D4",
  user: "\uE4C2",
  "sign-out": "\uE42A",
  "caret-down": "\uE136",
  star: "\uE46A",
  heart: "\uE2A8",
  ticket: "\uE490",
  calendar: "\uE108",
  globe: "\uE288",
  phone: "\uE3BC",
  envelope: "\uE214",
  "arrow-left": "\uE058",
  "buildings": "\uE0F4",
  eye: "\uE220",
  "eye-slash": "\uE224",
  clock: "\uE19C",
  "clock-countdown": "\uE1A8",
  "list-plus": "\uE2F8",
  pencil: "\uE3A4",
  ghost: "\uE278",
  "list-bullets": "\uE2F0",
  "users-three": "\uE4D8",
  "copy": "\uE1D0",
  trash: "\uE4AC",
  lightning: "\uE2DE",
  "folder-simple": "\uE268",
  "folder-simple-plus": "\uE26C",
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  weight?: IconWeight;
  size?: number | string;
  className?: string;
}

export function Icon({
  name,
  weight = "regular",
  size = 20,
  className = "",
}: IconProps) {
  return (
    <span
      className={className}
      style={{
        fontFamily: WEIGHT_FONT[weight],
        fontSize: size,
        lineHeight: 1,
        fontStyle: "normal",
        fontWeight: "normal",
        display: "inline-block",
        verticalAlign: "middle",
      }}
      aria-hidden="true"
    >
      {ICONS[name]}
    </span>
  );
}
