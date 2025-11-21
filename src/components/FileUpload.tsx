import { Box, Button, Typography, CircularProgress } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { storage } from "@/firebase/client";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useState } from "react";

interface FileUploadProps {
  onUpload?: (
    files: FileList,
    uploaded: { name: string; url: string }[]
  ) => void;
  accept?: string;
  label?: string;
  pathPrefix?: string; // e.g. 'expenses/<expenseId>'
}

export function FileUpload({
  onUpload,
  accept = "*",
  label = "Subir archivo",
  pathPrefix = "uploads",
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<
    { name: string; url: string }[]
  >([]);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = e.target.files;
    setUploading(true);
    setError(null);
    try {
      const uploaded: { name: string; url: string }[] = [];
      for (const file of Array.from(files)) {
        const storagePath = `${pathPrefix}/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(fileRef, file);
        uploadTask.on("state_changed", (snap) => {
          const pct = Math.round(
            (snap.bytesTransferred / snap.totalBytes) * 100
          );
          setProgressMap((p) => ({ ...p, [file.name]: pct }));
        });
        await new Promise<void>((resolve, reject) => {
          uploadTask.on("state_changed", undefined, reject, () => resolve());
        });
        const url = await getDownloadURL(fileRef);
        uploaded.push({ name: file.name, url });
        setProgressMap((p) => ({ ...p, [file.name]: 100 }));
      }
      setUploadedFiles((prev) => [...prev, ...uploaded]);
      onUpload && onUpload(files, uploaded);
    } catch (err: any) {
      const msg =
        err?.code === "storage/unauthorized"
          ? "Permisos insuficientes en Firebase Storage"
          : err?.code === "storage/canceled"
          ? "Subida cancelada"
          : err?.code === "storage/retry-limit-exceeded"
          ? "Límite de reintentos excedido (posible problema de red)"
          : err.message || "Error subiendo archivo";
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Button
        component="label"
        variant="outlined"
        startIcon={
          uploading ? <CircularProgress size={18} /> : <CloudUploadIcon />
        }
        disabled={uploading}
      >
        {uploading ? "Subiendo..." : label}
        <input
          type="file"
          hidden
          accept={accept}
          onChange={handleChange}
          multiple
        />
      </Button>
      {error && (
        <Typography
          color="error"
          variant="caption"
          display="block"
          sx={{ mt: 1 }}
        >
          {error}
        </Typography>
      )}
      {(uploading || uploadedFiles.length > 0) && (
        <Box sx={{ mt: 1 }}>
          {Object.entries(progressMap).map(([name, pct]) => (
            <Typography key={name} variant="caption" display="block">
              {name}: {pct}%
            </Typography>
          ))}
          {uploadedFiles.map((f) => (
            <Typography
              key={f.url}
              variant="caption"
              display="block"
              color="success.main"
            >
              {f.name} ✔
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}
