import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePwa } from "./PwaProvider";
import { cn } from "@/lib/utils";
import { Download, Share, Plus, Check } from "lucide-react";

interface InstallButtonProps {
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default";
  /** Show a compact icon-only button (label hidden until sm+). */
  full?: boolean;
}

export function InstallButton({ className, variant = "outline", size = "sm", full }: InstallButtonProps) {
  const { canInstall, installed, isStandalone, isIOS, promptInstall } = usePwa();
  const [iosOpen, setIosOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Already installed / running as an app, or platform can't install → render nothing.
  if (installed || isStandalone) return null;
  const showNative = canInstall;
  const showIOS = !canInstall && isIOS;
  if (!showNative && !showIOS) return null;

  const handleClick = async () => {
    if (showIOS) {
      setIosOpen(true);
      return;
    }
    setBusy(true);
    await promptInstall();
    setBusy(false);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={busy}
        className={cn("press gap-1.5", size === "sm" && "rounded-full", className)}
        aria-label="Install OfferBridge app"
      >
        <Download className="h-4 w-4" />
        <span className={cn(full ? "" : "hidden sm:inline")}>Install app</span>
      </Button>

      <Dialog open={iosOpen} onOpenChange={setIosOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Install OfferBridge</DialogTitle>
            <DialogDescription>Add OfferBridge to your Home Screen for an app-like experience.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 py-2 text-sm">
            <li className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">1</span>
              <span className="flex items-center gap-1.5">Tap the <Share className="inline h-4 w-4 text-primary" /> <b>Share</b> button in Safari.</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">2</span>
              <span className="flex items-center gap-1.5">Choose <b>Add to Home Screen</b> <Plus className="inline h-4 w-4 text-primary" />.</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">3</span>
              <span className="flex items-center gap-1.5">Tap <b>Add</b> <Check className="inline h-4 w-4 text-success" /> — OfferBridge appears on your Home Screen.</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
