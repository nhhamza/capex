import { Box, Container, Paper, Typography } from "@mui/material";

export function TermsPage() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100", py: 4 }}>
      <Container maxWidth="md">
        <Paper sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Términos y Condiciones
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>
            Última actualización: {new Date().toLocaleDateString("es-ES")}
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            1. Aceptación de los Términos
          </Typography>
          <Typography variant="body2" paragraph>
            Al acceder y utilizar esta plataforma de gestión inmobiliaria (en adelante, "el Servicio"),
            usted acepta estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguna
            parte de estos términos, no debe utilizar el Servicio.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            2. Descripción del Servicio
          </Typography>
          <Typography variant="body2" paragraph>
            El Servicio proporciona una plataforma de software como servicio (SaaS) para la gestión de
            propiedades inmobiliarias, incluyendo pero no limitado a: seguimiento de contratos de alquiler,
            gestión de gastos e ingresos, análisis financiero, y generación de informes.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            3. Responsabilidades del Usuario
          </Typography>
          <Typography variant="body2" paragraph>
            El usuario es responsable de:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 3 }}>
            <li>Mantener la confidencialidad de sus credenciales de acceso</li>
            <li>La veracidad y exactitud de los datos introducidos en el sistema</li>
            <li>El cumplimiento de las leyes fiscales y tributarias aplicables</li>
            <li>El uso apropiado y legal del Servicio</li>
            <li>Realizar sus propias copias de seguridad de datos críticos</li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            4. Limitación de Responsabilidad
          </Typography>
          <Typography variant="body2" paragraph>
            EL SERVICIO SE PROPORCIONA "TAL CUAL" SIN GARANTÍAS DE NINGÚN TIPO. En particular:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 3 }}>
            <li>
              <strong>Datos del Usuario:</strong> No somos responsables de la exactitud, integridad o
              legalidad de los datos introducidos por el usuario. El usuario es el único responsable
              de verificar que sus datos sean correctos.
            </li>
            <li>
              <strong>Obligaciones Fiscales:</strong> El Servicio proporciona herramientas para organizar
              datos, pero el usuario es el único responsable de cumplir con sus obligaciones fiscales y
              tributarias. Recomendamos consultar con un asesor fiscal profesional.
            </li>
            <li>
              <strong>Pérdida de Datos:</strong> Aunque implementamos medidas de seguridad, no garantizamos
              que el Servicio esté libre de errores o interrupciones. No somos responsables por pérdida
              de datos, daños directos, indirectos, incidentales o consecuenciales.
            </li>
            <li>
              <strong>Disponibilidad:</strong> No garantizamos que el Servicio esté disponible
              ininterrumpidamente o libre de errores.
            </li>
            <li>
              <strong>Decisiones Financieras:</strong> Los informes y análisis generados por el Servicio
              son informativos. El usuario es responsable de sus propias decisiones de inversión.
            </li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            5. Uso de Datos
          </Typography>
          <Typography variant="body2" paragraph>
            El usuario reconoce y acepta que:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 3 }}>
            <li>Los datos introducidos son propiedad del usuario</li>
            <li>Procesamos los datos únicamente para proporcionar el Servicio</li>
            <li>No compartimos datos personales con terceros sin consentimiento</li>
            <li>Consulte nuestra Política de Privacidad para más detalles</li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            6. Propiedad Intelectual
          </Typography>
          <Typography variant="body2" paragraph>
            El Servicio, incluyendo su código, diseño, gráficos y documentación, es propiedad exclusiva
            del proveedor y está protegido por las leyes de propiedad intelectual. El usuario obtiene
            únicamente una licencia limitada para usar el Servicio.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            7. Modificaciones del Servicio
          </Typography>
          <Typography variant="body2" paragraph>
            Nos reservamos el derecho de modificar, suspender o discontinuar el Servicio (o cualquier
            parte del mismo) en cualquier momento, con o sin previo aviso. No seremos responsables ante
            usted ni ante terceros por cualquier modificación, suspensión o discontinuación del Servicio.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            8. Terminación
          </Typography>
          <Typography variant="body2" paragraph>
            Podemos terminar o suspender su acceso al Servicio inmediatamente, sin previo aviso o
            responsabilidad, por cualquier motivo, incluido el incumplimiento de estos Términos.
            El usuario puede cancelar su cuenta en cualquier momento desde la configuración.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            9. Indemnización
          </Typography>
          <Typography variant="body2" paragraph>
            El usuario acepta indemnizar y mantener indemne al proveedor del Servicio, sus directores,
            empleados y agentes de cualquier reclamación, daño, obligación, pérdida, responsabilidad,
            costo o deuda, y gasto (incluyendo honorarios de abogados) que surja de: (a) su uso del
            Servicio, (b) la violación de estos Términos, o (c) la violación de cualquier derecho de terceros.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            10. Ley Aplicable y Jurisdicción
          </Typography>
          <Typography variant="body2" paragraph>
            Estos Términos se regirán e interpretarán de acuerdo con las leyes de España, sin tener
            en cuenta sus disposiciones sobre conflictos de leyes. Cualquier disputa relacionada con
            estos términos estará sujeta a la jurisdicción exclusiva de los tribunales de España.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            11. Cambios en los Términos
          </Typography>
          <Typography variant="body2" paragraph>
            Nos reservamos el derecho de modificar estos Términos en cualquier momento. Le notificaremos
            sobre cambios significativos publicando los nuevos Términos en esta página. Su uso continuado
            del Servicio después de dichos cambios constituye su aceptación de los nuevos Términos.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            12. Disposiciones Generales
          </Typography>
          <Typography variant="body2" paragraph>
            Si alguna disposición de estos Términos se considera inválida o inaplicable, las disposiciones
            restantes continuarán en pleno vigor y efecto. El hecho de no hacer cumplir cualquier derecho
            o disposición de estos Términos no constituirá una renuncia a dicho derecho o disposición.
          </Typography>

          <Typography variant="body2" sx={{ mt: 4, fontStyle: "italic", color: "text.secondary" }}>
            Al utilizar este Servicio, usted reconoce que ha leído, entendido y aceptado estar sujeto
            a estos Términos y Condiciones.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
