import {
    Calendar,
    Database,
    DatabaseZap,
    Globe,
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
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "@tanstack/react-router";
import { CheckForUpdate } from "./check-for-updates";

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
    {
        title: "Durable Objects",
        href: "/durable-objects",
        identifier: "durable-objects",
        icon: Globe,
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
                                            location.pathname === item.href
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
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <CheckForUpdate />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
