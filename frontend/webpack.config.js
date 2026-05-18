/**
 * ════════════════════════════════════════════════════════════════════════════
 * LEARNING-ONLY WEBPACK CONFIGURATION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️  This file is NOT used to build the app — that's Vite's job (vite.config.ts).
 *
 * WHY does this file exist then?
 *   • In 2026, ~70% of large enterprise React codebases still use Webpack.
 *     If you interview at Meta, Amazon, Microsoft, most banks, most legacy SaaS —
 *     they'll ask "walk me through your webpack config".
 *   • You need to be able to read, debug, and modify Webpack configs even if you
 *     don't pick it for greenfield projects.
 *   • Understanding Webpack also makes you better at Vite — Vite uses Rollup under
 *     the hood, which is conceptually similar (entry → loaders/plugins → output).
 *
 * Read this file top-to-bottom. Every comment maps to a real interview question.
 *
 * To run this config (optional, for experiments):
 *   npm install --save-dev webpack webpack-cli webpack-dev-server \
 *     html-webpack-plugin babel-loader @babel/preset-env @babel/preset-react \
 *     @babel/preset-typescript style-loader css-loader mini-css-extract-plugin \
 *     terser-webpack-plugin
 *   npx webpack serve --config webpack.config.js
 * ════════════════════════════════════════════════════════════════════════════
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import TerserPlugin from 'terser-webpack-plugin';

// ESM doesn't have __dirname natively → reconstruct it from import.meta.url.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Webpack accepts either an object OR a function. Function form is better because it
 * receives `env` and `argv`, letting us branch on dev vs prod from one config file
 * (DRY) instead of maintaining webpack.dev.js / webpack.prod.js separately.
 */
