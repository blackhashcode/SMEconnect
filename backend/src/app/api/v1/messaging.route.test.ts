import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createOrGetConversation: vi.fn(),
  listConversations: vi.fn(),
  getConversation: vi.fn(),
  listMessages: vi.fn(),
  sendMessage: vi.fn(),
  markConversationRead: vi.fn(),
  getMessage: vi.fn(),
  deleteMessage: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/server/services/messaging", () => ({
  createOrGetConversation: mocks.createOrGetConversation,
  listConversations: mocks.listConversations,
  getConversation: mocks.getConversation,
  listMessages: mocks.listMessages,
  sendMessage: mocks.sendMessage,
  markConversationRead: mocks.markConversationRead,
  getMessage: mocks.getMessage,
  deleteMessage: mocks.deleteMessage,
}));

import { UnauthorizedError } from "@/server/errors";
import * as conversationsRoute from "./conversations/route";
import * as conversationRoute from "./conversations/[id]/route";
import * as messagesRoute from "./conversations/[id]/messages/route";
import * as readRoute from "./conversations/[id]/read/route";
import * as messageRoute from "./messages/[messageId]/route";

const actor = { id: "usr_owner", role: "OWNER" as const };
const meta = { limit: 20, nextCursor: null, hasMore: false };

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRole.mockResolvedValue({ user: actor });
  mocks.listConversations.mockResolvedValue({ items: [{ id: "con_1" }], meta });
  mocks.createOrGetConversation.mockResolvedValue({ id: "con_1" });
  mocks.getConversation.mockResolvedValue({ id: "con_1" });
  mocks.listMessages.mockResolvedValue({ items: [{ id: "msg_1" }], meta });
  mocks.sendMessage.mockResolvedValue({ id: "msg_2" });
  mocks.markConversationRead.mockResolvedValue({
    conversationId: "con_1",
    markedRead: 1,
    unreadCount: 0,
  });
  mocks.getMessage.mockResolvedValue({ id: "msg_1" });
  mocks.deleteMessage.mockResolvedValue({ id: "msg_1", deleted: true });
});

describe("conversation routes", () => {
  it("lists conversations with parsed pagination", async () => {
    const response = await conversationsRoute.GET(
      new NextRequest("http://localhost/api/v1/conversations?limit=5"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [{ id: "con_1" }], meta });
    expect(mocks.requireRole).toHaveBeenCalledWith("OWNER", "INVESTOR");
    expect(mocks.listConversations).toHaveBeenCalledWith(actor, { limit: 5, cursor: undefined });
  });

  it("creates or retrieves a conversation from validated input", async () => {
    const response = await conversationsRoute.POST(
      jsonRequest("http://localhost/api/v1/conversations", { participantId: "usr_inv" }),
    );

    expect(response.status).toBe(201);
    expect(mocks.createOrGetConversation).toHaveBeenCalledWith(actor, {
      participantId: "usr_inv",
    });
  });

  it("returns conversation detail from the path id", async () => {
    const response = await conversationRoute.GET(new NextRequest("http://localhost/api/v1/conversations/con_1"), {
      params: Promise.resolve({ id: "con_1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.getConversation).toHaveBeenCalledWith(actor, "con_1");
  });
});

describe("message routes", () => {
  it("lists messages with after and limit, without trusting a client user id", async () => {
    const response = await messagesRoute.GET(
      new NextRequest("http://localhost/api/v1/conversations/con_1/messages?after=msg_1&limit=1"),
      { params: Promise.resolve({ id: "con_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.listMessages).toHaveBeenCalledWith(actor, "con_1", {
      limit: 1,
      cursor: undefined,
      after: "msg_1",
    });
  });

  it("rejects unknown polling query keys before calling the service", async () => {
    const response = await messagesRoute.GET(
      new NextRequest("http://localhost/api/v1/conversations/con_1/messages?senderId=usr_other"),
      { params: Promise.resolve({ id: "con_1" }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.listMessages).not.toHaveBeenCalled();
  });

  it("sends a sanitized body using the session identity", async () => {
    const response = await messagesRoute.POST(
      jsonRequest("http://localhost/api/v1/conversations/con_1/messages", {
        body: "  <b>Hello</b>  ",
      }),
      { params: Promise.resolve({ id: "con_1" }) },
    );

    expect(response.status).toBe(201);
    expect(mocks.sendMessage).toHaveBeenCalledWith(actor, "con_1", { body: "Hello" });
  });

  it("returns 400 for an empty message body", async () => {
    const response = await messagesRoute.POST(
      jsonRequest("http://localhost/api/v1/conversations/con_1/messages", { body: "   " }),
      { params: Promise.resolve({ id: "con_1" }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it("marks read and returns the service result", async () => {
    const response = await readRoute.POST(
      new NextRequest("http://localhost/api/v1/conversations/con_1/read", { method: "POST" }),
      { params: Promise.resolve({ id: "con_1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { conversationId: "con_1", markedRead: 1, unreadCount: 0 },
    });
    expect(mocks.markConversationRead).toHaveBeenCalledWith(actor, "con_1");
  });

  it("reads and soft-deletes an individual message from the path id", async () => {
    const detail = await messageRoute.GET(new NextRequest("http://localhost/api/v1/messages/msg_1"), {
      params: Promise.resolve({ messageId: "msg_1" }),
    });
    const deleted = await messageRoute.DELETE(
      new NextRequest("http://localhost/api/v1/messages/msg_1", { method: "DELETE" }),
      { params: Promise.resolve({ messageId: "msg_1" }) },
    );

    expect(detail.status).toBe(200);
    expect(mocks.getMessage).toHaveBeenCalledWith(actor, "msg_1");
    expect(deleted.status).toBe(200);
    expect(mocks.deleteMessage).toHaveBeenCalledWith(actor, "msg_1");
  });

  it("maps guard failures to the standard error envelope", async () => {
    mocks.requireRole.mockRejectedValueOnce(new UnauthorizedError());

    const response = await conversationsRoute.GET(
      new NextRequest("http://localhost/api/v1/conversations"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  });
});
