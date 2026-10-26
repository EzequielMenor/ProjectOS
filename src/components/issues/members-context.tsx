"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { MemberDTO } from "@/server/dto";

const MembersContext = createContext<MemberDTO[]>([]);

/** Lets rows and cards show the assignee without threading the member list through every view. */
export function MembersProvider({ members, children }: { members: MemberDTO[]; children: ReactNode }) {
  return <MembersContext value={members}>{children}</MembersContext>;
}

export const useMembers = () => useContext(MembersContext);

export function useMemberById() {
  const members = useMembers();
  return useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
}
