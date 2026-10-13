import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { isOutsideDirectory } from '../server/market/key-files.js';

test('external key paths reject repository children beginning with two dots',()=>{
  const root=resolve('workspace-fixture');
  assert.equal(isOutsideDirectory(root,root),false);
  assert.equal(isOutsideDirectory(root,resolve(root,'..keys','creator.keypair.json')),false);
  assert.equal(isOutsideDirectory(root,resolve(root,'private','creator.keypair.json')),false);
  assert.equal(isOutsideDirectory(root,resolve(root,'..','keys','creator.keypair.json')),true);
  assert.equal(isOutsideDirectory(root,resolve(root+'-external','creator.keypair.json')),true);
});
