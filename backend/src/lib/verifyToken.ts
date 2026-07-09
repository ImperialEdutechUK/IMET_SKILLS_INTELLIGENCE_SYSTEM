import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.AUTH_SECRET as string;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  departmentId: string | null;
}

export function verifyToken(req: Request): AuthUser | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    return payload;
  } catch {
    return null;
  }
}
