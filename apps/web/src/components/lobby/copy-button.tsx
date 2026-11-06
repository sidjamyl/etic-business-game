import { Check, Copy } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * The Clipboard API needs HTTPS or localhost: on the local-network fallback (P5, plain HTTP)
 * it is missing, so we ask people to copy by hand (codes and links are selectable).
 */
async function copyText(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Copies a code or a link. Icon-only unless `children` gives it a visible label. */
export function CopyButton({
  text,
  label,
  copiedMessage,
  children,
  variant = "outline",
  size = "icon-sm",
  className,
}: {
  text: string;
  /** Accessible name when the button shows only its icon. */
  label: string;
  copiedMessage: string;
  children?: ReactNode;
  variant?: "outline" | "ghost" | "secondary";
  size?: "icon-sm" | "icon" | "sm";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      aria-label={children ? undefined : label}
      onClick={async () => {
        if (!(await copyText(text))) {
          toast.error("Copie impossible ici : sélectionnez le texte et copiez-le à la main.");
          return;
        }
        toast.success(copiedMessage);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {children}
    </Button>
  );
}
