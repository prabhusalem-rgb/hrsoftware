import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load .env
const envPath = join(projectRoot, '.env');
const env = {};
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
  });
}

// Minimal test - plain text
console.log('Test 1: Basic document with just Text');
try {
  const SimplePDF = () => (
    <Document>
      <Page size="A4" style={{ padding: 30 }}>
        <Text>Hello World</Text>
      </Page>
    </Document>
  );
  const buf = await renderToBuffer(<SimplePDF />);
  console.log('✓ Basic PDF works! Size:', buf.length);
} catch (err: any) {
  console.error('✗ Basic PDF failed:', err.message);
  console.error(err.stack?.substring(0, 500));
}

// Test with styles
console.log('\nTest 2: With styles');
try {
  const styles = StyleSheet.create({
    page: { padding: 30 },
    title: { fontSize: 24, fontWeight: 'bold' },
  });
  const StylePDF = () => (
    <Document>
      <Page style={styles.page}>
        <Text style={styles.title}>Styled Text</Text>
      </Page>
    </Document>
  );
  const buf = await renderToBuffer(<StylePDF />);
  console.log('✓ Styled PDF works! Size:', buf.length);
} catch (err: any) {
  console.error('✗ Styled PDF failed:', err.message);
  console.error(err.stack?.substring(0, 500));
}

// Test with company data
console.log('\nTest 3: With company data');
try {
  const company = { name_en: 'Test Company', address: 'Test Address' };
  const DataPDF = () => (
    <Document>
      <Page style={{ padding: 30 }}>
        <Text>{company.name_en}</Text>
        <Text>{company.address}</Text>
      </Page>
    </Document>
  );
  const buf = await renderToBuffer(<DataPDF />);
  console.log('✓ Data PDF works! Size:', buf.length);
} catch (err: any) {
  console.error('✗ Data PDF failed:', err.message);
  console.error(err.stack?.substring(0, 500));
}
