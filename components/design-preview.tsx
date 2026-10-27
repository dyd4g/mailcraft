'use client';
import {useEffect,useRef,useState,useMemo} from 'react';
import type {EmailContent,Brand} from '@/lib/email/model';
import {exportEmail} from '@/lib/email/render';
export default function DesignPreview({content,brand,title,height=340}:{content:EmailContent;brand:Brand;title:string;height?:number}){
 const ref=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(300);
 useEffect(()=>{const el=ref.current;if(!el)return;const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));observer.observe(el);return()=>observer.disconnect();},[]);
 const html=useMemo(()=>exportEmail(content,brand),[content,brand]);const scale=width/content.width;
 return <div ref={ref} className="design-preview" style={{height}} aria-hidden="true"><iframe title={title+' miniature'} sandbox="" tabIndex={-1} loading="lazy" srcDoc={html} style={{width:content.width,height:Math.max(1400,height/scale),transform:`scale(${scale})`,transformOrigin:'top left',border:0,pointerEvents:'none'}}/></div>;
}
