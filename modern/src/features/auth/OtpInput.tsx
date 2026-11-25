import {useState} from 'react';
import {motion} from 'motion/react';
export function OtpInput({value,onChange,disabled,error}:{value:string;onChange:(value:string)=>void;disabled:boolean;error:boolean}){
 const [focused,setFocused]=useState(false),[caret,setCaret]=useState(0);
 return <div className="wf-otp" data-invalid={error}>
 <div className="wf-otp-cells" aria-hidden="true">{Array.from({length:6},(_,i)=><motion.span key={i} className="wf-otp-cell" data-active={focused&&i===Math.min(caret,5)} data-filled={!!value[i]}>{value[i]?<motion.span key={value[i]} initial={{opacity:0,y:3}} animate={{opacity:1,y:0}} transition={{duration:.12}}>{value[i]}</motion.span>:null}</motion.span>)}</div>
 <input id="wf-otp" name="otp" className="wf-otp-native" aria-label="Six-digit verification code" aria-invalid={error} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={value} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,'').slice(0,6);onChange(v);setCaret(v.length);}} onPaste={e=>{e.preventDefault();const v=e.clipboardData.getData('text').replace(/[^0-9]/g,'').slice(0,6);onChange(v);setCaret(v.length);}} onFocus={()=>{setFocused(true);setCaret(value.length);}} onBlur={()=>setFocused(false)} onSelect={e=>setCaret(e.currentTarget.selectionStart??value.length)} disabled={disabled} autoFocus required/>
 </div>;
}
