import {
    Calendar,
    Database,
    DatabaseZap,
    Home,
    Inbox,
    Key,
    LayoutDashboard,
    Search,
    Settings,
} from "lucide-react";

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "@tanstack/react-router";

// Menu items.
const items = [
    {
        title: "Dashboard",
        href: "/",
        identifier: "dashboard",
        icon: LayoutDashboard,
    },
    // {
    //     title: "Requests",
    //     identifier: "requests",
    //     icon: Inbox,
    // },
    {
        title: "D1",
        href: "/d1",
        identifier: "d1",
        icon: Database,
    },
    {
        title: "KV",
        href: "/kv",
        identifier: "kv",
        icon: Key,
    },
];

export function AppSidebar() {
    const location = useLocation()

    return (
        <Sidebar variant="inset">
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>wrkrscope</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.identifier}>
                                    <SidebarMenuButton
                                        asChild
                                        className={
                                            location.pathname === `/${item.href}`
                                                ? "bg-orange-600 text-primary-foreground hover:bg-orange-600/90 hover:text-primary-foreground"
                                                : ""
                                        }
                                    >
                                        <Link to={`${item.href}` as any}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}
