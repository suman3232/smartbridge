import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Upload, CheckCircle2, X } from "lucide-react";

interface FileUploadProps {
  bucket: string;
  /** Called with the stored path and the (public-bucket) URL once uploaded. */
  onUploaded: (result: { path: string; publicUrl: string }) => void;
  onCleared?: () => void;
  accept?: string;
  /** Max file size in MB (default 5). */
  maxSizeMb?: number;
  label?: string;
}

export function FileUpload({
  bucket,
  onUploaded,
  onCleared,
  accept = "image/*,application/pdf",
  maxSizeMb = 5,
  label = "Upload file",
}: FileUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast({ title: "Not signed in", description: "Please sign in to upload.", variant: "destructive" });
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast({ title: "File too large", description: `Max ${maxSizeMb}MB.`, variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const result = await uploadFile(bucket, user.id, file);
      setFileName(file.name);
      onUploaded(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clear = () => {
    setFileName(null);
    onCleared?.();
  };

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept={accept} onChange={handleSelect} className="hidden" />
      {fileName ? (
        <div className="flex items-center gap-2 rounded-md border border-input bg-secondary/40 px-3 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          <span className="flex-1 truncate">{fileName}</span>
          <button type="button" onClick={clear} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" /> {label}</>
          )}
        </Button>
      )}
    </div>
  );
}
