// 技能图标：所有正式主动与辅助必须生成独立主图，不回退到同属性／通用模板。
const fs = require('fs');
const ACTIVE = ['cyclone', 'volcanic', 'tornado', 'chainclip', 'arc', 'spark', 'ballista', 'boomerang', 'vortex', 'candle', 'icespear', 'inkrain', 'ruler', 'chalk', 'pinburst', 'absolve', 'brand', 'cola', 'doommark', 'pageslash', 'piercerush', 'spinlance', 'shieldrush', 'ricoshield', 'perfectarrow', 'arrowfocus', 'magfist', 'inkgrenade', 'heatrail'];
const SUPPORT = ['brutal', 'swift', 'unleash', 'focus', 'dot', 'sharpen', 'projspd', 'heavynib', 'multi', 'pierce', 'chain', 'homing', 'blast', 'wide', 'saturate', 'soak', 'sheath', 'core', 'retick', 'linger', 'reburst', 'stain', 'heavyweight', 'firstblood', 'scrit', 'rapid', 'sweep', 'followup', 'leech', 'shock', 'dur', 'onabsorb', 'ondive', 'onsurge', 'oncrit', 'onkill', 'areastorm', 'areaspikes', 'areaouter', 'areagravity', 'areadeath', 'areastack', 'cycloneline', 'cycloneresidue', 'cycloneshards', 'cyclonedetonate', 'projrepeat', 'projreturn', 'projendsplit', 'projaccel', 'strikecross', 'strikeaftershock', 'strikecrowd', 'strikeexecute', 'physdmg', 'physcrit', 'physvuln', 'physburst', 'firedmg', 'firecrit', 'fireburn', 'firespark', 'fireblast', 'icedmg', 'icecrit', 'icefrost', 'iceshard', 'icefield', 'thunderdmg', 'thundercrit', 'thunderstatic', 'thunderchain', 'thundernet', 'inkpool'];
global.window = {}; global.Image = function() { return { complete: false, naturalWidth: 0 }; };
global.SUPPORTS = Object.fromEntries(SUPPORT.map(id => [id, {}])); global.SKILL_ATTR = {};
let ops = [];
global.ctx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return (...args) => { ops.push([k, ...args]); }; }, set(t, k, v) { ops.push(['set', k, v]); return true; } });
eval(fs.readFileSync(__dirname + '/skill-icon-runtime.js', 'utf8'));
let failed = 0;
function check(ids, kind) {
  const seen = new Map();
  for (const id of ids) {
    ops = []; window.SkillIconRuntime.draw(id, kind, 0, 0, 48, { showLevel: false, showState: false });
    const signature = JSON.stringify(ops);
    if (seen.has(signature)) { failed++; console.log('ERR ' + kind + ' 图标重复：' + seen.get(signature) + ' / ' + id); }
    else seen.set(signature, id);
  }
  console.log('OK  ' + kind + ' 独立图标 ' + seen.size + '/' + ids.length);
}
check(ACTIVE, 'active'); check(SUPPORT, 'support');
const vortex = window.SkillIconRuntime.cardMeta({ kind: 'start', id: 'vortex' });
if (!vortex || vortex.id !== 'vortex' || vortex.kind !== 'active') { failed++; console.log('ERR 起手卡技能 id 映射错误'); }
console.log(failed ? 'SKILL_ICON_TEST_FAILURES: ' + failed : 'SKILL_ICON_TEST_OK (' + (ACTIVE.length + SUPPORT.length) + ' 个独立图案)'); process.exit(failed ? 1 : 0);
