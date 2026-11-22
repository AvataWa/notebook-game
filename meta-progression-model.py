"""局外养成规划的可复算模型；不读取或修改游戏存档。"""
from __future__ import annotations

import math
import random
import statistics

SEED = 20261122
RNG = random.Random(SEED)

BASIC = 5 * sum([30, 60, 120, 210, 330])
SPEC_EACH = sum([40, 90, 180])
SPECS = (29 + 3) * SPEC_EACH
CHARACTERS = 8 * sum([80, 160, 320, 600])
BOSS_CRAFT = 20 * 5 * 80
TOTAL = BASIC + SPECS + CHARACTERS + BOSS_CRAFT
MAIN_BUILD = BASIC + sum([80, 160, 320, 600]) + (4 + 3) * SPEC_EACH + 5 * 80


def earned(run: int, kind: str) -> int:
    """从全新存档连续打同一种深度；段位按实际最佳三局在下一局生效。"""
    if kind == "early":  # Lv11、1 Boss；首次奖励含补级后进入的第 2 页
        base, first = 26, 40
    elif kind == "mid":  # Lv101、10 Boss；首次奖励含补级后进入的第 11 页
        base, first = 251, 310
    elif kind == "full":  # Lv200、20 Boss；当前墨点等级仍截断为 100
        base, first = 450, 600
    else:
        raise ValueError(kind)
    if run == 1:
        return base + first
    if kind == "early":  # 三席 12 分，平均 12，段位仍为 2，无墨点倍率
        return base
    # Lv101 的表现分已截为 100：首/二/三局后分别达到 6/12/17 段；
    # 完整通关则第三局后为 18 段。两者第四局起都使用 1.25 倍。
    multiplier = 1.10 if run == 2 else (1.20 if run == 3 else 1.25)
    return math.floor(base * multiplier + 0.5)  # 与 JavaScript Math.round 的正数取整一致


def cumulative(run: int, kind: str) -> int:
    return sum(earned(i, kind) for i in range(1, run + 1))


def runs_for(target: int, kind: str) -> int:
    n = 0
    while cumulative(n, kind) < target:
        n += 1
    return n


def one_set_kills(core_per_kill: int) -> int:
    cores = specials = kills = 0
    dry = 0
    first = True
    while cores < 20 or specials < 5:
        kills += 1
        cores += core_per_kill
        drop = first or dry >= 2 or RNG.random() < 0.35
        first = False
        if drop:
            specials += 1
            dry = 0
        else:
            dry = min(2, dry + 1)
    return kills


def all_sets_clears(core_per_kill: int, sets: int = 20) -> int:
    cores = [0] * sets
    specials = [0] * sets
    dry = [0] * sets
    first = [True] * sets
    clears = 0
    while any(cores[i] < 20 or specials[i] < 5 for i in range(sets)):
        clears += 1
        for i in range(sets):
            cores[i] += core_per_kill
            drop = first[i] or dry[i] >= 2 or RNG.random() < 0.35
            first[i] = False
            if drop:
                specials[i] += 1
                dry[i] = 0
            else:
                dry[i] = min(2, dry[i] + 1)
    return clears


def rerolls_to_perfect() -> int:
    roll = RNG.randrange(50, 101)
    floor = 50
    count = 0
    while roll < 100:
        count += 1
        before = roll
        candidate = RNG.randrange(max(50, floor), 101)
        if candidate <= before:
            floor = min(100, before + 5)
        else:
            roll = candidate
            floor = 50
    return count


def summary(values: list[int]) -> str:
    ordered = sorted(values)
    return (
        f"mean={statistics.mean(values):.2f}, "
        f"p50={ordered[len(ordered)//2]}, "
        f"p90={ordered[int(len(ordered)*0.90)]}, "
        f"min={ordered[0]}, max={ordered[-1]}"
    )


print("COSTS", {"basic": BASIC, "specs": SPECS, "characters": CHARACTERS,
               "boss_craft": BOSS_CRAFT, "total": TOTAL, "main_build": MAIN_BUILD})
print("RUN_INCOME")
for kind in ("early", "mid", "full"):
    print(kind, [earned(i, kind) for i in range(1, 6)],
          "main_runs", runs_for(MAIN_BUILD, kind), "total_runs", runs_for(TOTAL, kind))
    print("checkpoints", {n: cumulative(n, kind) for n in (1, 3, 5, 10, 20, 40, 60)})

N = 50000
for cores in (2, 3):
    print("ONE_SET", cores, summary([one_set_kills(cores) for _ in range(N)]))
    print("ALL_SETS_FULL_CLEARS", cores, summary([all_sets_clears(cores) for _ in range(3000)]))

rerolls = [rerolls_to_perfect() for _ in range(100000)]
print("REROLLS_PER_ITEM", summary(rerolls))
print("EXPECTED_REROLLS_100_ITEMS", statistics.mean(rerolls) * 100)
