/* 局外成长参数：墨点、天赋、技能专精与段位。 */
const META_CONFIG = {
  storageKey: 'notebook-meta-v1',
  basicCosts: [30, 60, 120, 210, 330],
  specCosts: [40, 90, 180],
  basics: [
    { id: 'dmg', name: '笔锋', desc: '全部伤害', per: 3, unit: '%', max: 5 },
    { id: 'hp', name: '厚纸', desc: '最大生命', per: 5, unit: '', max: 5 },
    { id: 'speed', name: '疾行', desc: '移动速度', per: 1.5, unit: '%', max: 5 },
    { id: 'ink', name: '墨囊', desc: '墨水上限', per: 5, unit: '', max: 5 },
    { id: 'cd', name: '熟练', desc: '主动技能冷却', per: 1, unit: '%', max: 5 }
  ],
  inkSpecs: [
    { id: 'dive', name: '潜墨专精', desc: '潜墨词条伤害' },
    { id: 'surge', name: '墨潮专精', desc: '墨潮与衍生伤害' },
    { id: 'absorb', name: '吸墨专精', desc: '弹反与小墨潮伤害' }
  ],
  rankNames: ['涂鸦学徒', '铅笔好手', '圆珠笔达人', '马克笔专家', '钢笔大师', '纸面传说'],
  rankMinor: ['Ⅲ', 'Ⅱ', 'Ⅰ'],
  scrapByRarity: [2, 5, 12, 25],
  reforgeCostByRarity: [40, 80, 120, 160],
  examAffixes: ['断墨', '群像', '急促铃', '涂改', '不许返工']
};
