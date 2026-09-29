
import express from "express";
import {createServer} from "node:http";
import {Server} from "socket.io";
const app=express(), httpServer=createServer(app);
app.get("/",(_,res)=>res.json({ok:true,service:"FC-style multiplayer server"}));
const io=new Server(httpServer,{cors:{origin:"*",methods:["GET","POST"]}});
const rooms=new Map(), F={w:52,h:34}, DT=1/30;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const room=()=>({players:new Map(),ball:{x:0,y:0,vx:0,vy:0,owner:null},score:[0,0],clock:180});
function reset(r){r.ball={x:0,y:0,vx:0,vy:0,owner:null};let i=0;for(const p of r.players.values()){p.x=i?-10:10;p.y=0;p.vx=p.vy=0;p.cooldown=0;i++;}}
function state(r){return {score:r.score,clock:r.clock,ball:{...r.ball},players:[...r.players.values()].map(p=>({id:p.id,team:p.team,x:p.x,y:p.y,vx:p.vx,vy:p.vy}))};}
function sim(r){
 const ps=[...r.players.values()];
 for(const p of ps){const l=Math.hypot(p.input.x,p.input.y)||1,s=p.input.sprint?8.5:5.5,ax=p.input.x/l*s,ay=p.input.y/l*s;p.vx+=(ax-p.vx)*.25;p.vy+=(ay-p.vy)*.25;p.x=clamp(p.x+p.vx*DT,-F.w/2+1,F.w/2-1);p.y=clamp(p.y+p.vy*DT,-F.h/2+1,F.h/2-1);p.cooldown=Math.max(0,p.cooldown-DT);}
 let n=null,nd=2;for(const p of ps){const d=Math.hypot(r.ball.x-p.x,r.ball.y-p.y);if(d<nd){n=p;nd=d;}}
 if(n&&!r.ball.owner)r.ball.owner=n.id;
 const o=r.ball.owner?r.players.get(r.ball.owner):null;
 if(o){
  r.ball.x=o.x+o.vx/(o.input.sprint?12:9);r.ball.y=o.y+o.vy/(o.input.sprint?12:9);
  if(o.cooldown<=0&&o.input.pass){const a=Math.atan2(o.input.y||o.vy,o.input.x||o.vx);r.ball.owner=null;r.ball.vx=Math.cos(a)*14;r.ball.vy=Math.sin(a)*14;o.cooldown=.25;}
  if(o.cooldown<=0&&o.input.shoot){const tx=o.team===0?F.w/2+2:-F.w/2-2,a=Math.atan2(-o.y,tx-o.x);r.ball.owner=null;r.ball.vx=Math.cos(a)*22;r.ball.vy=Math.sin(a)*22;o.cooldown=.5;}
 }else{r.ball.x+=r.ball.vx*DT;r.ball.y+=r.ball.vy*DT;r.ball.vx*=.985;r.ball.vy*=.985;if(Math.abs(r.ball.y)>F.h/2){r.ball.y=clamp(r.ball.y,-F.h/2,F.h/2);r.ball.vy*=-.7;}}
 for(const p of ps)if(p.input.tackle&&p.cooldown===0&&r.ball.owner&&r.ball.owner!==p.id){const q=r.players.get(r.ball.owner);if(q&&Math.hypot(p.x-q.x,p.y-q.y)<2){r.ball.owner=null;r.ball.vx=(p.x-q.x)*5;r.ball.vy=(p.y-q.y)*5;p.cooldown=.45;}}
 if(Math.abs(r.ball.x)>F.w/2+1&&Math.abs(r.ball.y)<3.8){r.score[r.ball.x>0?0:1]++;reset(r);}
 r.clock=Math.max(0,r.clock-DT);
}
io.on("connection",s=>{
 s.on("join",()=>{let r=[...rooms.values()].find(x=>x.players.size<2);if(!r){r=room();r.id="room-"+Math.random().toString(36).slice(2,8);rooms.set(r.id,r);}
  const team=r.players.size;r.players.set(s.id,{id:s.id,team,x:team?-10:10,y:0,vx:0,vy:0,cooldown:0,input:{x:0,y:0,sprint:false,pass:false,shoot:false,tackle:false}});
  s.join(r.id);s.data.roomId=r.id;s.emit("joined",{roomId:r.id,team,players:r.players.size});io.to(r.id).emit("state",state(r));});
 s.on("input",i=>{const r=rooms.get(s.data.roomId),p=r?.players.get(s.id);if(!p)return;p.input={x:clamp(Number(i?.x)||0,-1,1),y:clamp(Number(i?.y)||0,-1,1),sprint:!!i?.sprint,pass:!!i?.pass,shoot:!!i?.shoot,tackle:!!i?.tackle};});
 s.on("disconnect",()=>{const r=rooms.get(s.data.roomId);if(!r)return;r.players.delete(s.id);if(!r.players.size)rooms.delete(r.id);else{reset(r);io.to(r.id).emit("state",state(r));}});
});
setInterval(()=>{for(const r of rooms.values()){sim(r);io.to(r.id).emit("state",state(r));}},1000/30);
const PORT=process.env.PORT||10000;httpServer.listen(PORT,"0.0.0.0",()=>console.log("Server on "+PORT));