export default (env, argv) => {
  const isProd = argv.mode === 'production';
  const isDev = !isProd;

  return {
    // ────────────────────────────────────────────────────────────────────────
    // MODE — controls a bunch of built-in optimizations
    // ────────────────────────────────────────────────────────────────────────
    // 'development' → fast builds, readable output, eval-source-maps, no minify
    // 'production'  → tree-shake, minify, NODE_ENV='production', deterministic ids
    // 'none'        → no defaults; only use if you know what you're disabling
    mode: isProd ? 'production' : 'development',

    // ────────────────────────────────────────────────────────────────────────
    // ENTRY — where the dependency graph starts
    // ────────────────────────────────────────────────────────────────────────
    // Webpack walks from each entry, follows every `import`, builds a graph.
    // You can have multiple entries for multiple bundles (e.g. main app + service worker).
    entry: {
      main: path.resolve(__dirname, 'src/main.tsx'),
    },

    // ────────────────────────────────────────────────────────────────────────
    // OUTPUT — where bundled files are written
    // ────────────────────────────────────────────────────────────────────────
    output: {
      path: path.resolve(__dirname, 'dist-webpack'),
      // `[name]` = entry key ('main'). `[contenthash]` = hash of file content.
      // WHY contenthash? Cache-busting. When app.js changes, filename changes →
      // browsers fetch the new one. When it doesn't change, CDN cache hits → fast.
      filename: isProd ? 'assets/js/[name].[contenthash:8].js' : 'assets/js/[name].js',
      // chunkFilename = name for split chunks (lazy-loaded routes, dynamic imports).
      chunkFilename: isProd
        ? 'assets/js/[name].[contenthash:8].chunk.js'
        : 'assets/js/[name].chunk.js',
      // assetModuleFilename = for images/fonts handled by Webpack 5's asset modules.
      assetModuleFilename: 'assets/media/[name].[hash:8][ext]',
      // publicPath = URL prefix in the generated HTML. '/' for SPA at root,
      // '/app/' if mounted at example.com/app/, 'auto' to infer at runtime.
      publicPath: '/',
      // clean: true removes old build outputs before writing new ones. Webpack 5+ feature.
      // Replaces the old clean-webpack-plugin (one less dependency).
      clean: true,
    },

    // ────────────────────────────────────────────────────────────────────────
    // RESOLVE — how Webpack finds modules when you `import` something
    // ────────────────────────────────────────────────────────────────────────
    resolve: {
      // Extensions tried in order when an import omits one.
      // import './App' → tries App.tsx, then App.ts, then App.jsx, then App.js.
      // ⚠️  Order matters for perf. Put most-common first.
      extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
      // Path aliases — must mirror tsconfig.app.json `paths` AND vite.config.ts alias.
      // Three places to keep in sync. (This is part of why monorepo tools like Nx exist.)
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },

    // ────────────────────────────────────────────────────────────────────────
    // MODULE.RULES — loaders transform files as Webpack walks the graph
    // ────────────────────────────────────────────────────────────────────────
    // Rules: { test (regex on filename), use (loader chain), exclude, include }
    // Loaders run RIGHT-TO-LEFT (last in array runs first). This trips up everyone once.
    module: {
      rules: [
        {
          // TypeScript + JSX. babel-loader transpiles to JS using @babel/preset-*.
          // Alternative: swc-loader (faster) or ts-loader (uses tsc, slower but type-checks).
          // Most teams use babel-loader for speed + fork-ts-checker-webpack-plugin for types in parallel.
          test: /\.(ts|tsx|js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: '> 0.5%, last 2 versions, not dead' }],
                ['@babel/preset-react', { runtime: 'automatic' }],
                '@babel/preset-typescript',
              ],
              // cacheDirectory dramatically speeds up rebuilds.
              cacheDirectory: true,
            },
          },
        },
        {
          // CSS pipeline. css-loader resolves @import & url(), then either:
          //   • style-loader (dev): injects <style> tags into DOM — fast HMR
          //   • MiniCssExtractPlugin.loader (prod): extracts to separate .css files — cacheable
          test: /\.css$/,
          use: [isProd ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader'],
        },
        {
          // Images. Webpack 5's "asset modules" replace url-loader/file-loader.
          //   type: 'asset' → inline if <8KB (Base64 in JS), else emit file. Best of both.
          //   type: 'asset/resource' → always emit file
          //   type: 'asset/inline' → always inline
          //   type: 'asset/source' → inline as raw text
          test: /\.(png|jpe?g|gif|svg|webp)$/i,
          type: 'asset',
          parser: { dataUrlCondition: { maxSize: 8 * 1024 } },
        },
        {
          // Fonts — always emit as files (Base64 fonts bloat JS).
          test: /\.(woff2?|eot|ttf|otf)$/i,
          type: 'asset/resource',
        },
      ],
    },

    // ────────────────────────────────────────────────────────────────────────
    // PLUGINS — broader transformations than per-file loaders
    // ────────────────────────────────────────────────────────────────────────
    plugins: [
      // Generates dist/index.html from a template and auto-injects <script> tags
      // for every emitted bundle. Without this you'd hand-edit HTML on every build.
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'index.html'),
        inject: 'body',
        // Production-only HTML minify. Tiny win but free.
        minify: isProd && {
          collapseWhitespace: true,
          removeComments: true,
          minifyCSS: true,
          minifyJS: true,
        },
      }),
      // Extracts CSS to separate files. Critical for prod: parallel CSS+JS download,
      // browser can cache CSS independently, prevents FOUC (flash of unstyled content).
      isProd &&
        new MiniCssExtractPlugin({
          filename: 'assets/css/[name].[contenthash:8].css',
          chunkFilename: 'assets/css/[name].[contenthash:8].chunk.css',
        }),
    ].filter(Boolean),

    // ────────────────────────────────────────────────────────────────────────
    // OPTIMIZATION — bundle size, code splitting, minification
    // ────────────────────────────────────────────────────────────────────────
    optimization: {
      // Minify in prod. TerserPlugin minifies JS, CssMinimizerPlugin (not shown)
      // would minify CSS. Webpack uses Terser by default in prod mode, so this is
      // explicit only because we want to customize options.
      minimize: isProd,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            // Drop console.* in prod. Frees bytes, prevents accidental log leaks.
            compress: { drop_console: true, drop_debugger: true },
            format: { comments: false },
          },
          extractComments: false,
          parallel: true,
        }),
      ],

      // ───────────────────────────────────────────────────────────────────
      // CODE SPLITTING — the most important interview topic in this file
      // ───────────────────────────────────────────────────────────────────
      // Without splitting: ONE huge bundle. Users download react+lodash+everything
      // even to view the login page. Bad TTI (time to interactive).
      //
      // With splitting: separate vendor/common/route chunks. Browser parallel-downloads,
      // caches vendor chunk for months (it rarely changes), only re-downloads your code
      // when YOUR code changes.
      splitChunks: {
        // 'all' = split both sync and async imports. 'async' = only dynamic imports.
        // 'initial' = only non-dynamic. 'all' is almost always right.
        chunks: 'all',
        // Cache groups: rules for how chunks are grouped.
        cacheGroups: {
          // Vendor chunk = anything from node_modules. Rarely changes → great caching.
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            reuseExistingChunk: true,
          },
          // React itself gets its own chunk — even larger cache win, since you upgrade
          // React far less often than other deps.
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            name: 'react-vendor',
            priority: 20,
            reuseExistingChunk: true,
          },
        },
      },

      // Runtime chunk: the small Webpack bootstrap code that wires chunks together.
      // 'single' = one runtime for all entries. Improves long-term caching.
      runtimeChunk: 'single',
    },

    // ────────────────────────────────────────────────────────────────────────
    // DEVTOOL — source maps. Maps minified prod code → original TS for debugging
    // ────────────────────────────────────────────────────────────────────────
    // Trade-off triangle: build speed vs source map quality vs rebuild speed.
    //   'eval-cheap-module-source-map' = fast dev rebuilds, OK quality
    //   'source-map' = slowest, best quality, what you want in prod (upload to Sentry)
    //   false = no source maps (smaller artifacts but zero debuggability)
    devtool: isProd ? 'source-map' : 'eval-cheap-module-source-map',

    // ────────────────────────────────────────────────────────────────────────
    // DEV SERVER — only used during `webpack serve`
    // ────────────────────────────────────────────────────────────────────────
    devServer: {
      port: 8080,
      hot: true, // Hot Module Replacement: update modules without full reload
      open: false,
      historyApiFallback: true, // SPA routing: serve index.html for any 404 → React Router takes over
      static: { directory: path.resolve(__dirname, 'public') },
      client: { overlay: { errors: true, warnings: false } }, // show errors in browser overlay
    },

    // ────────────────────────────────────────────────────────────────────────
    // PERFORMANCE — warn on big bundles to keep you honest
    // ────────────────────────────────────────────────────────────────────────
    performance: {
      hints: isProd ? 'warning' : false,
      maxAssetSize: 250 * 1024, // 250 KB per asset
      maxEntrypointSize: 500 * 1024, // 500 KB total for entry
    },

    // ────────────────────────────────────────────────────────────────────────
    // STATS — control how much info Webpack prints
    // ────────────────────────────────────────────────────────────────────────
    stats: 'normal',
  };
};
