import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { clearMessageNotifications, notifyMessageRecipient, notifyUser } from "@/server/services/notify";

type Db = Parameters<typeof notifyUser>[1];
const asDb = (value: unknown) => value as Db;

describe("notifyUser", () => {
  it("creates a notification", async () => {
    const create = vi.fn();
    await notifyUser({ userId: "u1", type: "CONNECTION_REQUEST", title: "A wants to connect", body: "Hi", link: "/connections" }, asDb({ notification: { create } }));
    expect(create.mock.calls[0][0].data).toMatchObject({ userId: "u1", type: "CONNECTION_REQUEST", link: "/connections" });
  });

  it("keeps one unread message notification per conversation, updating it", async () => {
    const create = vi.fn();
    const update = vi.fn();
    const findFirst = vi.fn().mockResolvedValue({ id: "n1" });
    await notifyUser(
      { userId: "u1", type: "MESSAGE_RECEIVED", title: "New message", body: "Second", link: "/conversations/c1", data: { conversationId: "c1" } },
      asDb({ notification: { create, update, findFirst } }),
    );
    expect(create).not.toHaveBeenCalled();
    expect(update.mock.calls[0][0]).toMatchObject({ where: { id: "n1" }, data: { body: "Second" } });
  });

  it("never throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifyUser({ userId: "u1", type: "CONNECTION_ACCEPTED", title: "t", body: "b", link: "/" }, asDb({ notification: { create: vi.fn().mockRejectedValue(new Error("down")) } }))).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

describe("message notifications", () => {
  it("notifies the other participant with a short preview", async () => {
    const create = vi.fn();
    const db = asDb({
      conversation: { findUnique: vi.fn().mockResolvedValue({ participantOneId: "a", participantTwoId: "b" }) },
      notification: { create, findFirst: vi.fn().mockResolvedValue(null) },
    });
    await notifyMessageRecipient("c1", { id: "a", name: "Asha" }, "x".repeat(200), db);
    const data = create.mock.calls[0][0].data;
    expect(data.userId).toBe("b");
    expect(data.title).toBe("New message from Asha");
    expect(data.body.length).toBe(120);
  });

  it("clears a conversation's unread message notifications", async () => {
    const updateMany = vi.fn();
    await clearMessageNotifications("u1", "c1", asDb({ notification: { updateMany } }));
    expect(updateMany.mock.calls[0][0].where).toMatchObject({ userId: "u1", type: "MESSAGE_RECEIVED", readAt: null });
  });
});
