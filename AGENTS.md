# Cadrage produit

Pour poursuivre le cadrage, lire `product.md`, puis `.agents/skills/grilling/SKILL.md`. Les règles sont validées (sections 15 et 18) ; toute nouvelle question part du domaine que souhaite explorer le porteur du projet.

Mettre à jour le document avec les réponses explicites du porteur du projet. Conserver la distinction entre acquis, exemples, recommandations et questions ouvertes. L'absence de réponse ne valide aucune proposition.

Pour une session GrillMe avec documentation du vocabulaire et des décisions, lire aussi `.agents/skills/grill-with-docs/SKILL.md` et `.agents/skills/domain-modeling/SKILL.md`. Si l'outil Skill est absent, lire directement les SKILL.md référencés.

# Réalisation

- Référence : PRD dans l'issue GitHub #1 (`docs/prd-v1.md`), issues #2 à #47, stack dans `product.md` §18, identité visuelle dans `DESIGN.md`.
- Démarche : `prd-to-issues` → `start-next-issue` → `start-implementation`. Discuter chaque issue avant de coder.
- Ordre retenu : toutes les issues backend (#2–#23), puis toutes les issues frontend (#24–#46), puis le déploiement (#47).
- Langues : code, identifiants et commits en anglais ; interface, contenu de jeu et documentation en français.
- Runtime et outils : Bun (exécution, workspaces, `bun test`), TypeScript strict, Biome. Lancer `bun run check` avant de considérer une issue terminée.
- Le moteur (`packages/engine`) reste pur : aucune entrée-sortie, aucun accès réseau, horloge ou hasard non déterministe. Toutes les valeurs de jeu vivent dans `packages/content`.
- Les packages internes exportent leurs sources TypeScript, sans étape de build.
- Migrations : `bun run db:generate` produit des fichiers SQL versionnés ; jamais de `drizzle-kit push`.
