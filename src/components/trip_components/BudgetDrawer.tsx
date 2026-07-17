import React from "react";
import {
View,
Text,
Modal,
TextInput,
TouchableOpacity,
StyleSheet,
ScrollView
} from "react-native";

import { BlurView } from "expo-blur";
import { doc,setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

/* TYPES */

type Contributor = {
name:string;
amount:string;
};

type Budget = {
total:string;
contributors:Contributor[];
};

export default function BudgetDrawer({
visible,
onClose,
budget,
setBudget,
userId
}:any){

/* SAFE BUDGET */

const safeBudget:Budget = budget ?? {
total:"",
contributors:[]
};

/* ADD CONTRIBUTOR */

const addContributor = ()=>{
setBudget({
...safeBudget,
contributors:[
...safeBudget.contributors,
{name:"",amount:""}
]
});
};

/* SAVE BUDGET */

const saveBudget = async()=>{

await setDoc(
doc(db,"budgets",userId),
{
total:safeBudget.total,
contributors:safeBudget.contributors
},
{merge:true}
);

onClose();

};

return(

<Modal
visible={visible}
transparent
animationType="slide"
onRequestClose={onClose}
>

<BlurView intensity={20} style={styles.backdrop}/>

<View style={styles.drawer}>

<View style={styles.handle}/>

<Text style={styles.title}>
Edit Trip Budget
</Text>

<ScrollView showsVerticalScrollIndicator={false}>

{/* TOTAL BUDGET */}

<Text style={styles.label}>
Total Budget (₹)
</Text>

<TextInput
style={styles.input}
keyboardType="numeric"
value={safeBudget?.total || ""}
onChangeText={(t)=>
setBudget({
...safeBudget,
total:t
})
}
/>

{/* CONTRIBUTORS */}

<Text style={styles.label}>
Contributors
</Text>

{(safeBudget?.contributors || []).map((c:any,i:number)=>(

<View key={i} style={styles.row}>

<TextInput
style={styles.input}
placeholder="Name"
placeholderTextColor="#777"
value={c?.name || ""}
onChangeText={(t)=>{

const arr=[...safeBudget.contributors];
arr[i].name=t;

setBudget({
...safeBudget,
contributors:arr
});

}}
/>

<TextInput
style={styles.amount}
placeholder="Amount"
placeholderTextColor="#777"
keyboardType="numeric"
value={c?.amount || ""}
onChangeText={(t)=>{

const arr=[...safeBudget.contributors];
arr[i].amount=t;

setBudget({
...safeBudget,
contributors:arr
});

}}
/>

</View>

))}

{/* ADD CONTRIBUTOR */}

<TouchableOpacity
style={styles.addBtn}
onPress={addContributor}
>

<Text style={{color:"#fff"}}>
+ ADD CONTRIBUTOR
</Text>

</TouchableOpacity>

{/* SAVE */}

<TouchableOpacity
style={styles.saveBtn}
onPress={saveBudget}
>

<Text style={{fontWeight:"700"}}>
SAVE BUDGET
</Text>

</TouchableOpacity>

</ScrollView>

</View>

</Modal>

);

}

const styles=StyleSheet.create({

backdrop:{
...StyleSheet.absoluteFillObject
},

drawer:{
position:"absolute",
bottom:0,
width:"100%",
backgroundColor:"#111",
padding:20,
borderTopLeftRadius:20,
borderTopRightRadius:20
},

handle:{
width:40,
height:5,
backgroundColor:"#888",
alignSelf:"center",
marginBottom:20
},

title:{
color:"#fff",
fontSize:18,
marginBottom:20
},

label:{
color:"#aaa",
marginTop:10
},

input:{
borderWidth:1,
borderColor:"#333",
borderRadius:10,
padding:12,
marginTop:8,
color:"#fff",
flex:1
},

amount:{
borderWidth:1,
borderColor:"#333",
borderRadius:10,
padding:12,
marginLeft:10,
width:110,
color:"#fff"
},

row:{
flexDirection:"row",
marginTop:10
},

addBtn:{
marginTop:20,
borderWidth:1,
borderColor:"#fff",
padding:12,
borderRadius:10,
alignItems:"center"
},

saveBtn:{
backgroundColor:"#fff",
padding:16,
borderRadius:12,
marginTop:20,
alignItems:"center"
}

});