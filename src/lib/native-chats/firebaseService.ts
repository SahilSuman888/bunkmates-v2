import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import type { Message, ChatRoom, User } from './types';

export const listenToChatrooms = (cb: (rooms: ChatRoom[]) => void) => {
  const q = query(collection(db, 'chatrooms'), orderBy('lastUpdated', 'desc'));
  return onSnapshot(q, snap => {
    const rooms: ChatRoom[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    cb(rooms);
  });
};

export const listenToRoomMessages = (roomId: string, cb: (messages: Message[]) => void) => {
  const q = query(collection(db, 'chatrooms', roomId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, snap => {
    const msgs: Message[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    cb(msgs);
  });
};

export const sendMessage = async (roomId: string, text: string, user: User) => {
  await addDoc(collection(db, 'chatrooms', roomId, 'messages'), { text, user, createdAt: serverTimestamp() });
  await setDoc(
    doc(db, 'chatrooms', roomId),
    { lastUpdated: serverTimestamp(), lastMessage: { text, user, createdAt: serverTimestamp() } },
    { merge: true }
  );
};

export const createGroup = async (name: string, members: User[]) => {
  const ref = await addDoc(collection(db, 'chatrooms'), { name, isGroup: true, members, lastUpdated: serverTimestamp() });
  return ref.id;
};

export const fetchGroupInvites = (userId: string, cb: (invites: any[]) => void) => {
  const q = query(collection(db, 'groupInvites'), where('to.id', '==', userId));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
};

export const inviteToGroup = async (groupId: string, to: User) => {
  await addDoc(collection(db, 'groupInvites'), { groupId, to, createdAt: serverTimestamp() });
};

export const findRecentMatchingChats = async (identifier: string) => {
  const q = query(collection(db, 'chatrooms'), limit(200));
  const snap = await getDocs(q);
  return snap.docs.filter(d => JSON.stringify(d.data()).toLowerCase().includes(identifier.toLowerCase()));
};
