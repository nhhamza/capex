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
  addPropertyDoc,
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
      // sort newest first
      setDocs(
        list.sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        )
      );
    } catch (e: any) {
      setError(e.message || "Error cargando documentos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [propertyId]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(e.target.files)) {
        const base64Url = await fileToBase64(file);
        await addPropertyDoc({ propertyId, name: file.name, url: base64Url });
      }
      await load();
    } catch (e: any) {
      setError(e.message || "Error guardando documento");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este documento?")) return;
    setUploading(true);
    try {
      await deletePropertyDoc(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (e: any) {
      setError(e.message || "Error eliminando documento");
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
                secondary={new Date(doc.uploadedAt).toLocaleString()}
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
                      const a = document.createElement("a");
                      a.href = doc.url;
                      a.download = doc.name;
                      a.click();
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
