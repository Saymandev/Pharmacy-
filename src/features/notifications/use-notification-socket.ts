"use client";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { NOTIFICATIONS_CHANGED } from "./events";

type SocketSession={ticket:string;socketUrl:string};
export function useNotificationSocket(){
 const {user,status:authStatus}=useAuth();
 const [state,setState]=useState<"connecting"|"connected"|"disconnected">("connecting"),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(authStatus!=="authenticated")return;
  let live=true,socket:Socket|undefined,retryTimer:ReturnType<typeof setTimeout>|undefined,denials=0;
  const changed=()=>window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED,{detail:{source:"socket"}}));
  async function session(){const data=await api.post<SocketSession>("/auth/socket-ticket",{});if(!data?.ticket||!data?.socketUrl)throw new Error("Realtime unavailable");return data;}
  const start=window.setTimeout(()=>{
   setState("connecting");
   void session().then(first=>{
    if(!live)return;
    let initial:SocketSession|undefined=first;
    socket=io(first.socketUrl,{autoConnect:false,transports:["websocket"],reconnection:true,reconnectionDelay:1000,reconnectionDelayMax:10000,auth:callback=>{
     const pending=initial?Promise.resolve(initial):session();initial=undefined;
     void pending.then(value=>{if(live)callback({ticket:value.ticket});}).catch(()=>{if(live){setState("disconnected");callback({ticket:""});}});
    }});
    socket.on("connect",()=>{if(live){denials=0;setState("connected");changed();}});
    socket.on("notification:received",changed);
    socket.on("notification:updated",changed);
    socket.on("disconnect",()=>{if(live)setState("disconnected");});
    socket.on("connect_error",()=>{if(!live)return;setState("disconnected");if(socket&&!socket.active&&denials<3){denials++;retryTimer=setTimeout(()=>{if(live)socket?.connect();},1000*2**(denials-1));}});
    socket.connect();
   }).catch(()=>{if(live)setState("disconnected");});
  },0);
  return()=>{live=false;window.clearTimeout(start);if(retryTimer)clearTimeout(retryTimer);socket?.removeAllListeners();socket?.disconnect();};
 },[authStatus,user?.id,retry]);
 return {state,reconnect:()=>setRetry(value=>value+1)};
}
