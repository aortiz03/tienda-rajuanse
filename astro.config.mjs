// @ts-check
import { defineConfig } from 'astro/config';

// Cambia "site" por el dominio final cuando la tienda esté publicada.
export default defineConfig({
  site: 'https://tienda.rajuanse.com',
  trailingSlash: 'ignore',
});
