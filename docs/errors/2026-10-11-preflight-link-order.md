# Preflight QA generation-order failure

Initial run: document link checker expected `docs/qa/preflight-results.json` before the browser checks had generated it; exit 1, no browser assertions executed. Root cause: generated-output dependency checked in the wrong phase, not a provider/network problem.

Fix: run ordinary browser/JSON verification, write result output, then check all document links and update the result. No link assertion removed, no dummy success result introduced. First repair round; subsequent result recorded in `docs/qa/preflight-results.json`.

Next run reached browser launch but sandbox remapped default browser cache to an empty virtual profile. Existing Chromium verified under the actual user `AppData/Local/ms-playwright`. Fix was only setting `PLAYWRIGHT_BROWSERS_PATH` for the QA process, no global install or settings change. Second repair/validation round passed all45 artifact checks; failures were different known causes, no unexplained consecutive failure threshold reached.
