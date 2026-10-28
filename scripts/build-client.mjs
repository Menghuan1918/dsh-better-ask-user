/** Build the DSH client closure bundle with esbuild + CSS Modules. */
import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { appendFile } from 'node:fs/promises'
import { basename } from 'node:path'

const PLUGIN_ID = 'dsh-better-ask-user'

const cssModules = {
  name: 'dsh-css-modules',
  setup(build) {
    build.onLoad({ filter: /\.module\.css$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8')
      const names = new Set([...source.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map(match => match[1]))
      const map = {}
      for (const name of names) map[name] = 'bau-' + name
      const css = source.replace(/\.([A-Za-z_][A-Za-z0-9_-]*)/g, (match, name) => map[name] === undefined ? match : '.' + map[name])
      // Stable across checkout paths so the published bundle carries no absolute
      // machine paths and style de-duplication survives a move.
      const id = PLUGIN_ID + '/' + basename(args.path)
      const contents = [
        'const css = ' + JSON.stringify(css) + ';',
        'const id = ' + JSON.stringify(id) + ';',
        "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(id) + ']') === null) {",
        "  const tag = document.createElement('style');",
        "  tag.dataset.plugin = " + JSON.stringify(PLUGIN_ID) + ';',
        '  tag.dataset.pluginCss = id;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        'export default ' + JSON.stringify(map) + ';',
      ].join('\n')
      return { contents, loader: 'js' }
    })
  },
}

await mkdir('lib', { recursive: true })
await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.cjs',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-store',
  ],
  plugins: [cssModules],
  logLevel: 'info',
})

const cjs = await readFile('lib/client.cjs', 'utf8')
const wrapped = [
  'window.__ModuleLoader__.load({',
  '  id: ' + JSON.stringify(PLUGIN_ID) + ',',
  '  factory: (require) => {',
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  cjs,
  '    return module.exports;',
  '  }',
  '});',
  '',
].join('\n')
await writeFile('lib/client.js', wrapped)
await appendFile('lib/client.js', '')
console.log('built lib/client.js')
