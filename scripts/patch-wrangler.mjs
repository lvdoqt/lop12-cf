import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wranglerPath = join(__dirname, '..', 'dist', 'server', 'wrangler.json');

try {
  const content = readFileSync(wranglerPath, 'utf-8');
  const config = JSON.parse(content);
  let changed = false;

  // Rename ASSETS → STATIC_ASSETS binding
  if (config.assets && config.assets.binding === 'ASSETS') {
    config.assets.binding = 'STATIC_ASSETS';
    console.log('✓ Renamed ASSETS binding → STATIC_ASSETS in dist/server/wrangler.json');
    changed = true;
  } else {
    console.log('✓ No ASSETS binding found, skipping rename');
  }

  // Remove auto-injected SESSION KV binding (project uses cookie-based auth, not KV sessions)
  if (config.kv_namespaces && Array.isArray(config.kv_namespaces)) {
    const before = config.kv_namespaces.length;
    config.kv_namespaces = config.kv_namespaces.filter(kv => kv.binding !== 'SESSION');
    if (config.kv_namespaces.length < before) {
      console.log('✓ Removed auto-injected SESSION KV binding (not used)');
      changed = true;
    }
    if (config.kv_namespaces.length === 0) {
      delete config.kv_namespaces;
    }
  }

  // Remove auto-injected IMAGES binding (project does not use Cloudflare Images)
  if (config.images) {
    delete config.images;
    console.log('✓ Removed auto-injected IMAGES binding (not used)');
    changed = true;
  }

  if (changed) {
    writeFileSync(wranglerPath, JSON.stringify(config, null, 2));
    console.log('✓ Patched dist/server/wrangler.json successfully');
  }
} catch (err) {
  console.error('Failed to patch wrangler.json:', err.message);
  process.exit(1);
}
