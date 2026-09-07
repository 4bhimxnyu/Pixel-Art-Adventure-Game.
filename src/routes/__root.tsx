import { Outlet } from "@tanstack/react-router";

export function RootShell() {
  return (
    <div className="h-full w-full bg-[#0a0507] text-[#f7e6c8]">
      <Outlet />
    </div>
  );
}
