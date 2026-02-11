// .prettierrc.cjs
module.exports = {
  // Carga el plugin para que Prettier entienda los archivos .astro
  plugins: ['prettier-plugin-astro'],
  // Opciones de estilo (puedes personalizarlas)
  singleQuote: true,
  trailingComma: 'es5',
  // Configuración específica para los archivos .astro
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
      },
    },
  ],
};
