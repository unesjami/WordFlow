import 'fake-indexeddb/auto';
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {loadLocal,storeLocal,makeSnapshot,openWorkspace,syncLocal,uploadSnapshot,acknowledgeSnapshot} from './offline';
import {readWorkspace,writeWorkspace} from './workspace';
vi.mock('./workspace',()=>({readWorkspace:vi.fn(),writeWorkspace:vi.fn()}));
const words=[{en:'apple',fa:'سیب',kept:false,timestamp:1}];
beforeEach(()=>vi.resetAllMocks());
describe('IndexedDB offline workspace',()=>{
 it('persists snapshots and isolates accounts',async()=>{const s=makeSnapshot('alice',words,2,true);await storeLocal(s,'');expect(await loadLocal('alice')).toEqual(s);expect(await loadLocal('bob')).toBeUndefined();});
 it('rejects a stale local version',async()=>{const s=makeSnapshot('tab',words,1,false);await storeLocal(s,'');const next=makeSnapshot('tab',[],1,true);await storeLocal(next,s.version);await expect(storeLocal(s,s.version)).rejects.toThrow('another tab');expect(await loadLocal('tab')).toEqual(next);});
 it('opens dirty data without replacing it from cloud',async()=>{const s=makeSnapshot('dirty',words,2,true);await storeLocal(s,'');expect(await openWorkspace('dirty')).toEqual(s);expect(readWorkspace).not.toHaveBeenCalled();});
 it('preserves local changes on remote conflict',async()=>{const s=makeSnapshot('conflict',words,2,true);await storeLocal(s,'');vi.mocked(readWorkspace).mockResolvedValue({words:[],revision:3,preferences:{}});await expect(syncLocal(s)).rejects.toThrow('Cloud workspace changed');expect(writeWorkspace).not.toHaveBeenCalled();expect(await loadLocal('conflict')).toEqual(s);});
 it('marks a successful upload clean',async()=>{const s=makeSnapshot('sync',words,2,true);await storeLocal(s,'');vi.mocked(readWorkspace).mockResolvedValue({words:[],revision:2,preferences:{}});vi.mocked(writeWorkspace).mockResolvedValue(3);const next=await syncLocal(s);expect(next).toMatchObject({dirty:false,revision:3,words});expect(await loadLocal('sync')).toEqual(next);});
 it('keeps local data when network fails',async()=>{const s=makeSnapshot('offline',words,2,false);await storeLocal(s,'');vi.mocked(readWorkspace).mockRejectedValue(Error('offline'));expect(await openWorkspace('offline')).toEqual(s);});
});

describe('nonblocking background sync',()=>{
 it('preserves a deletion made during cloud upload and advances its revision',async()=>{
  const original=makeSnapshot('during-upload',words,2,true);await storeLocal(original,'');
  vi.mocked(readWorkspace).mockResolvedValue({words:[],revision:2,preferences:{}});
  let finish!:(revision:number)=>void;
  vi.mocked(writeWorkspace).mockImplementation(()=>new Promise<number>(resolve=>{finish=resolve;}));
  const upload=uploadSnapshot(original);
  await vi.waitFor(()=>expect(writeWorkspace).toHaveBeenCalled());
  const edited=makeSnapshot(original.userId,[],2,true);await storeLocal(edited,original.version);
  finish(3);const revision=await upload;
  const latest=await loadLocal(original.userId);expect(latest).toEqual(edited);
  const acknowledged=acknowledgeSnapshot(original,latest!,revision);
  await storeLocal(acknowledged,edited.version);
  expect(await loadLocal(original.userId)).toMatchObject({words:[],revision:3,dirty:true});
 });
 it('never acknowledges a different account or revision',()=>{
  const s=makeSnapshot('a',words,2,true);
  expect(()=>acknowledgeSnapshot(s,makeSnapshot('b',words,2,true),3)).toThrow();
  expect(()=>acknowledgeSnapshot(s,makeSnapshot('a',words,4,true),3)).toThrow();
 });
 it('marks unchanged snapshots clean',()=>{
  const s=makeSnapshot('a',words,2,true);
  expect(acknowledgeSnapshot(s,s,3)).toMatchObject({words,revision:3,dirty:false});
 });
});
