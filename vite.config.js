import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'projetoVdd',
  envDir: '..',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(process.cwd(), 'projetoVdd/index.html'),
        acesso: resolve(process.cwd(), 'projetoVdd/acesso.html'),
        conta: resolve(process.cwd(), 'projetoVdd/conta.html'),
        minhaConta: resolve(process.cwd(), 'projetoVdd/minha-conta.html'),
        operador: resolve(process.cwd(), 'projetoVdd/operador.html'),
        ajuda: resolve(process.cwd(), 'projetoVdd/ajuda.html'),
        comoFunciona: resolve(process.cwd(), 'projetoVdd/como-funciona.html'),
        consultas: resolve(process.cwd(), 'projetoVdd/consultas.html'),
        demonstracoes: resolve(process.cwd(), 'projetoVdd/demonstracoes.html'),
        entrarFila: resolve(process.cwd(), 'projetoVdd/entrar-fila.html')
      }
    }
  }
});
