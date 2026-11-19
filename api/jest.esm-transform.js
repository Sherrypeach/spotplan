// NestJS 12 ships as ES modules. Jest runs tests as CommonJS, so ts-jest turns
// Nest's files into CommonJS too; the one thing it can't convert is
// `import.meta.url`, which becomes this file's URL here.
const { TsJestTransformer } = require('ts-jest');

const tsJest = new TsJestTransformer({ tsconfig: { allowJs: true }, diagnostics: false });
const IMPORT_META_URL = /import\.meta\.url/g;
// ES modules make their own `require`; CommonJS already has one.
const OWN_REQUIRE = /^\s*const require = createRequire\(import\.meta\.url\);?\s*$/gm;

function withoutImportMeta(source, path) {
  if (!path.includes('node_modules') || !source.includes('import.meta.url')) return source;
  return source
    .replace(OWN_REQUIRE, '')
    .replace(IMPORT_META_URL, "require('url').pathToFileURL(__filename).href");
}

module.exports = {
  process(source, path, options) {
    return tsJest.process(withoutImportMeta(source, path), path, options);
  },
  getCacheKey(source, path, options) {
    return tsJest.getCacheKey(withoutImportMeta(source, path), path, options);
  },
};
