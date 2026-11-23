import "@/server/openapi/setup";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/pagination";
import { SECURITY_SCHEME_NAME } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import {
  STANDARD_ERROR_RESPONSES,
  commentListSuccessEnvelopeSchema,
  commentSuccessEnvelopeSchema,
  connectionListSuccessEnvelopeSchema,
  connectionSuccessEnvelopeSchema,
  deleteResultSuccessEnvelopeSchema,
  followRecordListSuccessEnvelopeSchema,
  followRecordSuccessEnvelopeSchema,
  followResultSuccessEnvelopeSchema,
  likeResultSuccessEnvelopeSchema,
  postListSuccessEnvelopeSchema,
  postSuccessEnvelopeSchema,
} from "@/server/openapi/schemas";

export const FEED_PATH = "/api/v1/feed";
export const POSTS_PATH = "/api/v1/posts";
export const POST_PATH = `${POSTS_PATH}/{id}`;
export const POST_LIKE_PATH = `${POST_PATH}/like`;
export const POST_COMMENTS_PATH = `${POST_PATH}/comments`;
export const POST_COMMENT_PATH = `${POST_COMMENTS_PATH}/{commentId}`;
export const CONNECTIONS_PATH = "/api/v1/connections";
export const CONNECTION_PATH = `${CONNECTIONS_PATH}/{id}`;
export const CONNECTION_ACCEPT_PATH = `${CONNECTION_PATH}/accept`;
export const CONNECTION_DECLINE_PATH = `${CONNECTION_PATH}/decline`;
export const FOLLOWS_PATH = "/api/v1/follows";
export const FOLLOW_PATH = `${FOLLOWS_PATH}/{userId}`;
export const FOLLOWERS_PATH = "/api/v1/me/followers";
export const FOLLOWING_PATH = "/api/v1/me/following";

export const SOCIAL_PATHS = [
  FEED_PATH,
  POSTS_PATH,
  POST_PATH,
  POST_LIKE_PATH,
  POST_COMMENTS_PATH,
  POST_COMMENT_PATH,
  CONNECTIONS_PATH,
  CONNECTION_ACCEPT_PATH,
  CONNECTION_DECLINE_PATH,
  CONNECTION_PATH,
  FOLLOWS_PATH,
  FOLLOW_PATH,
  FOLLOWERS_PATH,
  FOLLOWING_PATH,
] as const;

const sessionSecurity = [{ [SECURITY_SCHEME_NAME]: [] }];
const optionalSessionSecurity: Array<Record<string, string[]>> = [
  { [SECURITY_SCHEME_NAME]: [] },
  {},
];
const idParam = { $ref: "#/components/parameters/IdPathParam" };

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

const META_EXAMPLE = { limit: DEFAULT_PAGE_LIMIT, nextCursor: null, hasMore: false };

const AUTHOR = {
  name: "Nusrat Akter",
  image: "/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg",
  role: "OWNER",
  verified: true,
  shopName: "Nusrat's Home Kitchen",
  slug: "nusrat-home-kitchen",
  category: "Food",
};

const POST = {
  id: "post_123",
  type: "UPDATE",
  content: "Fresh cookies fresh out of the oven today!",
  imageUrls: ["/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg"],
  author: AUTHOR,
  likeCount: 4,
  commentCount: 2,
  likedByMe: false,
  loanRequest: null,
  createdAt: "2026-11-23T18:00:00.000Z",
  updatedAt: "2026-11-23T18:00:00.000Z",
};

const COMMENT = {
  id: "cmt_123",
  postId: "post_123",
  content: "Congratulations on the new oven!",
  author: AUTHOR,
  createdAt: "2026-11-23T18:05:00.000Z",
  updatedAt: "2026-11-23T18:05:00.000Z",
};

const CONNECTION = {
  id: "con_123",
  user: AUTHOR,
  direction: "incoming",
  status: "PENDING",
  message: "I would like to know more about your shop.",
  createdAt: "2026-11-23T18:00:00.000Z",
  updatedAt: "2026-11-23T18:00:00.000Z",
};

