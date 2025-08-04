import * as React from 'react';
import { useLocation, Link } from 'react-router-dom';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Bus } from 'lucide-react';

const data = {
  navMain: [
    {
      title: 'Zuweisungen',
      url: '#',
      items: [
        {
          title: 'Wochenplanung',
          url: '/assignments/week',
        },
        {
          title: 'Tagesplanung',
          url: '/assignments/day',
        },
      ],
    },
    {
      title: 'Stammdaten',
      url: '#',
      items: [
        {
          title: 'Linien',
          url: '/lines',
        },
        {
          title: 'Busse',
          url: '/busses',
        },
        {
          title: 'Fahrer',
          url: '/drivers',
        },
      ],
    },
    {
      title: 'Einstellungen',
      url: '#',
      items: [
        {
          title: 'Datenstand',
          url: '/settings/data',
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Bus className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">Bus Planer</span>
                  <span className="">v1.0.0</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map(item => {
              // Check if any child item is active to highlight parent
              const isParentActive = item.items?.some(subItem =>
                currentPath.startsWith(subItem.url)
              );

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isParentActive}>
                    <Link to={item.url} className="font-medium">
                      {item.title}
                    </Link>
                  </SidebarMenuButton>
                  {item.items?.length ? (
                    <SidebarMenuSub>
                      {item.items.map(subItem => {
                        // Check if this item or its children are active
                        const isActive =
                          currentPath === subItem.url ||
                          (subItem.url !== '/' &&
                            currentPath.startsWith(subItem.url));

                        return (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild isActive={isActive}>
                              <Link to={subItem.url}>{subItem.title}</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
