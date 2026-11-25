// @ts-check
import { defineConfig } from 'astro/config';

// SITE_URL y BASE_PATH los define la publicación automática (GitHub Pages).
// Con un dominio propio (p. ej. tienda.rajuanse.com) BASE_PATH queda vacío.
export default defineConfig({
  site: process.env.SITE_URL || 'https://tienda.rajuanse.com',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
});
