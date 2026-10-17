import fs from 'fs';import {feature} from 'topojson-client';
const topo=JSON.parse(fs.readFileSync('node_modules/world-atlas/land-50m.json'));const land=feature(topo,topo.objects.land);
const W=720,H=360;const grid=new Uint8Array(W*H);
const geoms=(land.features||[land]).map(f=>f.geometry);const polys=geoms.flatMap(g=>g.type==='MultiPolygon'?g.coordinates:[g.coordinates]);
for(const poly of polys){
 let minLat=90,maxLat=-90;for(const ring of poly)for(const [,la] of ring){if(la<minLat)minLat=la;if(la>maxLat)maxLat=la;}
 for(let y=0;y<H;y++){const lat=90-(y+.5)*0.5;if(lat<minLat||lat>maxLat)continue;const xs=[];
 for(const ring of poly){for(let i=0;i<ring.length-1;i++){const [x1,y1]=ring[i],[x2,y2]=ring[i+1];if((y1<=lat&&y2>lat)||(y2<=lat&&y1>lat)){if(Math.abs(x2-x1)>180)continue;xs.push(x1+(lat-y1)/(y2-y1)*(x2-x1));}}}
 xs.sort((a,b)=>a-b);for(let k=0;k+1<xs.length;k+=2){const a=Math.ceil((xs[k]+180)/0.5-.5),b=Math.floor((xs[k+1]+180)/0.5-.5);for(let x=Math.max(0,a);x<=Math.min(W-1,b);x++)grid[y*W+x]=1;}}}
for(let y=0;y<H;y++){const lat=90-(y+.5)*.5;if(lat<-79)for(let x=0;x<W;x++)grid[y*W+x]=1;}
const bytes=new Uint8Array(W*H/8);for(let i=0;i<W*H;i++)if(grid[i])bytes[i>>3]|=1<<(i&7);
fs.writeFileSync('mask.b64',Buffer.from(bytes).toString('base64'));
let s='';for(let y=0;y<H;y+=8){let r='';for(let x=0;x<W;x+=4)r+=grid[y*W+x]?'#':'.';s+=r+'\n';}console.log(s);
