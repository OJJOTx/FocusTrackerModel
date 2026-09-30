/**
 * Download MediaPipe model files required by the Visual Attention Monitoring Engine.
 *
 * Run with: npx ts-node scripts/download-models.ts
 * Or: npm run download-models
 */

import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const MODELS = [
  {
    name: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
    description: 'MediaPipe Face Landmarker model (float16)',
  },
];

const MODELS_DIR = path.resolve(__dirname, '..', 'models');

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const request = (url.startsWith('https') ? https : http).get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect without location header'));
          return;
        }
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;

      response.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
          process.stdout.write(`\r  Downloading... ${progress}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)`);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        process.stdout.write('\n');
        resolve();
      });
    });

    request.on('error', (err) => {
      fs.unlink(destPath, () => {}); // Clean up partial file
      reject(err);
    });
  });
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('📦 Downloading MediaPipe model files...\n');

  // Create models directory if it doesn't exist
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  for (const model of MODELS) {
    const destPath = path.join(MODELS_DIR, model.name);

    if (fs.existsSync(destPath)) {
      const stats = fs.statSync(destPath);
      // eslint-disable-next-line no-console
      console.log(`✅ ${model.name} already exists (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
      continue;
    }

    // eslint-disable-next-line no-console
    console.log(`📥 ${model.description}`);
    // eslint-disable-next-line no-console
    console.log(`   URL: ${model.url}`);

    try {
      await downloadFile(model.url, destPath);
      const stats = fs.statSync(destPath);
      // eslint-disable-next-line no-console
      console.log(`   ✅ Saved to ${destPath} (${(stats.size / 1024 / 1024).toFixed(1)} MB)\n`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`   ❌ Failed to download ${model.name}: ${error}`);
      process.exit(1);
    }
  }

  // eslint-disable-next-line no-console
  console.log('✨ All models downloaded successfully!');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error:', err);
  process.exit(1);
});
