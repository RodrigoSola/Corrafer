// Script de respaldo de certificados
export const backupCertificates = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = `./backups/certificates_${timestamp}`;
    
    if (!fs.existsSync('./backups')) {
        fs.mkdirSync('./backups', { recursive: true });
    }
    
    fs.mkdirSync(backupDir, { recursive: true });
    
    // Copiar certificados
    fs.copyFileSync(process.env.AFIP_CERT_PATH, `${backupDir}/certificado.crt`);
    fs.copyFileSync(process.env.AFIP_KEY_PATH, `${backupDir}/private.key`);
    
    console.log('💾 Certificados respaldados en:', backupDir);
};