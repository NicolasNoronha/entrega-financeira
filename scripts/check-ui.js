const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

const views = [...html.matchAll(/data-view="([^"]+)"/g)].map((match) => match[1]);
const navs = [...html.matchAll(/data-nav="([^"]+)"/g)].map((match) => match[1]);
const missingViews = navs.filter((nav) => !views.includes(nav));
const duplicateNavs = navs.filter((nav, index) => navs.indexOf(nav) !== index);

if (missingViews.length > 0) {
  throw new Error(`Menus sem tela correspondente: ${missingViews.join(', ')}`);
}

if (duplicateNavs.length > 0) {
  throw new Error(`Menus duplicados: ${duplicateNavs.join(', ')}`);
}

console.log({
  views,
  navs,
  status: 'ok'
});
