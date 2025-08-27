CERTIFICADOS AFIP
==================

Este directorio debe contener:

1. certificado.crt - Certificado obtenido desde AFIP
2. private.key - Clave privada generada localmente

PASOS PARA OBTENER CERTIFICADOS:
1. Generar CSR: POST /api/arca/afip/generate-csr
2. Subir CSR a AFIP (Administrador de Relaciones)
3. Descargar certificado .crt cuando esté listo
4. Colocar ambos archivos aquí

IMPORTANTE:
- Mantener estos archivos seguros
- No compartir la clave privada
- Hacer backup regularmente

Tu certificado actual: BL5909368296111
Generado: 2025-08-13T03:06:25.611Z
