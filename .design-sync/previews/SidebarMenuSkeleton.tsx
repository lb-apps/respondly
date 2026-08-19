import { SidebarMenu, SidebarMenuItem, SidebarMenuSkeleton, SidebarProvider } from "respondly";

export const Loading = () => (
  <SidebarProvider>
    <div className="w-56">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  </SidebarProvider>
);
