import { NextResponse } from "next/server"
import { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  return NextResponse.next()
}

// No protected routes
export const config = {
  matcher: []
}