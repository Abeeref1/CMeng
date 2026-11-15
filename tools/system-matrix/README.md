# System invariant matrix

Every page of every project, checked against the shared invariants. Each failure is a manifestation, mapped to one of
the 14 shared mechanisms; the unit of repair is the mechanism, never a project.

1. `capture_all.sh <tag> [base]` (or `capture_list.sh <out dir> <base> <project...>`): opens every page of each
   project in Chromium, saves the text a reader sees (first screen, shown, all sections opened), section counts, open
   time, page errors, and the canonical facts each page received from the API. Also Project Review.
2. `fetch_facts.py <base> <facts dir> [project...]`: the canonical facts per project (ground truth).
3. `invariants.py <capture dir> <facts dir> <out.json>`: the matrix. Prints manifestations by mechanism and check.
4. `fresh.sh <empty data dir> <port> NAME=file.xer ...`: a fresh local server and fresh projects made by upload.

Invariants checked on every page: errors, stuck processing and empty pages; canonical headline, Data Date and
criticality on every response a page received; the Data Date it prints; CMeng's finish never shown or compared when no
open activity has a readable calendar; calendar coverage stated with the canonical count and the exact request;
baseline-only pages show no progress, movement, variance or recovery and no programme is compared with itself;
unknown is not zero for measures that are not established; answer first; at most 60 sections and 20 closed at load;
wording (plurals, separators, units, internal keys and codes, raw data, ISO dates, build numbers, retired names);
requests that name what is missing; Project Review decisions follow the owner rule (a choice no source states; missing
evidence is a data gap). Calculation semantics (CPM, P6 parity) are checked separately on the programme files.