const FOLLOW = { userId: "usr_123", user: AUTHOR, following: true };

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

export function registerSocialRoutes() {
  registry.registerPath({
    method: "get",
    path: FEED_PATH,
    operationId: "getFeed",
    tags: ["Feed and networking"],
    summary: "Personalized feed",
    description:
      "Posts from the actor, followed users and accepted connections plus recent OPEN loan-request posts, newest first. Cursor-paginated (default 20, max 50). Every entry includes an author mini-profile, verified badge, like/comment counts and `likedByMe`.",
    security: sessionSecurity,
    parameters: [
      {
        name: "type",
        in: "query",
        required: false,
        schema: { $ref: "#/components/schemas/PostType" },
      },
      ...paginationParameters,
    ],
    responses: {
      200: { description: "Feed page", content: json(postListSuccessEnvelopeSchema, { data: [POST], meta: META_EXAMPLE }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
    },
  });

  registry.registerPath({
    method: "get",
    path: POSTS_PATH,
    operationId: "listPosts",
    tags: ["Feed and networking"],
    summary: "Public recent posts",
    description:
      "Newest-first sanitized posts. Anonymous callers see `likedByMe: false`. Cursor-paginated (default 20, max 50).",
    security: optionalSessionSecurity,
    parameters: [
      {
        name: "type",
        in: "query",
        required: false,
        schema: { $ref: "#/components/schemas/PostType" },
      },
      ...paginationParameters,
    ],
    responses: {
      200: { description: "Post page", content: json(postListSuccessEnvelopeSchema, { data: [POST], meta: META_EXAMPLE }) },
      400: STANDARD_ERROR_RESPONSES[400],
    },
  });

  registry.registerPath({
    method: "post",
    path: POSTS_PATH,
    operationId: "createPost",
    tags: ["Feed and networking"],
    summary: "Create an UPDATE or MILESTONE post",
    description:
      "The author is taken from the session. LOAN_REQUEST and REPAYMENT posts are system-owned and cannot be created here. Up to 10 HTTP(S) image URLs are accepted.",
    security: sessionSecurity,
    requestBody: body("CreatePostRequest"),
    responses: {
      201: { description: "Post created", content: json(postSuccessEnvelopeSchema, { data: POST }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
    },
  });

  registry.registerPath({
    method: "get",
    path: POST_PATH,
    operationId: "getPost",
    tags: ["Feed and networking"],
    summary: "Get post details",
    description: "Returns one non-deleted post with counts and a safe author card.",
    security: optionalSessionSecurity,
    parameters: [idParam],
    responses: {
      200: { description: "Post detail", content: json(postSuccessEnvelopeSchema, { data: POST }) },
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "patch",
    path: POST_PATH,
    operationId: "updatePost",
    tags: ["Feed and networking"],
    summary: "Edit own post",
    description: "Only the author may edit a user-created post. System-generated posts are protected.",
    security: sessionSecurity,
    parameters: [idParam],
    requestBody: body("UpdatePostRequest"),
    responses: {
      200: { description: "Post updated", content: json(postSuccessEnvelopeSchema, { data: POST }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "delete",
    path: POST_PATH,
    operationId: "deletePost",
    tags: ["Feed and networking"],
    summary: "Soft-delete own post",
    description: "Marks the post and all of its live comments deleted. System-generated posts are protected.",
    security: sessionSecurity,
    parameters: [idParam],
    responses: {
      200: { description: "Post deleted", content: json(deleteResultSuccessEnvelopeSchema, { data: { id: "post_123", deleted: true } }) },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "post",
    path: POST_LIKE_PATH,
    operationId: "likePost",
    tags: ["Feed and networking"],
    summary: "Like a post",
    description: "Idempotence is enforced with a 409 conflict on duplicate likes.",
    security: sessionSecurity,
    parameters: [idParam],
    responses: {
      200: { description: "Like result", content: json(likeResultSuccessEnvelopeSchema, { data: { postId: "post_123", liked: true, likeCount: 5 } }) },
      401: STANDARD_ERROR_RESPONSES[401],
      404: STANDARD_ERROR_RESPONSES[404],
      409: STANDARD_ERROR_RESPONSES[409],
    },
  });

  registry.registerPath({
    method: "delete",
    path: POST_LIKE_PATH,
    operationId: "unlikePost",
    tags: ["Feed and networking"],
    summary: "Unlike a post",
    description: "Removes the actor's like. Returns 404 if no like exists.",
    security: sessionSecurity,
    parameters: [idParam],
    responses: {
      200: { description: "Like result", content: json(likeResultSuccessEnvelopeSchema, { data: { postId: "post_123", liked: false, likeCount: 4 } }) },
      401: STANDARD_ERROR_RESPONSES[401],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "get",
    path: POST_COMMENTS_PATH,
    operationId: "listComments",
    tags: ["Feed and networking"],
    summary: "List post comments",
    description: "Oldest-first, cursor-paginated (default 20, max 50). Soft-deleted comments are omitted.",
    security: optionalSessionSecurity,
    parameters: [idParam, ...paginationParameters],
    responses: {
      200: { description: "Comment page", content: json(commentListSuccessEnvelopeSchema, { data: [COMMENT], meta: META_EXAMPLE }) },
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "post",
    path: POST_COMMENTS_PATH,
    operationId: "createComment",
    tags: ["Feed and networking"],
    summary: "Comment on a post",
    description: "The author is taken from the session; a client-supplied author id is rejected.",
    security: sessionSecurity,
    parameters: [idParam],
    requestBody: body("CreateCommentRequest"),
    responses: {
      201: { description: "Comment created", content: json(commentSuccessEnvelopeSchema, { data: COMMENT }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "patch",
    path: POST_COMMENT_PATH,
    operationId: "updateComment",
    tags: ["Feed and networking"],
    summary: "Edit own comment",
    description: "Only the comment author may edit their own comment.",
    security: sessionSecurity,
    parameters: [idParam, { name: "commentId", in: "path", required: true, schema: { type: "string" } }],
    requestBody: body("UpdateCommentRequest"),
    responses: {
      200: { description: "Comment updated", content: json(commentSuccessEnvelopeSchema, { data: COMMENT }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "delete",
    path: POST_COMMENT_PATH,
    operationId: "deleteComment",
    tags: ["Feed and networking"],
    summary: "Soft-delete own comment",
    description: "Only the comment author may delete their own comment.",
    security: sessionSecurity,
    parameters: [idParam, { name: "commentId", in: "path", required: true, schema: { type: "string" } }],
    responses: {
      200: { description: "Comment deleted", content: json(deleteResultSuccessEnvelopeSchema, { data: { id: "cmt_123", deleted: true } }) },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "get",
    path: CONNECTIONS_PATH,
    operationId: "listConnections",
    tags: ["Feed and networking"],
    summary: "List connections",
    description: "Incoming, outgoing or all connections with optional status filter. Cursor-paginated (default 20, max 50).",
    security: sessionSecurity,
    parameters: [
      { name: "direction", in: "query", required: false, schema: { type: "string", enum: ["incoming", "outgoing", "all"], default: "all" } },
      { name: "status", in: "query", required: false, schema: { $ref: "#/components/schemas/ConnectionStatus" } },
      ...paginationParameters,
    ],
    responses: {
      200: { description: "Connection page", content: json(connectionListSuccessEnvelopeSchema, { data: [CONNECTION], meta: META_EXAMPLE }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
    },
  });

  registry.registerPath({
    method: "post",
    path: CONNECTIONS_PATH,
    operationId: "sendConnectionRequest",
    tags: ["Feed and networking"],
    summary: "Send a connection request",
    description: "Creates PENDING → intended recipient only. Self-connections and duplicates are rejected.",
    security: sessionSecurity,
    requestBody: body("SendConnectionRequestRequest"),
    responses: {
      201: { description: "Request created", content: json(connectionSuccessEnvelopeSchema, { data: CONNECTION }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      409: STANDARD_ERROR_RESPONSES[409],
      422: STANDARD_ERROR_RESPONSES[422],
    },
  });

  for (const [path, operationId, status, summary] of [
    [CONNECTION_ACCEPT_PATH, "acceptConnection", "ACCEPTED", "Accept an incoming connection request"],
    [CONNECTION_DECLINE_PATH, "declineConnection", "DECLINED", "Decline an incoming connection request"],
  ] as const) {
    registry.registerPath({
      method: "post",
      path,
      operationId,
      tags: ["Feed and networking"],
      summary,
      description: "PENDING → " + status + ". Only the addressee may respond; other states conflict.",
      security: sessionSecurity,
      parameters: [idParam],
      responses: {
        200: { description: "Updated connection", content: json(connectionSuccessEnvelopeSchema, { data: { ...CONNECTION, status } }) },
        401: STANDARD_ERROR_RESPONSES[401],
        403: STANDARD_ERROR_RESPONSES[403],
        404: STANDARD_ERROR_RESPONSES[404],
        409: STANDARD_ERROR_RESPONSES[409],
      },
    });
  }

  registry.registerPath({
    method: "delete",
    path: CONNECTION_PATH,
    operationId: "removeConnection",
    tags: ["Feed and networking"],
    summary: "Cancel or remove a connection",
    description: "Cancels a PENDING outgoing request or removes an ACCEPTED connection. DECLINED records cannot be modified.",
    security: sessionSecurity,
    parameters: [idParam],
    responses: {
      200: { description: "Removed connection", content: json(connectionSuccessEnvelopeSchema, { data: CONNECTION }) },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
      409: STANDARD_ERROR_RESPONSES[409],
    },
  });

  registry.registerPath({
    method: "post",
    path: FOLLOWS_PATH,
    operationId: "followUser",
    tags: ["Feed and networking"],
    summary: "Follow a user",
    description: "Targets must be active, non-admin users. Self-follows and duplicates are rejected.",
    security: sessionSecurity,
    requestBody: body("FollowUserRequest"),
    responses: {
      201: { description: "Follow created", content: json(followRecordSuccessEnvelopeSchema, { data: FOLLOW }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      409: STANDARD_ERROR_RESPONSES[409],
      422: STANDARD_ERROR_RESPONSES[422],
    },
  });

  registry.registerPath({
    method: "delete",
    path: FOLLOW_PATH,
    operationId: "unfollowUser",
    tags: ["Feed and networking"],
    summary: "Unfollow a user",
    description: "Removes only the actor's own follow relationship.",
    security: sessionSecurity,
    parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
    responses: {
      200: { description: "Unfollow result", content: json(followResultSuccessEnvelopeSchema, { data: { userId: "usr_123", following: false } }) },
      401: STANDARD_ERROR_RESPONSES[401],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  for (const [path, operationId, summary] of [
    [FOLLOWERS_PATH, "listFollowers", "List the actor's followers"],
    [FOLLOWING_PATH, "listFollowing", "List users the actor follows"],
  ] as const) {
    registry.registerPath({
      method: "get",
      path,
      operationId,
      tags: ["Feed and networking"],
      summary,
      description: "Cursor-paginated (default 20, max 50) with a safe public user card.",
      security: sessionSecurity,
      parameters: paginationParameters,
      responses: {
        200: { description: "Follow page", content: json(followRecordListSuccessEnvelopeSchema, { data: [FOLLOW], meta: META_EXAMPLE }) },
        400: STANDARD_ERROR_RESPONSES[400],
        401: STANDARD_ERROR_RESPONSES[401],
      },
    });
  }
}
