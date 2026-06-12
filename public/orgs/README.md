# Organization logos

Drop one PNG per org here, named by the org id from `src/data/orgs.json`:

```
ibuypower.png      flipsid3.png       gale-force.png    dignitas.png
nrg.png            cloud9.png         team-vitality.png spacestation.png
team-bds.png       g2.png             renegades.png     furia.png
faze.png           falcons.png        gen-g.png         karmine-corp.png
```

Used on base cards (centerpiece), bracket rows, standings and the field view.
Recommended: square, transparent background, ≥256×256px.
Missing files fall back to a monogram placeholder
(component: `src/components/ui/TeamLogo.tsx`). A per-org override is also
possible via the `logoUrl` field in `orgs.json`.
