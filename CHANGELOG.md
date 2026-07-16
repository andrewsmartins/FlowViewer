# Changelog

Formato: **padrão OmniChat, adaptado ao Fluxo**. Uma seção `### <versão>` por release
([SemVer](https://semver.org/lang/pt-BR/), mais recente no topo), com um bullet por commit no
formato [Conventional Commits](https://www.conventionalcommits.org/), **em inglês**. Quando a
mudança tiver PR, referencie o número/link do GitHub no bullet.

> **Bump de versão:** `MAJOR` (quebra de compatibilidade) · `MINOR` (feature retrocompatível) ·
> `PATCH` (correção/ajuste interno). O bump entra no mesmo commit da mudança.

> **Sem Jira (por enquanto):** o padrão Omnichat original abre cada entrada com o link da task do
> Jira; o Fluxo ainda não usa Jira, então essa linha é omitida. Quando um projeto Jira for
> definido, retomar o formato completo (link da task no topo de cada versão).

O histórico anterior à migração para a infra da OmniChat (formato Keep a Changelog, em português,
até a v0.36.0) está preservado em [docs/CHANGELOG-ARCHIVE.md](docs/CHANGELOG-ARCHIVE.md).

---

### 0.36.1

- chore: adopt the OmniChat dev ecosystem — register the plugin marketplace (`OmniChat/omnichat-claude-marketplace`) in versioned `.claude/settings.json`
- docs: migrate CHANGELOG to the OmniChat format (English, SemVer, PR-referenced); legacy history archived in [docs/CHANGELOG-ARCHIVE.md](docs/CHANGELOG-ARCHIVE.md)
- chore: create `devel` branch and record the dev-ecosystem migration plan in PLANS.md

### 0.36.0

- Baseline: last release in the previous format. Full pre-migration history in [docs/CHANGELOG-ARCHIVE.md](docs/CHANGELOG-ARCHIVE.md).
