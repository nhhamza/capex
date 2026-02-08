import { Box, Card, CardContent, Typography } from "@mui/material";
import { Property } from "../types";
import { PropertyPurchaseTab } from "./PropertyPurchaseTab";
import { PropertyDocsTab } from "./PropertyDocsTab";

interface PropertyDataTabProps {
  property: Property;
  onSave: () => void;
}

/**
 * Consolidated tab for property data (purchase info + documents)
 */
export function PropertyDataTab({ property, onSave }: PropertyDataTabProps) {
  return (
    <Box>
      {/* Purchase data section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            📋 Datos de compra
          </Typography>

          {/* Use existing PropertyPurchaseTab */}
          <PropertyPurchaseTab property={property} onSave={onSave} />
        </CardContent>
      </Card>

      {/* Documents section */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            📄 Documentos
          </Typography>

          {/* Use existing PropertyDocsTab */}
          <PropertyDocsTab propertyId={property.id} />
        </CardContent>
      </Card>
    </Box>
  );
}
