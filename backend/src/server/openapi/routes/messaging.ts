import "@/server/openapi/setup";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/pagination";
import { SECURITY_SCHEME_NAME } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import {
  STANDARD_ERROR_RESPONSES,
  conversationListSuccessEnvelopeSchema,
  conversationSuccessEnvelopeSchema,
  deleteResultSuccessEnvelopeSchema,
  markReadResultSuccessEnvelopeSchema,
  messageListSuccessEnvelopeSchema,
  messageSuccessEnvelopeSchema,
} from "@/server/openapi/schemas";

export const CONVERSATIONS_PATH = "/api/v1/conversations";
export const CONVERSATION_PATH = `${CONVERSATIONS_PATH}/{id}`;
export const CONVERSATION_MESSAGES_PATH = `${CONVERSATION_PATH}/messages`;
export const CONVERSATION_READ_PATH = `${CONVERSATION_PATH}/read`;
export const MESSAGE_PATH = "/api/v1/messages/{messageId}";

export const MESSAGING_PATHS = [
  CONVERSATIONS_PATH,
  CONVERSATION_PATH,
  CONVERSATION_MESSAGES_PATH,
  CONVERSATION_READ_PATH,
  MESSAGE_PATH,
] as const;

const sessionSecurity = [{ [SECURITY_SCHEME_NAME]: [] }];
const idParam = { $ref: "#/components/parameters/IdPathParam" };
const messageIdParam = {
  name: "messageId",
  in: "path" as const,
  required: true,
  schema: { type: "string" as const },
  description: "Message identifier",
};

const paginationParameters = [
  {
    name: "cursor",
    in: "query" as const,
    required: false,
    schema: { type: "string" as const },
    description: "Opaque cursor returned by the previous page",
  },
  {
    name: "limit",
    in: "query" as const,
    required: false,
    schema: {
      type: "integer" as const,
      minimum: 1,
      maximum: MAX_PAGE_LIMIT,
      default: DEFAULT_PAGE_LIMIT,
    },
    description: `Page size (default ${DEFAULT_PAGE_LIMIT}, max ${MAX_PAGE_LIMIT})`,
  },
];

const afterParameter = {
  name: "after",
  in: "query" as const,
  required: false,
  schema: { type: "string" as const },
  description: "Return messages created strictly after this message id (HTTP polling)",
};

const META_EXAMPLE = { limit: DEFAULT_PAGE_LIMIT, nextCursor: null, hasMore: false };
const CREATED_AT = "2026-11-23T18:00:00.000Z";

const PARTICIPANT = {
  id: "usr_456",
  name: "Tanvir Ahmed",
  image: null,
  role: "INVESTOR",
  verified: true,
  shopName: null,
  slug: null,
  category: null,
};

