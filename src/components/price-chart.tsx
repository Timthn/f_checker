'use client';
import { useEffect,useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, DataZoomComponent, AriaComponent,MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
echarts.use([LineChart,GridComponent,TooltipComponent,DataZoomComponent,AriaComponent,MarkLineComponent,CanvasRenderer]);
export function PriceChart({points,label,currency,locale,centerDay,centerLabel,average,connectGaps=false}:{points:{day:string;minor:number|null}[];label:string;currency:string;locale:string;centerDay?:string;centerLabel?:string;average?:number|null;connectGaps?:boolean}){
  const element=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!element.current)return;const chart=echarts.init(element.current);const styles=getComputedStyle(element.current);const ink=styles.color,panel=styles.getPropertyValue('--panel').trim()||'#fcfdf9',gridLine=styles.getPropertyValue('--line').trim()||'#dce5db',accent=styles.getPropertyValue('--chart-accent').trim()||'#346d68';const digits=new Intl.NumberFormat(locale,{style:'currency',currency}).resolvedOptions().maximumFractionDigits??2;const fmt=(v:number)=>new Intl.NumberFormat(locale,{style:'currency',currency}).format(v/10**digits);
    const lines=[...(centerDay?[{xAxis:centerDay,label:{formatter:centerLabel??centerDay,color:ink}}]:[]),...(average!=null?[{yAxis:average,label:{formatter:fmt(average),color:ink},lineStyle:{color:'#b77b43'}}]:[])];
    chart.setOption({aria:{enabled:true,description:label},animation:!window.matchMedia('(prefers-reduced-motion: reduce)').matches,grid:{left:70,right:24,top:44,bottom:65},tooltip:{backgroundColor:panel,borderColor:gridLine,textStyle:{color:ink},trigger:'axis',valueFormatter:(value:unknown)=>typeof value==='number'?fmt(value):'—'},xAxis:{type:'category',data:points.map(p=>p.day),axisLine:{lineStyle:{color:gridLine}},axisLabel:{color:ink,formatter:(day:string)=>day.slice(5).replace('-','/')}},yAxis:{type:'value',scale:true,axisLabel:{formatter:(v:number)=>fmt(v),color:ink},splitLine:{lineStyle:{color:gridLine}}},dataZoom:[{type:'inside'},{type:'slider',textStyle:{color:ink},height:18,bottom:10,borderColor:'transparent',fillerColor:'#346d6822'}],series:[{name:label,type:'line',data:points.map(p=>p.minor),connectNulls:connectGaps,smooth:false,symbolSize:8,lineStyle:{width:3,color:accent,type:connectGaps?'dashed':'solid'},itemStyle:{color:accent},areaStyle:connectGaps?undefined:{color:'#346d6815'},markLine:{silent:true,symbol:'none',data:lines}}]});
    const observer=new ResizeObserver(()=>chart.resize());observer.observe(element.current);return()=>{observer.disconnect();chart.dispose();};},[points,label,currency,locale,centerDay,centerLabel,average,connectGaps]);
  return <div ref={element} className="price-chart" role="img" aria-label={label}/>;
}
