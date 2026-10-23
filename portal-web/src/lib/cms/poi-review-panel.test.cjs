const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const filename = path.resolve(__dirname, '../../components/cms/PoiReviewPanel.tsx');
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
const load = compiled.require.bind(compiled);
compiled.require = id => load(id.startsWith('@/') ? path.resolve(__dirname, '../..', id.slice(2)) : id);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
}).outputText, filename);
const Panel = compiled.exports.default;

test('CMS conflict panel renders editor requirement and context without auto-selecting candidates', () => {
  const html = renderToStaticMarkup(React.createElement(Panel, {
    visit: { id: 'v', resolutionStatus: 'SPATIAL_CONFLICT_OVERNIGHT', resolution: {
      candidates: [{ id: 'm', source: 'mapbox', name: 'Hotel suggestion', distanceMeters: 20 }],
      fallbackAreaContext: [{ name: 'District' }]
    } }, onSaved: async () => {}
  }));
  assert.ok(html.includes('來源位置有衝突'));
  assert.ok(html.includes('沒有 CMS editor'));
  assert.ok(html.includes('Mapbox 候選僅供參考'));
  assert.ok(html.includes('區域背景：District'));
  assert.ok(!html.includes('人工確認此場所'));
  assert.ok(html.includes('disabled=""'));
});

test('migration source contract is additive and preserves authenticated RLS (not SQL runtime proof)', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../../../supabase/migrations/20261023000000_poi_resolution.sql'), 'utf8');
  assert.match(sql, /ALTER COLUMN place_id DROP NOT NULL/);
  assert.match(sql, /resolution_status <> 'MANUALLY_CONFIRMED' AND place_id IS NULL/);
  assert.match(sql, /LEFT JOIN app\.places/);
  assert.match(sql, /security_invoker = true, security_barrier = true/);
  assert.match(sql, /REVOKE ALL ON FUNCTION api_cms\.review_cms_visit_place[^;]+FROM PUBLIC, anon/);
  assert.doesNotMatch(sql, /CREATE\s+(?:OR REPLACE\s+)?(?:VIEW|FUNCTION)\s+api_public/);
});