const MESSAGE = {
  id: "msg_123",
  conversationId: "con_123",
  senderId: "usr_456",
  mine: false,
  body: "Hello, I would like to know more about your shop.",
  readAt: null,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const CONVERSATION = {
  id: "con_123",
  participant: PARTICIPANT,
  lastMessage: MESSAGE,
  unreadCount: 1,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const MARK_READ = { conversationId: "con_123", markedRead: 1, unreadCount: 0 };

function body(name: string) {
  return {
    required: true,
    content: {
      "application/json": { schema: { $ref: `#/components/schemas/${name}` } },
    },
  };
}

function json<T>(schema: T, example: unknown) {
  return { "application/json": { schema, example } };
}

export function registerMessagingRoutes() {
  registry.registerPath({
    method: "get",
    path: CONVERSATIONS_PATH,
    operationId: "listConversations",
    tags: ["Messaging"],
    summary: "List conversations",
    description:
      "Paginated conversations for the session user. Only pairs with an accepted connection or an existing offer are listed; blocked pairs are excluded. Each entry includes a safe participant card, the latest visible message and an unread count.",
    security: sessionSecurity,
    parameters: paginationParameters,
    responses: {
      200: {
        description: "Conversation page",
        content: json(conversationListSuccessEnvelopeSchema, {
          data: [CONVERSATION],
          meta: META_EXAMPLE,
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
    },
  });

  registry.registerPath({
    method: "post",
    path: CONVERSATIONS_PATH,
    operationId: "createOrGetConversation",
    tags: ["Messaging"],
    summary: "Create or retrieve a conversation",
    description:
      "Requires an accepted connection or an existing offer with the target. Participant ids are canonicalized so a pair has exactly one conversation. Blocked users are rejected. Repeating the request returns the existing conversation.",
    security: sessionSecurity,
    requestBody: body("CreateConversationRequest"),
    responses: {
      201: {
        description: "Created or existing conversation",
        content: json(conversationSuccessEnvelopeSchema, { data: CONVERSATION }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
      422: STANDARD_ERROR_RESPONSES[422],
    },
  });

  registry.registerPath({
    method: "get",
    path: CONVERSATION_PATH,
    operationId: "getConversation",
    tags: ["Messaging"],
    summary: "Conversation detail",
    description:
      "Returns the conversation only if the session user participates, is not blocked and remains eligible via an accepted connection or an existing offer.",
    security: sessionSecurity,
    parameters: [idParam],
    responses: {
      200: {
        description: "Conversation detail",
        content: json(conversationSuccessEnvelopeSchema, { data: CONVERSATION }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "get",
    path: CONVERSATION_MESSAGES_PATH,
    operationId: "listMessages",
    tags: ["Messaging"],
    summary: "List messages in a conversation",
    description:
      "Oldest-first, cursor-paginated (default 20, max 50). Pass `?after=<messageId>` for chronological HTTP polling; omit both `after` and `cursor` for the first page. Messages deleted by the caller are omitted.",
    security: sessionSecurity,
    parameters: [idParam, afterParameter, ...paginationParameters],
    responses: {
      200: {
        description: "Message page",
        content: json(messageListSuccessEnvelopeSchema, {
          data: [MESSAGE],
          meta: META_EXAMPLE,
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "post",
    path: CONVERSATION_MESSAGES_PATH,
    operationId: "sendMessage",
    tags: ["Messaging"],
    summary: "Send a message",
    description:
      "The sender is always the session user. The body is sanitized plain text (max 5000 characters). Sending requires conversation membership and an accepted connection or an existing offer; blocked pairs are rejected. There are no WebSockets — poll `GET` with `?after=<messageId>`.",
    security: sessionSecurity,
    parameters: [idParam],
    requestBody: body("SendMessageRequest"),
    responses: {
      201: {
        description: "Message sent",
        content: json(messageSuccessEnvelopeSchema, { data: MESSAGE }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
      422: STANDARD_ERROR_RESPONSES[422],
    },
  });

  registry.registerPath({
    method: "post",
    path: CONVERSATION_READ_PATH,
    operationId: "markConversationRead",
    tags: ["Messaging"],
    summary: "Mark incoming messages as read",
    description:
      "Sets `readAt` on every live, unread message in the conversation sent by the other participant. Messages deleted by the caller are ignored. Returns the number marked and the remaining unread count.",
    security: sessionSecurity,
    parameters: [idParam],
    responses: {
      200: {
        description: "Read state updated",
        content: json(markReadResultSuccessEnvelopeSchema, { data: MARK_READ }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "get",
    path: MESSAGE_PATH,
    operationId: "getMessage",
    tags: ["Messaging"],
    summary: "Message detail",
    description:
      "Returns a message only to a participant of its conversation. Messages deleted by the caller or globally are not found.",
    security: sessionSecurity,
    parameters: [messageIdParam],
    responses: {
      200: {
        description: "Message detail",
        content: json(messageSuccessEnvelopeSchema, { data: MESSAGE }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "delete",
    path: MESSAGE_PATH,
    operationId: "deleteMessage",
    tags: ["Messaging"],
    summary: "Soft-delete a message for the caller",
    description:
      "Creates a `MessageDeletion` for the session user. The other participant still sees the message; no global `Message.deletedAt` is set. Deleting again is idempotent.",
    security: sessionSecurity,
    parameters: [messageIdParam],
    responses: {
      200: {
        description: "Message hidden for the caller",
        content: json(deleteResultSuccessEnvelopeSchema, {
          data: { id: "msg_123", deleted: true },
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });
}
