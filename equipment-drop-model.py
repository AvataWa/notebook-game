"""普通装备掉落、散件金装与碎纸闭环的可复算模型；不读取或修改玩家存档。"""
from __future__ import annotations

import math
import random
import statistics

SEED = 20261122
RNG = random.Random(SEED)

# 当前击杀模型：精英替换率 4.5%；普通池 13 种，暴躁涂鸦按 1/13 估算。
# 普通怪 0.2%，暴躁涂鸦 1%，精英 5%。
ELITE_RATE = 0.045
NORMAL_DROP = (12 / 13) * 0.002 + (1 / 13) * 0.01
DROP_PER_KILL = (1 - ELITE_RATE) * NORMAL_DROP + ELITE_RATE * 0.05

# 第 1 页、第 10 页与完整通关击杀量来自当前 XP／冒烟模拟。
# 完整通关逐页分布的前 10 页为模拟值；后 10 页仅按总击杀 4922 等差分摊，不是实测掉落埋点。
STAGE_KILLS = [140, 166, 183, 195, 205, 212, 218, 223, 227, 230,
               258, 265, 273, 281, 289, 296, 304, 312, 320, 325]
assert sum(STAGE_KILLS[:10]) == 1999
assert sum(STAGE_KILLS) == 4922

RARITY_BY_STAGE = {
    "early": [56, 32, 12, 0],
    "mid": [45, 32, 18, 5],
    "late": [35, 30, 25, 10],
}
PAPER_VALUE = [2, 5, 12, 25]
SLOT_ITEM_COUNTS = [7, 6, 6, 6, 7]


def tier(stage: int) -> list[int]:
    if stage >= 15:
        return RARITY_BY_STAGE["late"]
    if stage >= 10:
        return RARITY_BY_STAGE["mid"]
    if stage >= 5:
        return RARITY_BY_STAGE["early"]
    return [72, 28, 0, 0]


def route(kills: list[int], first_stage: int = 1) -> dict[str, float]:
    drops = [0.0] * 4
    paper = 0.0
    for offset, count in enumerate(kills):
        weights = tier(first_stage + offset)
        expected = count * DROP_PER_KILL
        for rarity in range(4):
            drops[rarity] += expected * weights[rarity] / 100
            paper += expected * weights[rarity] / 100 * PAPER_VALUE[rarity]
    return {
        "kills": sum(kills),
        "drops": sum(drops),
        "green": drops[0],
        "blue": drops[1],
        "purple": drops[2],
        "gold": drops[3],
        "paper_if_all_salvaged": paper,
    }


def probability_two_gold(runs: int, gold_per_clear: float) -> float:
    """泊松近似下，累计至少两件任意金装。"""
    lam = runs * gold_per_clear
    return 1 - math.exp(-lam) * (1 + lam)


def two_named_gold(gold_per_clear: float) -> tuple[float, int]:
    """两件预先指定且池内各 1/32 的金装；几何分布精确期望与 90% 分位。"""
    p = gold_per_clear / 32
    q = 1 - p
    mean = 2 / p - 1 / (1 - q * q)
    p90 = math.ceil(math.log(1 - math.sqrt(0.90)) / math.log(q))
    return mean, p90


def distinct_gold_slots(runs: int, gold_per_clear: float, samples: int = 100000) -> tuple[float, float]:
    """累计金装至少覆盖两个不同部位；忽略装订限制，适合评价自然掉落本身。"""
    lam = runs * gold_per_clear
    success = 0
    for _ in range(samples):
        # Knuth 泊松采样；本模型 lam 很小。
        threshold = math.exp(-lam)
        product, count = 1.0, -1
        while product > threshold:
            count += 1
            product *= RNG.random()
        slots = {RNG.choices(range(5), weights=SLOT_ITEM_COUNTS)[0] for _ in range(count)}
        if len(slots) >= 2:
            success += 1
    return success / samples, lam


def poisson(lam: float) -> int:
    threshold = math.exp(-lam)
    product, count = 1.0, -1
    while product > threshold:
        count += 1
        product *= RNG.random()
    return count


