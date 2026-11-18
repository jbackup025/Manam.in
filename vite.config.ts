import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig, type Plugin} from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function vercelApiDevPlugin(): Plugin {
  return {
    name: 'vercel-api-dev-middleware',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        const pathname = rawUrl.split('?')[0];
        if (!pathname.startsWith('/api/') || pathname.includes('..') || pathname.includes('/_lib/')) {
          return next();
        }
        const relPath = pathname.slice(1) + '.ts';
        const absPath = path.resolve(rootDir, relPath);
        if (!fs.existsSync(absPath)) {
          return next();
        }

        try {
          let body: unknown = {};
          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const raw = Buffer.concat(chunks).toString('utf8');
            if (raw) {
              try {
                body = JSON.parse(raw);
              } catch {
                body = {};
              }
            }
          }

          const vercelReq = Object.assign(req, {
            body,
            query: Object.fromEntries(new URL(rawUrl, 'http://localhost').searchParams.entries()),
            cookies: {},
          });

          const vercelRes = Object.assign(res, {
            status(code: number) {
              res.statusCode = code;
              return vercelRes;
            },
            json(payload: unknown) {
              if (!res.headersSent) {
                res.setHeader('Content-Type', 'application/json');
              }
              res.end(JSON.stringify(payload));
              return vercelRes;
            },
            send(payload: unknown) {
              if (typeof payload === 'object' && payload !== null && !Buffer.isBuffer(payload)) {
                return vercelRes.json(payload);
              }
              res.end(payload);
              return vercelRes;
            },
          });

          const mod = await server.ssrLoadModule('/' + relPath);
          await mod.default(vercelReq, vercelRes);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({error: err instanceof Error ? err.message : 'API error'}));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      vercelApiDevPlugin(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
