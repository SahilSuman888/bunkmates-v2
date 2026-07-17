import { useState,useEffect } from "react"
import {
collection,
query,
where,
onSnapshot
} from "firebase/firestore"

import {db} from "../lib/firebase"

export const useUserGroups = (userId) => {

const [groups,setGroups] = useState([])
const [loading,setLoading] = useState(true)

useEffect(()=>{

if(!userId) return

const q = query(
collection(db,"groupChats"),
where("members","array-contains",userId)
)

const unsub = onSnapshot(q,(snap)=>{

const list = snap.docs.map(doc=>({

id:doc.id,
...doc.data()

}))

setGroups(list)
setLoading(false)

})

return ()=>unsub()

},[userId])

return {groups,loading}

}