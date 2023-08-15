importScripts('/resources/testharness.js');
importScripts('resources/sandboxed-fs-test-helpers.js');
importScripts('resources/test-helpers.js');

'use strict';

// Adds tests to test the interaction between a lock created by the move
// operation and a lock created by `createLock`.
function crossLockMoveTests(lockName, createLock) {
  crossLockTests(createMoveWithCleanup, createLock, {
    sameFile: `A file with an ongoing move operation cannot have ${lockName}`,
    diffFile: `A file with an ongoing move operation does not interfere with` +
        ` ${lockName} on another file`,
    acquireAfterClose: `After a file has finished moving, that file can have` +
        ` ${lockName}`,
    // TODO(1450624): Uncomment these tests when move for directories is
    // implemented.
    // takeDirThenFile: `A file cannot have ${lockName} if its in a directory` +
    // ` being moved.`,
    // takeFileThenDir: `A directory cannot be moved if it contains a file` +
    // ` that has ${lockName}.`,
  });

  directory_test(async (t, rootDir) => {
    const [fooFileHandle, barFileHandle] =
        await createFileHandles(rootDir, 'foo.test', 'bar.test');

    createLock(t, fooFileHandle);
    await promise_rejects_dom(
        t, 'NoModificationAllowedError',
        createMoveWithCleanup(t, barFileHandle, 'foo.test'));
  }, `A file cannot be moved to a location with ${lockName}`);

  directory_test(async (t, rootDir) => {
    const [fooFileHandle, barFileHandle] =
        await createFileHandles(rootDir, 'foo.test', 'bar.test');

    createMoveWithCleanup(t, fooFileHandle, 'bar.test');

    await promise_rejects_dom(
        t, 'NoModificationAllowedError', createLock(t, barFileHandle));
  }, `While a file is being moved to a location, that location cannot have` +
    ` ${lockName}`);
}


// Adds tests to test the interaction between a lock created by the remove
// operation and a lock created by `createLock`.
function crossLockRemoveTests(lockName, createLock) {
  crossLockTests(createRemoveWithCleanup, createLock, {
    sameFile: `A file with an ongoing remove operation cannot have ${lockName}`,
    diffFile: `A file with an ongoing remove operation does not interfere` +
        ` with the creation of ${lockName} on another file`,
    acquireAfterClose: `After a file has finished being removed, that file` +
        ` can have ${lockName}`,
    takeDirThenFile: `A file cannot have ${lockName} if its in a directory` +
        ` being removed.`,
    takeFileThenDir: `A directory cannot be removed if it contains a file` +
        ` that has ${lockName}.`,
  });
}

// Adds tests to test the interaction between a lock created by an open writable
// and a lock created by `createLock`.
function crossLockWFSTests(lockName, createLock) {
  crossLockTests(createWritableWithCleanup, createLock, {
    sameFile: `When there's an open writable stream on a file, cannot have a` +
        ` ${lockName} on that same file`,
    diffFile: `A writable stream from one file does not interfere with a` +
        ` ${lockName} on another file`,
    multiAcquireAfterClose: `After all writable streams have been closed for` +
        ` a file, that file can have ${lockName}`,
  });
}

// Adds tests to test the interaction between a lock created by an open access
// handle in `sahMode and locks created by other file primitives and operations.
function crossLockSAHTests(sahMode) {
  const createSAHLock = createSAHWithCleanupFactory({mode: sahMode});
  const SAHLockName = `an open access handle in ${sahMode} mode`;

  // Test interaction between move locks and SAH locks.
  crossLockMoveTests(SAHLockName, createSAHLock);
  crossLockTests(createSAHLock, createMoveWithCleanup, {
    sameFile: `A file with ${SAHLockName} cannot be moved`,
    diffFile: `A file with ${SAHLockName} does not interfere with moving` +
        ` another file`,
    acquireAfterClose: `After ${SAHLockName} on a file has been closed, that` +
        ` file can be moved`,
  });

  // Test interaction between remove locks and SAH locks.
  crossLockRemoveTests(SAHLockName, createSAHLock);
  crossLockTests(createSAHLock, createRemoveWithCleanup, {
    sameFile: `A file with ${SAHLockName} cannot be removed`,
    diffFile: `A file with ${SAHLockName} does not interfere with removing` +
        ` another file`,
    acquireAfterClose: `After ${SAHLockName} on a file has been closed, that` +
        ` file can be removed`,
  });

  // Test interaction between WFS locks and SAH locks.
  crossLockWFSTests(SAHLockName, createSAHLock);
  crossLockTests(createSAHLock, createWritableWithCleanup, {
    sameFile: `When there's ${SAHLockName} on a file, cannot open a writable` +
        ` stream on that same file`,
    diffFile: `A file with ${SAHLockName} does not interfere with the` +
        ` creation of a writable stream on another file`
  });
}

crossLockSAHTests('readwrite');
crossLockSAHTests('read-only');
crossLockSAHTests('readwrite-unsafe');

// Test interaction between move locks and WFS locks.
crossLockMoveTests('an open writable stream', createWritableWithCleanup);
crossLockWFSTests('an ongoing move operation', createMoveWithCleanup);

// Test interaction between remove locks and WFS locks.
crossLockRemoveTests('an open writable stream', createWritableWithCleanup);
crossLockWFSTests('an ongoing remove operation', createRemoveWithCleanup);

// Test interaction between move locks and remove locks.
crossLockMoveTests('an ongoing remove operation', createRemoveWithCleanup);
crossLockRemoveTests('an ongoing move operation', createMoveWithCleanup);

done();
