export type User = {
  id: string;
  name: string;
  avatar?: string;
};

export type Message = {
  id: string;
  text: string;
  createdAt: any;
  user: User;
};

export type ChatRoom = {
  id: string;
  name: string;
  isGroup?: boolean;
  members?: User[];
  lastMessage?: Message;
};
