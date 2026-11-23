import { describe, expect, it } from "vitest";
import {
  conversationRecordSchema,
  createConversationSchema,
  markReadResultSchema,
  messageBodySchema,
  messageListQuerySchema,
  messageRecordSchema,
  sendMessageSchema,
} from "@/server/validators/message";

describe("messaging input validators", () => {
  it("sanitizes plain-text message bodies without collapsing meaningful newlines", () => {
    expect(
      messageBodySchema.parse("  <b>Hello</b>  there\n\n\nfriend\u0007 "),
    ).toBe("Hello  there\n\nfriend");
    expect(messageBodySchema.parse("Hello\nworld")).toBe("Hello\nworld");
  });

  it("enforces length and non-empty rules after trimming", () => {
    expect(messageBodySchema.safeParse("   ").success).toBe(false);
    expect(messageBodySchema.safeParse("<p></p>").success).toBe(false);
    expect(messageBodySchema.safeParse("x".repeat(5000)).success).toBe(true);
    expect(messageBodySchema.safeParse("x".repeat(5001)).success).toBe(false);
  });

  it("accepts only a body when sending; ids come from the route", () => {
    expect(sendMessageSchema.safeParse({ body: "hello" }).success).toBe(true);
    expect(
      sendMessageSchema.safeParse({ body: "hello", conversationId: "conv_1" }).success,
    ).toBe(false);
    expect(
      sendMessageSchema.safeParse({ body: "hello", senderId: "usr_other" }).success,
    ).toBe(false);
  });

  it("validates conversation creation and polling query values strictly", () => {
    expect(createConversationSchema.safeParse({ participantId: "usr_1" }).success).toBe(true);
    expect(
      createConversationSchema.safeParse({ participantId: "usr_1", role: "ADMIN" }).success,
    ).toBe(false);
    expect(messageListQuerySchema.safeParse({ after: "msg_1" }).success).toBe(true);
    expect(messageListQuerySchema.safeParse({}).success).toBe(true);
    expect(messageListQuerySchema.safeParse({ after: "" }).success).toBe(false);
    expect(messageListQuerySchema.safeParse({ senderId: "usr_1" }).success).toBe(false);
  });
});

describe("messaging response allow-lists", () => {
  const participant = {
    id: "usr_1",
    name: "Nusrat Akter",
    image: null,
    role: "OWNER",
    verified: true,
    shopName: "Nusrat's Home Kitchen",
    slug: "nusrat-home-kitchen",
    category: "Food",
  };
  const message = {
    id: "msg_1",
    conversationId: "conv_1",
    senderId: "usr_1",
    mine: false,
    body: "Hello",
    readAt: null,
    createdAt: "2026-11-23T10:00:00.000Z",
    updatedAt: "2026-11-23T10:00:00.000Z",
  };

  it("rejects private fields in participant and message payloads", () => {
    expect(
      conversationRecordSchema.safeParse({
        id: "conv_1",
        participant,
        lastMessage: message,
        unreadCount: 1,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      }).success,
    ).toBe(true);
    expect(
      conversationRecordSchema.safeParse({
        id: "conv_1",
        participant: { ...participant, email: "secret@example.com" },
        lastMessage: null,
        unreadCount: 0,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      }).success,
    ).toBe(false);
    expect(messageRecordSchema.safeParse(message).success).toBe(true);
    expect(
      messageRecordSchema.safeParse({ ...message, recipientPhone: "+8801712345678" }).success,
    ).toBe(false);
  });

  it("validates the mark-read result", () => {
    expect(
      markReadResultSchema.safeParse({
        conversationId: "conv_1",
        markedRead: 2,
        unreadCount: 0,
      }).success,
    ).toBe(true);
    expect(
      markReadResultSchema.safeParse({
        conversationId: "conv_1",
        markedRead: -1,
        unreadCount: 0,
      }).success,
    ).toBe(false);
  });
});
