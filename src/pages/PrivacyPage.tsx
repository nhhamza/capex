import { Box, Container, Paper, Typography } from "@mui/material";

export function PrivacyPage() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100", py: 4 }}>
      <Container maxWidth="md">
        <Paper sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Política de Privacidad
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>
            Última actualización: {new Date().toLocaleDateString("es-ES")}
          </Typography>

          <Typography variant="body2" paragraph>
            Esta Política de Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos
            su información personal cuando utiliza nuestra plataforma de gestión inmobiliaria.
            Nos comprometemos a proteger su privacidad y cumplir con el Reglamento General de
            Protección de Datos (RGPD/GDPR) y la legislación española aplicable.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            1. Responsable del Tratamiento
          </Typography>
          <Typography variant="body2" paragraph>
            El responsable del tratamiento de sus datos personales es el titular de esta plataforma.
            Puede contactarnos para cualquier consulta relacionada con sus datos personales.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            2. Datos que Recopilamos
          </Typography>
          <Typography variant="body2" paragraph>
            Recopilamos los siguientes tipos de información:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 3 }}>
            <li>
              <strong>Datos de cuenta:</strong> nombre, correo electrónico, contraseña (encriptada),
              teléfono, ciudad
            </li>
            <li>
              <strong>Datos de perfil:</strong> tipo de usuario (inversor/pequeño propietario),
              nombre de organización
            </li>
            <li>
              <strong>Datos de propiedades:</strong> direcciones, precios, fechas, notas y otra
              información relacionada con sus propiedades inmobiliarias
            </li>
            <li>
              <strong>Datos financieros:</strong> contratos de alquiler, gastos, ingresos, préstamos
              y otra información financiera que usted introduce
            </li>
            <li>
              <strong>Datos de uso:</strong> información sobre cómo utiliza el Servicio, incluyendo
              registros de acceso y actividad
            </li>
            <li>
              <strong>Datos técnicos:</strong> dirección IP, tipo de navegador, sistema operativo,
              información del dispositivo
            </li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            3. Base Legal y Finalidad del Tratamiento
          </Typography>
          <Typography variant="body2" paragraph>
            Tratamos sus datos personales bajo las siguientes bases legales:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 3 }}>
            <li>
              <strong>Ejecución del contrato:</strong> para proporcionarle el Servicio que ha contratado
            </li>
            <li>
              <strong>Consentimiento:</strong> para enviarle comunicaciones comerciales (si lo ha consentido)
            </li>
            <li>
              <strong>Interés legítimo:</strong> para mejorar nuestro Servicio, prevenir fraudes y
              garantizar la seguridad
            </li>
            <li>
              <strong>Obligación legal:</strong> para cumplir con requisitos legales y fiscales cuando aplique
            </li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            4. Cómo Usamos sus Datos
          </Typography>
          <Typography variant="body2" paragraph>
            Utilizamos sus datos personales para:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 3 }}>
            <li>Proporcionar, mantener y mejorar el Servicio</li>
            <li>Crear y gestionar su cuenta de usuario</li>
            <li>Procesar y almacenar la información de sus propiedades</li>
            <li>Generar informes y análisis financieros</li>
            <li>Comunicarnos con usted sobre el Servicio</li>
            <li>Enviarle actualizaciones importantes y notificaciones de seguridad</li>
            <li>Responder a sus solicitudes de soporte</li>
            <li>Proteger contra fraudes y uso indebido</li>
            <li>Cumplir con obligaciones legales</li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            5. Compartir Información con Terceros
          </Typography>
          <Typography variant="body2" paragraph>
            NO vendemos ni alquilamos sus datos personales a terceros. Podemos compartir información
            limitada solo en los siguientes casos:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 3 }}>
            <li>
              <strong>Proveedores de servicios:</strong> con proveedores de alojamiento (Firebase/Google Cloud),
              procesamiento de pagos (Stripe), y otros servicios técnicos necesarios para operar el Servicio.
              Estos proveedores están obligados contractualmente a proteger sus datos.
            </li>
            <li>
              <strong>Requisitos legales:</strong> cuando sea requerido por ley, orden judicial o
              autoridad competente
            </li>
            <li>
              <strong>Protección de derechos:</strong> para proteger nuestros derechos legales o la
              seguridad de nuestros usuarios
            </li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            6. Transferencias Internacionales
          </Typography>
          <Typography variant="body2" paragraph>
            Sus datos pueden ser almacenados y procesados en servidores ubicados en la Unión Europea
            o en otros países que ofrecen un nivel adecuado de protección de datos. Cuando transferimos
            datos fuera del EEE, aseguramos que existan garantías adecuadas (como cláusulas contractuales
            tipo de la UE).
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            7. Seguridad de los Datos
          </Typography>
          <Typography variant="body2" paragraph>
            Implementamos medidas de seguridad técnicas y organizativas apropiadas para proteger
            sus datos personales:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 3 }}>
            <li>Encriptación de datos en tránsito (HTTPS/TLS)</li>
            <li>Encriptación de contraseñas</li>
            <li>Autenticación mediante Firebase Authentication</li>
            <li>Control de acceso basado en roles</li>
            <li>Copias de seguridad regulares</li>
            <li>Monitoreo de seguridad y auditorías</li>
          </Typography>
          <Typography variant="body2" paragraph>
            Sin embargo, ningún método de transmisión por Internet o almacenamiento electrónico
            es 100% seguro. No podemos garantizar la seguridad absoluta de sus datos.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            8. Retención de Datos
          </Typography>
          <Typography variant="body2" paragraph>
            Conservamos sus datos personales solo durante el tiempo necesario para cumplir con las
            finalidades descritas en esta Política, a menos que la ley requiera o permita un período
            de retención más largo. Los criterios para determinar el período de retención incluyen:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 3 }}>
            <li>Mientras mantenga una cuenta activa con nosotros</li>
            <li>Mientras sea necesario para proporcionarle el Servicio</li>
            <li>Para cumplir con obligaciones legales, fiscales o contables</li>
            <li>Para resolver disputas o hacer cumplir acuerdos</li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            9. Sus Derechos (GDPR/RGPD)
          </Typography>
          <Typography variant="body2" paragraph>
            Bajo el RGPD, usted tiene los siguientes derechos respecto a sus datos personales:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 3 }}>
            <li>
              <strong>Derecho de acceso:</strong> puede solicitar una copia de sus datos personales
            </li>
            <li>
              <strong>Derecho de rectificación:</strong> puede corregir datos inexactos o incompletos
            </li>
            <li>
              <strong>Derecho de supresión ("derecho al olvido"):</strong> puede solicitar la eliminación
              de sus datos en determinadas circunstancias
            </li>
            <li>
              <strong>Derecho de limitación del tratamiento:</strong> puede solicitar que restrinjamos
              el procesamiento de sus datos
            </li>
            <li>
              <strong>Derecho de portabilidad:</strong> puede solicitar recibir sus datos en formato
              estructurado y legible por máquina
            </li>
            <li>
              <strong>Derecho de oposición:</strong> puede oponerse al tratamiento de sus datos en
              determinadas circunstancias
            </li>
            <li>
              <strong>Derecho a retirar el consentimiento:</strong> puede retirar su consentimiento
              en cualquier momento
            </li>
            <li>
              <strong>Derecho a presentar reclamación:</strong> puede presentar una queja ante la
              Agencia Española de Protección de Datos (AEPD)
            </li>
          </Typography>
          <Typography variant="body2" paragraph>
            Para ejercer estos derechos, puede contactarnos a través de la configuración de su cuenta
            o por correo electrónico. Responderemos a su solicitud dentro del plazo legal de un mes.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            10. Cookies y Tecnologías Similares
          </Typography>
          <Typography variant="body2" paragraph>
            Utilizamos cookies y tecnologías similares para:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 3 }}>
            <li>Mantener su sesión activa (cookies esenciales)</li>
            <li>Recordar sus preferencias</li>
            <li>Analizar el uso del Servicio para mejorarlo</li>
            <li>Proporcionar funcionalidades de seguridad</li>
          </Typography>
          <Typography variant="body2" paragraph>
            Puede configurar su navegador para rechazar cookies, aunque esto puede afectar
            la funcionalidad del Servicio.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            11. Menores de Edad
          </Typography>
          <Typography variant="body2" paragraph>
            El Servicio no está dirigido a menores de 18 años. No recopilamos intencionalmente
            información personal de menores. Si descubrimos que hemos recopilado datos de un menor,
            los eliminaremos inmediatamente.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            12. Cambios en esta Política
          </Typography>
          <Typography variant="body2" paragraph>
            Podemos actualizar esta Política de Privacidad periódicamente. Le notificaremos sobre
            cambios significativos publicando la nueva Política en esta página y actualizando la
            fecha de "Última actualización". Le recomendamos revisar esta Política regularmente.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            13. Contacto
          </Typography>
          <Typography variant="body2" paragraph>
            Si tiene preguntas sobre esta Política de Privacidad o sobre cómo tratamos sus datos
            personales, puede contactarnos a través de la configuración de su cuenta o mediante
            los canales de soporte disponibles en el Servicio.
          </Typography>

          <Typography variant="body2" sx={{ mt: 4, fontStyle: "italic", color: "text.secondary" }}>
            Al utilizar este Servicio, usted reconoce que ha leído y comprendido esta Política de
            Privacidad y acepta el tratamiento de sus datos personales como se describe en la misma.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
