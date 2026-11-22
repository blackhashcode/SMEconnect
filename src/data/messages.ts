import type { ChatMessage, ChatThread } from "./types";

export const chatThreads: ChatThread[] = [
  {
    id: "th-1",
    personId: "nusrat",
    businessId: "crave-co",
    subject: "Second deck oven · ৳150,000",
    lastMessage: "That works for me. Shall we confirm the monthly date?",
    time: "10:42",
    unread: 2,
    online: true,
  },
  {
    id: "th-2",
    personId: "tanvir",
    businessId: "deshi-threads",
    subject: "Jamdani loom upgrade",
    lastMessage: "Thanks for connecting — I'll share the supplier quote.",
    time: "Yesterday",
    unread: 0,
    online: false,
  },
  {
    id: "th-3",
    personId: "farzana",
    businessId: "terracotta-studio",
    subject: "Ceramic kiln materials",
    lastMessage: "The kiln materials order is confirmed.",
    time: "Mon",
    unread: 0,
    online: true,
  },
  {
    id: "th-4",
    personId: "samira",
    subject: "Co-investing in food brands",
    lastMessage: "Let's compare notes on the Dhanmondi businesses.",
    time: "Fri",
    unread: 0,
    online: false,
  },
];

export const chatMessages: ChatMessage[] = [
  { id: "msg-1", threadId: "th-1", senderId: "nusrat", text: "Assalamu Alaikum Rafiq bhai! Thank you for connecting. Did you get a chance to look at the oven quote?", time: "10:18" },
  { id: "msg-2", threadId: "th-1", senderId: "rafiq", text: "Walaikum Assalam Nusrat. Yes — the track record looks solid and the 100% on-time repayment on your first loan was reassuring. What frequency fits your cashflow best?", time: "10:24" },
  { id: "msg-3", threadId: "th-1", senderId: "nusrat", text: "Monthly works best. We get paid by our café partners on the 5th, so the 10th would be ideal.", time: "10:31" },
  { id: "msg-4", threadId: "th-1", senderId: "rafiq", text: "Perfect. I'll send a formal offer with those terms.", time: "10:33", kind: "offer", offerId: "of-1" },
  { id: "msg-5", threadId: "th-1", senderId: "nusrat", text: "That works for me. Shall we confirm the monthly date?", time: "10:42" },
  { id: "msg-6", threadId: "th-2", senderId: "tanvir", text: "I'm adding two looms and a finishing table. The weavers have already agreed to the new schedule.", time: "16:05" },
  { id: "msg-7", threadId: "th-2", senderId: "rafiq", text: "Great to hear. Send the supplier quote when you can.", time: "16:12" },
  { id: "msg-8", threadId: "th-2", senderId: "tanvir", text: "Thanks for connecting — I'll share the supplier quote.", time: "Yesterday" },
  { id: "msg-9", threadId: "th-3", senderId: "farzana", text: "The glaze supplier confirmed the bulk rate.", time: "Monday" },
  { id: "msg-10", threadId: "th-3", senderId: "farzana", text: "The kiln materials order is confirmed. Thank you for connecting!", time: "Mon" },
  { id: "msg-11", threadId: "th-4", senderId: "samira", text: "Let's compare notes on the Dhanmondi businesses.", time: "Friday" },
];

export const messagesForThread = (threadId: string) => chatMessages.filter((message) => message.threadId === threadId);
