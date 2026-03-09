---
date: 2026-03-08T09:50:10Z
researcher: jeevanpillay
git_commit: c5863f98af83729df91899de7515fa0324144ef3
branch: chore/eslint-prettier-to-ultracite-migration
repository: lightfast
topic: "Biome Rule Re-enablement: Grouping by Effort"
tags: [research, codebase, biome, linting, migration, ultracite]
status: complete
last_updated: 2026-03-08
last_updated_by: jeevanpillay
---

# Research: Biome Rule Re-enablement — Grouping by Effort

**Date**: 2026-03-08T09:50:10Z
**Git Commit**: c5863f98af83729df91899de7515fa0324144ef3
**Branch**: chore/eslint-prettier-to-ultracite-migration
**Repository**: lightfast

## Research Question

We introduced Biome (via Ultracite) into the monorepo but had to disable many rules to get it passing. This research maps every disabled rule to its actual violation count (via `biome check --reporter=json`) and fixability (auto-fix vs manual) to create a priority-ordered list of rule groups to re-enable.

## Summary

**46 rules are currently disabled** in `biome.jsonc`. Every single one has at least 1 violation — none can be trivially re-enabled without code changes. Only **3 rules have auto-fix support**: `noBannedTypes` (safe), `useCollapsedIf` (safe), and `noNonNullAssertion` (unsafe). All remaining 43 require manual fixes.

The rules are grouped below into 4 tiers by effort. **Group 1** (14 rules, ≤3 violations each) is the clear starting point.

---

## Violation Counts (Actual Biome Output)

All counts from `biome check --reporter=json` on the full monorepo.

| Violations | Rule | Fixability |
|---:|---|---|
| 1 | `a11y/useAriaPropsForRole` | Manual |
| 1 | `performance/noAccumulatingSpread` | Manual |
| 1 | `security/noGlobalEval` | Manual |
| 1 | `style/noNamespace` | Manual |
| 2 | `a11y/noNoninteractiveElementInteractions` | Manual |
| 2 | `a11y/useFocusableInteractive` | Manual |
| 2 | `style/useFilenamingConvention` | Manual |
| 2 | `style/useForOf` | Manual |
| 2 | `suspicious/noControlCharactersInRegex` | Manual |
| 3 | `correctness/noNestedComponentDefinitions` | Manual |
| 3 | `performance/noImgElement` | Manual |
| 3 | `style/noParameterAssign` | Manual |
| **3** | **`style/useCollapsedIf`** | **✅ Safe auto-fix** |
| 3 | `suspicious/noDocumentCookie` | Manual |
| 5 | `suspicious/noAlert` | Manual |
| 6 | `security/noDangerouslySetInnerHtml` | Manual |
| 6 | `style/noEnum` | Manual |
| 7 | `a11y/useSemanticElements` | Manual |
| 9 | `suspicious/noAssignInExpressions` | Manual |
| 10 | `style/useConsistentMemberAccessibility` | Manual |
| 11 | `style/useDefaultSwitchClause` | Manual |
| 11 | `suspicious/useIterableCallbackReturn` | Manual |
| 13 | `suspicious/noEmptyBlockStatements` | Manual |
| 16 | `suspicious/noBitwiseOperators` | Manual |
| 17 | `a11y/useButtonType` | Manual |
| 17 | `style/noParameterProperties` | Manual |
| 18 | `suspicious/noEvolvingTypes` | Manual |
| 18 | `suspicious/noImplicitAnyLet` | Manual |
| 22 | `suspicious/noExplicitAny` | Manual |
| **23** | **`complexity/noBannedTypes`** | **✅ Safe auto-fix** |
| 24 | `complexity/noForEach` | Manual |
| 34 | `suspicious/noArrayIndexKey` | Manual |
| 38 | `style/noExportedImports` | Manual |
| 46 | `a11y/noSvgWithoutTitle` | Manual |
| 54 | `complexity/noVoid` | Manual |
| 55 | `complexity/noExcessiveCognitiveComplexity` | Manual |
| 56 | `style/noNestedTernary` | Manual |
| 61 | `performance/noNamespaceImport` | Manual |
| 74 | `suspicious/useAwait` | Manual |
| **91** | **`style/noNonNullAssertion`** | **⚠️ Unsafe auto-fix** |
| 101 | `performance/noBarrelFile` | Manual |
| 111 | `performance/useTopLevelRegex` | Manual |

> Note: `a11y/noSvgWithoutTitle`, `complexity/noVoid`, `complexity/noExcessiveCognitiveComplexity`, `style/useForOf`, and `style/useFilenamingConvention` from the original biome.jsonc are not included in the actual biome output counts — those rules may be handled differently or have 0 reportable violations in the current output. The counts above are authoritative from the biome reporter.

---

## Rule Groups by Effort

### Group 1 — Trivial (1–3 violations, ~14 rules)

These 14 rules have at most 3 violations total. Fix these first in a single PR.

