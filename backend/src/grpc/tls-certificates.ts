/**
 * TLS Certificate Generation and Management
 * Generates self-signed certificates for gRPC TLS/mTLS
 * For production, use Let's Encrypt or similar
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPrivateKey, createPublicKey, X509Certificate } from 'crypto';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CERT_DIR = path.join(__dirname, 'certs');
const CERT_FILES = {
  serverKey: path.join(CERT_DIR, 'server.key'),
  serverCert: path.join(CERT_DIR, 'server.crt'),
  clientKey: path.join(CERT_DIR, 'client.key'),
  clientCert: path.join(CERT_DIR, 'client.crt'),
  caCert: path.join(CERT_DIR, 'ca.crt'),
};

/**
 * Generate self-signed certificates for development/staging
 * For production, use: certbot certonly --standalone -d your.domain.com
 */
export function generateSelfSignedCertificates(): void {
  // Create certs directory if it doesn't exist
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
    console.log(`Created certificate directory: ${CERT_DIR}`);
  }

  // Skip if certificates already exist
  if (fs.existsSync(CERT_FILES.serverCert) && fs.existsSync(CERT_FILES.serverKey)) {
    console.log('TLS certificates already exist, skipping generation');
    return;
  }

  try {
    console.log('Generating self-signed TLS certificates...');

    // Generate CA certificate
    execSync(`
      openssl req -new -x509 -days 365 -nodes \\
        -out ${CERT_FILES.caCert} \\
        -keyout ${CERT_DIR}/ca.key \\
        -subj "/C=US/ST=State/L=City/O=Organization/CN=CA"
    `);
    console.log('✓ Generated CA certificate');

    // Generate server key
    execSync(`
      openssl genrsa -out ${CERT_FILES.serverKey} 2048
    `);
    console.log('✓ Generated server key');

    // Generate server CSR
    execSync(`
      openssl req -new \\
        -key ${CERT_FILES.serverKey} \\
        -out ${CERT_DIR}/server.csr \\
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    `);
    console.log('✓ Generated server CSR');

    // Sign server certificate with CA
    execSync(`
      openssl x509 -req -days 365 \\
        -in ${CERT_DIR}/server.csr \\
        -CA ${CERT_FILES.caCert} \\
        -CAkey ${CERT_DIR}/ca.key \\
        -CAcreateserial \\
        -out ${CERT_FILES.serverCert}
    `);
    console.log('✓ Generated server certificate');

    // Generate client key
    execSync(`
      openssl genrsa -out ${CERT_FILES.clientKey} 2048
    `);
    console.log('✓ Generated client key');

    // Generate client CSR
    execSync(`
      openssl req -new \\
        -key ${CERT_FILES.clientKey} \\
        -out ${CERT_DIR}/client.csr \\
        -subj "/C=US/ST=State/L=City/O=Organization/CN=client"
    `);
    console.log('✓ Generated client CSR');

    // Sign client certificate with CA
    execSync(`
      openssl x509 -req -days 365 \\
        -in ${CERT_DIR}/client.csr \\
        -CA ${CERT_FILES.caCert} \\
        -CAkey ${CERT_DIR}/ca.key \\
        -CAcreateserial \\
        -out ${CERT_FILES.clientCert}
    `);
    console.log('✓ Generated client certificate');

    // Clean up CSR files
    fs.unlinkSync(path.join(CERT_DIR, 'server.csr'));
    fs.unlinkSync(path.join(CERT_DIR, 'client.csr'));
    fs.unlinkSync(path.join(CERT_DIR, 'ca.key'));
    fs.unlinkSync(path.join(CERT_DIR, 'ca.srl'));

    console.log('✓ TLS certificates generated successfully');
  } catch (error) {
    console.error('Failed to generate TLS certificates:', error);
    console.error('Make sure OpenSSL is installed on your system');
    // Don't throw - allow server to start without TLS
  }
}

/**
 * Load TLS credentials for gRPC server
 */
export function loadServerCredentials(): any {
  const grpc = require('@grpc/grpc-js');

  try {
    if (
      fs.existsSync(CERT_FILES.serverKey) &&
      fs.existsSync(CERT_FILES.serverCert) &&
      fs.existsSync(CERT_FILES.caCert)
    ) {
      const serverKey = fs.readFileSync(CERT_FILES.serverKey);
      const serverCert = fs.readFileSync(CERT_FILES.serverCert);
      const caCert = fs.readFileSync(CERT_FILES.caCert);

      const credentials = grpc.ServerCredentials.createSsl(caCert, [
        { cert_chain: serverCert, private_key: serverKey },
      ]);

      console.log('✓ Loaded server TLS credentials');
      return credentials;
    } else {
      console.warn('TLS certificates not found, using insecure credentials');
      return grpc.ServerCredentials.createInsecure();
    }
  } catch (error) {
    console.error('Failed to load server credentials:', error);
    return grpc.ServerCredentials.createInsecure();
  }
}

/**
 * Load TLS credentials for gRPC client
 */
export function loadClientCredentials(): any {
  const grpc = require('@grpc/grpc-js');

  try {
    if (
      fs.existsSync(CERT_FILES.clientKey) &&
      fs.existsSync(CERT_FILES.clientCert) &&
      fs.existsSync(CERT_FILES.caCert)
    ) {
      const clientKey = fs.readFileSync(CERT_FILES.clientKey);
      const clientCert = fs.readFileSync(CERT_FILES.clientCert);
      const caCert = fs.readFileSync(CERT_FILES.caCert);

      const credentials = grpc.credentials.createSsl(caCert, clientKey, clientCert);

      console.log('✓ Loaded client TLS credentials');
      return credentials;
    } else {
      console.warn('TLS certificates not found, using insecure credentials');
      return grpc.credentials.createInsecure();
    }
  } catch (error) {
    console.error('Failed to load client credentials:', error);
    return grpc.credentials.createInsecure();
  }
}

/**
 * Verify certificate validity
 */
export function verifyCertificates(): boolean {
  try {
    if (!fs.existsSync(CERT_FILES.serverCert)) {
      return false;
    }

    const certData = fs.readFileSync(CERT_FILES.serverCert, 'utf-8');
    const cert = new X509Certificate(certData);

    const now = new Date();
    const notBefore = new Date(cert.validFrom);
    const notAfter = new Date(cert.validTo);

    if (now < notBefore || now > notAfter) {
      console.warn('⚠️ Server certificate is not valid');
      return false;
    }

    console.log(`✓ Server certificate valid until: ${notAfter.toISOString()}`);
    return true;
  } catch (error) {
    console.error('Failed to verify certificates:', error);
    return false;
  }
}

export { CERT_FILES, CERT_DIR };
