# Test fixtures

`rzc262830400vl.001.h5` is one real MeteoSwiss radar frame: the PRECIP (RZC) product for
2026-10-10 04:00 UTC, as published at
`https://data.geo.admin.ch/ch.meteoschweiz.ogd-radar-precip/20261010-ch/`.

That morning was chosen rather than a dry one on purpose: 63 314 of its cells had rain in them,
700-odd of them over the region the app ships with. A fixture from a dry hour decodes just as well
and proves far less -- a browser test could not tell a correctly painted radar from a blank one.

It is open data. MeteoSwiss' terms are free use with the source named, so anything built from it
says **«Quelle: MeteoSchweiz»** — which is also why `METEOSWISS_ATTRIBUTION` exists in
`src/services/meteoswissRadar.ts`.

It is here rather than fetched because the suites do not touch the network: the unit tests read it
off disk, and the browser tests are answered with it in place of the real service. 41 KB, and it is
the only thing standing between `src/services/odim.ts` and a silent change in what the files look
like — a reader written against a format is still only ever tested against a file.
