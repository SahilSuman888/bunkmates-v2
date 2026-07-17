import React, { useEffect, useState } from "react";
import {
View,
Text,
ScrollView,
StyleSheet,
ImageBackground,
TouchableOpacity,
ActivityIndicator,
Image
} from "react-native";

import { useLocalSearchParams } from "expo-router";
import { doc, onSnapshot, collection, query, where, getDocs, getDoc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import ConfirmDeleteDialog from "../../components/trip_components/ConfirmDeleteDialog";
import { useTrips } from "../../hooks/useTrips";

/* DRAWERS */

import BudgetDrawer from "../../components/trip_components/BudgetDrawer";
import ChecklistDrawer from "../../components/trip_components/ChecklistDrawer";
import ChecklistViewAllDrawer from "../../components/trip_components/ChecklistViewAllDrawer";
import TimelineDrawer from "../../components/trip_components/TimelineDrawer";
import TimelineAllDrawer from "../../components/trip_components/TimelineAllDrawer";
import LinkDrawer from "../../components/trip_components/LinkDrawer";

export default function TripDetails(){

const { id } = useLocalSearchParams();

/* STATES */

const [trip,setTrip] = useState<any>(null);
const [groupChat,setGroupChat] = useState<any>(null);
const [checklist,setChecklist] = useState<any[]>([]);
const [timeline,setTimeline] = useState<any[]>([]);

const [budget,setBudget] = useState({
total:"",
contributors:[],
expenses:[]
});

const [loading,setLoading] = useState(true);
const [membersDetails, setMembersDetails] = useState<any[]>([]);

/* DRAWERS */

const [budgetDrawer,setBudgetDrawer] = useState(false);
const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
const [inviteModalOpen, setInviteModalOpen] = useState(false);
const [checklistDrawerOpen, setChecklistDrawerOpen] = useState(false);
const [checklistViewAllOpen, setChecklistViewAllOpen] = useState(false);
const [timelineDrawerOpen, setTimelineDrawerOpen] = useState(false);
const [timelineAllDrawerOpen, setTimelineAllDrawerOpen] = useState(false);

/* DELETE DIALOG */
const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

const [checklistDrafts, setChecklistDrafts] = useState<string[]>([]);
const [timelineDrafts, setTimelineDrafts] = useState<any[]>([]);
const [newTimelineEvent, setNewTimelineEvent] = useState<any>({ title: "", time: "", note: "" });

const router = useRouter();
const { deleteTrip } = useTrips();

/* FETCH DATA */

useEffect(()=>{

if(!id) return;

const unsubTrip = onSnapshot(
doc(db,"trips",id as string),
(snap)=>{
if(snap.exists()){
setTrip({id:snap.id,...snap.data()});
}
setLoading(false);
}
);

const unsubChecklist = onSnapshot(
collection(db,"trips",id as string,"checklist"),
(snap)=>{
setChecklist(
snap.docs.map(d=>({id:d.id,...d.data()}))
);
}
);

const unsubTimeline = onSnapshot(
collection(db,"trips",id as string,"timeline"),
(snap)=>{
setTimeline(
snap.docs.map(d=>({id:d.id,...d.data()}))
);
}
);

// listen for related groupChat (where tripId == id) to get iconURL and members
const unsubGroupChat = onSnapshot(
	query(collection(db, 'groupChats'), where('tripId', '==', id as string)),
	(snap) => {
		if (!snap.empty) {
			const docData = snap.docs[0].data();
			setGroupChat({ id: snap.docs[0].id, ...docData });
		}
	}
);

/* BUDGET */

const unsubBudget = onSnapshot(
doc(db,"budgets",id as string),
(snap)=>{
if(snap.exists()){
setBudget(snap.data() as any);
}
}
);

return ()=>{
unsubTrip();
unsubChecklist();
unsubTimeline();
unsubBudget();
unsubGroupChat();
};

},[id]);

// fetch member details when trip or groupChat updates
useEffect(() => {
	const uids =
		trip?.members && Array.isArray(trip.members)
			? trip.members
			: groupChat?.members && Array.isArray(groupChat.members)
			? groupChat.members
			: [];
	if (!uids || uids.length === 0) {
		setMembersDetails([]);
		return;
	}

	let mounted = true;
	const fetchMembers = async () => {
			try {
				const results: any[] = [];
				for (const uid of uids) {
					try {
						const uSnap = await getDoc(doc(db, 'users', uid));
						if (uSnap.exists()) results.push({ id: uSnap.id, ...(uSnap.data() || {}) });
					} catch (err) {
						console.warn('failed fetch user', uid, err);
					}
				}
				if (mounted) setMembersDetails(results);
			} catch (e) {
				console.error('fetchMembers error', e);
			}
		};

	fetchMembers();
	return () => { mounted = false; };
}, [trip]);

/* LOADING */

if(loading){
return(
<View style={styles.center}>
<ActivityIndicator size="large" color="#fff"/>
</View>
);
}

/* BUDGET CALCULATION */

const usedAmount =
budget?.expenses?.reduce((sum:any,e:any)=>sum+Number(e.amount),0) || 0;

const totalBudget = Number(budget?.total || 0);

const progress =
totalBudget === 0 ? 0 : (usedAmount/totalBudget)*100;

/* UI */

return(

<View style={{flex:1}}>

<ScrollView style={styles.container}>

{/* HEADER */}

<TouchableOpacity activeOpacity={0.9} onPress={() => setImagePreviewOpen(true)}>
	<ImageBackground
		source={
			(groupChat?.iconURL || trip?.settings?.imageBackgroundUrl) ? { uri: groupChat?.iconURL || trip?.settings?.imageBackgroundUrl } : undefined
		}
		style={styles.header}
	>

		<View style={styles.headerOverlay}>

			<Text style={styles.title}>{groupChat?.name || trip?.name}</Text>

			<Text style={styles.location}>📍 {trip?.location}</Text>

			<Text style={styles.date}>🗓 {trip?.startDate} — {trip?.endDate}</Text>

			<Text style={styles.route}>Route: {trip?.from} → {trip?.to}</Text>

		</View>

	</ImageBackground>
</TouchableOpacity>

{/* LINKS */}

<View style={styles.section}>

<Text style={styles.sectionTitle}>
Shared Trip Links
</Text>

{trip?.links?.map((link:any)=>(
<View key={link.id} style={styles.linkCard}>

<View style={styles.youtubeBox}>
<MaterialCommunityIcons
name="youtube"
size={26}
color="#ff0000"
/>
</View>

<Text style={styles.linkTitle}>
{link.title}
</Text>

<Text style={styles.linkUrl}>
{link.url}
</Text>

</View>
))}

<TouchableOpacity style={styles.addButton}>
<Text style={styles.addText}>
ADD TRIP LINK
</Text>
</TouchableOpacity>

</View>

{/* BUDGET */}

<View style={styles.section}>

<View style={styles.rowBetween}>

<Text style={styles.sectionTitle}>
Budget
</Text>

<View style={{flexDirection:"row"}}>

<TouchableOpacity onPress={()=>setBudgetDrawer(true)}>
<Text style={styles.smallBtn}>
EDIT
</Text>
</TouchableOpacity>

</View>

</View>

<Text style={styles.budgetText}>
₹{usedAmount} used of ₹{totalBudget}
</Text>

<View style={styles.progressBar}>

<View
style={{
backgroundColor:"#fff",
width:`${progress}%`,
height:6,
borderRadius:5
}}
/>

</View>

</View>

{/* CHECKLIST */}

<View style={styles.section}>

<View style={styles.rowBetween}>
<Text style={styles.sectionTitle}>
Checklist
</Text>
<Text style={styles.addSmall} onPress={() => setChecklistDrawerOpen(true)}>
+ ADD
</Text>
</View>

{checklist.map(item=>(

<View key={item.id} style={styles.checkRow}>

<MaterialCommunityIcons
name={
item.completed
? "checkbox-marked"
: "checkbox-blank-outline"
}
size={22}
color="#4ade80"
/>

<Text
style={[
styles.checkText,
item.completed && {
textDecorationLine:"line-through",
opacity:.6
}
]}
>
{item.title}
</Text>

</View>

))}

</View>
 
<TouchableOpacity style={{alignItems:'center', marginTop:12}} onPress={() => setChecklistViewAllOpen(true)}>
	<Text style={{backgroundColor:'#111', paddingHorizontal:24, paddingVertical:10, borderRadius:20, color:'#fff'}}>View All</Text>
</TouchableOpacity>

{/* TIMELINE */}

<View style={styles.section}>

<View style={styles.rowBetween}>
<Text style={styles.sectionTitle}>
Trip Timeline
</Text>
<Text style={styles.addSmall} onPress={() => setTimelineDrawerOpen(true)}>
+ ADD
</Text>
</View>

{timeline.length === 0 && (
<Text style={{color:"#888",marginTop:10}}>
No events added yet.
</Text>
)}

</View>

<TouchableOpacity style={{alignItems:'center', marginTop:12}} onPress={() => setTimelineAllDrawerOpen(true)}>
	<Text style={{backgroundColor:'#111', paddingHorizontal:24, paddingVertical:10, borderRadius:20, color:'#fff'}}>View All</Text>
</TouchableOpacity>

{/* Drawers for checklist/timeline and link/preview */}

<ChecklistDrawer
	visible={checklistDrawerOpen}
	onClose={() => { setChecklistDrawerOpen(false); setChecklistDrafts([]); }}
	tripId={id as string}
	checklist={checklist}
	mode="dark"
/>

<ChecklistViewAllDrawer
	checklistViewAllOpen={checklistViewAllOpen}
	setChecklistViewAllOpen={setChecklistViewAllOpen}
	checklist={checklist.map(c => ({ id: c.id, text: c.title || c.text || "", completed: !!c.completed }))}
	toggleTask={async (task:any) => {
		try {
			await updateDoc(doc(db, "trips", id as string, "checklist", task.id), { completed: !task.completed });
		} catch (e) { console.error(e); }
	}}
	mode="dark"
/>

<TimelineDrawer
	timelineDrawerOpen={timelineDrawerOpen}
	setTimelineDrawerOpen={setTimelineDrawerOpen}
	timelineDrafts={timelineDrafts}
	newEvent={newTimelineEvent}
	setNewEvent={setNewTimelineEvent}
	addTimelineEvent={async () => {
		if (!id) return;
		try {
			const payload = { title: newTimelineEvent.title || "Untitled", time: newTimelineEvent.time ? new Date(newTimelineEvent.time).toISOString() : new Date().toISOString(), note: newTimelineEvent.note || "", completed: false, createdAt: serverTimestamp() };
			await addDoc(collection(db, "trips", id as string, "timeline"), payload);
			setNewTimelineEvent({ title: "", time: "", note: "" });
		} catch (e) { console.error(e); }
	}}
	addEmptyTimelineDraft={() => setTimelineDrafts(s => [...s, { title: "", time: "", note: "" }])}
	addAllTimelineEvents={async () => {
		if (!id || timelineDrafts.length === 0) return;
		try {
			const batchAdds = timelineDrafts.map(d => addDoc(collection(db, "trips", id as string, "timeline"), { title: d.title || "Untitled", time: d.time ? new Date(d.time).toISOString() : new Date().toISOString(), note: d.note || "", completed: false, createdAt: serverTimestamp() }));
			await Promise.all(batchAdds);
			setTimelineDrafts([]);
			setTimelineDrawerOpen(false);
		} catch (e) { console.error(e); }
	}}
	updateTimelineDraft={(idx:number, val:any) => setTimelineDrafts(s=>s.map((it,i)=>i===idx?val:it))}
	removeTimelineDraft={(idx:number) => setTimelineDrafts(s=>s.filter((_,i)=>i!==idx))}
	mode="dark"
/>

<TimelineAllDrawer
	timelineAllDrawerOpen={timelineAllDrawerOpen}
	setTimelineAllDrawerOpen={setTimelineAllDrawerOpen}
	timeline={timeline}
	toggleEventCompleted={async (item:any) => {
		try { await updateDoc(doc(db, "trips", id as string, "timeline", item.id), { completed: !item.completed }); } catch(e){console.error(e);} }
	}
	mode="dark"
/>

<LinkDrawer visible={inviteModalOpen} onClose={() => setInviteModalOpen(false)} tripId={id as string} links={trip?.links || []} mode="dark" />

{/* MEMBERS */}

<View style={styles.section}>

<Text style={styles.sectionTitle}>
Members
</Text>







	{(membersDetails && membersDetails.length > 0 ? membersDetails : trip?.members || []).map((m:any,i:number)=>(

		<View key={m.uid || m.id || i} style={styles.memberRow}>

			<Image
				source={
					m?.photoURL ? { uri: m.photoURL } : undefined
				}
				style={styles.avatar}
			/>

			<View style={{flex:1}}>
				<Text style={styles.memberName}>
					{m?.name || (typeof m === 'string' ? `User` : `User ${i+1}`)}
				</Text>
				<Text style={styles.memberEmail}>
					{m?.email || m?.username || (typeof m === 'string' ? '' : '')}
				</Text>
			</View>

			<MaterialCommunityIcons
				name="delete"
				size={20}
				color="red"
			/>

		</View>

	))}

<TouchableOpacity style={styles.inviteBtn}>
<Text style={{color:"#fff"}}>
INVITE MEMBERS
</Text>
</TouchableOpacity>

<TouchableOpacity style={[styles.inviteBtn, {marginTop:12}]} onPress={() => setInviteModalOpen(true)}>
	<Text style={{color:'#fff'}}>SHARE TRIP</Text>
</TouchableOpacity>

<TouchableOpacity style={styles.deleteBtn} onPress={() => setConfirmDeleteOpen(true)}>
<Text style={{color:"#ff4444"}}>
DELETE TRIP
</Text>
</TouchableOpacity>

<ConfirmDeleteDialog
	confirmDeleteOpen={confirmDeleteOpen}
	setConfirmDeleteOpen={setConfirmDeleteOpen}
	mode="dark"
	handleDeleteTrip={async () => {
		if (!id) return;
		try {
			await deleteTrip(id as string);
			// navigate back to trips list
			router.replace("/(tabs)/trips");
		} catch (e) {
			console.error("Failed to delete trip", e);
			throw e;
		}
	}}
/>

</View>

</ScrollView>

{/* BUDGET DRAWER */}

<BudgetDrawer
visible={budgetDrawer}
onClose={()=>setBudgetDrawer(false)}
budget={budget}
setBudget={setBudget}
userId={id}
/>

</View>

);
}

/* STYLES */

const styles = StyleSheet.create({

container:{flex:1,backgroundColor:"#050505"},

center:{
flex:1,
justifyContent:"center",
alignItems:"center"
},

header:{
height:300,
justifyContent:"flex-end"
},

headerOverlay:{
backgroundColor:"rgba(0,0,0,0.5)",
padding:20
},

title:{
fontSize:32,
color:"#fff",
fontWeight:"700"
},

location:{
color:"#ccc",
marginTop:4
},

date:{
color:"#aaa",
marginTop:4
},

route:{
color:"#aaa",
marginTop:10
},

section:{
padding:20,
borderBottomWidth:.4,
borderColor:"#333"
},

sectionTitle:{
color:"#fff",
fontSize:18,
fontWeight:"600"
},

linkCard:{
marginTop:14,
padding:14,
borderRadius:10,
backgroundColor:"#111"
},

youtubeBox:{
height:40,
backgroundColor:"#222",
justifyContent:"center",
alignItems:"center",
borderRadius:6
},

linkTitle:{
color:"#fff",
marginTop:10,
fontWeight:"600"
},

linkUrl:{
color:"#888",
fontSize:12
},

addButton:{
marginTop:14,
backgroundColor:"#fff",
padding:12,
borderRadius:8,
alignItems:"center"
},

addText:{
fontWeight:"600"
},

rowBetween:{
flexDirection:"row",
justifyContent:"space-between",
alignItems:"center"
},

smallBtn:{
color:"#aaa",
marginLeft:14,
fontSize:12
},

budgetText:{
color:"#fff",
marginTop:10
},

progressBar:{
backgroundColor:"#333",
height:6,
borderRadius:5,
marginTop:10
},

checkRow:{
flexDirection:"row",
alignItems:"center",
marginTop:12
},

checkText:{
color:"#fff",
marginLeft:10
},

addSmall:{
color:"#aaa"
},

memberRow:{
flexDirection:"row",
alignItems:"center",
marginTop:16
},

avatar:{
width:40,
height:40,
borderRadius:20,
marginRight:10
},

memberName:{
color:"#fff",
fontWeight:"600"
},

memberEmail:{
color:"#888",
fontSize:12
},

inviteBtn:{
marginTop:20,
borderWidth:1,
borderColor:"#fff",
padding:14,
borderRadius:8,
alignItems:"center"
},

deleteBtn:{
marginTop:12,
borderWidth:1,
borderColor:"#ff4444",
padding:14,
borderRadius:8,
alignItems:"center"
}

});