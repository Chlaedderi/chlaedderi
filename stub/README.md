# The page that stays behind

These four files are **not** part of the app. They are what the app's old address serves once the
app has moved: `https://enteee.github.io/Chl-dderi/`.

They are kept here, in the app's own repository, so that they are reviewed, formatted and spell-
checked like everything else, and so that `mappack.schema.json` beside them cannot drift from the
one the app compiles with. `tools/make-site.sh` names every published file individually, so this
folder is never published from here.

| file | what it does |
| --- | --- |
| `index.html` | reads the three storage layers, builds an `FA2.` code, and hands it to the new address in the fragment — where no server ever sees it. An old `#crag?pack=…` link that lands here is forwarded unchanged, so every link ever sent keeps working. |
| `sw.js` | replaces the app's own service worker **at the same path** and then removes itself. Without it the installed worker answers every navigation with the cached app shell and nobody ever sees the page above. It deletes the app shell and nothing matching `finale-atlas`, which is where the data it is about to read lives. |
| `mappack.schema.json` | a copy, so the historical `$id` address keeps resolving for anybody's pack that points at it. |
| `.nojekyll` | Pages serves the folder as it is. |

## When this ships

Not until `https://chlaedderi.ch/` resolves. The page sends people to one address and they follow
it once; if it pointed at an address that later redirects somewhere else, everyone who had already
moved would be emptied a second time. `HOME` at the top of `index.html` is that address, and it is
the only thing in here that must be right before it goes anywhere.

Then: rename the old repository out of the way, create a public `Enteee/Chl-dderi` holding these
four files at its root, and turn Pages on for it. The old repository keeps the old spelling of the
name for exactly this reason — `/Chl-dderi/` is a path people's browsers already hold.