def salvage_after_binding(kills: list[int], slots: int, first_stage: int = 1, samples: int = 30000) -> float:
    """假设玩家保留碎纸价值最高的若干件，其余全部拆解；不含重复收藏追加拆解。"""
    totals = []
    for _ in range(samples):
        values = []
        for offset, count in enumerate(kills):
            weights = tier(first_stage + offset)
            for rarity in range(4):
                expected = count * DROP_PER_KILL * weights[rarity] / 100
                values.extend([PAPER_VALUE[rarity]] * poisson(expected))
        values.sort(reverse=True)
        totals.append(sum(values[slots:]))
    return statistics.mean(totals)


def full_income(run: int, level_cap: int) -> int:
    """从全新存档连续完整通关；当前段位倍率节奏保持不变。"""
    level = min(200, level_cap)
    base = level + 20 * 15 + 50
    first = 600 if run == 1 else 0
    if run == 1:
        return base + first
    multiplier = 1.10 if run == 2 else (1.20 if run == 3 else 1.25)
    return math.floor(base * multiplier + 0.5)


def runs_for_ink(target: int, level_cap: int) -> int:
    total = 0
    run = 0
    while total < target:
        run += 1
        total += full_income(run, level_cap)
    return run


def boss_set_kills(pieces: int, core_per_kill: int = 2, samples: int = 50000) -> tuple[float, int, int]:
    """对应 Boss 受击击杀；首次特殊材料必掉，之后 35%，连续两次空掉后保底。"""
    results = []
    for _ in range(samples):
        cores = specials = kills = dry = 0
        first = True
        while cores < pieces * 4 or specials < pieces:
            kills += 1
            cores += core_per_kill
            drop = first or dry >= 2 or RNG.random() < 0.35
            first = False
            if drop:
                specials += 1
                dry = 0
            else:
                dry = min(2, dry + 1)
        results.append(kills)
    ordered = sorted(results)
    return statistics.mean(results), ordered[len(ordered) // 2], ordered[int(len(ordered) * .9)]


routes = {
    "early_stage_1": route(STAGE_KILLS[:1]),
    "mid_stage_10": route(STAGE_KILLS[:10]),
    "full_clear": route(STAGE_KILLS),
}
print("DROP_PER_KILL", round(DROP_PER_KILL * 100, 4), "%")
for name, data in routes.items():
    print(name, {key: round(value, 3) for key, value in data.items()})
print("PAPER_AFTER_BINDING", {
    "early_stage_1": round(salvage_after_binding(STAGE_KILLS[:1], 1), 2),
    "mid_stage_10": round(salvage_after_binding(STAGE_KILLS[:10], 2), 2),
    "full_clear": round(salvage_after_binding(STAGE_KILLS, 3), 2),
})

print("BOSS_SET_KILLS", {pieces: tuple(round(v, 2) for v in boss_set_kills(pieces)) for pieces in (2, 3, 5)})

full_gold = routes["full_clear"]["gold"]
print("TWO_ANY_GOLD_PROBABILITY", {run: round(probability_two_gold(run, full_gold), 4) for run in range(1, 6)})
print("TWO_DISTINCT_GOLD_SLOTS", {run: tuple(round(v, 4) for v in distinct_gold_slots(run, full_gold)) for run in range(1, 6)})
mean_named, p90_named = two_named_gold(full_gold)
print("TWO_NAMED_GOLD", {"mean_full_clears": round(mean_named, 2), "p90_full_clears": p90_named})

print("FULL_INCOME_CAP_100", [full_income(run, 100) for run in range(1, 5)])
print("FULL_INCOME_CAP_200", [full_income(run, 200) for run in range(1, 5)])
for target in (7480, 30950):
    print("FULL_CLEAR_RUNS", {"ink_target": target, "cap100": runs_for_ink(target, 100), "cap200": runs_for_ink(target, 200)})
print("FIRST_SET_EARLY_INK_RUNS", {cost: math.ceil((cost - 66) / 26) + 1 for cost in (200, 400)})
