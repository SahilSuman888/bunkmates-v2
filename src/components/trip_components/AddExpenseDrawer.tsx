import React,{useState} from "react";
import {
Modal,
View,
Text,
TextInput,
TouchableOpacity,
StyleSheet
} from "react-native";

import { BlurView } from "../ui/AppBlurView";
import { doc,updateDoc,arrayUnion } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function AddExpenseDrawer({
visible,
onClose,
userId
}:any){

const [name,setName]=useState("");
const [amount,setAmount]=useState("");
const [category,setCategory]=useState("");

const saveExpense = async()=>{

await updateDoc(doc(db,"budgets",userId),{
expenses:arrayUnion({
name,
amount:Number(amount),
category,
date:new Date().toISOString(),
})
});

onClose();

};

return(

<Modal visible={visible} transparent animationType="slide">

<BlurView intensity={20} style={styles.backdrop}/>

<View style={styles.drawer}>

<View style={styles.handle}/>

<Text style={styles.title}>Add New Expense</Text>

<TextInput
placeholder="Expense Name"
placeholderTextColor="#777"
style={styles.input}
value={name}
onChangeText={setName}
/>

<TextInput
placeholder="Amount (₹)"
placeholderTextColor="#777"
style={styles.input}
value={amount}
onChangeText={setAmount}
/>

<TextInput
placeholder="Category"
placeholderTextColor="#777"
style={styles.input}
value={category}
onChangeText={setCategory}
/>

<TouchableOpacity style={styles.saveBtn} onPress={saveExpense}>
<Text style={{fontWeight:"700"}}>SAVE EXPENSE</Text>
</TouchableOpacity>

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

input:{
borderWidth:1,
borderColor:"#333",
borderRadius:10,
padding:12,
marginTop:12,
color:"#fff"
},

saveBtn:{
backgroundColor:"#fff",
padding:16,
borderRadius:12,
marginTop:20,
alignItems:"center"
}

});