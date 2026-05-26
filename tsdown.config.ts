import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'lib',
  target: 'es2024',
  minify: false,
  sourcemap: false
})
