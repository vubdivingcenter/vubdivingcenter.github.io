import{J as v,P as m,F as a,H as h,G as c,Q as u,R as l,S as d,T as R,U as g,V as w,W as P,X as b}from"./index.js";const A=v("user",{state:()=>({auth:m(),db:a(h),usersRef:c(a(h),"users"),inviteRef:c(a(h),"invites")}),getters:{user(){var t;return(t=this.auth)==null?void 0:t.currentUser}},actions:{findUserById(t){return new Promise((r,s)=>{const i=u(this.usersRef,t);l(i).then(e=>{e.exists()?r(e.data()):s("User not found.")}).catch(e=>{console.error(e),s(e)})})},findInviteByKey(t){return new Promise((r,s)=>{const i=u(this.inviteRef,t);l(i).then(e=>{e.exists()?r(e.data()):s("Invalid invite key.")}).catch(e=>{console.error(e),s(e)})})},createInvite(){return new Promise((t,r)=>{const s=u(this.inviteRef,this.user.uid);d(s,{uid:this.user.uid}).then(()=>{t(s.id)}).catch(i=>{console.error(i),r(i)})})},login(t,r){return new Promise((s,i)=>(this.auth!==null&&R(this.auth,g.credential(t,r)).then(()=>w(this.auth)).then(e=>{if(e===null)return i("User is null.");s(e.user)}).catch(e=>{i(e)}),i("Authentication is not available.")))},register(t,r,s,i,e){return new Promise((f,o)=>(this.auth!==null&&P(this.auth,r,s).then(n=>b(n.user,{url:"https://www.vubdivingcenter.be/user/register?email=".concat(r)})).then(()=>d(u(this.usersRef,this.user.uid),{firstName:i,lastName:e,invite:t})).then(()=>{f(this.user)}).catch(n=>{console.error(n),o(n)}),o("Authentication is not available.")))}}});export{A as u};