
// META: title=RemoteContextHelper navigation using BFCache
// META: script=./test-helper.js
// META: script=/common/dispatcher/dispatcher.js
// META: script=/common/get-host-info.sub.js
// META: script=/common/utils.js
// META: script=/html/browsers/browsing-the-web/back-forward-cache/resources/rc-helper.js
// META: script=/html/browsers/browsing-the-web/remote-context-helper/resources/remote-context-helper.js
// META: timeout=long
'use strict';
// Ensure that empty attributes are reported as empty strings and missing
// attributes are reported as null.
promise_test(async t => {
  const rcHelper = new RemoteContextHelper();
  // Open a window with noopener so that BFCache will work.
  const rc1 = await rcHelper.addWindow(
      /*config=*/ null, /*options=*/ {features: 'noopener'});
  const rc1_url = await rc1.executeScript(() => {
    return location.href;
  });
  rc1.executeScript(() => {
    const never_resolved = new Promise(resolve => {});
    new Promise(continue_test => {
      navigator.locks.request('resource', async () => {
        continue_test();
        await never_resolved;
      });
    })
  });
  // Check the BFCache result and the reported reasons.
  await assertBFCacheEligibility(rc1, /*shouldRestoreFromBFCache=*/ false);
  await assertNotRestoredReasonsEquals(
      rc1,
      /*blocked=*/ true,
      /*url=*/ rc1_url,
      /*src=*/ null,
      /*id=*/ null,
      /*name=*/ null,
      /*reasons=*/['lock'],
      /*children=*/[]);
});