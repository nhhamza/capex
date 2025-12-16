import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
  CircularProgress,
  Button,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import {
  listPropertyDocs,
  uploadPropertyDoc, // ✅ new backend upload
  deletePropertyDoc,
  PropertyDocMeta,
} from "../api";

interface PropertyDocsTabProps {
  propertyId: string;
}

export function PropertyDocsTab({ propertyId }: PropertyDocsTabProps) {
  const [docs, setDocs] = useState<PropertyDocMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listPropertyDocs(propertyId);

      // sort newest first (guard in case uploadedAt is missing)
      setDocs(
        [...list].sort((a, b) => {
          const ta = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
          const tb = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
          return tb - ta;
        })
      );
    } catch (e: any) {
      setError(e?.message || "Error cargando documentos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      // Upload in parallel (faster)
      await Promise.all(
        files.map((file) => uploadPropertyDoc(propertyId, file, file.name))
      );

      await load();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        (typeof err?.response?.data === "string" ? err.response.data : null) ||
        err?.message ||
        "Error subiendo documento";

      setError(msg);
      console.error("Upload failed:", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
    } finally {
      setUploading(false);
      // allow re-uploading same file by resetting input value
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este documento?")) return;
    setUploading(true);
    setError(null);

    try {
      await deletePropertyDoc(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (e: any) {
      setError(e?.message || "Error eliminando documento");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Documentos
      </Typography>

      <Button
        component="label"
        variant="outlined"
        startIcon={
          uploading ? <CircularProgress size={18} /> : <CloudUploadIcon />
        }
        disabled={uploading}
        sx={{ minHeight: 48 }}
      >
        {uploading ? "Subiendo..." : "Subir documentos"}
        <input
          type="file"
          hidden
          accept="*"
          onChange={handleFileChange}
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

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Documentos adjuntos:
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={32} />
        </Box>
      ) : docs.length === 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          No hay documentos todavía
        </Typography>
      ) : (
        <List>
          {docs.map((doc) => (
            <ListItem
              key={doc.id}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                mb: 1,
                flexWrap: "wrap",
                alignItems: "flex-start",
                maxWidth: "100%",
              }}
            >
              <ListItemText
                primary={doc.name}
                secondary={
                  doc.uploadedAt
                    ? new Date(doc.uploadedAt).toLocaleString()
                    : ""
                }
                sx={{
                  flex: 1,
                  minWidth: 0,
                  pr: 2,
                  overflow: "hidden",
                  "& .MuiListItemText-primary": {
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  },
                }}
              />

              <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
                <Tooltip title="Descargar">
                  <IconButton
                    onClick={() => {
                      // signed URL from backend
                      window.open(doc.url, "_blank", "noopener,noreferrer");
                    }}
                    sx={{ minWidth: 48, minHeight: 48 }}
                    color="primary"
                  >
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Eliminar">
                  <IconButton
                    onClick={() => handleDelete(doc.id)}
                    disabled={uploading}
                    color="error"
                    sx={{ minWidth: 48, minHeight: 48 }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
