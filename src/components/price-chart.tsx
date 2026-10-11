'use client';
import { useEffect,useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, DataZoomComponent, AriaComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
echarts.use([LineChart,GridComponent,TooltipComponent,DataZoomComponent,AriaComponent,CanvasRenderer]);
export function PriceChart({points,label,currency,locale}:{points:{day:string;minor:number|null}[];label:string;currency:string;locale:string}){
  const element=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!element.current)return;const chart=echarts.init(element.current);const digits=new Intl.NumberFormat(locale,{style:'currency',currency}).resolvedOptions().maximumFractionDigits??2;const fmt=(v:number)=>new Intl.NumberFormat(locale,{style:'currency',currency}).format(v/10**digits);
    chart.setOption({aria:{enabled:true,description:label},animation:!window.matchMedia('(prefers-reduced-motion: reduce)').matches,grid:{left:70,right:24,top:32,bottom:65},tooltip:{trigger:'axis',valueFormatter:(value:unknown)=>typeof value==='number'?fmt(value):'—'},xAxis:{type:'category',data:points.map(p=>p.day),axisLine:{lineStyle:{color:'#abc0b8'}},axisLabel:{color:'#54706a'}},yAxis:{type:'value',scale:true,axisLabel:{formatter:(v:number)=>fmt(v),color:'#54706a'},splitLine:{lineStyle:{color:'#dce5db'}}},dataZoom:[{type:'inside'},{type:'slider',height:18,bottom:10,borderColor:'transparent',fillerColor:'#346d6822'}],series:[{name:label,type:'line',data:points.map(p=>p.minor),connectNulls:false,smooth:false,symbolSize:7,lineStyle:{width:3,color:'#346d68'},itemStyle:{color:'#346d68'},areaStyle:{color:'#346d6815'}}]});
    const observer=new ResizeObserver(()=>chart.resize());observer.observe(element.current);return()=>{observer.disconnect();chart.dispose();};},[points,label,currency,locale]);
  return <div ref={element} className="price-chart" role="img" aria-label={label}/>;
}