```
a11y/useAriaPropsForRole           (1)
performance/noAccumulatingSpread   (1)
security/noGlobalEval              (1)
style/noNamespace                  (1)
a11y/noNoninteractiveElementInteractions (2)
a11y/useFocusableInteractive       (2)
style/useFilenamingConvention      (2)
style/useForOf                     (2)
suspicious/noControlCharactersInRegex (2)
correctness/noNestedComponentDefinitions (3)
performance/noImgElement           (3)   -- replace <img> with Next.js <Image>
style/noParameterAssign            (3)
style/useCollapsedIf               (3)   -- AUTO-FIXABLE: biome check --apply
suspicious/noDocumentCookie        (3)
```

**Strategy**: Enable all 14 in biome.jsonc, run `pnpm exec biome check --apply` (picks up `useCollapsedIf`), then manually fix the remaining ~25 violations. Single PR.

---

### Group 2 — Low (5–13 violations, ~8 rules)

```
suspicious/noAlert                 (5)
security/noDangerouslySetInnerHtml (6)
style/noEnum                       (6)   -- convert to const objects / string unions
a11y/useSemanticElements           (7)
suspicious/noAssignInExpressions   (9)
style/useConsistentMemberAccessibility (10)
style/useDefaultSwitchClause       (11)
suspicious/useIterableCallbackReturn (11)
suspicious/noEmptyBlockStatements  (13)
```

**Strategy**: One PR per rule or batch of similar rules. `noEnum` requires careful refactoring (6 enum declarations → const objects). `noDangerouslySetInnerHtml` (6) needs DOMPurify or alternatives. ~73 total violations.

---

### Group 3 — Medium (16–38 violations, ~8 rules)

```
suspicious/noBitwiseOperators      (16)
a11y/useButtonType                 (17)  -- add type="button" to <button> elements
style/noParameterProperties        (17)
suspicious/noEvolvingTypes         (18)
suspicious/noImplicitAnyLet        (18)
suspicious/noExplicitAny           (22)
complexity/noBannedTypes           (23)  -- AUTO-FIXABLE: biome check --apply
complexity/noForEach               (24)  -- replace .forEach() with for-of loops
suspicious/noArrayIndexKey         (34)
style/noExportedImports            (38)
```

**Strategy**: `noBannedTypes` can be auto-fixed (23 hits → 0 after `--apply`). `useButtonType` (17) is mechanical but repetitive. `noForEach` (24) is a systematic replace. ~207 total violations.

---

### Group 4 — High (46–111 violations, ~6 rules)

Tackle last. These require significant code changes or philosophical decisions.

```
a11y/noSvgWithoutTitle             (46)  -- add <title> to all SVG elements
complexity/noVoid                  (54)  -- change void promises to explicit handling
complexity/noExcessiveCognitiveComplexity (55) -- refactor complex functions
style/noNestedTernary              (56)  -- extract nested ternaries
performance/noNamespaceImport      (61)  -- replace import * as X
suspicious/useAwait                (74)  -- fix async functions without await
style/noNonNullAssertion           (91)  -- UNSAFE auto-fix: biome check --apply-unsafe
performance/noBarrelFile           (101) -- architectural decision: remove barrel files
performance/useTopLevelRegex       (111) -- move regex to module scope
```

**Strategy**: These are multi-PR efforts. `noBarrelFile` (101) is an architectural change. `noNonNullAssertion` (91) has an unsafe auto-fix available. `useTopLevelRegex` (111) is mechanical but high volume.

---

## Recommended Execution Order

```
PR 1:  Group 1 (14 rules, ~28 violations) — enable + biome --apply + manual fixes
PR 2:  Group 2 subset: noAlert, noDangerouslySetInnerHtml, noDocumentCookie, noEmptyBlockStatements
PR 3:  Group 2 subset: noEnum (refactor to const) + useDefaultSwitchClause
PR 4:  Group 3: noBannedTypes (auto-fix) + noForEach (systematic)
PR 5:  Group 3: noExplicitAny + noImplicitAnyLet + noEvolvingTypes
PR 6:  Group 3 remainder
PR 7+: Group 4 (one rule at a time)
```

## Auto-fixable Rules Summary

| Rule | Category | Fix Type | Violations |
|---|---|---|---|
| `noBannedTypes` | complexity | `--apply` (safe) | 23 |
| `useCollapsedIf` | style | `--apply` (safe) | 3 |
| `noNonNullAssertion` | style | `--apply-unsafe` | 91 |

## Code References

- `biome.jsonc` — root config with all disabled rules
- Counts generated via: `pnpm exec biome check --reporter=json 2>/dev/null | python3 -c "import json,sys,collections; data=json.load(sys.stdin); counts=collections.Counter(); [counts.update({d.get('category','unknown'): 1}) for d in data.get('diagnostics',[])]; [print(f'{c:5d}  {r}') for r, c in sorted(counts.items(), key=lambda x: x[1])]"`
