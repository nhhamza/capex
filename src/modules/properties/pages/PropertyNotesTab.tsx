import { useState } from 'react';
import { Box, TextField, Button } from '@mui/material';
import { Property } from '../types';
import { updateProperty } from '../api';

interface PropertyNotesTabProps {
  property: Property;
  onSave: () => void;
}

export function PropertyNotesTab({ property, onSave }: PropertyNotesTabProps) {
  const [notes, setNotes] = useState(property.notes || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProperty(property.id, { notes });
      onSave();
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <TextField
        fullWidth
        label="Notas"
        multiline
        rows={12}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Button
        variant="contained"
        onClick={handleSave}
        disabled={loading}
        sx={{ mt: 2 }}
      >
        {loading ? 'Guardando...' : 'Guardar Notas'}
      </Button>
    </Box>
  );
}
