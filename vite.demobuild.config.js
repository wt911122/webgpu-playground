import { defineConfig } from 'vite';
import { createRequire } from 'module';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: './assets/*', // 源文件路径
          dest: 'assets', // 目标路径(directories will be created as necessary)
        },
      ],
    }),
  ],
  build: {
    outDir: 'docs', // 输出目录
  },
});