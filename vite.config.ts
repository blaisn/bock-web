import { defineConfig } from 'vite';

// base relative : le site fonctionne à la racine d'un bucket comme dans un sous-dossier
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
