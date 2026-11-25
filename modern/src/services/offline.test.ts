import 'fake-indexeddb/auto';
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {loadLocal,storeLocal,makeSnapshot,openWorkspace,syncLocal} from './offline';
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
