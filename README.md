# vfk-cli
A command line interface for our pleasure


# KA VI VIL

Kjøre en kommando fra terminal - "PR" - patch, minor, major (kan sikkert ha noen flag og)

- Den sjekker hva slags prosjekt du er i.
- Sjekker at du er up-to-date med origin i current branch. Og at du ikke har masse endringer liggende som du har glemt. (med flag at du kan få lov)
- Henter nyeste semver-tag samma hvor den kommer fra.
- Henter alle endringer siden forrige tag?
- Lager kanskje en fin squash commit? Kanskje ikke?
- Sjekker versjon for prosjektet (avhengig av språk/rammeverk), sjekker om det trengs å oppdateres, oppdaterer om det trengs.
- OPpretter en fancy lenke til ny PR som er klikkbar. (trykk og opprett PR - done) kanskje setter assigne og tags og sånt

SPECIAL CASE - 1.0.0 i project, ingen tag - initial release, bruk 1.0.0



Det må godkjennes og merges - så går det kanskje deployment til et testmilljø

Når det er klart for prod - gå til main-branch (husk en pull) og kjør en release fra cli
- Verifiser at du er up-to-date. Og at tag og f. eks package.json stemmer
- Release cli henter alle commits siden forrige release, og lager fancy release notes
- Opprett lenke til release-form, og tut og kjør


## HVA må vi ta høyde for

- PR kan ligge der allerede - DET GÅR BRA, den åpner bare samme PR
- Hvis man har glemt at den ligger der, og kjører PR-koommando fra terminal.
- Kan man ha to PR på samma branch
- Kan vi sjekke issues i samma slengen??
  - Kan vi bare bruke gh cli til dette?
- Det skal gå bra selv om man har laget manuell PR og glemt versjonering til og med
- 


## Tanker
- Støtte for monorepo - f. eks at du får valg om hvilke ting som skal bumpes



HVAAA om man jobber på 2 PR samtidig? Da er det vel bare førstemann til mølla, og vfk-cli må bli lei seg om man var sist.
- Merk at hvis vi bruker versjon i PR tittel, så blir ikke den endra om man må endre det på nytt... Bruk feature name eller no fancy




