import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

// GET  /api/notifications  → the current user's recent notifications + unread count.
//                            Does NOT mark them read (the bell decides when).
export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notification.count({ where: { userId: authUser.id, readAt: null } }),
  ]);

  return NextResponse.json({
    unreadCount,
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

// POST /api/notifications  → mark the current user's notifications read.
// Body `{ id }` marks just that one (banner dismiss); no body marks all (bell).
export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let id: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.id === "string") id = body.id;
  } catch {
    // No JSON body → mark all read.
  }

  await prisma.notification.updateMany({
    // Always scoped to this user, so an id can only clear one's own notification.
    where: { userId: authUser.id, readAt: null, ...(id ? { id } : {}) },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

// DELETE /api/notifications  → remove the current user's notifications for good.
// Body `{ id }` removes just that one; no id removes all of them.
//
// Distinct from POST: marking read only clears the unread badge, the entries
// stay in the list. This is the "clear" the bell's bin icon performs.
export async function DELETE(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let id: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.id === "string") id = body.id;
  } catch {
    // No JSON body → clear all.
  }

  // Scoped to this user, so an id can never reach someone else's notification;
  // a wrong id simply deletes nothing.
  const { count } = await prisma.notification.deleteMany({
    where: { userId: authUser.id, ...(id ? { id } : {}) },
  });
  return NextResponse.json({ ok: true, deleted: count });
}
