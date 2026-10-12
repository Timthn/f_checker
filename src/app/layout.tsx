import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Flight checker',description:'A bilingual flight comparison cockpit'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-Hans"><body>{children}</body></html>;}
